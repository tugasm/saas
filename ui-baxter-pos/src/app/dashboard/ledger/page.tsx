'use client';

import { useEffect, useState, useMemo } from 'react';
import { ledger } from '@/lib/api';
import { 
  Plus, FileSpreadsheet, Search, Filter, 
  ArrowDownLeft, ArrowUpRight, Wallet, X, Calendar 
} from 'lucide-react';

export default function Ledger() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State Filter
  const [filters, setFilters] = useState({
    search: '',
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // Start of month
    end_date: new Date().toISOString().split('T')[0], // Today
  });

  // State Form
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'income', 
    category: '',
    amount: 0,
    description: '',
    reference: '',
  });

  useEffect(() => {
    loadData();
  }, [filters.start_date, filters.end_date]); // Reload only on date change, search is manual trigger usually better

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await ledger.getAll({
        start_date: filters.start_date,
        end_date: filters.end_date,
        search: filters.search
      });
      
      // Sort Oldest to Newest for running balance calculation
      const sortedData = (res.data || []).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      setData(sortedData);
    } catch (error) {
      console.error('Error loading ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await ledger.create(formData);
      alert('Entry recorded successfully!');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save entry');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleExport = async () => {
    alert("Excel export feature is coming soon!");
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'income',
      category: '',
      amount: 0,
      description: '',
      reference: '',
    });
  };

  // --- RUNNING BALANCE CALCULATION ---
  const { processedData, totalDebit, totalCredit, endingBalance } = useMemo(() => {
    let runningBalance = 0;
    let tDebit = 0;
    let tCredit = 0;

    const processed = data.map(item => {
        // Map Type to Debit/Credit
        // Standard Accounting: Income = Debit (Increase Asset), Expense = Credit (Decrease Asset)
        // Note: This assumes "Cash Ledger". For Revenue Ledger it might be opposite. 
        // We stick to Cash perspective here (Debit = Money In).
        
        const isDebit = item.type === 'income';
        const debitAmount = isDebit ? item.amount : 0;
        const creditAmount = !isDebit ? item.amount : 0;

        tDebit += debitAmount;
        tCredit += creditAmount;
        
        runningBalance += (debitAmount - creditAmount);

        return {
            ...item,
            debit: debitAmount,
            credit: creditAmount,
            balance: runningBalance
        };
    });

    return {
        processedData: processed,
        totalDebit: tDebit,
        totalCredit: tCredit,
        endingBalance: runningBalance
    };
  }, [data]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      
      {/* 1. HEADER & HIGHLIGHTS */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Header & Actions */}
          <div className="xl:col-span-1 flex flex-col justify-between h-full space-y-6">
              <div>
                  <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <Wallet className="text-slate-600"/> General Ledger
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">Track financial movements and balance.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <button
                      onClick={handleExport}
                      className="flex items-center justify-center gap-2 px-4 py-3 shadow-soft text-slate-600 rounded-lg hover:bg-slate-50 font-bold text-sm transition shadow-sm"
                  >
                      <FileSpreadsheet size={18} /> Export
                  </button>
                  <button
                      onClick={() => setShowForm(true)}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm transition shadow-soft-md"
                  >
                      <Plus size={18} /> Add Entry
                  </button>
              </div>
          </div>

          {/* Stats Cards */}
          <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Debit Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden group hover:border-emerald-300 transition">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition"><ArrowDownLeft size={80}/></div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Debit (In)</p>
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><ArrowDownLeft size={24}/></div>
                      <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalDebit)}</h3>
                  </div>
              </div>

              {/* Credit Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100 relative overflow-hidden group hover:border-rose-300 transition">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition"><ArrowUpRight size={80}/></div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Credit (Out)</p>
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ArrowUpRight size={24}/></div>
                      <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalCredit)}</h3>
                  </div>
              </div>

              {/* Balance Card */}
              <div className="bg-blue-600 p-6 rounded-2xl shadow-soft-lg text-white relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ending Balance</p>
                  <h3 className="text-3xl font-bold tracking-tight">{formatCurrency(endingBalance)}</h3>
                  <p className="text-xs text-slate-500 mt-2">Period: {new Date(filters.start_date).toLocaleDateString()} - {new Date(filters.end_date).toLocaleDateString()}</p>
              </div>
          </div>
      </div>

      {/* 2. FILTER BAR */}
      <div className="bg-white p-5 rounded-2xl shadow-soft flex flex-col lg:flex-row gap-4 items-end">
         <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase">Search Reference</label>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="text"
                        placeholder="Description, Invoice Ref..."
                        value={filters.search}
                        onChange={e => setFilters({...filters, search: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 shadow-soft rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase">From Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="date"
                        value={filters.start_date}
                        onChange={e => setFilters({...filters, start_date: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 shadow-soft rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-slate-900 outline-none transition"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase">To Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="date"
                        value={filters.end_date}
                        onChange={e => setFilters({...filters, end_date: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 shadow-soft rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-slate-900 outline-none transition"
                    />
                </div>
            </div>
         </div>
         <button 
            onClick={loadData}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 h-[38px]"
         >
            <Filter size={16}/> Apply Filter
         </button>
      </div>

      {/* 3. LEDGER TABLE */}
      <div className="bg-white shadow-soft rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 w-32">Date</th>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4 w-40">Ref / Category</th>
                        <th className="px-6 py-4 text-right text-emerald-700 bg-emerald-50/30 w-40">Debit</th>
                        <th className="px-6 py-4 text-right text-rose-700 bg-rose-50/30 w-40">Credit</th>
                        <th className="px-6 py-4 text-right bg-slate-100 w-40">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading records...</td></tr>
                    ) : processedData.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-12 text-slate-400 italic">No entries found for this period.</td></tr>
                    ) : (
                        processedData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition group">
                                <td className="px-6 py-3 whitespace-nowrap font-medium text-slate-600">
                                    {new Date(item.date).toLocaleDateString('en-GB')}
                                </td>
                                <td className="px-6 py-3">
                                    <p className="text-slate-900 font-medium">{item.description}</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">By: {item.creator?.name || 'System'}</p>
                                </td>
                                <td className="px-6 py-3">
                                    {item.reference && (
                                        <span className="block text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded w-fit mb-1 shadow-soft">
                                            {item.reference}
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-500 capitalize">{item.category || 'General'}</span>
                                </td>
                                
                                {/* DEBIT */}
                                <td className="px-6 py-3 text-right font-mono text-emerald-600 bg-emerald-50/10 font-bold">
                                    {item.debit > 0 ? formatCurrency(item.debit) : <span className="text-slate-200">-</span>}
                                </td>

                                {/* CREDIT */}
                                <td className="px-6 py-3 text-right font-mono text-rose-600 bg-rose-50/10 font-bold">
                                    {item.credit > 0 ? formatCurrency(item.credit) : <span className="text-slate-200">-</span>}
                                </td>

                                {/* BALANCE */}
                                <td className="px-6 py-3 text-right font-mono font-bold text-slate-800 bg-slate-50 group-hover:bg-slate-100 transition">
                                    {formatCurrency(item.balance)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
                {/* FOOTER TOTAL */}
                {!loading && processedData.length > 0 && (
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-700">
                        <tr>
                            <td colSpan={3} className="px-6 py-4 text-right text-slate-500 text-xs uppercase tracking-wider">Total This Period</td>
                            <td className="px-6 py-4 text-right text-emerald-700 font-mono">{formatCurrency(totalDebit)}</td>
                            <td className="px-6 py-4 text-right text-rose-700 font-mono">{formatCurrency(totalCredit)}</td>
                            <td className="px-6 py-4 text-right text-slate-900 bg-slate-100 font-mono">{formatCurrency(endingBalance)}</td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
      </div>

      {/* 4. MODAL ADD ENTRY */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-soft-xl overflow-hidden scale-100">
            
            {/* Header */}
            <div className={`p-5 flex justify-between items-center ${formData.type === 'income' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {formData.type === 'income' ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                    {formData.type === 'income' ? 'Record Income (Debit)' : 'Record Expense (Credit)'}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-white/80 hover:text-white transition"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleCreateEntry} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full shadow-soft p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className={`w-full border p-2.5 rounded-lg font-bold text-sm outline-none appearance-none ${
                                formData.type === 'income' 
                                    ? 'text-emerald-700 border-emerald-200 bg-emerald-50 focus:ring-emerald-500' 
                                    : 'text-rose-700 border-rose-200 bg-rose-50 focus:ring-rose-500'
                            }`}
                        >
                            <option value="income">Debit (Incoming)</option>
                            <option value="expense">Credit (Outgoing)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Amount (IDR)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 font-bold">Rp</span>
                        <input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                            className="w-full pl-10 p-3 shadow-soft rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 outline-none"
                            placeholder="0"
                            min="0"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Category</label>
                        <input
                            type="text"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full shadow-soft p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                            placeholder="e.g. Operational"
                            list="ledger_categories"
                            required
                        />
                        <datalist id="ledger_categories">
                            <option value="Operational"/>
                            <option value="Tukar QRIS"/>
                            <option value="Salary"/>
                            <option value="Maintenance"/>
                            <option value="Marketing"/>
                            <option value="Adjustment"/>
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Reference (Opt)</label>
                        <input
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full shadow-soft p-2.5 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slate-900 outline-none"
                            placeholder="INV-001"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full shadow-soft p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none min-h-[80px]"
                        placeholder="Details about this entry..."
                        required
                    />
                </div>

                <div className="pt-2 flex gap-3">
                    <button 
                        type="button" 
                        onClick={() => setShowForm(false)} 
                        className="flex-1 py-3 shadow-soft text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50 transition"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className={`flex-1 py-3 text-white rounded-lg font-bold text-sm shadow-md transition ${
                            formData.type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                        }`}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Entry'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}