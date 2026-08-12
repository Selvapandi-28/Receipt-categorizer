/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { X, Edit2, Check, Trash2, Plus, Calendar, FileText, ShoppingBag, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EXPENSE_CATEGORIES } from '../types';
import { useTheme } from '../theme.jsx';
import { useCurrency } from '../currency.jsx';

export default function ExpenseDetailModal({
  expense,
  onClose,
  onUpdateExpense,
  onDeleteExpense,
}) {
  const { theme } = useTheme();
  const { baseCurrency, convertAmount, formatPrice } = useCurrency();
  const [isEditing, setIsEditing] = useState(false);
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Others');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (expense) {
      setVendor(expense.vendor);
      setAmount(expense.originalAmount !== undefined ? expense.originalAmount : expense.amount);
      setDate(expense.date);
      setCategory(expense.category);
      setDescription(expense.description || '');
      setItems(expense.items || []);
      setIsEditing(false); // Reset editing mode
      setIsConfirmingDelete(false); // Reset delete confirmation state
    }
  }, [expense]);

  if (!expense) return null;

  const handleAddItem = () => {
    setItems([...items, { name: 'New Item', price: 0, quantity: 1 }]);
  };

  const handleUpdateItem = (idx, field, val) => {
    const updatedItems = [...items];
    updatedItems[idx] = {
      ...updatedItems[idx],
      [field]: val,
    };
    
    // Recalculate main amount if user modifies item prices directly
    let totalSum = 0;
    updatedItems.forEach((item) => {
      totalSum += Number(item.price || 0) * Number(item.quantity || 1);
    });
    setItems(updatedItems);
    setAmount(Number(totalSum.toFixed(2)));
  };

  const handleRemoveItem = (idx) => {
    const updatedItems = items.filter((_, i) => i !== idx);
    let totalSum = 0;
    updatedItems.forEach((item) => {
      totalSum += Number(item.price || 0) * Number(item.quantity || 1);
    });
    setItems(updatedItems);
    setAmount(Number(totalSum.toFixed(2)));
  };

  const handleSave = async () => {
    if (!vendor.trim() || amount <= 0 || !date) {
      alert('Please fill out all required fields with valid values.');
      return;
    }

    setIsSaving(true);
    try {
      const origCurrency = expense.originalCurrency || 'INR';
      const databaseAmount = convertAmount(amount, origCurrency, 'INR');

      await onUpdateExpense(expense.id, {
        vendor,
        amount: databaseAmount,
        date,
        category,
        description,
        items,
        originalAmount: amount,
        originalCurrency: origCurrency,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update expense:', error);
      alert('Error saving modifications.');
    } finally {
      setIsSaving(false);
    }
  };

  // Modern dynamic category styling maps
  const categoryStyles = {
    'Food & Dining': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-indigo-950/45 border border-indigo-900/40 text-indigo-300' : 'bg-indigo-50 border border-indigo-200 text-indigo-700'}`,
    'Groceries': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-emerald-950/45 border border-emerald-900/40 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`,
    'Shopping': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-amber-950/45 border border-amber-900/40 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700'}`,
    'Utilities': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-rose-950/45 border border-rose-900/40 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-700'}`,
    'Travel & Transport': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-sky-950/45 border border-sky-900/40 text-sky-300' : 'bg-sky-50 border border-sky-200 text-sky-700'}`,
    'Entertainment': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-purple-950/45 border border-purple-900/40 text-purple-300' : 'bg-purple-50 border border-purple-200 text-purple-700'}`,
    'Healthcare': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-teal-950/45 border border-teal-900/40 text-teal-300' : 'bg-teal-50 border border-teal-200 text-teal-700'}`,
    'Education': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-cyan-950/45 border border-cyan-900/40 text-cyan-300' : 'bg-cyan-50 border border-cyan-200 text-cyan-700'}`,
    'Others': `text-[10px] font-sans font-semibold rounded-full px-2.5 py-0.5 mt-1 inline-flex shadow-3xs ${theme.isDark ? 'bg-neutral-850 border border-neutral-800 text-neutral-350' : 'bg-slate-100 border border-slate-200 text-slate-700'}`,
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
        {/* Backdrop clickable Area */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          id="expense-modal-box"
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 15 }}
          className={`relative w-full max-w-4xl ${theme.panel} border ${theme.border} rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] ${theme.text}`}
        >
          {/* Left panel: Receipt visual image preview */}
          <div className={`w-full md:w-[320px] ${theme.isDark ? 'bg-[#0f0f11]' : 'bg-slate-50'} p-6 border-b md:border-b-0 md:border-r ${theme.border} flex flex-col justify-between h-[300px] md:h-auto overflow-y-auto`}>
            <div>
              <h4 className={`font-sans text-sm ${theme.isDark ? 'text-white' : 'text-slate-900'} font-semibold flex items-center gap-1.5 mb-4`}>
                <ShoppingBag className="w-4 h-4 text-neutral-500" />
                Receipt Image Record
              </h4>
              
              {expense.imageUrl ? (
                <div className={`relative border ${theme.border} rounded-lg overflow-hidden ${theme.bg} shadow-inner flex items-center justify-center max-h-[400px] p-2`}>
                  <img
                    src={expense.imageUrl}
                    alt="Receipt source scan"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto max-h-[350px] object-contain rounded-md"
                  />
                </div>
              ) : (
                <div className={`border border-dashed ${theme.border} rounded-lg p-6 text-center ${theme.isDark ? 'bg-[#0a0a0b]/40' : 'bg-slate-100/35'} flex flex-col items-center justify-center min-h-[220px]`}>
                  <FileText className="w-6 h-6 text-neutral-500 mb-2" />
                  <p className={`text-xs ${theme.textMuted} font-sans leading-relaxed`}>
                    No visual scanned receipt photo is stored with this record.
                  </p>
                </div>
              )}
            </div>

            <div className={`mt-4 pt-4 border-t ${theme.border} text-[10px] font-mono ${theme.textMuted} space-y-1`}>
              <div>Record ID: {expense.id}</div>
              <div>Added: {new Date(expense.createdAt).toLocaleString()}</div>
            </div>
          </div>

          {/* Right panel: Details & Form editors */}
          <div className={`flex-1 p-6 overflow-y-auto flex flex-col justify-between ${theme.panel}`}>
            <div>
              {/* Header section */}
              <div className={`flex items-center justify-between mb-6 pb-4 border-b ${theme.border}`}>
                <div>
                  <span className={`text-[10px] font-sans uppercase font-semibold tracking-wide ${theme.textMuted}`}>
                    Expense Breakdown
                  </span>
                  <h3 className={`font-sans font-bold text-xl ${theme.isDark ? 'text-white' : 'text-slate-900'} mt-0.5`}>
                    {isEditing ? 'Modify Details' : vendor}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="modal-edit-btn"
                    onClick={() => setIsEditing(!isEditing)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer shadow-sm ${
                      isEditing
                        ? `border ${theme.border} ${theme.isDark ? 'text-white bg-neutral-900' : 'text-slate-950 bg-slate-200'}`
                        : `border ${theme.border} ${theme.textMuted} ${theme.isDark ? 'bg-[#121214]' : 'bg-slate-50'} hover:${theme.isDark ? 'text-white' : 'text-slate-950'} hover:border-neutral-750`
                    }`}
                    title={isEditing ? 'Cancel Edit' : 'Edit Receipt Details'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id="modal-close-btn"
                    onClick={onClose}
                    className={`p-2 rounded-lg border ${theme.border} ${theme.isDark ? 'bg-[#121214]' : 'bg-slate-50'} transition-colors ${theme.textMuted} hover:${theme.isDark ? 'text-white' : 'text-slate-950'} cursor-pointer shadow-sm`}
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Editable Fields or Details View */}
              {isEditing ? (
                <div className="space-y-4">
                  {/* Row 1: Vendor & Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} block`}>Vendor Name *</label>
                      <input
                        id="edit-vendor-input"
                        type="text"
                        value={vendor}
                        onChange={(e) => setVendor(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all shadow-inner`}
                        placeholder="Starbucks Coffee"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} block`}>Transaction Date *</label>
                      <input
                        id="edit-date-input"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all shadow-inner font-mono`}
                      />
                    </div>
                  </div>

                  {/* Row 2: Category & Total Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} block`}>Category *</label>
                      <select
                        id="edit-category-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all cursor-pointer font-sans shadow-inner`}
                      >
                        {EXPENSE_CATEGORIES.map((cat) => (
                           <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} block`}>
                        Total Amount ({expense.originalCurrency || 'INR'}) *
                      </label>
                      <input
                        id="edit-amount-input"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all font-mono shadow-inner`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted} block`}>Description / Memo</label>
                    <input
                      id="edit-description-input"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all shadow-inner`}
                      placeholder="e.g. Lunch with team members"
                    />
                  </div>

                  {/* Line Items Editor */}
                  <div className={`space-y-2 mt-4 pt-4 border-t ${theme.border}`}>
                    <div className="flex items-center justify-between">
                      <h5 className={`text-[10px] font-sans font-semibold tracking-wider ${theme.textMuted}`}>Line Items List</h5>
                      <button
                        id="add-item-btn"
                        type="button"
                        onClick={handleAddItem}
                        className={`flex items-center gap-1 text-[11px] font-sans font-medium ${theme.isDark ? 'text-neutral-200 bg-[#121214]' : 'text-slate-800 bg-slate-50 hover:bg-slate-100'} border ${theme.border} px-2.5 py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer`}
                      >
                        <Plus className="w-3 h-3" /> Add Item
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            id={`item-name-input-${idx}`}
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                            className={`flex-1 min-w-[120px] px-2.5 py-1.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500`}
                            placeholder="Item name"
                          />
                          <input
                            id={`item-price-input-${idx}`}
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleUpdateItem(idx, 'price', Number(e.target.value))}
                            className={`w-20 px-2.5 py-1.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs font-mono focus:outline-none focus:border-neutral-500`}
                            placeholder="Price"
                          />
                          <input
                            id={`item-qty-input-${idx}`}
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                            className={`w-16 px-2.5 py-1.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs font-mono focus:outline-none focus:border-neutral-500`}
                            placeholder="Qty"
                          />
                          <button
                            id={`remove-item-btn-${idx}`}
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className={`p-1.5 border ${theme.border} ${theme.isDark ? 'bg-[#121214] hover:bg-[#1a1a1f] text-neutral-400' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'} rounded-lg transition-colors cursor-pointer shadow-sm`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Info Row block */}
                  <div className={`grid grid-cols-2 sm:grid-cols-3 gap-6 ${theme.isDark ? 'bg-[#0a0a0b]/40' : 'bg-slate-50'} rounded-xl p-4 border ${theme.border} shadow-sm`}>
                    <div>
                      <span className={`text-[10px] font-sans ${theme.textMuted} uppercase font-semibold tracking-wider block`}>Total Amount</span>
                      <span className={`font-sans text-2xl ${theme.isDark ? 'text-white' : 'text-slate-955'} font-bold tracking-tight`}>
                        {formatPrice(convertAmount(expense.amount, 'INR', baseCurrency))}
                      </span>
                    </div>
                    <div>
                      <span className={`text-[10px] font-sans ${theme.textMuted} uppercase font-semibold tracking-wider block`}>Transaction Date</span>
                      <span className={`text-xs font-sans font-medium ${theme.isDark ? 'text-neutral-200' : 'text-slate-850'} flex items-center gap-1.5 mt-2`}>
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        {new Date(expense.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          timeZone: 'UTC'
                        })}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className={`text-[10px] font-sans ${theme.textMuted} uppercase font-semibold tracking-wider block`}>Category Tag</span>
                      <div className="mt-1">
                        <span className={categoryStyles[expense.category]}>
                          {expense.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h5 className={`text-[10px] font-sans font-semibold ${theme.textMuted} uppercase mb-1.5 tracking-wider`}>Memo / Description</h5>
                    <p className={`text-xs ${theme.isDark ? 'text-neutral-300 bg-[#0a0a0b]/30' : 'text-slate-800 bg-slate-50'} p-3.5 rounded-lg border ${theme.border} leading-relaxed font-sans shadow-sm`}>
                      {expense.description || 'No custom memo or description logged with this purchase.'}
                    </p>
                  </div>

                  {/* Scanned Line Items List representation */}
                  <div className="space-y-2">
                    <h5 className={`text-[10px] font-sans font-semibold ${theme.textMuted} uppercase tracking-wider`}>Extracted Line Items</h5>
                    {items.length > 0 ? (
                      <div className={`border ${theme.border} rounded-lg overflow-hidden ${theme.panel} shadow-md`}>
                        <table className="w-full text-left text-xs">
                          <thead className={`${theme.isDark ? 'bg-[#0a0a0b]/40 text-neutral-400' : 'bg-slate-50 text-slate-600'} uppercase font-sans text-[10px] font-semibold tracking-wider border-b ${theme.border}`}>
                            <tr>
                              <th className="py-2.5 px-4">Item Name / Description</th>
                              <th className="py-2.5 px-3 text-right">Price</th>
                              <th className="py-2.5 px-3 text-center">Qty</th>
                              <th className="py-2.5 px-4 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${theme.isDark ? 'divide-neutral-900' : 'divide-slate-200'} text-[11px] font-mono ${theme.textMuted}`}>
                            {items.map((item, idx) => (
                              <tr key={idx} className={`hover:${theme.isDark ? 'bg-[#121214]/30' : 'bg-slate-100/50'} transition-colors`}>
                                <td className={`py-2.5 px-4 font-sans text-xs font-medium ${theme.isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
                                  {item.name}
                                </td>
                                <td className={`py-2.5 px-3 text-right ${theme.textMuted}`}>
                                  {formatPrice(convertAmount(item.price, expense.originalCurrency || 'INR', baseCurrency))}
                                </td>
                                <td className={`py-2.5 px-3 text-center ${theme.textMuted}`}>
                                  {item.quantity}
                                </td>
                                <td className={`py-2.5 px-4 text-right ${theme.isDark ? 'text-white' : 'text-slate-950'} font-semibold font-sans text-xs`}>
                                  {formatPrice(convertAmount(Number(item.price) * Number(item.quantity), expense.originalCurrency || 'INR', baseCurrency))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={`text-center p-6 border border-dashed ${theme.border} ${theme.isDark ? 'bg-[#0a0a0b]/20' : 'bg-slate-50/50'} rounded-lg`}>
                        <p className={`text-xs ${theme.textMuted} font-sans`}>
                          No itemized details were parsed for this receipt.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Row */}
            <div className={`mt-8 pt-4 border-t ${theme.border} flex items-center justify-between`}>
              <div>
                {!isEditing && (
                  isConfirmingDelete ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-sans font-semibold uppercase text-rose-400 tracking-wider flex items-center gap-1 bg-rose-950/40 border border-rose-900/60 px-2.5 py-1 rounded-md">
                        <AlertTriangle className="w-3.5 h-3.5" /> Delete entry?
                      </span>
                      <button
                        id="modal-delete-confirm-btn"
                        onClick={() => onDeleteExpense(expense.id)}
                        className="px-2.5 py-1 text-[10px] font-sans font-medium rounded-lg border border-rose-900 bg-rose-950/60 text-rose-300 hover:bg-rose-900 hover:text-rose-200 transition-all cursor-pointer shadow-sm"
                      >
                        Yes
                      </button>
                      <button
                        id="modal-delete-cancel-btn"
                        onClick={() => setIsConfirmingDelete(false)}
                        className={`px-2.5 py-1 text-[10px] font-sans font-medium rounded-lg border ${theme.border} ${theme.buttonSecondary} cursor-pointer shadow-sm`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      id="modal-delete-btn"
                      onClick={() => setIsConfirmingDelete(true)}
                      className={`flex items-center gap-1.5 text-xs font-sans font-medium ${theme.textMuted} hover:text-rose-400 transition-colors cursor-pointer`}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Entry
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      id="modal-cancel-edit-btn"
                      onClick={() => setIsEditing(false)}
                      className={`px-4 py-2 border ${theme.border} ${theme.buttonSecondary} rounded-lg text-xs font-sans font-medium cursor-pointer`}
                    >
                      Cancel
                    </button>
                    <button
                      id="modal-save-btn"
                      disabled={isSaving}
                      onClick={handleSave}
                      className={`flex items-center gap-1.5 px-4 py-2 ${theme.buttonPrimary} rounded-lg text-xs font-sans font-medium shadow-sm transition-colors cursor-pointer`}
                    >
                      <Check className="w-3.5 h-3.5" /> Save Changes
                    </button>
                  </>
                ) : (
                  <button
                    id="modal-done-btn"
                    onClick={onClose}
                    className={`px-5 py-2 ${theme.buttonPrimary} rounded-lg text-xs font-sans font-medium shadow-sm transition-colors cursor-pointer`}
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
