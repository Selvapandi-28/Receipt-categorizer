/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useState, useEffect } from 'react';

const CurrencyContext = createContext();

export const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  AED: 'AED'
};

export const CURRENCY_NAMES = {
  INR: 'Indian Rupee',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  AED: 'UAE Dirham'
};

const CURRENCY_LOCALE = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU',
  AED: 'en-AE'
};

export const EXCHANGE_RATES = {
  USD: 1.0,
  INR: 83.50,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 155.0,
  CAD: 1.36,
  AUD: 1.50,
  AED: 3.67
};

export function CurrencyProvider({ children }) {
  const [baseCurrency, setBaseCurrency] = useState(() => {
    return localStorage.getItem('expense_base_currency') || 'INR';
  });

  const [rates, setRates] = useState(EXCHANGE_RATES);

  // Fetch mock exchange rates from server
  useEffect(() => {
    fetch('/api/exchange-rates')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch exchange rates');
      })
      .then((data) => {
        if (data && data.rates) {
          setRates(data.rates);
        }
      })
      .catch((err) => {
        console.warn('Using client-side fallback mock exchange rates:', err);
      });
  }, []);

  const changeBaseCurrency = (newCurrency) => {
    if (CURRENCY_SYMBOLS[newCurrency]) {
      setBaseCurrency(newCurrency);
      localStorage.setItem('expense_base_currency', newCurrency);
    }
  };

  const convertAmount = (amount, fromCurr, toCurr) => {
    const from = fromCurr || 'INR';
    const to = toCurr || baseCurrency;
    
    if (from === to) return Number(amount);
    
    const fromRate = rates[from] || EXCHANGE_RATES[from] || 1.0;
    const toRate = rates[to] || EXCHANGE_RATES[to] || 1.0;
    
    const amountInUSD = Number(amount) / fromRate;
    return Number((amountInUSD * toRate).toFixed(2));
  };

  const formatPrice = (amount, currencyCode = baseCurrency) => {
    const symbol = CURRENCY_SYMBOLS[currencyCode] || '$';
    const locale = CURRENCY_LOCALE[currencyCode] || 'en-US';
    const spacing = ' ';
    try {
      return symbol + spacing + Number(amount).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } catch (e) {
      return symbol + spacing + Number(amount).toFixed(2);
    }
  };

  const getSymbol = (currencyCode = baseCurrency) => {
    return CURRENCY_SYMBOLS[currencyCode] || '$';
  };

  return (
    <CurrencyContext.Provider value={{
      baseCurrency,
      changeBaseCurrency,
      rates,
      convertAmount,
      formatPrice,
      getSymbol,
      CURRENCY_SYMBOLS,
      CURRENCY_NAMES
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
