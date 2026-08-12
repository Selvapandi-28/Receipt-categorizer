/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { X, Check, Trash2, Plus, Calendar, FileText, ShoppingBag, AlertTriangle, Sparkles, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EXPENSE_CATEGORIES } from '../types';
import { useTheme } from '../theme.jsx';

const normalizeDateToYMD = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString().split('T')[0];
  }
  
  const cleaned = dateStr.trim();
  
  // 1. If it is already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // 2. Try native Date parsing
  try {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Proceed
  }
  
  // 3. Try DD/MM/YYYY or MM/DD/YYYY
  const parts = cleaned.split(/[-/]/);
  if (parts.length === 3) {
    // Check if YYYY is at the end
    if (parts[2].length === 4 && !isNaN(parts[2])) {
      const year = parts[2];
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      // Assume MM/DD/YYYY by default unless DD > 12
      if (p0 > 12) {
        // DD/MM/YYYY
        return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
      } else {
        // MM/DD/YYYY
        return `${year}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
    }
    // Check if YYYY is at the start
    if (parts[0].length === 4 && !isNaN(parts[0])) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }

  // Fallback to today
  return new Date().toISOString().split('T')[0];
};

export default function ReceiptConfirmationModal({
  pendingAnalysis,
  onClose,
  onConfirm,
}) {
  const { theme } = useTheme();
  
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Others');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with pending analysis values when opened
  useEffect(() => {
    if (pendingAnalysis && pendingAnalysis.result) {
      const { result } = pendingAnalysis;
      setVendor(result.vendor || '');
      setAmount(Number(result.amount || 0));
      setDate(normalizeDateToYMD(result.date));
      setCategory(result.category || 'Others');
      setDescription(result.description || '');
      setItems(result.items || []);
    }
  }, [pendingAnalysis]);

  if (!pendingAnalysis) return null;

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
      await onConfirm({
        vendor,
        amount,
        date,
        category,
        description,
        items,
      }, pendingAnalysis.base64Image);
    } catch (error) {
      console.error('Failed to confirm and save expense:', error);
      alert('Error saving verified receipt.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
        {/* Backdrop Clickable Area */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          id="confirmation-modal-box"
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 15 }}
          className={`relative w-full max-w-4xl ${theme.panel} border ${theme.border} rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] ${theme.text}`}
        >
          {/* Left panel: Receipt visual image preview */}
          <div className={`w-full md:w-[320px] ${theme.isDark ? 'bg-[#0f0f11]' : 'bg-slate-50'} p-6 border-b md:border-b-0 md:border-r ${theme.border} flex flex-col justify-between h-[300px] md:h-auto overflow-y-auto`}>
            <div>
              <h4 className={`font-sans text-xs ${theme.isDark ? 'text-amber-100' : 'text-slate-900'} font-semibold flex items-center gap-1.5 mb-4`}>
                <ShoppingBag className="w-4 h-4 text-neutral-500" />
                {theme.id === 'potter' ? 'Captured Parchment Scroll' : 'Scanned Receipt Image'}
              </h4>
              
              {pendingAnalysis.base64Image ? (
                <div className={`relative border ${theme.border} rounded-lg overflow-hidden ${theme.bg} shadow-inner flex items-center justify-center max-h-[400px] p-2`}>
                  <img
                    src={pendingAnalysis.base64Image}
                    alt="Scanned receipt preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto max-h-[350px] object-contain rounded-md"
                  />
                </div>
              ) : (
                <div className={`border border-dashed ${theme.border} rounded-lg p-6 text-center ${theme.isDark ? 'bg-[#0a0a0b]/40' : 'bg-slate-100/35'} flex flex-col items-center justify-center min-h-[220px]`}>
                  <FileText className="w-6 h-6 text-neutral-500 mb-2" />
                  <p className={`text-xs ${theme.textMuted} font-sans leading-relaxed`}>
                    No visual receipt preview available.
                  </p>
                </div>
              )}
            </div>

            <div className={`mt-4 pt-4 border-t ${theme.border} text-[10px] font-sans ${theme.textMuted} space-y-1`}>
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold uppercase tracking-wider text-[9px]">
                <Sparkles className="w-3.5 h-3.5" />
                Parsed via Gemini AI
              </div>
              <p className="leading-relaxed">Verify all parsed details below against your uploaded receipt image before saving to the database ledger.</p>
            </div>
          </div>

          {/* Right panel: Details Verification Form */}
          <div className={`flex-1 p-6 overflow-y-auto flex flex-col justify-between ${theme.panel}`}>
            <div>
              {/* Header section */}
              <div className={`flex items-center justify-between mb-6 pb-4 border-b ${theme.border}`}>
                <div className="flex items-center gap-3.5 min-w-0">
                  {pendingAnalysis.base64Image && (
                    <div className={`relative w-12 h-12 rounded-lg overflow-hidden border ${theme.border} bg-neutral-900 shadow-sm flex-shrink-0 group cursor-pointer`} title="Receipt source image preview">
                      <img
                        src={pendingAnalysis.base64Image}
                        alt="Receipt source thumbnail"
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-3.5 h-3.5 text-white stroke-[2]" />
                      </div>
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className={`text-[10px] font-sans uppercase font-bold tracking-wider ${theme.id === 'potter' ? 'text-amber-400' : 'text-neutral-500'} block truncate`}>
                      {theme.id === 'potter' ? '✦ Gringotts Wizarding Verification' : 'Review & Confirm Scanned Details'}
                    </span>
                    <h3 className={`font-sans font-bold text-base md:text-lg ${theme.isDark ? 'text-white' : 'text-slate-900'} mt-0.5 truncate`}>
                      Verify Receipt Ledger Entries
                    </h3>
                  </div>
                </div>
                <button
                  id="confirm-modal-close-btn"
                  onClick={onClose}
                  className={`p-2 rounded-lg border ${theme.border} ${theme.isDark ? 'bg-[#121214]' : 'bg-slate-50'} transition-colors ${theme.textMuted} hover:${theme.isDark ? 'text-white' : 'text-slate-900'} cursor-pointer shadow-sm flex-shrink-0`}
                  title="Discard Scan"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Row 1: Vendor & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-sans font-bold tracking-wider ${theme.textMuted} uppercase block`}>Vendor / Merchant Name *</label>
                    <input
                      id="confirm-vendor-input"
                      type="text"
                      required
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all shadow-inner`}
                      placeholder="e.g. Ayodhya Upachara, Starbucks"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-sans font-bold tracking-wider ${theme.textMuted} uppercase block`}>Transaction Date *</label>
                    <input
                      id="confirm-date-input"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all shadow-inner font-mono`}
                    />
                  </div>
                </div>

                {/* Row 2: Category & Total Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-sans font-bold tracking-wider ${theme.textMuted} uppercase block`}>Ledger Category *</label>
                    <select
                      id="confirm-category-select"
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
                    <label className={`text-[10px] font-sans font-bold tracking-wider ${theme.textMuted} uppercase block`}>Total Amount (₹) *</label>
                    <input
                      id="confirm-amount-input"
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all font-mono shadow-inner`}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-sans font-bold tracking-wider ${theme.textMuted} uppercase block`}>Description / Memo</label>
                  <input
                    id="confirm-description-input"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500 transition-all shadow-inner`}
                    placeholder="e.g. Purchases and bills"
                  />
                </div>

                {/* Line Items List */}
                <div className={`space-y-2 mt-4 pt-4 border-t ${theme.border}`}>
                  <div className="flex items-center justify-between">
                    <h5 className={`text-[10px] font-sans font-bold tracking-wider ${theme.textMuted} uppercase`}>Extracted Items Ledger</h5>
                    <button
                      id="confirm-add-item-btn"
                      type="button"
                      onClick={handleAddItem}
                      className={`flex items-center gap-1 text-[10px] font-sans font-semibold uppercase tracking-wider ${theme.isDark ? 'text-neutral-200 bg-[#121214]' : 'text-slate-800 bg-slate-50 hover:bg-slate-100'} border ${theme.border} px-2.5 py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer`}
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {items.length > 0 ? (
                      items.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            id={`confirm-item-name-${idx}`}
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                            className={`flex-1 min-w-[120px] px-2.5 py-1.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs focus:outline-none focus:border-neutral-500`}
                            placeholder="Item name"
                          />
                          <input
                            id={`confirm-item-price-${idx}`}
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleUpdateItem(idx, 'price', Number(e.target.value))}
                            className={`w-20 px-2.5 py-1.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs font-mono focus:outline-none focus:border-neutral-500`}
                            placeholder="Price"
                          />
                          <input
                            id={`confirm-item-qty-${idx}`}
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                            className={`w-16 px-2.5 py-1.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.isDark ? 'text-white' : 'text-slate-900'} text-xs font-mono focus:outline-none focus:border-neutral-500`}
                            placeholder="Qty"
                          />
                          <button
                            id={`confirm-remove-item-${idx}`}
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className={`p-1.5 border ${theme.border} ${theme.isDark ? 'bg-[#121214] hover:bg-[#1a1a1f] text-neutral-400' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'} rounded-lg transition-colors cursor-pointer shadow-sm`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className={`text-center p-4 border border-dashed ${theme.border} ${theme.isDark ? 'bg-[#0a0a0b]/20' : 'bg-slate-50/50'} rounded-lg`}>
                        <p className={`text-xs ${theme.textMuted} font-sans`}>
                          No itemized lists were parsed. Click 'Add Item' to create list items manually.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className={`mt-8 pt-4 border-t ${theme.border} flex items-center justify-between`}>
              <button
                id="confirm-discard-btn"
                type="button"
                onClick={onClose}
                className={`px-4 py-2 border ${theme.border} ${theme.buttonSecondary} rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer`}
              >
                Discard Scan
              </button>
              <button
                id="confirm-save-btn"
                disabled={isSaving}
                onClick={handleSave}
                className={`flex items-center gap-1.5 px-5 py-2 ${theme.buttonPrimary} rounded-lg text-xs font-sans font-medium shadow-sm transition-colors cursor-pointer`}
              >
                <Check className="w-3.5 h-3.5" /> 
                {isSaving ? 'Saving...' : 'Confirm & Save to Ledger'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
