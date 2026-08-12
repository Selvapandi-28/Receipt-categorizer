import { useState, useMemo } from 'react';
import { useCurrency } from '../currency.jsx';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { EXPENSE_CATEGORIES } from '../types';
import { useTheme } from '../theme.jsx';
import { TrendingUp, AlertTriangle, ShieldCheck, PieChart as PieIcon, BarChart2 } from 'lucide-react';

export default function MonthlyBudgetDashboard({ 
  expenses, 
  selectedMonth, 
  activeLimits, 
  currentMonthSpending,
  categoryData
}) {
  const { theme } = useTheme();
  const { baseCurrency, formatPrice, getSymbol } = useCurrency();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'bar', 'pie'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Prepare data for the Bar Chart: Budget vs Spent
  const barChartData = useMemo(() => {
    return EXPENSE_CATEGORIES.map(cat => {
      const budget = activeLimits?.categories?.[cat] || 0;
      const spent = currentMonthSpending?.byCategory?.[cat] || 0;
      return {
        category: cat,
        Budget: budget,
        Spent: Number(spent.toFixed(2)),
        status: budget > 0 ? (spent > budget ? 'Over' : 'On Track') : 'No Limit'
      };
    });
  }, [activeLimits, currentMonthSpending]);

  // Prepare data for the Pie Chart: Category distribution of spent amount
  const pieChartData = useMemo(() => {
    const totalSpent = currentMonthSpending?.total || 0;

    return categoryData
      .filter(item => {
        const limit = activeLimits?.categories?.[item.category] || 0;
        return item.total > 0 || limit > 0;
      })
      .map(item => {
        const limit = activeLimits?.categories?.[item.category] || 0;
        const utilization = limit > 0 ? (item.total / limit) * 100 : 0;
        const pctOfSpend = totalSpent > 0 ? (item.total / totalSpent) * 100 : 0;
        
        return {
          name: item.category,
          value: Number(item.total.toFixed(2)),
          percentageOfSpend: Number(pctOfSpend.toFixed(1)),
          limit,
          utilization: Number(utilization.toFixed(1)),
          color: item.color.base,
          isRemaining: false
        };
      });
  }, [categoryData, activeLimits, currentMonthSpending]);

  // Potter vs Default Theme Colors
  const colors = useMemo(() => {
    if (theme.id === 'potter') {
      return {
        budget: '#aa7c11',
        spent: '#d4af37',
        spentOver: '#e11d48',
        text: '#f5e5b3',
        grid: '#22060c',
        tooltipBg: '#1c050a',
        tooltipBorder: '#d4af37'
      };
    }
    return {
      budget: theme.isDark ? '#475569' : '#94a3b8',
      spent: '#3b82f6',
      spentOver: '#ef4444',
      text: theme.isDark ? '#94a3b8' : '#475569',
      grid: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      tooltipBg: theme.isDark ? '#0f0f11' : '#ffffff',
      tooltipBorder: theme.isDark ? '#1e293b' : '#e2e3e5'
    };
  }, [theme]);

  // Calculate insights
  const insights = useMemo(() => {
    let topOverCategory = null;
    let maxOverspend = 0;
    let savings = 0;
    let alertCount = 0;

    EXPENSE_CATEGORIES.forEach(cat => {
      const limit = activeLimits?.categories?.[cat] || 0;
      const spent = currentMonthSpending?.byCategory?.[cat] || 0;
      if (limit > 0) {
        if (spent > limit) {
          alertCount++;
          const over = spent - limit;
          if (over > maxOverspend) {
            maxOverspend = over;
            topOverCategory = cat;
          }
        } else {
          savings += (limit - spent);
        }
      }
    });

    // If overall total limit is set and greater than 0, use totalLimit - totalSpent for the true remaining budget balance
    const totalLimit = activeLimits?.total || 0;
    const totalSpent = currentMonthSpending?.total || 0;
    if (totalLimit > 0) {
      savings = Math.max(0, totalLimit - totalSpent);
    }

    return {
      topOverCategory,
      maxOverspend,
      savings,
      alertCount
    };
  }, [activeLimits, currentMonthSpending]);

  // Custom tooltips matching theme
  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const budget = payload[0]?.value || 0;
      const spent = payload[1]?.value || 0;
      const diff = budget - spent;
      return (
        <div className={`p-3 rounded-lg border shadow-lg font-sans text-xs`} style={{ backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder }}>
          <p className="font-semibold text-white mb-2">{label}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-6" style={{ color: colors.budget }}>
              <span>Limit:</span>
              <span className="font-mono font-bold">{formatPrice(budget)}</span>
            </p>
            <p className="flex justify-between gap-6" style={{ color: spent > budget && budget > 0 ? colors.spentOver : colors.spent }}>
              <span>Spent:</span>
              <span className="font-mono font-bold">{formatPrice(spent)}</span>
            </p>
            {budget > 0 && (
              <p className={`flex justify-between gap-6 mt-1.5 pt-1.5 border-t border-dashed border-neutral-700 font-medium ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span>{diff >= 0 ? 'Remaining:' : 'Over-budget:'}</span>
                <span className="font-mono">{formatPrice(Math.abs(diff))}</span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { name, value, limit, utilization, color, percentageOfSpend } = payload[0].payload;

      return (
        <div className="p-3 rounded-lg border shadow-lg font-sans text-xs" style={{ backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder }}>
          <p className="font-semibold text-white mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            {name}
          </p>
          <div className="space-y-1">
            <p className="flex justify-between gap-6 text-neutral-300">
              <span>Amount Spent:</span>
              <span className="font-mono font-bold">{formatPrice(value)}</span>
            </p>
            
            <p className="flex justify-between gap-6 text-neutral-400">
              <span>Share of Spend:</span>
              <span className="font-mono text-amber-400 font-semibold">{percentageOfSpend}%</span>
            </p>

            {limit > 0 && (
              <>
                <p className="flex justify-between gap-6 text-neutral-400 border-t border-dashed border-neutral-700/60 pt-1 mt-1">
                  <span>Category Limit:</span>
                  <span className="font-mono">{formatPrice(limit)}</span>
                </p>
                <p className="flex justify-between gap-6 text-neutral-400">
                  <span>Limit Utilized:</span>
                  <span className={`font-mono font-semibold ${utilization > 100 ? 'text-rose-400' : 'text-amber-400'}`}>
                    {utilization}%
                  </span>
                </p>
                <p className="flex justify-between gap-6 text-neutral-400">
                  <span>Remaining Limit:</span>
                  <span className={`font-mono font-semibold ${value > limit ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {value > limit ? `Overspent by ${formatPrice(value - limit)}` : `${formatPrice(limit - value)} left`}
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`border ${theme.border} ${theme.panel} p-6 rounded-lg shadow-md transition-colors duration-300 w-full`}>
      {/* Header with selector */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 border-b ${theme.border} pb-4 gap-4`}>
        <div>
          <p className={`text-[10px] uppercase tracking-wider ${theme.textMuted} font-semibold mb-0.5`}>
            {theme.id === 'potter' ? '✦ Wizarding Visualizations' : 'Monthly Budget Performance'}
          </p>
          <h4 className={`text-base ${theme.id === 'potter' ? 'font-display font-bold text-amber-100' : 'font-sans font-medium ' + (theme.isDark ? 'text-white' : 'text-slate-900')}`}>
            {theme.id === 'potter' ? 'Interactive Vault Ledger Charts' : 'Budget vs. Spent Analysis'}
          </h4>
        </div>

        {/* View Switcher buttons */}
        <div className={`flex items-center p-1 rounded-lg ${theme.isDark ? 'bg-neutral-900/60' : 'bg-slate-100'} border ${theme.border}`}>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium flex items-center gap-1 cursor-pointer transition-all ${
              activeTab === 'all'
                ? (theme.id === 'potter' ? 'bg-[#d4af37]/25 text-amber-200 border border-[#d4af37]/40' : 'bg-white dark:bg-neutral-800 text-blue-500 dark:text-white shadow-xs')
                : `text-neutral-400 hover:text-white`
            }`}
          >
            All Views
          </button>
          <button
            onClick={() => setActiveTab('bar')}
            className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium flex items-center gap-1 cursor-pointer transition-all ${
              activeTab === 'bar'
                ? (theme.id === 'potter' ? 'bg-[#d4af37]/25 text-amber-200 border border-[#d4af37]/40' : 'bg-white dark:bg-neutral-800 text-blue-500 dark:text-white shadow-xs')
                : `text-neutral-400 hover:text-white`
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Comparison
          </button>
          <button
            onClick={() => setActiveTab('pie')}
            className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium flex items-center gap-1 cursor-pointer transition-all ${
              activeTab === 'pie'
                ? (theme.id === 'potter' ? 'bg-[#d4af37]/25 text-amber-200 border border-[#d4af37]/40' : 'bg-white dark:bg-neutral-800 text-blue-500 dark:text-white shadow-xs')
                : `text-neutral-400 hover:text-white`
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            Distribution
          </button>
        </div>
      </div>

      {/* Optional Top Warning / Alert box */}
      {insights.alertCount > 0 && (
        <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 text-xs ${
          theme.id === 'potter' ? 'bg-rose-950/15 border-rose-900/40 text-rose-300' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
        }`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Budget Warning:</span> {insights.alertCount} {insights.alertCount === 1 ? 'category is' : 'categories are'} currently exceeding budget limits. 
            {insights.topOverCategory && (
              <span> Top excessive spend was in <strong className="text-white font-medium">{insights.topOverCategory}</strong>, overdrawn by {formatPrice(insights.maxOverspend)}.</span>
            )}
          </div>
        </div>
      )}

      {/* Grid of charts or single charts based on activeTab */}
      <div className={`grid grid-cols-1 ${activeTab === 'all' ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-8 items-stretch`}>
        
        {/* Comparison Bar Chart */}
        {(activeTab === 'all' || activeTab === 'bar') && (
          <div className="flex flex-col justify-between h-full space-y-4">
            <div>
              <p className={`text-[10px] uppercase tracking-wider ${theme.textMuted} font-semibold mb-1`}>
                LIMIT VS. EXPENDITURE
              </p>
              <h5 className={`text-xs ${theme.isDark ? 'text-white' : 'text-slate-900'} font-semibold mb-3`}>
                Category budget caps against actual spending
              </h5>
            </div>

            <div className="w-full h-[280px] min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis 
                    dataKey="category" 
                    tick={{ fill: colors.text, fontSize: 8 }} 
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    tickFormatter={(value) => value.split(' ')[0]} // Truncate long category names
                  />
                  <YAxis 
                    tick={{ fill: colors.text, fontSize: 9 }} 
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    tickFormatter={(val) => `${getSymbol()} ${val}`}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconSize={10} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: 10, fontFamily: 'Inter, sans-serif' }} 
                  />
                  <Bar 
                    dataKey="Budget" 
                    name="Limit Budget" 
                    fill={colors.budget} 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="Spent" 
                    name="Actual Spent" 
                    fill={colors.spent}
                    radius={[4, 4, 0, 0]}
                  >
                    {barChartData.map((entry, index) => {
                      const limit = entry.Budget;
                      const spent = entry.Spent;
                      const over = limit > 0 && spent > limit;
                      return <Cell key={`cell-${index}`} fill={over ? colors.spentOver : colors.spent} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Distribution Pie Chart */}
        {(activeTab === 'all' || activeTab === 'pie') && (
          <div className="flex flex-col justify-between h-full space-y-4">
            <div>
              <p className={`text-[10px] uppercase tracking-wider ${theme.textMuted} font-semibold mb-1`}>
                CONTRIBUTION BREAKDOWN
              </p>
              <h5 className={`text-xs ${theme.isDark ? 'text-white' : 'text-slate-900'} font-semibold mb-3`}>
                Share of total month spend per category
              </h5>
            </div>

            {pieChartData.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center flex-1">
                <div className="sm:col-span-6 h-[240px] relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive={false}
                        onMouseEnter={(_, index) => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {pieChartData.map((entry, index) => {
                          const isHovered = hoveredIndex === index;
                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.color} 
                              style={{
                                outline: 'none',
                                transition: 'opacity 200ms ease',
                                cursor: 'pointer'
                              }}
                              opacity={hoveredIndex !== null ? (isHovered ? 1 : 0.4) : 1}
                            />
                          );
                        })}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none text-center px-4 w-full max-w-[130px]">
                    {hoveredIndex !== null && pieChartData[hoveredIndex] ? (
                      <>
                        <span className={`text-[9px] uppercase tracking-wider ${theme.textMuted} font-semibold max-w-[105px] truncate`}>
                          {pieChartData[hoveredIndex].name}
                        </span>
                        <span className={`text-sm font-extrabold ${theme.isDark ? 'text-white' : 'text-slate-900'} font-mono mt-0.5`}>
                          {formatPrice(pieChartData[hoveredIndex].value)}
                        </span>
                        <span className="text-[10px] text-amber-400 font-bold mt-0.5 font-sans">
                          {pieChartData[hoveredIndex].percentageOfSpend}% of spend
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={`text-[9px] uppercase tracking-wider ${theme.textMuted} font-semibold`}>
                          Total Spent
                        </span>
                        <span className={`text-base font-extrabold ${theme.isDark ? 'text-white' : 'text-slate-900'} font-mono mt-0.5`}>
                          {formatPrice(currentMonthSpending.total)}
                        </span>
                        {activeLimits?.total > 0 && (
                          <span className={`text-[8px] ${theme.id === 'potter' ? 'text-amber-200/70' : 'text-neutral-400'} mt-0.5`}>
                            of {formatPrice(activeLimits.total)} Limit
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Legend container */}
                <div className="sm:col-span-6 pr-1.5 space-y-1.5">
                  {pieChartData.map((item, idx) => {
                    const isHovered = hoveredIndex === idx;
                    return (
                      <div 
                        key={idx} 
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className={`flex items-center justify-between py-2 px-2.5 text-xs font-sans rounded-lg transition-all duration-200 cursor-pointer border ${
                          isHovered 
                            ? (theme.id === 'potter'
                                ? 'bg-[#2b0a12] text-[#f5ebd6] border-[#d4af37]/45 shadow-[0_0_8px_rgba(212,175,55,0.15)]'
                                : (theme.isDark ? 'bg-neutral-800/40 text-white border-neutral-700/50' : 'bg-slate-100 text-slate-950 border-slate-200 shadow-xs')) 
                            : (theme.id === 'potter'
                                ? 'text-[#f5ebd6]/75 hover:text-[#f5ebd6] border-transparent'
                                : (theme.isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-slate-600 hover:text-slate-900') + ' border-transparent')
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span 
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-300 ${isHovered ? 'scale-125' : ''}`} 
                            style={{ backgroundColor: item.color }} 
                          />
                          <span className={`truncate font-medium ${
                            theme.id === 'potter'
                              ? 'text-[#f5ebd6]'
                              : (theme.isDark ? 'text-neutral-200' : 'text-slate-800')
                          }`}>
                            {item.name}
                          </span>
                        </div>
                        <div className="text-right pl-2 font-mono flex items-center gap-2.5 flex-shrink-0 justify-end">
                          <span className={`font-semibold ${
                            theme.id === 'potter'
                              ? 'text-amber-300'
                              : (theme.isDark ? 'text-neutral-100' : 'text-slate-800')
                          }`}>
                            {formatPrice(item.value)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {item.limit > 0 ? (
                              (() => {
                                const remainingBalance = item.limit - item.value;
                                const isOver = remainingBalance < 0;
                                return (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-sans border ${
                                    isOver
                                      ? (theme.id === 'potter'
                                          ? 'bg-rose-950/50 text-rose-300 border-rose-900/50 animate-pulse'
                                          : (theme.isDark
                                              ? 'bg-rose-950/40 text-rose-400 border-rose-900/30 animate-pulse'
                                              : 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'))
                                      : (theme.id === 'potter'
                                          ? 'bg-emerald-950/50 text-emerald-300 border-emerald-900/40'
                                          : (theme.isDark
                                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                                              : 'bg-emerald-50 text-emerald-600 border-emerald-200'))
                                  }`} title={isOver ? "Overdrawn from your budget cap" : "Remaining amount left to spend under your budget cap"}>
                                    {isOver ? `${formatPrice(Math.abs(remainingBalance))} over` : `${formatPrice(remainingBalance)} left`}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium font-sans border ${
                                theme.id === 'potter'
                                  ? 'bg-[#1b1512] text-[#f5ebd6]/65 border-[#d4af37]/15'
                                  : (theme.isDark
                                      ? 'bg-neutral-800 text-neutral-400 border-neutral-700/50'
                                      : 'bg-slate-100 text-slate-500 border-slate-200')
                              }`} title="No budget limit set for this category">
                                Unlimited
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={`h-[240px] flex flex-col items-center justify-center border border-dashed ${theme.border} rounded-lg`}>
                <p className={`text-xs ${theme.textMuted}`}>Awaiting transaction ledger entries to map contribution breakdown.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom quick metrics */}
      {pieChartData.length > 0 && (
        <div className={`mt-6 pt-4 border-t ${theme.border} grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${theme.id === 'potter' ? 'bg-amber-950/20 text-[#d4af37] border border-amber-950' : 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10'} flex-shrink-0`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-[10px] uppercase tracking-wider ${theme.textMuted} font-semibold block`}>Estimated Saving Potential</span>
              <p className={`font-mono font-semibold ${theme.isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {formatPrice(insights.savings)} remaining inside limits
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${theme.id === 'potter' ? 'bg-amber-950/20 text-[#d4af37] border border-amber-950' : 'bg-blue-500/5 text-blue-400 border border-blue-500/10'} flex-shrink-0`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-[10px] uppercase tracking-wider ${theme.textMuted} font-semibold block`}>Heavy Category Allocation</span>
              <p className={`font-semibold ${theme.isDark ? 'text-white' : 'text-slate-800'}`}>
                {pieChartData[0] ? (
                  <>
                    {pieChartData[0].name}{" "}
                    <span className="text-[10px] font-normal text-neutral-400 font-sans">
                      ({pieChartData[0].percentageOfSpend}% of spend
                      {pieChartData[0].limit > 0 ? `, ${pieChartData[0].utilization}% of limit` : ""})
                    </span>
                  </>
                ) : 'None'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
