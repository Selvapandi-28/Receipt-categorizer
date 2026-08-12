/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Trash2, Calendar, FileText, ChevronDown, Check, X, ShoppingBag, Filter, Image, Receipt, RotateCcw, DollarSign } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '../types';
import { useTheme } from '../theme.jsx';
import { useCurrency } from '../currency.jsx';

export default function ExpenseList({ expenses, onDeleteExpense, onSelectExpense }) {
  const { theme } = useTheme();
  const { baseCurrency, convertAmount, formatPrice } = useCurrency();

  // Search & Filter state variables
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dateFilterPreset, setDateFilterPreset] = useState('all'); // 'all' | 'this-month' | 'last-month' | 'this-year' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [receiptTypeFilter, setReceiptTypeFilter] = useState('all'); // 'all' | 'with-image' | 'manual'
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Reset all filters helper
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setDateFilterPreset('all');
    setStartDate('');
    setEndDate('');
    setReceiptTypeFilter('all');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('date-desc');
  };

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm.trim() !== '' ||
      selectedCategory !== 'All' ||
      dateFilterPreset !== 'all' ||
      receiptTypeFilter !== 'all' ||
      minAmount !== '' ||
      maxAmount !== ''
    );
  }, [searchTerm, selectedCategory, dateFilterPreset, receiptTypeFilter, minAmount, maxAmount]);

  // Elegant dynamic category styling maps
  const categoryStyles = {
    'Food & Dining': theme.id === 'potter' 
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#5c131d]/60 text-[#f5ebd6] border border-[#d4af37]/40 shadow-[0_0_6px_rgba(212,175,55,0.15)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-indigo-950/45 text-indigo-300 border border-indigo-900/40' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`,
    'Groceries': theme.id === 'potter'
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#0d2a1d]/60 text-emerald-300 border border-emerald-500/40 shadow-[0_0_6px_rgba(16,185,129,0.15)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-emerald-950/45 text-emerald-300 border border-emerald-900/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`,
    'Shopping': theme.id === 'potter'
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#aa7c11]/20 text-[#d4af37] border border-[#d4af37]/50 shadow-[0_0_6px_rgba(212,175,55,0.2)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-amber-950/45 text-amber-300 border border-amber-900/40' : 'bg-amber-50 text-amber-700 border border-amber-200'}`,
    'Utilities': theme.id === 'potter'
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#3c2f0f]/60 text-[#eab308] border border-[#eab308]/40 shadow-[0_0_6px_rgba(234,179,8,0.15)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-rose-950/45 text-rose-300 border border-rose-900/40' : 'bg-rose-50 text-rose-700 border border-rose-200'}`,
    'Travel & Transport': theme.id === 'potter'
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#0f243c]/60 text-sky-300 border border-sky-500/40 shadow-[0_0_6px_rgba(14,165,233,0.15)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-sky-950/45 text-sky-300 border border-sky-900/40' : 'bg-sky-50 text-sky-700 border border-sky-200'}`,
    'Entertainment': theme.id === 'potter'
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#4c1d95]/40 text-purple-300 border border-purple-500/30 shadow-[0_0_6px_rgba(168,85,247,0.15)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-purple-950/45 text-purple-300 border border-purple-900/40' : 'bg-purple-50 text-purple-700 border border-purple-200'}`,
    'Healthcare': theme.id === 'potter'
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#9f1239]/30 text-rose-300 border border-rose-500/30 shadow-[0_0_6px_rgba(244,63,94,0.15)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-teal-950/45 text-teal-300 border border-teal-900/40' : 'bg-teal-50 text-teal-700 border border-teal-200'}`,
    'Education': theme.id === 'potter'
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#1e1b4b]/60 text-[#c7d2fe] border border-[#a5b4fc]/30 shadow-[0_0_6px_rgba(165,180,252,0.15)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-cyan-950/45 text-cyan-300 border border-cyan-900/40' : 'bg-cyan-50 text-cyan-700 border border-cyan-200'}`,
    'Others': theme.id === 'potter'
      ? `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center bg-[#1c050a]/80 text-[#d4af37]/90 border border-[#d4af37]/35 shadow-[0_0_6px_rgba(212,175,55,0.1)]`
      : `font-sans text-[10px] font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center ${theme.isDark ? 'bg-[#1e293b] text-[#94a3b8] border border-[#334155]' : 'bg-slate-100 text-slate-700 border border-slate-200'}`,
  };

  const convertedExpenses = useMemo(() => {
    return expenses.map(exp => ({
      ...exp,
      amount: convertAmount(exp.originalAmount !== undefined ? exp.originalAmount : exp.amount, exp.originalCurrency || 'INR', baseCurrency)
    }));
  }, [expenses, baseCurrency, convertAmount]);

  // Comprehensive Search & Filter Logic
  const filteredAndSortedExpenses = useMemo(() => {
    let result = [...convertedExpenses];

    // 1. Merchant / Text Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter((exp) => {
        const matchesVendor = exp.vendor?.toLowerCase().includes(term);
        const matchesDesc = (exp.description || '').toLowerCase().includes(term);
        const matchesItems = exp.items ? exp.items.some((item) => item.name?.toLowerCase().includes(term)) : false;
        const matchesCategory = exp.category?.toLowerCase().includes(term);
        
        const formattedDate = new Date(exp.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC'
        }).toLowerCase();
        
        const matchesRawDate = exp.date?.toLowerCase().includes(term);
        const matchesFormattedDate = formattedDate.includes(term);

        return matchesVendor || matchesDesc || matchesItems || matchesCategory || matchesRawDate || matchesFormattedDate;
      });
    }

    // 2. Category filter
    if (selectedCategory !== 'All') {
      result = result.filter((exp) => exp.category === selectedCategory);
    }

    // 3. Receipt Type filter
    if (receiptTypeFilter === 'with-image') {
      result = result.filter((exp) => !!exp.imageUrl);
    } else if (receiptTypeFilter === 'manual') {
      result = result.filter((exp) => !exp.imageUrl);
    }

    // 4. Amount Range Filter
    if (minAmount !== '' && !isNaN(Number(minAmount))) {
      result = result.filter((exp) => exp.amount >= Number(minAmount));
    }
    if (maxAmount !== '' && !isNaN(Number(maxAmount))) {
      result = result.filter((exp) => exp.amount <= Number(maxAmount));
    }

    // 5. Date Filter Presets & Custom Range
    const now = new Date();
    if (dateFilterPreset === 'this-month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      result = result.filter((exp) => new Date(exp.date) >= startOfMonth);
    } else if (dateFilterPreset === 'last-month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      result = result.filter((exp) => {
        const expDate = new Date(exp.date);
        return expDate >= startOfLastMonth && expDate <= endOfLastMonth;
      });
    } else if (dateFilterPreset === 'this-year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      result = result.filter((exp) => new Date(exp.date) >= startOfYear);
    } else if (dateFilterPreset === 'custom') {
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        result = result.filter((exp) => new Date(exp.date) >= sDate);
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        result = result.filter((exp) => new Date(exp.date) <= eDate);
      }
    }

    // 6. Sorting
    result.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (sortBy === 'amount-asc') {
        return a.amount - b.amount;
      }
      if (sortBy === 'vendor-asc') {
        return (a.vendor || '').localeCompare(b.vendor || '');
      }
      return 0;
    });

    return result;
  }, [convertedExpenses, searchTerm, selectedCategory, receiptTypeFilter, minAmount, maxAmount, dateFilterPreset, startDate, endDate, sortBy]);

  // Total sum of currently filtered expenses
  const filteredTotalAmount = useMemo(() => {
    return filteredAndSortedExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [filteredAndSortedExpenses]);

  return (
    <div className="space-y-4">
      {/* Search, Filter & Controls Header Panel */}
      <div className={`p-4 border ${theme.border} ${theme.panel} rounded-xl shadow-md space-y-3`}>
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              id="expense-search-input"
              type="text"
              placeholder="Search by merchant, date, category tag, or line items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 ${searchTerm ? 'pr-9' : 'pr-4'} py-2.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 text-xs transition-all shadow-inner`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded-full transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Controls Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Quick Filter */}
            <div className="relative flex items-center">
              <SlidersHorizontal className="absolute left-3 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <select
                id="category-filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`pl-9 pr-8 py-2 text-xs rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} font-sans focus:outline-none focus:border-amber-500/50 shadow-sm appearance-none cursor-pointer`}
              >
                <option value="All">All Categories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>

            {/* Sort Selector */}
            <div className="relative flex items-center">
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`pl-3 pr-8 py-2 text-xs rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} font-sans focus:outline-none focus:border-amber-500/50 shadow-sm appearance-none cursor-pointer`}
              >
                <option value="date-desc">Newest Date First</option>
                <option value="date-asc">Oldest Date First</option>
                <option value="amount-desc">Highest Cost First</option>
                <option value="amount-asc">Lowest Cost First</option>
                <option value="vendor-asc">Merchant (A-Z)</option>
              </select>
              <ChevronDown className="absolute right-3 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>

            {/* Advanced Filters Toggle Button */}
            <button
              id="toggle-advanced-filters-btn"
              type="button"
              onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                isAdvancedFiltersOpen || hasActiveFilters
                  ? `${theme.id === 'potter' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`
                  : `${theme.buttonSecondary}`
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filter Options */}
        {isAdvancedFiltersOpen && (
          <div className={`pt-3 border-t ${theme.border} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs`}>
            {/* 1. Date Preset Filter */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400" />
                <span>Date Range</span>
              </label>
              <select
                id="date-filter-preset"
                value={dateFilterPreset}
                onChange={(e) => setDateFilterPreset(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} focus:outline-none focus:border-amber-500/50 cursor-pointer`}
              >
                <option value="all">All Dates</option>
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="this-year">This Year</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Custom Date Pickers (if custom date preset is selected) */}
            {dateFilterPreset === 'custom' && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} focus:outline-none focus:border-amber-500/50`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} focus:outline-none focus:border-amber-500/50`}
                  />
                </div>
              </div>
            )}

            {/* 2. Receipt Attachment Type */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1 flex items-center gap-1">
                <Receipt className="w-3 h-3 text-amber-400" />
                <span>Receipt Format</span>
              </label>
              <select
                id="receipt-type-filter"
                value={receiptTypeFilter}
                onChange={(e) => setReceiptTypeFilter(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} focus:outline-none focus:border-amber-500/50 cursor-pointer`}
              >
                <option value="all">All Entries</option>
                <option value="with-image">With Scanned Image Only</option>
                <option value="manual">Manual Entries Only</option>
              </select>
            </div>

            {/* 3. Min & Max Amount Filter */}
            <div className="sm:col-span-2 lg:col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  <span>Min Amount ({baseCurrency})</span>
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} focus:outline-none focus:border-amber-500/50`}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  <span>Max Amount ({baseCurrency})</span>
                </label>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} focus:outline-none focus:border-amber-500/50`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Pills Bar & Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Active Filter Tags */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${theme.textMuted}`}>
              Showing {filteredAndSortedExpenses.length} of {expenses.length} receipts
            </span>

            {hasActiveFilters && (
              <>
                <span className="text-neutral-600">•</span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                    Search: "{searchTerm}"
                    <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSearchTerm('')} />
                  </span>
                )}

                {selectedCategory !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px]">
                    Category: {selectedCategory}
                    <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSelectedCategory('All')} />
                  </span>
                )}

                {dateFilterPreset !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                    Date: {dateFilterPreset}
                    <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setDateFilterPreset('all')} />
                  </span>
                )}

                {receiptTypeFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px]">
                    Format: {receiptTypeFilter === 'with-image' ? 'Image Only' : 'Manual Only'}
                    <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setReceiptTypeFilter('all')} />
                  </span>
                )}

                {(minAmount !== '' || maxAmount !== '') && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                    Amount: {minAmount ? `${baseCurrency} ${minAmount}` : '0'} - {maxAmount ? `${baseCurrency} ${maxAmount}` : '∞'}
                    <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => { setMinAmount(''); setMaxAmount(''); }} />
                  </span>
                )}

                <button
                  id="clear-all-filters-btn"
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer ml-1 flex items-center gap-0.5"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Reset All
                </button>
              </>
            )}
          </div>

          {/* Filtered Total Sum Badge */}
          {filteredAndSortedExpenses.length > 0 && (
            <div className={`text-xs font-mono font-semibold ${theme.id === 'potter' ? 'text-amber-300' : 'text-neutral-200'}`}>
              Filtered Total: <span className="text-emerald-400">{formatPrice(filteredTotalAmount)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid List Table representation */}
      <div className={`border ${theme.border} ${theme.panel} rounded-xl overflow-hidden shadow-md transition-colors duration-300`}>
        {filteredAndSortedExpenses.length > 0 ? (
          <>
            {/* Desktop Table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${theme.border} ${theme.bg}/45 ${theme.textMuted} font-sans text-[10px] uppercase tracking-wider font-semibold`}>
                    <th className="py-3 px-5">Vendor / Merchant</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Transaction Date</th>
                    <th className="py-3 px-4">Line Items</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-5 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.isDark ? 'divide-neutral-900' : 'divide-slate-200'}`}>
                  {filteredAndSortedExpenses.map((exp) => (
                    <tr
                      key={exp.id}
                      onClick={() => onSelectExpense(exp)}
                      className={`hover:${theme.isDark ? (theme.id === 'potter' ? 'bg-[#3d0f1a]/55 text-white' : 'bg-[#121214]/65') : 'bg-slate-50'} cursor-pointer transition-colors duration-150 group`}
                    >
                      {/* Vendor & Description */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {exp.imageUrl ? (
                            <div className={`relative w-8 h-8 rounded-md overflow-hidden border ${theme.border} bg-neutral-900 shadow-xs flex-shrink-0 group/thumb`} title="Receipt thumbnail preview">
                              <img
                                src={exp.imageUrl}
                                alt="Receipt thumbnail"
                                className="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-110"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className={`w-8 h-8 rounded-md border border-dashed ${theme.border} ${theme.isDark ? 'bg-neutral-950/45' : 'bg-slate-50'} flex items-center justify-center flex-shrink-0 text-neutral-500`}>
                              <ShoppingBag className="w-3.5 h-3.5 stroke-[1.5]" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className={`font-sans font-medium text-sm ${theme.isDark ? 'text-white group-hover:text-neutral-100' : 'text-slate-900 group-hover:text-slate-950'} transition-colors truncate max-w-[150px] md:max-w-[200px]`}>
                                {exp.vendor}
                              </div>
                              {exp.isOfflinePending && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-sans font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                                  Pending Sync
                                </span>
                              )}
                            </div>
                            <div className={`text-[11px] ${theme.textMuted} max-w-[240px] truncate font-sans mt-0.5`}>
                              {exp.description || 'No description'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category Chip */}
                      <td className="py-4 px-4">
                        <span className={categoryStyles[exp.category] || categoryStyles['Others']}>
                          {exp.category}
                        </span>
                      </td>

                      {/* Transaction Date */}
                      <td className={`py-4 px-4 text-xs font-mono ${theme.textMuted}`}>
                        {new Date(exp.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          timeZone: 'UTC'
                        })}
                      </td>

                      {/* Line Item count */}
                      <td className={`py-4 px-4 text-xs font-sans ${theme.textMuted}`}>
                        {exp.items && exp.items.length > 0 ? (
                          <span className="flex items-center gap-1.5">
                            <FileText className={`w-3.5 h-3.5 ${theme.textMuted}`} />
                            {exp.items.length} {exp.items.length === 1 ? 'item' : 'items'}
                          </span>
                        ) : (
                          <span className="text-neutral-500">No items</span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className={`py-4 px-4 text-right font-mono text-sm font-semibold ${theme.isDark ? 'text-white' : 'text-slate-955'}`}>
                        {formatPrice(exp.amount)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-center">
                        {confirmDeleteId === exp.id ? (
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              id={`confirm-delete-${exp.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteExpense(exp.id);
                                setConfirmDeleteId(null);
                              }}
                              className="p-1.5 rounded-md border border-rose-950 bg-rose-950/40 text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 transition-all focus:outline-none"
                              title="Confirm Deletion"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`cancel-delete-${exp.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className={`p-1.5 rounded-md border ${theme.border} ${theme.buttonSecondary} focus:outline-none`}
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`delete-btn-${exp.id}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(exp.id);
                            }}
                            className={`p-1.5 rounded-md border ${theme.border} ${theme.buttonSecondary} opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none shadow-sm`}
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-style layout */}
            <div className={`md:hidden divide-y ${theme.isDark ? 'divide-neutral-900' : 'divide-slate-200'}`}>
              {filteredAndSortedExpenses.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => onSelectExpense(exp)}
                  className={`p-4 active:${theme.isDark ? (theme.id === 'potter' ? 'bg-[#3d0f1a]/70' : 'bg-[#121214]/60') : 'bg-slate-100'} flex flex-col gap-3`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {exp.imageUrl ? (
                        <div className={`relative w-9 h-9 rounded-md overflow-hidden border ${theme.border} bg-neutral-900 shadow-xs flex-shrink-0`}>
                          <img
                            src={exp.imageUrl}
                            alt="Receipt thumbnail"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className={`w-9 h-9 rounded-md border border-dashed ${theme.border} ${theme.isDark ? 'bg-neutral-950/45' : 'bg-slate-50'} flex items-center justify-center flex-shrink-0 text-neutral-500`}>
                          <ShoppingBag className="w-4 h-4 stroke-[1.5]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className={`font-sans font-medium text-sm ${theme.isDark ? 'text-white' : 'text-slate-900'} truncate max-w-[150px]`}>
                            {exp.vendor}
                          </div>
                          {exp.isOfflinePending && (
                            <span className="text-[8px] px-1 py-0.1 rounded-full font-sans font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                              Pending Sync
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] ${theme.textMuted} mt-0.5 font-sans truncate`}>
                          {exp.description || 'No description'}
                        </div>
                      </div>
                    </div>
                    <div className={`font-mono text-sm font-semibold ${theme.isDark ? 'text-white' : 'text-slate-955'} flex-shrink-0`}>
                      {formatPrice(exp.amount)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={categoryStyles[exp.category] || categoryStyles['Others']}>
                      {exp.category}
                    </span>
                    
                    <span className={`${theme.textMuted} font-sans text-xs flex items-center gap-1`}>
                      <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                      {new Date(exp.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC'
                      })}
                    </span>
                  </div>

                  <div className={`flex items-center justify-between border-t ${theme.border} pt-3 mt-1`}>
                    <span className={`text-xs ${theme.textMuted}`}>
                      {exp.items && exp.items.length > 0 ? `${exp.items.length} line items` : 'No line items listed'}
                    </span>
                    
                    {confirmDeleteId === exp.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          id={`confirm-delete-mobile-${exp.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteExpense(exp.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2.5 py-1 text-xs font-sans rounded-md border border-rose-950 bg-rose-950/40 text-rose-300 hover:bg-rose-950/60 transition-all focus:outline-none flex items-center gap-1"
                          title="Confirm Deletion"
                        >
                          <Check className="w-3 h-3" /> Confirm
                        </button>
                        <button
                          id={`cancel-delete-mobile-${exp.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className={`p-1 rounded-md border ${theme.border} ${theme.buttonSecondary} focus:outline-none`}
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        id={`delete-btn-mobile-${exp.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(exp.id);
                        }}
                        className={`p-1.5 border ${theme.border} ${theme.buttonSecondary} rounded-md shadow-sm`}
                        title="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={`p-12 text-center flex flex-col items-center justify-center ${theme.bg}/20`}>
            <div className={`p-4 border ${theme.border} ${theme.bg}/45 rounded-full mb-3 text-neutral-500 shadow-sm`}>
              <Search className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h4 className={`font-sans font-medium text-sm ${theme.isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
              No matching receipts found
            </h4>
            <p className={`text-xs ${theme.textMuted} max-w-xs mt-1 font-sans leading-relaxed`}>
              {hasActiveFilters
                ? 'No expenses match your current search & filter criteria.'
                : 'No receipts uploaded or recorded yet.'}
            </p>
            {hasActiveFilters && (
              <button
                id="empty-state-reset-filters-btn"
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

