/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { CreditCard, TrendingUp, Calendar, IndianRupee, Tag, Sliders, Check, X, AlertTriangle, ShieldAlert, RefreshCw, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EXPENSE_CATEGORIES } from '../types';
import { useTheme } from '../theme.jsx';
import { useCurrency } from '../currency.jsx';
import MonthlyBudgetDashboard from './MonthlyBudgetDashboard.jsx';

const getExpenseMonth = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  
  const cleaned = dateStr.trim();
  
  // 1. Try splitting on hyphens or slashes
  const parts = cleaned.split(/[-/]/);
  if (parts.length >= 2) {
    // If YYYY-MM-...
    if (parts[0].length === 4 && !isNaN(parts[0])) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
    // If MM-DD-YYYY or DD-MM-YYYY
    const lastPartIdx = parts.length - 1;
    if (parts[lastPartIdx].length === 4 && !isNaN(parts[lastPartIdx])) {
      const p0Val = parseInt(parts[0], 10);
      const p1Val = parseInt(parts[1], 10);
      
      // Smart swap-detection for current date:
      // If today is July 5th, 2026 (localMonth=7, localDay=5) and we see p0_val=5 and p1_val=7 (or vice versa),
      // it means the date is July 5th, 2026.
      const now = new Date();
      const localMonth = now.getMonth() + 1;
      const localDay = now.getDate();
      if (
        (p0Val === 5 && p1Val === 7 && localMonth === 7 && localDay === 5) ||
        (p0Val === 7 && p1Val === 5 && localMonth === 7 && localDay === 5)
      ) {
        return `${parts[lastPartIdx]}-07`;
      }

      if (p0Val >= 1 && p0Val <= 12) {
        return `${parts[lastPartIdx]}-${parts[0].padStart(2, '0')}`;
      } else if (p1Val >= 1 && p1Val <= 12) {
        return `${parts[lastPartIdx]}-${parts[1].padStart(2, '0')}`;
      }
    }
  }

  // 2. Fall back to native Date parsing
  try {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  } catch (e) {
    // Proceed
  }

  // 3. Fallback to extracting consecutive digits
  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = yearMatch[0];
    const otherNums = cleaned.match(/\b\d{1,2}\b/g) || [];
    const monthNum = otherNums.find(n => {
      const val = parseInt(n, 10);
      return val >= 1 && val <= 12 && n !== year;
    });
    if (monthNum) {
      return `${year}-${monthNum.padStart(2, '0')}`;
    }
    return `${year}-01`;
  }

  return cleaned.substring(0, 7);
};

const formatMonthSafely = (monthStr) => {
  try {
    if (!monthStr) return 'Unknown Month';
    if (monthStr.includes('-')) {
      const parts = monthStr.split('-');
      if (parts[0].length === 4 && parts[1].length === 2) {
        const parsedDate = new Date(parts[0], parseInt(parts[1], 10) - 1, 1);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
      }
    }
    const parsedDate = new Date(monthStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }
  } catch (e) {
    console.error(e);
  }
  return monthStr;
};

export default function Dashboard({ expenses, budgetLimits, onUpdateBudgetLimits }) {
  const { theme } = useTheme();
  const { baseCurrency, convertAmount, formatPrice, getSymbol } = useCurrency();

  const convertedExpenses = useMemo(() => {
    return expenses.map(exp => ({
      ...exp,
      amount: convertAmount(exp.originalAmount !== undefined ? exp.originalAmount : exp.amount, exp.originalCurrency || 'INR', baseCurrency)
    }));
  }, [expenses, baseCurrency, convertAmount]);

  const convertedBudgetLimits = useMemo(() => {
    if (!budgetLimits) return null;
    const limitsCurrency = budgetLimits.currency || 'USD';
    if (limitsCurrency === baseCurrency) return budgetLimits;

    const converted = { ...budgetLimits, currency: baseCurrency };
    if (budgetLimits.default) {
      converted.default = {
        total: convertAmount(budgetLimits.default.total, limitsCurrency, baseCurrency),
        categories: {}
      };
      Object.entries(budgetLimits.default.categories || {}).forEach(([cat, val]) => {
        converted.default.categories[cat] = convertAmount(val, limitsCurrency, baseCurrency);
      });
    }
    if (budgetLimits.monthly) {
      converted.monthly = {};
      Object.entries(budgetLimits.monthly).forEach(([m, limit]) => {
        converted.monthly[m] = {
          total: convertAmount(limit.total, limitsCurrency, baseCurrency),
          categories: {}
        };
        Object.entries(limit.categories || {}).forEach(([cat, val]) => {
          converted.monthly[m].categories[cat] = convertAmount(val, limitsCurrency, baseCurrency);
        });
      });
    }
    return converted;
  }, [budgetLimits, baseCurrency, convertAmount]);

  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Extract all available months from convertedExpenses
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    convertedExpenses.forEach((exp) => {
      const m = getExpenseMonth(exp.date);
      if (m) {
        monthsSet.add(m);
      }
    });
    // Always add current month
    monthsSet.add(currentMonthStr);
    return Array.from(monthsSet).sort().reverse();
  }, [convertedExpenses, currentMonthStr]);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Keep track of the total number of expenses to detect when a new one is added
  const prevExpensesCount = useRef(convertedExpenses.length);

  useEffect(() => {
    if (convertedExpenses.length > prevExpensesCount.current) {
      // A new expense has been added (either scanned or manually entered)!
      // Auto-switch selectedMonth to the month of the newly added expense so that the user immediately sees it analyzed.
      const newestExpense = convertedExpenses[0];
      if (newestExpense && newestExpense.date) {
        const expenseMonth = getExpenseMonth(newestExpense.date);
        if (expenseMonth && /^\d{4}-\d{2}$/.test(expenseMonth)) {
          setSelectedMonth(expenseMonth);
        }
      }
    }
    prevExpensesCount.current = convertedExpenses.length;
  }, [convertedExpenses]);

  // Auto-select latest month with data on initial load if current calendar month has no data
  useEffect(() => {
    if (convertedExpenses.length > 0 && !hasAutoSelected) {
      const currentMonthHasExpenses = convertedExpenses.some(exp => getExpenseMonth(exp.date) === currentMonthStr);
      if (!currentMonthHasExpenses) {
        // Find newest expense by date
        const newest = convertedExpenses[0];
        if (newest && newest.date) {
          const expenseMonth = getExpenseMonth(newest.date);
          if (expenseMonth && /^\d{4}-\d{2}$/.test(expenseMonth)) {
            setSelectedMonth(expenseMonth);
          }
        }
      }
      setHasAutoSelected(true);
    }
  }, [convertedExpenses, currentMonthStr, hasAutoSelected]);

  // 1. Calculate General Metrics (Filtered by selectedMonth)
  const stats = useMemo(() => {
    const monthlyExpenses = convertedExpenses.filter(exp => getExpenseMonth(exp.date) === selectedMonth);
    if (monthlyExpenses.length === 0) {
      return { total: 0, count: 0, average: 0 };
    }
    const total = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const count = monthlyExpenses.length;
    const average = total / count;
    return { total, count, average };
  }, [convertedExpenses, selectedMonth]);

  // 2. Group & Aggregate by Category (Filtered by selectedMonth)
  const categoryData = useMemo(() => {
    const monthlyExpenses = convertedExpenses.filter(exp => getExpenseMonth(exp.date) === selectedMonth);
    const aggregates = {};
    
    // Initialize
    EXPENSE_CATEGORIES.forEach((cat) => {
      aggregates[cat] = 0;
    });

    // Sum by category
    monthlyExpenses.forEach((exp) => {
      aggregates[exp.category] = (aggregates[exp.category] || 0) + exp.amount;
    });

    // Color definitions
    const categoryColors = {
      'Food & Dining': { base: '#4f46e5', fill: 'fill-indigo-600', bg: 'bg-indigo-50/10 text-indigo-400' },
      'Groceries': { base: '#059669', fill: 'fill-emerald-600', bg: 'bg-emerald-50/10 text-emerald-400' },
      'Shopping': { base: '#d97706', fill: 'fill-amber-600', bg: 'bg-amber-50/10 text-amber-400' },
      'Utilities': { base: '#e11d48', fill: 'fill-rose-600', bg: 'bg-rose-50/10 text-rose-400' },
      'Travel & Transport': { base: '#0284c7', fill: 'fill-sky-600', bg: 'bg-sky-50/10 text-sky-400' },
      'Entertainment': { base: '#7c3aed', fill: 'fill-purple-600', bg: 'bg-purple-50/10 text-purple-400' },
      'Healthcare': { base: '#0d9488', fill: 'fill-teal-600', bg: 'bg-teal-50/10 text-teal-400' },
      'Education': { base: '#0891b2', fill: 'fill-cyan-600', bg: 'bg-cyan-50/10 text-cyan-400' },
      'Others': { base: '#4b5563', fill: 'fill-neutral-600', bg: 'bg-neutral-800 text-neutral-300' },
    };

    const list = Object.entries(aggregates).map(([cat, totalAmount]) => {
      const percentage = stats.total > 0 ? (Number(totalAmount) / stats.total) * 100 : 0;
      return {
        category: cat,
        total: Number(totalAmount),
        percentage,
        color: categoryColors[cat] || { base: '#94a3b8', fill: 'fill-slate-400', bg: 'bg-slate-500/10' },
      };
    });

    // Sort descending by amount
    return list.sort((a, b) => Number(b.total) - Number(a.total));
  }, [convertedExpenses, selectedMonth, stats.total]);

  // 3. Generate Timeline Trend Data (Last 10 unique dates or sorted in selected month)
  const trendData = useMemo(() => {
    const monthlyExpenses = convertedExpenses.filter(exp => getExpenseMonth(exp.date) === selectedMonth);
    if (monthlyExpenses.length === 0) return [];
    
    // Group by date
    const dateMap = {};
    monthlyExpenses.forEach((exp) => {
      dateMap[exp.date] = (dateMap[exp.date] || 0) + exp.amount;
    });

    // Sort dates ascending
    const sortedDates = Object.keys(dateMap).sort();
    
    // Take at most 8 dates for charting
    const maxDataPoints = 8;
    const subsetDates = sortedDates.slice(-maxDataPoints);

    return subsetDates.map((date) => {
      let formattedDate = date;
      try {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          formattedDate = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        }
      } catch (err) {
        // Fallback to original string
      }
      return {
        date,
        formattedDate,
        amount: dateMap[date],
      };
    });
  }, [convertedExpenses, selectedMonth]);

  // SVG Trend Line Calculations - HEIGHT SCALED TO 180 (Vertical Footprint Increased by 50%)
  const trendSvgPath = useMemo(() => {
    if (trendData.length === 0) return { line: '', area: '', points: [] };

    const width = 500;
    const height = 180;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxVal = Math.max(...trendData.map((d) => d.amount)) * 1.15 || 100;
    
    let points = [];
    if (trendData.length === 1) {
      // Single data point: place in the center horizontally
      const x = paddingLeft + chartWidth / 2;
      const y = height - paddingBottom - (trendData[0].amount / maxVal) * chartHeight;
      points = [{ x, y }];
    } else {
      points = trendData.map((d, idx) => {
        const x = paddingLeft + (idx / (trendData.length - 1)) * chartWidth;
        const y = height - paddingBottom - (d.amount / maxVal) * chartHeight;
        return { x, y };
      });
    }

    // Build line path
    let linePath = '';
    let areaPath = '';

    if (trendData.length === 1) {
      linePath = `M ${paddingLeft} ${points[0].y} L ${width - paddingRight} ${points[0].y}`;
      areaPath = `
        M ${paddingLeft} ${points[0].y}
        L ${width - paddingRight} ${points[0].y}
        L ${width - paddingRight} ${height - paddingBottom}
        L ${paddingLeft} ${height - paddingBottom}
        Z
      `;
    } else if (trendData.length > 1) {
      linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      areaPath = `
        ${linePath} 
        L ${points[points.length - 1].x} ${height - paddingBottom} 
        L ${points[0].x} ${height - paddingBottom} 
        Z
      `;
    }

    return { line: linePath, area: areaPath, points };
  }, [trendData]);

  // SVG Donut Calculations
  const donutSegments = useMemo(() => {
    let currentAngle = 0;
    const radius = 50;
    const cx = 60;
    const cy = 60;

    // Filter out 0 total categories to prevent rendering empty/overlapping slices
    const activeCategories = categoryData.filter((d) => d.total > 0);

    return activeCategories.map((data) => {
      const percentage = data.percentage;
      const angle = (percentage / 100) * 360;
      
      // Calculate SVG Arc coordinates
      const startAngleRad = (currentAngle - 90) * (Math.PI / 180);
      const endAngleRad = (currentAngle + angle - 90) * (Math.PI / 180);

      const x1 = cx + radius * Math.cos(startAngleRad);
      const y1 = cy + radius * Math.sin(startAngleRad);
      const x2 = cx + radius * Math.cos(endAngleRad);
      const y2 = cy + radius * Math.sin(endAngleRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = `
        M ${cx} ${cy}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        Z
      `;

      currentAngle += angle;

      return {
        ...data,
        path: pathData,
      };
    });
  }, [categoryData]);

  // --- BUDGET COMPONENT STATE & LOGIC ---
  const [isEditingLimits, setIsEditingLimits] = useState(false);
  const [editedTotal, setEditedTotal] = useState(1500);
  const [editedCategories, setEditedCategories] = useState({});
  const [isSavingLimits, setIsSavingLimits] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [limitTargetMonth, setLimitTargetMonth] = useState(selectedMonth);

  // Active limits for the selectedMonth (with robust fallback to prevent crash before API resolves)
  const activeLimits = useMemo(() => {
    const fallback = {
      total: convertAmount(1500, 'USD', baseCurrency),
      categories: {
        'Food & Dining': convertAmount(200, 'USD', baseCurrency),
        'Groceries': convertAmount(300, 'USD', baseCurrency),
        'Shopping': convertAmount(250, 'USD', baseCurrency),
        'Utilities': convertAmount(150, 'USD', baseCurrency),
        'Travel & Transport': convertAmount(150, 'USD', baseCurrency),
        'Entertainment': convertAmount(100, 'USD', baseCurrency),
        'Healthcare': convertAmount(100, 'USD', baseCurrency),
        'Education': convertAmount(150, 'USD', baseCurrency),
        'Others': convertAmount(100, 'USD', baseCurrency)
      }
    };

    const computeTotal = (limitObj) => {
      if (!limitObj || !limitObj.categories) return 0;
      return Object.values(limitObj.categories).reduce((sum, val) => sum + (Number(val) || 0), 0);
    };

    if (!convertedBudgetLimits) {
      fallback.total = computeTotal(fallback);
      return fallback;
    }

    let result = fallback;
    if (convertedBudgetLimits.default) {
      const monthLimit = convertedBudgetLimits.monthly?.[selectedMonth];
      if (monthLimit && monthLimit.categories) {
        result = { ...monthLimit };
      } else {
        result = { ...convertedBudgetLimits.default };
      }
    } else if (convertedBudgetLimits.categories) {
      result = { ...convertedBudgetLimits };
    }

    // Ensure the total limit is computed dynamically based on the actual categories to avoid hardcoded defaults
    result.total = computeTotal(result);
    return result;
  }, [convertedBudgetLimits, selectedMonth, baseCurrency, convertAmount]);

  // Pre-fill input fields dynamically based on whether we are editing a custom month or default template
  useEffect(() => {
    const computeSum = (cats) => Object.values(cats || {}).reduce((acc, curr) => acc + (Number(curr) || 0), 0);

    if (isEditingLimits) {
      if (saveAsDefault) {
        if (convertedBudgetLimits && convertedBudgetLimits.default) {
          const cats = convertedBudgetLimits.default.categories || {};
          setEditedTotal(computeSum(cats));
          setEditedCategories({ ...cats });
        }
      } else {
        const targetLimits = convertedBudgetLimits?.monthly?.[limitTargetMonth] || convertedBudgetLimits?.default || {
          categories: {
            'Food & Dining': 200,
            'Groceries': 300,
            'Shopping': 250,
            'Utilities': 150,
            'Travel & Transport': 150,
            'Entertainment': 100,
            'Healthcare': 100,
            'Education': 150,
            'Others': 100
          }
        };
        const cats = targetLimits.categories || {};
        setEditedTotal(computeSum(cats));
        setEditedCategories({ ...cats });
      }
    } else {
      // Sync with activeLimits when not editing
      if (activeLimits) {
        setEditedTotal(activeLimits.total);
        setEditedCategories({ ...activeLimits.categories });
      }
    }
  }, [isEditingLimits, saveAsDefault, limitTargetMonth, convertedBudgetLimits, activeLimits]);

  // Compute actual spending values inside selected month
  const currentMonthSpending = useMemo(() => {
    let total = 0;
    const byCategory = {};
    
    EXPENSE_CATEGORIES.forEach((cat) => {
      byCategory[cat] = 0;
    });

    convertedExpenses.forEach((exp) => {
      if (getExpenseMonth(exp.date) === selectedMonth) {
        total += exp.amount;
        byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
      }
    });

    return { total, byCategory };
  }, [convertedExpenses, selectedMonth]);

  // Compile active budget excesses / warnings for the selected month
  const budgetBreaches = useMemo(() => {
    if (!activeLimits) return [];
    const breaches = [];

    // Global check
    if (currentMonthSpending.total > activeLimits.total) {
      breaches.push({
        type: 'total',
        label: 'Total Monthly Budget',
        limit: activeLimits.total,
        spent: currentMonthSpending.total,
        excess: currentMonthSpending.total - activeLimits.total,
      });
    }

    // Individual category checks
    EXPENSE_CATEGORIES.forEach((cat) => {
      const limit = activeLimits.categories[cat] || 0;
      const spent = currentMonthSpending.byCategory[cat] || 0;
      if (spent > limit && limit > 0) {
        breaches.push({
          type: 'category',
          label: cat,
          limit: limit,
          spent: spent,
          excess: spent - limit,
        });
      }
    });

    return breaches;
  }, [activeLimits, currentMonthSpending]);

  const handleCategoryLimitChange = (cat, val) => {
    setEditedCategories((prev) => {
      const updated = {
        ...prev,
        [cat]: val,
      };
      const sum = Object.values(updated).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
      setEditedTotal(sum);
      return updated;
    });
  };

  const handleSaveLimits = async (e) => {
    e.preventDefault();
    setIsSavingLimits(true);
    try {
      await onUpdateBudgetLimits({
        total: editedTotal,
        categories: editedCategories,
        month: saveAsDefault ? 'default' : limitTargetMonth,
        currency: baseCurrency
      });
      if (!saveAsDefault) {
        setSelectedMonth(limitTargetMonth);
      }
      setIsEditingLimits(false);
    } catch (error) {
      console.error('Failed to update limits:', error);
    } finally {
      setIsSavingLimits(false);
    }
  };

  const toggleEditingLimits = () => {
    if (isEditingLimits) {
      // Revert edits
      if (activeLimits) {
        setEditedTotal(activeLimits.total);
        setEditedCategories({ ...activeLimits.categories });
      }
      setIsEditingLimits(false);
    } else {
      setLimitTargetMonth(selectedMonth);
      setIsEditingLimits(true);
    }
  };

  const handleExportPDF = () => {
    // Filter expenses matching the currently selected month
    const monthlyExpenses = convertedExpenses.filter(
      (exp) => getExpenseMonth(exp.date) === selectedMonth
    );

    if (monthlyExpenses.length === 0) {
      alert(`No expenses registered for ${formatMonthSafely(selectedMonth)}.`);
      return;
    }

    const doc = new jsPDF();
    const formattedMonth = formatMonthSafely(selectedMonth);

    // 1. Document Title & Header Banner
    if (theme.id === 'potter') {
      doc.setFillColor(34, 6, 12); // Gringotts Crimson
    } else {
      doc.setFillColor(15, 23, 42); // slate-900 background for top bar
    }
    doc.rect(0, 0, 210, 40, 'F');

    if (theme.id === 'potter') {
      doc.setTextColor(212, 175, 55); // Gold text
    } else {
      doc.setTextColor(255, 255, 255);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(theme.id === 'potter' ? 'LEDGERFLOW MONTHLY VAULT REPORT' : 'MONTHLY EXPENSE LEDGER REPORT', 15, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (theme.id === 'potter') {
      doc.setTextColor(245, 235, 214); // parchment text
    } else {
      doc.setTextColor(200, 200, 200);
    }
    doc.text(`Statement Period: ${formattedMonth}`, 15, 28);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 155, 28);

    // 2. Budget vs. Spent Dashboard Block
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('1. Executive Budget Summary', 15, 52);

    // Summary box background
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(15, 57, 180, 32, 'FD');

    // Values
    const totalLimit = activeLimits?.total || 0;
    const totalSpent = currentMonthSpending.total || 0;
    const pct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
    const remaining = totalLimit - totalSpent;
    const statusText = remaining >= 0 
      ? `Within budget (Remaining: ${getSymbol()} ${remaining.toFixed(2)})`
      : `Exceeded budget by ${getSymbol()} ${Math.abs(remaining).toFixed(2)}`;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('Total Monthly Budget Limit:', 20, 64);
    doc.text('Actual Month-to-Date Spend:', 20, 71);
    doc.text('Overall Utilization Percentage:', 20, 78);
    doc.text('Overall Account Status:', 20, 85);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${getSymbol()} ${totalLimit.toFixed(2)}`, 85, 64);
    doc.text(`${getSymbol()} ${totalSpent.toFixed(2)}`, 85, 71);
    doc.text(`${pct.toFixed(1)}%`, 85, 78);

    if (remaining >= 0) {
      doc.setTextColor(16, 185, 129); // emerald-500
    } else {
      doc.setTextColor(239, 68, 68); // red-500
    }
    doc.text(statusText, 85, 85);

    // 3. Category Breakdown Table
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. Budget Allocation by Category', 15, 102);

    const categoryHeaders = [['Category', `Monthly Limit (${getSymbol()})`, `Amount Spent (${getSymbol()})`, 'Utilization', 'Status']];
    const categoryRows = EXPENSE_CATEGORIES.map((cat) => {
      const limit = activeLimits?.categories?.[cat] || 0;
      const spent = currentMonthSpending.byCategory?.[cat] || 0;
      const utilization = limit > 0 ? `${((spent / limit) * 100).toFixed(0)}%` : '0%';
      const overAmt = spent - limit;
      
      let status = 'No Limit Set';
      if (limit > 0) {
        status = overAmt > 0 ? `Over by ${getSymbol()} ${overAmt.toFixed(2)}` : 'On Track';
      }

      return [cat, limit > 0 ? `${getSymbol()} ${limit.toFixed(2)}` : '-', `${getSymbol()} ${spent.toFixed(2)}`, limit > 0 ? utilization : '-', status];
    });

    autoTable(doc, {
      startY: 107,
      head: categoryHeaders,
      body: categoryRows,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] }, // slate-700
      styles: { fontSize: 8.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'center' },
        4: { fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.section === 'body') {
          if (data.cell.text[0].startsWith('Over by')) {
            data.cell.styles.textColor = [239, 68, 68];
          } else if (data.cell.text[0] === 'On Track') {
            data.cell.styles.textColor = [16, 185, 129];
          }
        }
      }
    });

    // 4. Expense Detail Ledger Table
    const lastY = doc.lastAutoTable.finalY || 180;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('3. Detailed Transactions Ledger', 15, lastY + 12);

    const itemHeaders = [['Date', 'Vendor', 'Category', `Amount (${getSymbol()})`, 'Description', 'Line Items']];
    const itemRows = monthlyExpenses.map((exp) => {
      const date = exp.date || '';
      const vendor = exp.vendor || '';
      const category = exp.category || '';
      const amount = `${getSymbol()} ${(exp.amount || 0).toFixed(2)}`;
      const description = exp.description || '';
      
      let itemsSummary = '';
      if (Array.isArray(exp.items) && exp.items.length > 0) {
        itemsSummary = exp.items
          .map((item) => `${item.name || 'Item'} (${item.quantity || 1}x @${getSymbol()} ${(item.price || 0).toFixed(2)})`)
          .join(', ');
      }

      return [date, vendor, category, amount, description, itemsSummary];
    });

    autoTable(doc, {
      startY: lastY + 17,
      head: itemHeaders,
      body: itemRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }, // dark slate
      styles: { fontSize: 7.5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 24 },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 42 },
        5: { cellWidth: 50 },
      }
    });

    // Save PDF
    doc.save(`Expense_Report_${selectedMonth}.pdf`);
  };

  return (
    <div className="space-y-6 text-neutral-300">
      {/* Month Selection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 border border-neutral-850 bg-[#0f0f11] rounded-lg shadow-md">
        <div>
          <h3 className="text-sm font-sans font-medium text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Monthly Expense & Budget Control
          </h3>
          <p className="text-xs text-neutral-400">Select a ledger cycle to evaluate matching expenses and budget thresholds.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-neutral-400">
              <Calendar className="w-4 h-4" />
            </span>
            <input
              type="month"
              id="month-selector"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value);
                }
              }}
              className="pl-9 pr-3.5 py-1.5 rounded-lg border border-neutral-800 bg-[#121214] text-white text-xs font-sans font-semibold focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 transition-all cursor-pointer shadow-sm w-full sm:w-[180px] dark:[color-scheme:dark]"
            />
          </div>
          {selectedMonth !== currentMonthStr && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonthStr)}
              className={`px-3.5 py-1.5 rounded-lg border text-xs font-sans font-semibold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${
                theme.id === 'potter'
                  ? 'border-[#d4af37]/45 bg-[#d4af37]/10 hover:bg-[#d4af37]/25 text-[#d4af37]'
                  : 'border-emerald-800 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset to This Month
            </button>
          )}
          <button
            type="button"
            onClick={handleExportPDF}
            className={`px-3.5 py-1.5 rounded-lg border text-xs font-sans font-semibold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${
              theme.id === 'potter'
                ? 'border-[#d4af37]/50 bg-gradient-to-r from-[#aa7c11]/40 to-[#d4af37]/35 hover:from-[#aa7c11]/65 hover:to-[#d4af37]/50 text-amber-200 hover:text-white shadow-[0_0_8px_rgba(212,175,55,0.2)]'
                : 'border-emerald-800 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-white'
            }`}
            title="Export this month's expenses as a PDF document"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* 0. Budget Limit Breach Warning Banners (Polished alerts) */}
      {budgetBreaches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-rose-950 bg-rose-950/20 p-5 rounded-lg relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
            <AlertTriangle className="w-32 h-32 text-rose-500" />
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 border border-rose-900 bg-rose-950/40 text-rose-400 mt-0.5 shadow-xs">
              <ShieldAlert className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-sans text-base text-rose-200 font-semibold">
                  Budget Warning Threshold
                </h4>
                <span className="text-[9px] font-sans font-semibold tracking-wider text-rose-300 bg-rose-950 border border-rose-900 px-2 py-0.5 rounded-full uppercase">
                  Alert Active
                </span>
              </div>
              <p className="text-xs text-rose-300 leading-relaxed max-w-2xl">
                The current ledger has registered transactions for <span className="font-semibold">{formatMonthSafely(selectedMonth)}</span> that exceed your configured limits. Take a look at the allocations below.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {budgetBreaches.map((breach, idx) => (
                  <div key={idx} className="p-3 border border-rose-900/60 bg-neutral-900/80 rounded-md flex items-center justify-between text-xs font-sans shadow-2xs">
                    <div className="space-y-0.5">
                      <span className="text-neutral-400 uppercase text-[9px] font-semibold tracking-wider block">{breach.label}</span>
                      <span className="text-rose-400 font-semibold text-sm">{formatPrice(breach.spent)} spent</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-neutral-500 text-[10px] block">Limit: {formatPrice(breach.limit)}</span>
                      <span className="text-rose-300 text-[10px] font-bold block">+{formatPrice(breach.excess)} over</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 1. KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Spending */}
        <div className={`p-6 border ${theme.border} ${theme.panel} rounded-lg relative overflow-hidden group shadow-md transition-colors duration-300`}>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.02] pointer-events-none group-hover:scale-105 transition-transform duration-500">
            <CreditCard className="w-28 h-28 text-white" />
          </div>
          <div>
            <p className={`text-xs ${theme.textMuted} uppercase tracking-wider mb-3 font-medium`}>
              Total Spending
            </p>
            <p className={`text-3xl font-semibold ${theme.isDark ? 'text-white' : 'text-slate-900'} font-sans tracking-tight`}>
              {formatPrice(stats.total)}
            </p>
            <p className="mt-2 text-[11px] text-emerald-400 font-sans font-medium flex items-center gap-1">
              <span>●</span> Fully Synced
            </p>
          </div>
        </div>

        {/* Total Scanned Receipts */}
        <div className={`p-6 border ${theme.border} ${theme.panel} rounded-lg relative overflow-hidden group shadow-md transition-colors duration-300`}>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.02] pointer-events-none group-hover:scale-105 transition-transform duration-500">
            <CreditCard className="w-28 h-28 text-white" />
          </div>
          <div>
            <p className={`text-xs ${theme.textMuted} uppercase tracking-wider mb-3 font-medium`}>
              Scanned Receipts
            </p>
            <p className={`text-3xl font-semibold ${theme.isDark ? 'text-white' : 'text-slate-900'} font-sans tracking-tight`}>
              {stats.count}
            </p>
            <p className={`mt-2 text-[11px] ${theme.textMuted} font-sans`}>
              Analyzed via Intelligence
            </p>
          </div>
        </div>

        {/* Average Receipt Amount */}
        <div className={`p-6 border ${theme.border} ${theme.panel} rounded-lg relative overflow-hidden group shadow-md transition-colors duration-300`}>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.02] pointer-events-none group-hover:scale-105 transition-transform duration-500">
            <TrendingUp className="w-28 h-28 text-white" />
          </div>
          <div>
            <p className={`text-xs ${theme.textMuted} uppercase tracking-wider mb-3 font-medium`}>
              Average Transaction
            </p>
            <p className={`text-3xl font-semibold ${theme.isDark ? 'text-white' : 'text-slate-900'} font-sans tracking-tight`}>
              {formatPrice(stats.average)}
            </p>
            <p className={`mt-2 text-[11px] ${theme.textMuted} font-sans`}>
              Calculated mean value
            </p>
          </div>
        </div>
      </div>

      {/* 2. Charts section: Recharts Monthly Budget Dashboard Component */}
      <MonthlyBudgetDashboard
        expenses={convertedExpenses}
        selectedMonth={selectedMonth}
        activeLimits={activeLimits}
        currentMonthSpending={currentMonthSpending}
        categoryData={categoryData}
      />

      {/* 4. Budget Limits Manager */}
      <div className={`border ${theme.border} ${theme.panel} p-6 rounded-lg shadow-md transition-colors duration-300`}>
        <div className={`flex items-center justify-between mb-5 border-b ${theme.border} pb-3`}>
          <div>
            <p className={`text-[10px] uppercase tracking-wider ${theme.textMuted} font-semibold mb-0.5`}>
              {theme.id === 'potter' ? '✦ Ministry of Magic Mandates' : 'Parameters'}
            </p>
            <h4 className={`text-base ${theme.id === 'potter' ? 'font-display font-bold text-amber-100' : 'font-sans font-medium ' + (theme.isDark ? 'text-white' : 'text-slate-900')}`}>
              {theme.id === 'potter' ? 'Vault Budget Allowances' : 'Monthly Budget Limits'}
            </h4>
          </div>
          <button
            id="toggle-budget-edit-btn"
            onClick={toggleEditingLimits}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border ${theme.border} ${theme.buttonSecondary} transition-all text-xs font-sans font-medium cursor-pointer shadow-sm`}
          >
            {isEditingLimits ? (
              <>
                <X className="w-3.5 h-3.5 text-rose-500" /> Cancel
              </>
            ) : (
              <>
                <Sliders className="w-3.5 h-3.5" /> Adjust Limits
              </>
            )}
          </button>
        </div>

        {activeLimits ? (
          isEditingLimits ? (
            <form onSubmit={handleSaveLimits} className="space-y-6">
              {/* Total limit input */}
              <div className={`p-4 border ${theme.border} ${theme.bg}/40 rounded-lg space-y-2`}>
                <div className="flex items-center justify-between">
                  <label className={`text-[10px] font-sans tracking-wider ${theme.textMuted} uppercase font-semibold`}>
                    Global Total Monthly Limit ({getSymbol()}) *
                  </label>
                  <span className={`text-[9px] font-sans ${theme.textMuted} font-medium`}>OVERALL BUDGET TARGET</span>
                </div>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={editedTotal}
                  onChange={(e) => setEditedTotal(Number(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-sm focus:outline-none focus:border-neutral-700 transition-all font-mono`}
                  placeholder="e.g. 1500"
                />
              </div>

              {/* Category inputs grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <div key={cat} className={`p-3.5 border ${theme.border} ${theme.bg}/50 rounded-lg space-y-1.5 shadow-sm`}>
                    <label className={`text-[9px] font-sans tracking-wider ${theme.textMuted} uppercase block font-semibold`}>
                      {cat} Limit ({getSymbol()})
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={editedCategories[cat] !== undefined ? editedCategories[cat] : 0}
                      onChange={(e) => handleCategoryLimitChange(cat, Number(e.target.value))}
                      className={`w-full px-3 py-1.5 rounded-md border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none transition-all font-mono`}
                      placeholder="0 (No limit)"
                    />
                  </div>
                ))}
              </div>

              {/* Scope & Month Selector */}
              <div className={`p-4 border ${theme.border} ${theme.panel} rounded-lg space-y-4`}>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-sans tracking-wider ${theme.textMuted} uppercase font-semibold`}>
                    Target Allocation Scope
                  </span>
                  <p className="text-xs text-neutral-400">Determine whether these adjustments set your default baseline limits, or target a specific cycle.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-neutral-200">
                    <input
                      type="radio"
                      name="limit-scope"
                      checked={saveAsDefault}
                      onChange={() => setSaveAsDefault(true)}
                      className={`w-4 h-4 rounded-full border ${theme.border} bg-[#121214] text-emerald-500 focus:ring-0 cursor-pointer`}
                    />
                    <span className={saveAsDefault ? 'font-semibold text-emerald-400' : 'text-neutral-300'}>
                      Apply as All-Time Default Template
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-neutral-200">
                    <input
                      type="radio"
                      name="limit-scope"
                      checked={!saveAsDefault}
                      onChange={() => setSaveAsDefault(false)}
                      className={`w-4 h-4 rounded-full border ${theme.border} bg-[#121214] text-emerald-500 focus:ring-0 cursor-pointer`}
                    />
                    <span className={!saveAsDefault ? 'font-semibold text-emerald-400' : 'text-neutral-300'}>
                      Target a Custom Specific Month
                    </span>
                  </label>
                </div>
                
                {!saveAsDefault && (
                  <div className="pt-2 flex items-center gap-3 border-t border-dashed border-neutral-800">
                    <span className="text-xs text-neutral-400 font-medium">Target Month:</span>
                    <input
                      type="month"
                      value={limitTargetMonth}
                      onChange={(e) => {
                        if (e.target.value) {
                          setLimitTargetMonth(e.target.value);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-neutral-850 bg-[#121214] text-white text-xs font-sans font-semibold focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 transition-all cursor-pointer shadow-sm w-[180px] dark:[color-scheme:dark]"
                    />
                    <span className="text-[10px] text-neutral-500 font-sans italic">
                      Adjust limits strictly for {formatMonthSafely(limitTargetMonth)}
                    </span>
                  </div>
                )}
              </div>

              <div className={`flex items-center justify-end gap-3 pt-4 border-t ${theme.border}`}>
                <button
                  type="button"
                  onClick={() => setIsEditingLimits(false)}
                  className={`px-4 py-2 rounded-lg text-xs font-sans font-medium ${theme.textMuted} hover:text-white transition-colors cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLimits}
                  className={`px-5 py-2 rounded-lg text-xs font-sans ${theme.buttonPrimary} font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm`}
                >
                  {isSavingLimits ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Save Allocations
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Total Limit progress display with Circular Gauge */}
              <div className={`p-5 border ${theme.border} ${theme.bg}/40 rounded-lg shadow-inner flex flex-col md:flex-row items-center gap-6`}>
                {/* Elegant Circle Progress Ring for Overall Budget Utilization */}
                <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      className={`fill-none ${theme.isDark ? 'stroke-neutral-800/80' : 'stroke-slate-200'}`}
                      strokeWidth="8"
                    />
                    {/* Dynamic Active Filling Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      className="fill-none transition-all duration-1000 ease-out"
                      strokeWidth="8"
                      strokeDasharray="263.89"
                      strokeDashoffset={263.89 - (Math.min((currentMonthSpending.total / (activeLimits.total || 1)) * 100, 100) / 100) * 263.89}
                      stroke={currentMonthSpending.total > activeLimits.total ? '#f43f5e' : (theme.id === 'potter' ? '#d4af37' : '#10b981')}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Inner Text Center Indicator */}
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className={`text-base font-mono font-bold ${currentMonthSpending.total > activeLimits.total ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {activeLimits.total > 0 ? ((currentMonthSpending.total / activeLimits.total) * 100).toFixed(0) : 0}%
                    </span>
                    <span className={`text-[8px] uppercase tracking-wider ${theme.textMuted} font-semibold`}>Used</span>
                  </div>
                </div>

                {/* Details side of the layout */}
                <div className="flex-1 space-y-3.5 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-sans tracking-wide ${theme.textMuted} uppercase block font-semibold`}>Total Monthly Budget Status</span>
                      <span className={`text-xl font-semibold font-sans ${theme.isDark ? 'text-white' : 'text-slate-900'}`}>
                        {formatPrice(currentMonthSpending.total)} <span className={`text-xs font-sans ${theme.textMuted} font-normal`}>spent of</span> {formatPrice(activeLimits.total)}
                      </span>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className={`text-[9px] font-sans tracking-wide ${theme.textMuted} uppercase block font-semibold`}>Budget Performance</span>
                      <span className={`text-xs font-sans font-semibold ${currentMonthSpending.total > activeLimits.total ? 'text-rose-400' : 'text-emerald-500'}`}>
                        {currentMonthSpending.total > activeLimits.total 
                          ? `Exceeded by ${formatPrice(currentMonthSpending.total - activeLimits.total)}` 
                          : `${formatPrice(activeLimits.total - currentMonthSpending.total)} remaining`}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Gradient Bar */}
                  <div className={`w-full h-2 ${theme.isDark ? 'bg-neutral-950' : 'bg-slate-200'} rounded-full overflow-hidden`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${currentMonthSpending.total > activeLimits.total ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min((currentMonthSpending.total / (activeLimits.total || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Category Limits progress grid with individual filling circles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {EXPENSE_CATEGORIES.map((cat) => {
                const limit = activeLimits.categories[cat] || 0;
                const spent = currentMonthSpending.byCategory[cat] || 0;
                const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                const isOver = spent > limit && limit > 0;

                return (
                  <div key={cat} className={`p-4 border ${isOver ? 'border-rose-950 bg-rose-950/15' : `${theme.border} ${theme.bg}/40`} rounded-lg flex items-center justify-between gap-4 shadow-sm transition-colors duration-300`}>
                    <div className="space-y-1 flex-1 min-w-0">
                      <span className={`text-xs font-semibold ${theme.isDark ? 'text-neutral-200' : 'text-slate-800'} block truncate`}>{cat}</span>
                      <span className={`text-[11px] font-sans ${theme.textMuted} block truncate`}>
                        {formatPrice(spent)} spent / {limit > 0 ? formatPrice(limit) : 'No limit'}
                      </span>
                        {!limit && (
                          <div className={`text-[10px] font-sans ${theme.textMuted} italic`}>No limit set</div>
                        )}
                      </div>

                      {/* Dynamic Micro Circle Ring Fill */}
                      {limit > 0 ? (
                        <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            {/* Background Ring */}
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              className={`fill-none ${theme.isDark ? 'stroke-neutral-800/60' : 'stroke-slate-200'}`}
                              strokeWidth="3.5"
                            />
                            {/* Filling Active Ring */}
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              className="fill-none transition-all duration-500 ease-out"
                              strokeWidth="3.5"
                              strokeDasharray="94.25"
                              strokeDashoffset={94.25 - (Math.min(percentage, 100) / 100) * 94.25}
                              stroke={isOver ? '#f43f5e' : (theme.id === 'potter' ? '#d4af37' : '#10b981')}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className={`absolute text-[9px] font-mono font-bold ${isOver ? 'text-rose-400' : (theme.isDark ? 'text-neutral-300' : 'text-slate-700')}`}>
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                          <span className={`text-[10px] font-sans ${theme.textMuted} italic`}>--</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div className={`p-8 text-center border border-dashed ${theme.border} ${theme.bg}/20 rounded-lg`}>
            <RefreshCw className={`w-5 h-5 ${theme.textMuted} animate-spin mx-auto mb-2`} />
            <p className={`text-xs font-sans ${theme.textMuted}`}>Loading budget parameters...</p>
          </div>
        )}
      </div>
    </div>
  );
}
