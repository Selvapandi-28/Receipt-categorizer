/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sparkles, Plus, Wallet, X, ListPlus, Receipt, RefreshCw, Layers, Palette, WifiOff, CloudUpload, CloudOff, CheckCircle2, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EXPENSE_CATEGORIES } from './types';
import ReceiptScanner from './components/ReceiptScanner';
import Dashboard from './components/Dashboard';
import ExpenseList from './components/ExpenseList';
import ExpenseDetailModal from './components/ExpenseDetailModal';
import ReceiptConfirmationModal from './components/ReceiptConfirmationModal';
import MagicCursor from './components/MagicCursor';
import Auth from './components/Auth';
import { useTheme, THEMES } from './theme.jsx';
import { useCurrency } from './currency.jsx';

export default function App() {
  const { currentTheme, theme, setTheme } = useTheme();
  const { baseCurrency, changeBaseCurrency, CURRENCY_SYMBOLS, CURRENCY_NAMES, convertAmount } = useCurrency();
  const currencies = Object.keys(CURRENCY_SYMBOLS || {});
  
  // User Authentication State
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('active_user_session') || null);
  
  const [expenses, setExpenses] = useState([]);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [budgetLimits, setBudgetLimits] = useState(null);
  const [pendingAnalysis, setPendingAnalysis] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Calculate pending local cache uploads count
  const getPendingSyncCount = () => {
    if (!currentUser) return 0;
    const offlineExpensesKey = `offline_manual_expenses_${currentUser}`;
    const pendingBudgetKey = `pending_budget_limit_update_${currentUser}`;
    const manualQueue = JSON.parse(localStorage.getItem(offlineExpensesKey) || '[]');
    const hasPendingBudget = !!localStorage.getItem(pendingBudgetKey);
    const pendingExpenseObjects = expenses.filter(e => e.isOfflinePending).length;
    return Math.max(manualQueue.length, pendingExpenseObjects) + (hasPendingBudget ? 1 : 0);
  };
  const pendingSyncCount = getPendingSyncCount();

  // Manual Form States
  const [manualVendor, setManualVendor] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualCategory, setManualCategory] = useState('Shopping');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCurrency, setManualCurrency] = useState('INR');

  // User-scoped cache helpers
  const getCachedExpenses = () => {
    return currentUser ? localStorage.getItem(`cached_expenses_${currentUser}`) : null;
  };
  const setCachedExpenses = (data) => {
    if (currentUser) {
      localStorage.setItem(`cached_expenses_${currentUser}`, typeof data === 'string' ? data : JSON.stringify(data));
    }
  };
  const getCachedBudgetLimits = () => {
    return currentUser ? localStorage.getItem(`cached_budget_limits_${currentUser}`) : null;
  };
  const setCachedBudgetLimits = (data) => {
    if (currentUser) {
      localStorage.setItem(`cached_budget_limits_${currentUser}`, typeof data === 'string' ? data : JSON.stringify(data));
    }
  };

  // Helper for requests
  const getHeaders = (extraHeaders = {}) => {
    const headers = { ...extraHeaders };
    if (currentUser) {
      headers['X-Username'] = currentUser;
    }
    return headers;
  };

  const apiFetch = async (url, options = {}) => {
    try {
      const response = await fetch(url, options);
      if (response.status === 401) {
        if (!url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
          console.warn('[Session Monitor] Received 401 response. Session has expired or is invalid. Logging out.');
          handleLogout();
        }
      }
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    if (isManualFormOpen) {
      setManualCurrency(baseCurrency);
    }
  }, [isManualFormOpen, baseCurrency]);

  // 1. Fetch Expenses on Mount with Cache Fallback
  const fetchExpenses = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setIsSyncing(true);
    try {
      const res = await apiFetch('/api/expenses', {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        setCachedExpenses(data);
        setLastSyncedTime(new Date());
      } else if (res.status === 401) {
        // Session expired / invalid on server, apiFetch already logs out. Avoid throwing / logging loud errors.
        return;
      } else {
        throw new Error(`Server returned status code ${res.status}`);
      }
    } catch (err) {
      console.warn('Non-critical: Error fetching expenses, falling back to local cache:', err.message || err);
      const cached = getCachedExpenses();
      if (cached) {
        try {
          setExpenses(JSON.parse(cached));
        } catch (parseErr) {
          console.warn('Failed to parse cached expenses:', parseErr);
        }
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  const fetchBudgetLimits = async () => {
    if (!currentUser) return;
    try {
      const res = await apiFetch('/api/budget-limits', {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setBudgetLimits(data);
        setCachedBudgetLimits(data);
      } else if (res.status === 401) {
        // Session expired / invalid on server, apiFetch already logs out. Avoid throwing / logging loud errors.
        return;
      } else {
        throw new Error(`Server returned status code ${res.status}`);
      }
    } catch (err) {
      console.warn('Non-critical: Error fetching budget limits, falling back to local cache:', err.message || err);
      const cached = getCachedBudgetLimits();
      if (cached) {
        try {
          setBudgetLimits(JSON.parse(cached));
        } catch (parseErr) {
          console.warn('Failed to parse cached budget limits:', parseErr);
        }
      }
    }
  };

  const handleUpdateBudgetLimits = async (updated) => {
    if (!currentUser) return;
    // Save locally first to be responsive and optimistic
    setCachedBudgetLimits(updated);
    setBudgetLimits(updated);

    const pendingKey = `pending_budget_limit_update_${currentUser}`;

    if (!navigator.onLine) {
      localStorage.setItem(pendingKey, JSON.stringify(updated));
      return;
    }

    try {
      const res = await apiFetch('/api/budget-limits', {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json();
        setBudgetLimits(data);
        setCachedBudgetLimits(data);
        localStorage.removeItem(pendingKey);
      } else {
        localStorage.setItem(pendingKey, JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Error updating budget limits on server:', err);
      localStorage.setItem(pendingKey, JSON.stringify(updated));
    }
  };

  // Sync Offline Created Manual Expenses and Limits once Reconnected
  const syncOfflineData = async () => {
    if (!navigator.onLine || !currentUser) return;

    setIsSyncing(true);
    try {
      const offlineExpensesKey = `offline_manual_expenses_${currentUser}`;
      const pendingBudgetKey = `pending_budget_limit_update_${currentUser}`;

      // 1. Sync manual offline expenses queue
      const manualQueue = JSON.parse(localStorage.getItem(offlineExpensesKey) || '[]');
      if (manualQueue.length > 0) {
        console.log(`Syncing ${manualQueue.length} offline manual transactions...`);
        const remainingQueue = [];

        for (const item of manualQueue) {
          try {
            const res = await apiFetch('/api/expenses', {
              method: 'POST',
              headers: getHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify(item.payload),
            });

            if (!res.ok) {
              remainingQueue.push(item);
            }
          } catch (err) {
            console.warn('Failed to sync offline expense, keeping in queue:', err);
            remainingQueue.push(item);
          }
        }

        localStorage.setItem(offlineExpensesKey, JSON.stringify(remainingQueue));
      }

      // 2. Sync pending budget limit update
      const pendingBudget = localStorage.getItem(pendingBudgetKey);
      if (pendingBudget) {
        try {
          const parsed = JSON.parse(pendingBudget);
          const res = await apiFetch('/api/budget-limits', {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(parsed),
          });
          if (res.ok) {
            localStorage.removeItem(pendingBudgetKey);
          }
        } catch (err) {
          console.warn('Failed to sync pending budget limits:', err);
        }
      }

      // Refresh everything
      await fetchExpenses();
      await fetchBudgetLimits();
      setLastSyncedTime(new Date());
    } catch (error) {
      console.warn('Error during offline data sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Multi-user initial data fetcher & cache switcher
  useEffect(() => {
    if (!currentUser) return;

    // Load caches immediately for instantaneous layout render
    const cachedExp = getCachedExpenses();
    if (cachedExp) {
      try {
        setExpenses(JSON.parse(cachedExp));
      } catch (e) {
        console.error(e);
      }
    } else {
      setExpenses([]);
    }

    const cachedBudget = getCachedBudgetLimits();
    if (cachedBudget) {
      try {
        setBudgetLimits(JSON.parse(cachedBudget));
      } catch (e) {
        console.error(e);
      }
    } else {
      setBudgetLimits(null);
    }

    fetchExpenses();
    fetchBudgetLimits();

    if (navigator.onLine) {
      syncOfflineData();
    }
  }, [currentUser]);

  // Online status listner
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (currentUser) {
        syncOfflineData();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser]);



  // 2. Handle AI Receipt Analysis Completion
  const handleAnalysisComplete = async (result, base64Image) => {
    // Stage the analysis results for user confirmation instead of saving automatically
    setPendingAnalysis({ result, base64Image });
  };

  // 2.5 Handle Verified Scanned Receipt Confirmation & Saving
  const handleConfirmAnalysis = async (confirmedData, base64Image) => {
    if (!currentUser) return;
    const payload = {
      vendor: confirmedData.vendor,
      amount: confirmedData.amount,
      date: confirmedData.date,
      category: confirmedData.category,
      description: confirmedData.description,
      items: confirmedData.items,
      imageUrl: base64Image,
    };

    const offlineExpensesKey = `offline_manual_expenses_${currentUser}`;

    if (!isOnline) {
      const offlineId = `offline-${Date.now()}`;
      const offlineExpense = {
        id: offlineId,
        ...payload,
        isOfflinePending: true,
      };

      const updatedExpenses = [offlineExpense, ...expenses];
      setExpenses(updatedExpenses);
      setCachedExpenses(updatedExpenses);

      const existingQueue = JSON.parse(localStorage.getItem(offlineExpensesKey) || '[]');
      existingQueue.push({ offlineId, payload });
      localStorage.setItem(offlineExpensesKey, JSON.stringify(existingQueue));

      setPendingAnalysis(null);
      return;
    }

    try {
      const res = await apiFetch('/api/expenses', {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newExpense = await res.json();
        const updatedExpenses = [newExpense, ...expenses];
        setExpenses(updatedExpenses);
        setCachedExpenses(updatedExpenses);
        setPendingAnalysis(null);
      } else {
        const err = await res.json();
        alert(`Error saving scanned receipt: ${err.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.warn('Network failure saving scanned receipt, queueing offline:', error);
      const offlineId = `offline-${Date.now()}`;
      const offlineExpense = {
        id: offlineId,
        ...payload,
        isOfflinePending: true,
      };

      const updatedExpenses = [offlineExpense, ...expenses];
      setExpenses(updatedExpenses);
      setCachedExpenses(updatedExpenses);

      const existingQueue = JSON.parse(localStorage.getItem(offlineExpensesKey) || '[]');
      existingQueue.push({ offlineId, payload });
      localStorage.setItem(offlineExpensesKey, JSON.stringify(existingQueue));

      setPendingAnalysis(null);
    }
  };

  // 3. Handle Manual Expense Insertion (Resilient Offline Fallback)
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!manualVendor.trim() || !manualAmount || !manualDate) {
      alert('Please fill out all required fields.');
      return;
    }

    const payload = {
      vendor: manualVendor,
      amount: convertAmount(Number(manualAmount), manualCurrency, 'INR'),
      date: manualDate,
      category: manualCategory,
      description: manualDescription,
      items: [], // empty items for manual add
      originalAmount: Number(manualAmount),
      originalCurrency: manualCurrency,
    };

    const offlineExpensesKey = `offline_manual_expenses_${currentUser}`;

    if (!isOnline) {
      const offlineId = `offline-${Date.now()}`;
      const offlineExpense = {
        id: offlineId,
        ...payload,
        isOfflinePending: true,
      };

      const updatedExpenses = [offlineExpense, ...expenses];
      setExpenses(updatedExpenses);
      setCachedExpenses(updatedExpenses);

      const existingQueue = JSON.parse(localStorage.getItem(offlineExpensesKey) || '[]');
      existingQueue.push({ offlineId, payload });
      localStorage.setItem(offlineExpensesKey, JSON.stringify(existingQueue));

      // Reset manual form state
      setManualVendor('');
      setManualAmount('');
      setManualDate(new Date().toISOString().split('T')[0]);
      setManualCategory('Shopping');
      setManualDescription('');
      setIsManualFormOpen(false);
      return;
    }

    try {
      const res = await apiFetch('/api/expenses', {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newExpense = await res.json();
        const updatedExpenses = [newExpense, ...expenses.filter(item => !item.isOfflinePending)];
        setExpenses(updatedExpenses);
        setCachedExpenses(updatedExpenses);
        
        // Reset manual form state
        setManualVendor('');
        setManualAmount('');
        setManualDate(new Date().toISOString().split('T')[0]);
        setManualCategory('Shopping');
        setManualDescription('');
        setIsManualFormOpen(false);
      } else {
        const err = await res.json();
        alert(`Failed to add manual expense: ${err.error}`);
      }
    } catch (error) {
      console.warn('Manual insert request failed due to network, caching locally:', error);
      const offlineId = `offline-${Date.now()}`;
      const offlineExpense = {
        id: offlineId,
        ...payload,
        isOfflinePending: true,
      };

      const updatedExpenses = [offlineExpense, ...expenses];
      setExpenses(updatedExpenses);
      setCachedExpenses(updatedExpenses);

      const existingQueue = JSON.parse(localStorage.getItem(offlineExpensesKey) || '[]');
      existingQueue.push({ offlineId, payload });
      localStorage.setItem(offlineExpensesKey, JSON.stringify(existingQueue));

      // Reset manual form state
      setManualVendor('');
      setManualAmount('');
      setManualDate(new Date().toISOString().split('T')[0]);
      setManualCategory('Shopping');
      setManualDescription('');
      setIsManualFormOpen(false);
    }
  };

  // 4. Update an Expense (Save edits)
  const handleUpdateExpense = async (id, updatedFields) => {
    if (!currentUser) return;
    const offlineExpensesKey = `offline_manual_expenses_${currentUser}`;

    if (typeof id === 'string' && id.startsWith('offline-')) {
      const updatedExpenses = expenses.map((exp) => {
        if (exp.id === id) {
          return { ...exp, ...updatedFields };
        }
        return exp;
      });
      setExpenses(updatedExpenses);
      setCachedExpenses(updatedExpenses);

      const queue = JSON.parse(localStorage.getItem(offlineExpensesKey) || '[]');
      const updatedQueue = queue.map(item => {
        if (item.offlineId === id) {
          return { ...item, payload: { ...item.payload, ...updatedFields } };
        }
        return item;
      });
      localStorage.setItem(offlineExpensesKey, JSON.stringify(updatedQueue));

      const target = updatedExpenses.find(exp => exp.id === id);
      setSelectedExpense(target);
      return;
    }

    try {
      const res = await apiFetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updatedFields),
      });

      if (res.ok) {
        const updated = await res.json();
        const updatedExpenses = expenses.map((exp) => (exp.id === id ? updated : exp));
        setExpenses(updatedExpenses);
        setCachedExpenses(updatedExpenses);
        setSelectedExpense(updated);
      } else {
        throw new Error('API return code failure');
      }
    } catch (error) {
      console.warn('Failed to update expense online, updating locally:', error);
      if (!isOnline) {
        const updatedExpenses = expenses.map((exp) => {
          if (exp.id === id) {
            return { ...exp, ...updatedFields };
          }
          return exp;
        });
        setExpenses(updatedExpenses);
        setCachedExpenses(updatedExpenses);
        const target = updatedExpenses.find(exp => exp.id === id);
        setSelectedExpense(target);
      } else {
        throw error;
      }
    }
  };

  // 5. Delete an Expense
  const handleDeleteExpense = async (id) => {
    if (!currentUser) return;
    const offlineExpensesKey = `offline_manual_expenses_${currentUser}`;

    if (typeof id === 'string' && id.startsWith('offline-')) {
      const updated = expenses.filter((exp) => exp.id !== id);
      setExpenses(updated);
      setCachedExpenses(updated);

      const queue = JSON.parse(localStorage.getItem(offlineExpensesKey) || '[]');
      const filteredQueue = queue.filter(item => item.offlineId !== id);
      localStorage.setItem(offlineExpensesKey, JSON.stringify(filteredQueue));

      setSelectedExpense(null);
      return;
    }

    try {
      const res = await apiFetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        const updated = expenses.filter((exp) => exp.id !== id);
        setExpenses(updated);
        setCachedExpenses(updated);
        setSelectedExpense(null);
      } else {
        alert('Failed to delete expense record.');
      }
    } catch (error) {
      console.warn('Delete request failed on server, trying offline deletion:', error);
      if (!isOnline) {
        const updated = expenses.filter((exp) => exp.id !== id);
        setExpenses(updated);
        setCachedExpenses(updated);
        setSelectedExpense(null);
      } else {
        alert('Delete API request failed.');
      }
    }
  };

  const handleLoginSuccess = (username) => {
    localStorage.setItem('active_user_session', username);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('active_user_session');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col font-sans transition-colors duration-300 relative overflow-hidden ${theme.id === 'potter' ? 'theme-potter' : ''}`}>
      <MagicCursor />
      {/* Hogwarts magic light particles background if potter theme active */}
      {theme.id === 'potter' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-[10%] left-[20%] w-[250px] h-[250px] bg-amber-500/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-[20%] right-[15%] w-[300px] h-[300px] bg-rose-700/5 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
          {/* Subtle star elements */}
          <div className="absolute top-10 right-24 text-amber-300/40 animate-ping text-xs">✦</div>
          <div className="absolute top-48 left-12 text-amber-400/30 animate-pulse text-sm">★</div>
          <div className="absolute bottom-36 left-[30%] text-amber-200/20 animate-bounce text-xs">✦</div>
          <div className="absolute top-1/3 right-[40%] text-amber-300/30 animate-pulse text-lg">✦</div>
        </div>
      )}

      {/* Global Navigation Bar */}
      <header className={`border-b ${theme.border} ${theme.headerBg} backdrop-blur-md relative z-10 shadow-sm transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 border ${theme.border} ${theme.panel} rounded-lg shadow-inner ${theme.id === 'potter' ? 'text-amber-400 border-amber-500/50 shadow-[0_0_8px_rgba(212,175,55,0.2)]' : 'text-neutral-300'}`}>
              {theme.id === 'potter' ? (
                <Sparkles className="w-5 h-5 stroke-[1.5] animate-spin" style={{ animationDuration: '6s' }} />
              ) : (
                <Receipt className="w-5 h-5 stroke-[2]" />
              )}
            </div>
            <div>
              <p className={`text-[10px] uppercase tracking-wider ${theme.id === 'potter' ? 'text-amber-400/80 font-bold font-display' : 'text-neutral-500 font-semibold'} mb-0.5`}>
                {theme.id === 'potter' ? '✦ LedgerFlow Intelligence' : 'Finance Intelligence'}
              </p>
              <div className="flex items-center gap-2">
                <h1 className={`tracking-tight ${
                  theme.id === 'potter' 
                    ? 'font-magic text-xl bg-gradient-to-r from-[#d4af37] via-[#f5e5b3] to-[#aa7c11] bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-bold' 
                    : `font-sans font-semibold text-lg ${theme.isDark ? 'text-white' : 'text-slate-900'}`
                }`}>
                  {theme.id === 'potter' ? 'LedgerFlow Workspace' : 'Receipt Scanner'}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Base Currency Selector */}
            <div className="relative flex items-center">
              <select
                id="header-currency-select"
                value={baseCurrency}
                onChange={(e) => changeBaseCurrency(e.target.value)}
                className={`text-xs px-2.5 py-2 rounded-lg border ${theme.border} ${theme.buttonSecondary} ${theme.isDark ? 'text-white' : 'text-slate-900'} cursor-pointer appearance-none pr-8 font-sans font-medium focus:outline-none`}
              >
                {currencies.map((code) => (
                  <option key={code} value={code} className={theme.isDark ? 'bg-neutral-900 text-white' : 'bg-white text-black'}>
                    {code} ({CURRENCY_SYMBOLS[code]}) — {CURRENCY_NAMES[code]}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>

            <button
              id="header-manual-add-btn"
              onClick={() => setIsManualFormOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg ${theme.buttonSecondary} text-xs font-sans font-medium transition-all cursor-pointer shadow-sm`}
            >
              <Plus className="w-3.5 h-3.5" /> Manual Entry
            </button>
            
            {/* Visual Cloud Sync Indicator Component */}
            <div id="header-cloud-sync-status" className="flex items-center">
              {isSyncing ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span className="hidden md:inline">Syncing Cloud...</span>
                </div>
              ) : pendingSyncCount > 0 ? (
                <button
                  id="header-pending-sync-btn"
                  onClick={syncOfflineData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-all cursor-pointer shadow-xs animate-pulse"
                  title="Click to upload pending local cache changes to the cloud database"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-amber-400" />
                  <span>{pendingSyncCount} Pending Sync</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 font-bold ml-0.5">Sync Now</span>
                </button>
              ) : !isOnline ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-950/40 text-amber-300 border border-amber-800/40">
                  <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Offline (Cached)</span>
                </div>
              ) : (
                <button
                  id="header-cloud-synced-badge"
                  onClick={fetchExpenses}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    theme.id === 'potter'
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-950/60'
                      : `${theme.isDark ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-950/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`
                  } transition-all cursor-pointer`}
                  title={lastSyncedTime ? `Cloud database synced at ${lastSyncedTime.toLocaleTimeString()}. Click to refresh.` : 'Synced with Cloud Database. Click to refresh.'}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Synced with Cloud</span>
                </button>
              )}
            </div>

            {currentUser && (
              <div className={`flex items-center gap-3 pl-3 border-l ${theme.border}`} id="header-user-profile-section">
                <div className="flex flex-col text-right hidden lg:flex">
                  <span className="text-[9px] uppercase text-neutral-500 font-bold tracking-wider">Vault Username</span>
                  <span className={`text-xs font-semibold ${theme.id === 'potter' ? 'text-amber-300' : 'text-neutral-200'}`}>{currentUser}</span>
                </div>
                <button
                  id="header-logout-btn"
                  onClick={handleLogout}
                  className={`px-3 py-1.5 text-[10px] rounded border ${theme.border} ${theme.buttonSecondary} hover:text-rose-400 hover:border-rose-500/40 transition-all font-semibold uppercase tracking-wider cursor-pointer`}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Cloud Sync Pending Alert Banner */}
      <AnimatePresence>
        {pendingSyncCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-500/15 border-b border-amber-500/30 backdrop-blur-md relative z-10"
            id="pending-sync-alert-banner"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between text-xs text-amber-200">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <CloudUpload className="w-3.5 h-3.5 animate-bounce" />
                </div>
                <div>
                  <strong className="text-amber-100 font-semibold">{pendingSyncCount} update{pendingSyncCount > 1 ? 's' : ''} saved in local cache</strong>
                  <span className="hidden sm:inline text-amber-200/80 ml-1">— awaiting upload to cloud database across your devices.</span>
                </div>
              </div>
              <button
                id="banner-sync-now-btn"
                onClick={syncOfflineData}
                disabled={isSyncing || !isOnline}
                className="px-3 py-1 bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border border-amber-400/50 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-3 h-3" />
                    <span>Upload to Cloud Now</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10 flex flex-col gap-8">
        {!isOnline && (
          <div className="p-4 border border-amber-900/60 bg-amber-950/15 text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-sans rounded-lg shadow-md animate-fade-in">
            <div className="flex items-start sm:items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-amber-500 animate-bounce flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-semibold">Local-First Mode Engaged:</span> You can safely browse, create manual entries, and drop receipt images. Your actions will cache locally and automatically synchronize with the server once you reconnect.
              </div>
            </div>
            {localStorage.getItem('offline_manual_expenses') && JSON.parse(localStorage.getItem('offline_manual_expenses') || '[]').length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 font-medium whitespace-nowrap self-end sm:self-auto">
                {JSON.parse(localStorage.getItem('offline_manual_expenses') || '[]').length} Pending Sync
              </span>
            )}
          </div>
        )}
        {/* FIRST: AI Receipt Scanner */}
        <section id="ai-receipt-scanner-section" className={`space-y-4 border ${theme.border} ${theme.panel} p-6 rounded-lg shadow-md relative overflow-hidden w-full transition-colors duration-300 ${theme.id === 'potter' ? 'shadow-[0_0_15px_rgba(212,175,55,0.1)] border-amber-500/30' : ''}`}>
          <div className={`flex items-center justify-between border-b ${theme.border} pb-3`}>
            <div>
              <p className={`text-[10px] uppercase tracking-wider ${theme.id === 'potter' ? 'text-amber-400 font-bold' : 'text-neutral-500 font-semibold'} mb-0.5`}>
                {theme.id === 'potter' ? '✦ Intelligent Receipt Extraction' : 'Instant OCR Parsing'}
              </p>
              <h3 className={`text-base ${theme.id === 'potter' ? 'font-bold text-amber-100' : 'font-sans font-medium ' + (theme.isDark ? 'text-white' : 'text-slate-900')}`}>
                {theme.id === 'potter' ? "AI-Powered Receipt Analyzer" : 'AI Receipt Scanner'}
              </h3>
            </div>
            <span className={`text-[10px] ${theme.id === 'potter' ? 'font-semibold text-amber-300 bg-amber-950/40 border-amber-500/30 px-3 py-0.5 shadow-[0_0_5px_rgba(212,175,55,0.1)]' : (theme.isDark ? 'text-neutral-300 bg-[#16161a]' : 'text-slate-700 bg-slate-100') + ' font-sans px-2.5 py-0.5'} border ${theme.border} rounded-full`}>
              {theme.id === 'potter' ? '✦ Enterprise AI Scan' : 'Intelligent Scan'}
            </span>
          </div>
          
          <ReceiptScanner onAnalysisComplete={handleAnalysisComplete} />
          
          <p className={`text-xs ${theme.textMuted} font-sans leading-relaxed mt-2 pt-2 border-t ${theme.border}`}>
            {theme.id === 'potter' ? (
              "Securely upload a photo or scan of your receipt. Our enterprise-grade Gemini AI model will automatically parse the vendor name, date, itemized list, taxes, and intelligently suggest the appropriate financial category."
            ) : (
              "Securely upload a photo or scan of your receipt. Our Gemini model will automatically parse the vendor name, date, itemized list, taxes, and intelligently suggest the appropriate financial category."
            )}
          </p>
        </section>

        {/* DASHBOARD SECTIONS (KPIs, Trend, Allocation, Budget Limits) */}
        <div className="w-full">
          {isLoading && expenses.length === 0 ? (
            <div className={`h-[280px] border ${theme.border} ${theme.panel} rounded-lg flex flex-col items-center justify-center shadow-md`}>
              <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin mb-3" />
              <p className={`text-xs font-sans ${theme.textMuted}`}>Compiling financial metrics...</p>
            </div>
          ) : (
            <Dashboard
              expenses={expenses}
              budgetLimits={budgetLimits}
              onUpdateBudgetLimits={handleUpdateBudgetLimits}
            />
          )}
        </div>

        {/* Bottom Workspace: Searchable Expense Table */}
        <section className="space-y-4">
          <div className={`flex items-center justify-between border-b ${theme.border} pb-3`}>
            <div className="flex items-center gap-2">
              <Layers className={`w-4 h-4 ${theme.id === 'potter' ? 'text-amber-400' : 'text-neutral-500'}`} />
              <h2 className={`text-base ${theme.id === 'potter' ? 'font-bold text-amber-100' : 'font-sans font-medium ' + (theme.isDark ? 'text-white' : 'text-slate-900')}`}>
                {theme.id === 'potter' ? "Interactive Transaction Ledger" : 'Expenses & Receipts Ledger'}
              </h2>
            </div>
            <span className={`text-xs ${theme.textMuted} font-medium`}>
              {expenses.length} {theme.id === 'potter' ? 'Vault Entries Registered' : 'Receipts Registered'}
            </span>
          </div>

          {isLoading && expenses.length === 0 ? (
            <div className={`p-12 text-center border ${theme.border} ${theme.panel} rounded-lg shadow-md`}>
              <RefreshCw className="w-5 h-5 text-neutral-500 animate-spin mx-auto mb-2" />
              <p className={`text-xs font-sans ${theme.textMuted}`}>Loading ledger records...</p>
            </div>
          ) : (
            <ExpenseList
              expenses={expenses}
              onDeleteExpense={handleDeleteExpense}
              onSelectExpense={setSelectedExpense}
            />
          )}
        </section>
      </main>

      {/* Manual Entry Modal Frame */}
      <AnimatePresence>
        {isManualFormOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setIsManualFormOpen(false)} />
            
            <motion.form
              onSubmit={handleManualSubmit}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className={`relative w-full max-w-md ${theme.panel} border ${theme.border} rounded-xl p-6 shadow-2xl space-y-5 ${theme.text}`}
            >
              <div className={`flex items-center justify-between pb-4 border-b ${theme.border}`}>
                <div className="flex items-center gap-2">
                  <ListPlus className="w-4 h-4 text-neutral-400" />
                  <h3 className={`font-sans font-semibold text-base ${theme.isDark ? 'text-white' : 'text-slate-900'}`}>
                    Log Expense Manually
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManualFormOpen(false)}
                  className={`p-1.5 rounded-lg ${theme.textMuted} hover:${theme.isDark ? 'text-white bg-neutral-800' : 'text-slate-950 bg-slate-200'} transition-colors cursor-pointer`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Vendor */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} uppercase block`}>Merchant Name *</label>
                <input
                  id="manual-vendor-input"
                  type="text"
                  required
                  value={manualVendor}
                  onChange={(e) => setManualVendor(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-sm focus:outline-none focus:border-neutral-500 transition-all font-sans placeholder-neutral-500`}
                  placeholder="Starbucks, Target, Delta"
                />
              </div>

              {/* Currency, Amount & Date */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} uppercase block`}>Currency *</label>
                  <div className="relative flex items-center">
                    <select
                      id="manual-currency-select"
                      value={manualCurrency}
                      onChange={(e) => setManualCurrency(e.target.value)}
                      className={`w-full px-2.5 py-2 pr-7 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-neutral-200' : 'text-slate-800'} text-sm focus:outline-none focus:border-neutral-500 transition-all cursor-pointer appearance-none font-sans`}
                    >
                      {currencies.map((code) => (
                        <option key={code} value={code} className={theme.isDark ? 'bg-neutral-900 text-white' : 'bg-white text-black'}>
                          {code} ({CURRENCY_SYMBOLS[code]}) — {CURRENCY_NAMES[code]}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-neutral-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 col-span-1">
                  <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} uppercase block`}>Amount *</label>
                  <input
                    id="manual-amount-input"
                    type="number"
                    step="0.01"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-sm focus:outline-none focus:border-neutral-500 transition-all font-mono placeholder-neutral-500`}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} uppercase block`}>Date *</label>
                  <input
                    id="manual-date-input"
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className={`w-full px-2 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-sm focus:outline-none focus:border-neutral-500 transition-all font-mono`}
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} uppercase block`}>Category *</label>
                <div className="relative flex items-center">
                  <select
                    id="manual-category-select"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className={`w-full px-3 py-2 pr-10 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-neutral-200' : 'text-slate-800'} text-sm focus:outline-none focus:border-neutral-500 transition-all cursor-pointer appearance-none font-sans`}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className={theme.isDark ? 'bg-neutral-900 text-white' : 'bg-white text-black'}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} uppercase block`}>Notes / Memo</label>
                <input
                  id="manual-desc-input"
                  type="text"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-sm focus:outline-none focus:border-neutral-500 transition-all font-sans placeholder-neutral-500`}
                  placeholder="A brief note about this purchase"
                />
              </div>

              <div className={`flex items-center justify-end gap-3 pt-4 border-t ${theme.border}`}>
                <button
                  id="manual-cancel-btn"
                  type="button"
                  onClick={() => setIsManualFormOpen(false)}
                  className={`px-4 py-2 rounded-lg text-xs font-sans font-medium ${theme.textMuted} hover:${theme.isDark ? 'text-white' : 'text-slate-950'} transition-colors cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  id="manual-save-btn"
                  type="submit"
                  className={`px-5 py-2 rounded-lg text-xs font-sans font-medium ${theme.buttonPrimary} transition-colors cursor-pointer shadow-sm`}
                >
                  Save Transaction
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Expense Detail Viewer Modal */}
      <ExpenseDetailModal
        expense={selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onUpdateExpense={handleUpdateExpense}
        onDeleteExpense={handleDeleteExpense}
      />

      {/* Receipt Confirmation Modal */}
      <ReceiptConfirmationModal
        pendingAnalysis={pendingAnalysis}
        onClose={() => setPendingAnalysis(null)}
        onConfirm={handleConfirmAnalysis}
      />
    </div>
  );
}
