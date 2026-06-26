'use client';

import { useEffect, useState } from 'react';
import { cashflow, shifts } from '@/lib/api';
import ShiftReportSections from '@/components/ShiftReportSections';
import {
  Plus, Minus, Upload, TrendingUp, TrendingDown,
  Wallet, FileText, X, Loader2, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CashFlow() {
  const [data, setData] = useState<any[]>([]);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [shiftReport, setShiftReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'in' | 'out'>('in');
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    evidence: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const shiftRes = await shifts.current();
      const shift = shiftRes.data?.shift || null;
      setCurrentShift(shift);
      setSummary(shiftRes.data?.summary || null);

      if (shift) {
        const [cashflowRes, reportRes] = await Promise.all([
          cashflow.getAll({ current_shift: true }),
          shifts.report(shift.id),
        ]);
        setData(Array.isArray(cashflowRes.data) ? cashflowRes.data : []);
        setShiftReport(reportRes.data?.report || null);
      } else {
        setData([]);
        setShiftReport(null);
      }
    } catch (error) {
      console.error('Error loading cash flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, evidence: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const amount = parseRupiahInput(formData.amount);
      if (amount <= 0) {
        toast.error('Nominal harus lebih dari 0');
        setIsSubmitting(false);
        return;
      }

      if (formType === 'in') {
        const payload = { ...formData, amount, category: formData.category || 'general' };
        await cashflow.cashIn(payload);
        toast.success('Pemasukan berhasil dicatat!');
      } else {
        if (!formData.evidence) {
          toast.error('Upload bukti struk diperlukan untuk pengeluaran!');
          setIsSubmitting(false);
          return;
        }
        const payload = { ...formData, amount, category: formData.category || 'operational' };
        await cashflow.cashOut(payload);
        toast.success('Pengeluaran berhasil dicatat!');
      }
      setShowForm(false);
      setFormData({ amount: '', description: '', category: '', evidence: '' });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const parseRupiahInput = (value: string) => {
    return Number(value.replace(/[^\d]/g, '')) || 0;
  };

  const formatRupiahInput = (value: string) => {
    const digits = value.replace(/[^\d]/g, '').replace(/^0+/, '');
    if (!digits) return '';
    return new Intl.NumberFormat('id-ID').format(Number(digits));
  };

  const totalIn = data.filter((d) => d.type === 'in').reduce((sum, d) => sum + d.amount, 0);
  const totalOut = data.filter((d) => d.type === 'out').reduce((sum, d) => sum + d.amount, 0);
  const netCashFlow = totalIn - totalOut;
  const expectedClosing = (currentShift?.opening_balance || 0) + netCashFlow;

  // --- COMPONENT: STAT CARD ---
  const StatCard = ({ label, value, type }: { label: string, value: number, type: 'in' | 'out' | 'net' }) => {
      const isPositive = value >= 0;
      const config = {
          in: { icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          out: { icon: ArrowUpRight, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
          net: { icon: Wallet, color: isPositive ? 'text-blue-600' : 'text-amber-600', bg: isPositive ? 'bg-blue-50' : 'bg-amber-50', border: isPositive ? 'border-blue-100' : 'border-amber-100' }
      }[type];
      
      const Icon = config.icon;

      return (
          <div className={`p-6 rounded-2xl border ${config.border} bg-white flex flex-col justify-between h-32 hover:shadow-sm transition`}>
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">{label}</p>
                      <h3 className={`text-2xl font-bold ${config.color}`}>{formatRupiah(value)}</h3>
                  </div>
                  <div className={`p-2.5 rounded-lg ${config.bg} ${config.color}`}>
                      <Icon size={20} />
                  </div>
              </div>
          </div>
      )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[50vh]"><Loader2 className="animate-spin text-slate-400 h-8 w-8"/></div>;
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      
      {/* HEADER & STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Title Section */}
          <div className="lg:col-span-1 flex flex-col justify-center">
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Shift Management</h1>
              <p className="text-slate-500 text-sm mb-6">
                {currentShift ? `Shift aktif #${currentShift.id}` : 'Buka shift terlebih dahulu untuk mencatat kas.'}
              </p>
              
              <div className="flex gap-3">
                  <button
                    onClick={() => { setFormType('in'); setFormData({ amount: '', description: '', category: 'general', evidence: '' }); setShowForm(true); }}
                    disabled={!currentShift}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
                  >
                    <Plus size={16} /> Income
                  </button>
                  <button
                    onClick={() => { setFormType('out'); setFormData({ amount: '', description: '', category: 'operational', evidence: '' }); setShowForm(true); }}
                    disabled={!currentShift}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
                  >
                    <Minus size={16} /> Expense
                  </button>
              </div>
          </div>

          {/* Stats Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard label="Start Balance" value={currentShift?.opening_balance || 0} type="net" />
              <StatCard label="Total Income" value={summary?.cash_in ?? totalIn} type="in" />
              <StatCard label="Total Expense" value={totalOut} type="out" />
              <StatCard label="Expected Closing" value={expectedClosing} type="net" />
          </div>
      </div>

      <hr className="border-slate-200"/>

      {shiftReport && (
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">Shift Report</h2>
            <p className="text-xs text-slate-500 mt-1">Ringkasan penjualan, pembayaran, laba/rugi, dan pesanan dibatalkan.</p>
          </div>
          <ShiftReportSections report={shiftReport} compact />
        </div>
      )}

      <hr className="border-slate-200"/>

      {/* TRANSACTION HISTORY TABLE */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-slate-400"/> Shift Cash Records
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {data.length} Records
            </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-4 w-32">Date</th>
                <th className="p-4 w-24">Type</th>
                <th className="p-4 w-32">Category</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-right w-40">Amount</th>
                <th className="p-4 w-32">Created By</th>
                <th className="p-4 text-center w-24">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition group">
                    <td className="p-4 text-slate-600">
                      {new Date(item.created_at).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}
                      <div className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        item.type === 'in' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {item.type === 'in' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded capitalize">
                        {item.category?.replace('_', ' ') || 'General'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-700 font-medium">
                      {item.description}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800">
                      <span className={item.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}>
                        {item.type === 'in' ? '+' : '-'} {formatRupiah(item.amount)}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 text-xs">
                      {item.creator?.name || 'System'}
                    </td>
                    <td className="p-4 text-center">
                      {item.evidence ? (
                        <button
                          onClick={() => setPreviewImage(item.evidence)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-bold hover:underline"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL (Minimalist Design) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-0 w-full max-w-md shadow-soft-xl overflow-hidden">
            
            {/* Header */}
            <div className={`p-5 flex justify-between items-center ${formType === 'in' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {formType === 'in' ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                    {formType === 'in' ? 'Record Income' : 'Record Expense'}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-white/80 hover:text-white transition"><X size={24}/></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Amount (Rp)</label>
                <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400 font-bold">Rp</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: formatRupiahInput(e.target.value) })}
                        className="w-full pl-10 pr-4 py-2.5 shadow-soft rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-transparent outline-none font-mono font-bold text-slate-800 text-lg"
                        placeholder="10.000"
                        required
                        autoFocus
                    />
                </div>
              </div>

              {/* Category Select */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Category</label>
                <div className="relative">
                    <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2.5 shadow-soft rounded-lg focus:ring-2 focus:ring-slate-800 outline-none appearance-none bg-white text-slate-700 font-medium"
                    >
                        {formType === 'in' ? (
                            <>
                            <option value="general">General Income</option>
                            <option value="tukar_qris">Tukar QRIS (Terima Tunai)</option>
                            <option value="modal">Capital Injection (Modal)</option>
                            <option value="refund_vendor">Vendor Refund</option>
                            </>
                        ) : (
                            <>
                            <option value="operational">Operational (Electricity/Water/Food)</option>
                            <option value="tukar_qris">Tukar QRIS (Setor Tunai)</option>
                            <option value="maintenance">Maintenance & Repairs</option>
                            <option value="marketing">Marketing & Ads</option>
                            <option value="salary">Salary / Bonus (Manual)</option>
                            {/* Opsi Loan dihapus sesuai instruksi agar via Employee Page */}
                            <option value="other">Other Expense</option>
                            </>
                        )}
                    </select>
                    {/* Helper Text for Expense */}
                    {formType === 'out' && (
                        <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1 bg-amber-50 p-1.5 rounded border border-amber-100">
                            💡 For Employee Loans (Kasbon), please use the <b>Employees</b> menu.
                        </p>
                    )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 shadow-soft rounded-lg focus:ring-2 focus:ring-slate-800 outline-none text-sm min-h-[80px]"
                  placeholder="Details about this transaction..."
                  required
                />
              </div>

              {/* Evidence Upload (Only for Expense) */}
              {formType === 'out' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Proof of Payment <span className="text-rose-500">*</span></label>
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      required={!formData.evidence}
                    />
                    {formData.evidence ? (
                        <div className="relative">
                            <img src={formData.evidence} alt="Proof" className="h-24 mx-auto rounded-md shadow-sm object-cover"/>
                            <p className="text-xs text-emerald-600 font-bold mt-2">Image Selected</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center py-2">
                            <Upload className="text-slate-400 mb-2" size={24} />
                            <p className="text-xs text-slate-500 font-medium">Click to upload receipt</p>
                        </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 shadow-soft rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-white font-bold transition shadow-md flex justify-center items-center gap-2 ${
                    formType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : 'Save Record'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-soft-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Proof of Payment</h3>
                <p className="text-xs text-slate-500">Receipt image for this shift record.</p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={20}/>
              </button>
            </div>
            <div className="bg-slate-50 p-4 max-h-[75vh] overflow-auto">
              <img
                src={previewImage}
                alt="Proof of payment"
                className="max-w-full mx-auto rounded-lg shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
