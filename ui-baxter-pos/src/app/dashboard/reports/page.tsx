'use client';

import { useState, useEffect, useRef } from 'react';
import { reports, shifts } from '@/lib/api';
import ShiftReportSections from '@/components/ShiftReportSections';
import { 
  Download, Calendar, DollarSign, Filter, 
  Search, RefreshCcw, FileSpreadsheet, Loader2, X, ChevronDown, BarChart2, TrendingUp, ShoppingCart, Activity, Wallet
} from 'lucide-react';

export default function Reports() {
  const [loading, setLoading] = useState(false);
  
  // --- STATE 1: MONTHLY REPORT (EXISTING) ---
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [reportFilter, setReportFilter] = useState({
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
  });

  // --- STATE 2: SIMPLE EXPORT (EXISTING) ---
  const [exportFilter, setExportFilter] = useState({
    start_date: '',
    end_date: '',
  });

  // --- STATE 3: ADVANCED REPORT (NEW) ---
  const [advancedFilter, setAdvancedFilter] = useState({
    search: '', 
    payment_method: '', 
    status: '',
    start_date: new Date().toISOString().split('T')[0], 
    end_date: new Date().toISOString().split('T')[0],
  });
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [shiftList, setShiftList] = useState<any[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [shiftFilter, setShiftFilter] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [shiftReport, setShiftReport] = useState<any>(null);

  // --- STATE 4: AUTOCOMPLETE (NEW) ---
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null); 

  // --- EFFECT: CLICK OUTSIDE DROPDOWN ---
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  useEffect(() => {
    const loadShifts = async () => {
      if (!shiftFilter.start_date || !shiftFilter.end_date) {
        setShiftList([]);
        return;
      }

      try {
        const res = await shifts.getAll({ ...shiftFilter, limit: 200 });
        setShiftList(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error(error);
      }
    };
    loadShifts();
  }, [shiftFilter]);

  // --- EFFECT: AUTOCOMPLETE LOGIC ---
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (advancedFilter.search.length >= 2 && showDropdown) {
        setIsSuggesting(true);
        try {
          const res = await reports.transactions({
            search: advancedFilter.search,
          });
          
          const rawData = Array.isArray(res.data) ? res.data : res.data.data;
          const data = rawData || [];

          // Deduplikasi Customer
          const uniqueCustomers = new Map();
          data.forEach((trx: any) => {
            const name = trx.user?.name || trx.guest_name || 'Walk-in';
            if (!uniqueCustomers.has(name) && name !== 'Walk-in') {
               uniqueCustomers.set(name, {
                  id: trx.user_id,
                  name: name,
               });
            }
          });

          setSuggestions(Array.from(uniqueCustomers.values()).slice(0, 5));
        } catch (error) {
          console.error(error);
        } finally {
          setIsSuggesting(false);
        }
      } else if (advancedFilter.search.length < 2) {
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [advancedFilter.search, showDropdown]);

  // --- HANDLERS ---

  const handleSelectSuggestion = (customer: any) => {
    setAdvancedFilter({ ...advancedFilter, search: customer.name });
    setShowDropdown(false); 
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdvancedFilter({ ...advancedFilter, search: e.target.value });
    setShowDropdown(true); 
  };

  const loadMonthlyReport = async () => {
    setLoading(true);
    try {
      const res = await reports.monthly({
        year: reportFilter.year,
        month: reportFilter.month,
      });
      setMonthlyData(res.data);
    } catch (error) {
      alert('Gagal memuat laporan bulanan');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (mode: 'simple' | 'advanced') => {
    // Validasi Simple Export
    if (mode === 'simple' && (!exportFilter.start_date || !exportFilter.end_date)) {
      alert('Pilih tanggal mulai dan akhir terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      // Tentukan payload berdasarkan mode
      const params = mode === 'simple' ? exportFilter : {
        ...advancedFilter,
        is_advanced: true
      };

      const res = await reports.export(params);
      
      // Download Blob Logic
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_export_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Export gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancedSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await reports.transactions({
        search: advancedFilter.search,
        payment_method_id: advancedFilter.payment_method,
        status: advancedFilter.status,
        start_date: advancedFilter.start_date,
        end_date: advancedFilter.end_date,
      });
      
      const data = Array.isArray(res.data) ? res.data : res.data.data;
      setFilteredTransactions(data || []);
    } catch (error) {
      alert('Gagal mencari data');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadShiftReport = async () => {
    if (!selectedShiftId) return;
    setLoading(true);
    try {
      const res = await shifts.report(selectedShiftId);
      setShiftReport(res.data);
    } catch {
      alert('Gagal memuat laporan shift');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadShiftRangeReport = async () => {
    if (!shiftFilter.start_date || !shiftFilter.end_date) {
      alert('Pilih tanggal mulai dan akhir shift');
      return;
    }

    setLoading(true);
    try {
      const res = await shifts.rangeReport(shiftFilter);
      setShiftReport(res.data);
      setSelectedShiftId('');
    } catch {
      alert('Gagal memuat laporan range shift');
    } finally {
      setLoading(false);
    }
  };

  const handleShiftDateChange = (field: 'start_date' | 'end_date', value: string) => {
    setShiftFilter(prev => ({ ...prev, [field]: value }));
    setSelectedShiftId('');
    setShiftReport(null);
  };

  const handleResetFilter = () => {
    setAdvancedFilter({
      search: '',
      payment_method: '',
      status: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
    });
    setFilteredTransactions([]);
    setHasSearched(false);
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const isRangeShiftReport = Array.isArray(shiftReport?.shifts);
  const shiftSummary = shiftReport?.summary || {};
  const shiftReportTitle = isRangeShiftReport
    ? `${shiftReport?.period?.start_date || '-'} to ${shiftReport?.period?.end_date || '-'}`
    : shiftReport?.shift
      ? `Shift #${shiftReport.shift.id} - ${shiftReport.shift.cashier?.name || 'Cashier'}`
      : '';

  return (
    <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
      
      {/* 1. SECTION: MONTHLY OVERVIEW (REDESIGNED) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left: Control Panel */}
        <div className="xl:col-span-1 bg-white rounded-2xl shadow-soft p-6 h-fit">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><Calendar size={20}/></div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Period Overview</h2>
                    <p className="text-xs text-slate-500">Select month to view performance</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Year</label>
                    <div className="relative">
                        <select 
                            value={reportFilter.year} 
                            onChange={(e) => setReportFilter({...reportFilter, year: e.target.value})}
                            className="w-full appearance-none bg-slate-50 shadow-soft text-slate-700 py-2.5 px-4 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium transition"
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"/>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Month</label>
                    <div className="relative">
                        <select 
                            value={reportFilter.month} 
                            onChange={(e) => setReportFilter({...reportFilter, month: e.target.value})}
                            className="w-full appearance-none bg-slate-50 shadow-soft text-slate-700 py-2.5 px-4 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium transition"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                <option key={month} value={month.toString().padStart(2, '0')}>
                                {new Date(2000, month - 1).toLocaleString('en-US', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"/>
                    </div>
                </div>

                <button 
                    onClick={loadMonthlyReport}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition shadow-soft-md disabled:opacity-70 flex justify-center items-center gap-2 mt-2"
                >
                    {loading ? <Loader2 className="animate-spin" size={18}/> : 'Analyze Data'}
                </button>
            </div>
        </div>

        {/* Right: Visualization & Stats */}
        <div className="xl:col-span-3">
            {!monthlyData ? (
                <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 min-h-[300px]">
                    <BarChart2 size={48} className="mb-2 opacity-50"/>
                    <p className="font-medium">Select a period to view analytics</p>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Key Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard 
                            label="Total Revenue" 
                            value={formatRupiah(monthlyData.total_revenue)} 
                            icon={<DollarSign size={20}/>} 
                            trend="Gross Income"
                        />
                        <StatCard 
                            label="Transactions" 
                            value={monthlyData.total_transactions} 
                            icon={<ShoppingCart size={20}/>} 
                            trend="Total Volume"
                        />
                        <StatCard 
                            label="Net Income" 
                            value={formatRupiah(monthlyData.net_income)} 
                            icon={<TrendingUp size={20}/>} 
                            trend="Profit"
                            highlight={monthlyData.net_income >= 0}
                        />
                        <StatCard 
                            label="Cash Flow Gap" 
                            value={formatRupiah(monthlyData.cash_in - monthlyData.cash_out)} 
                            icon={<Activity size={20}/>} 
                            trend="In vs Out"
                        />
                    </div>

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Service Performance */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-soft p-6">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div> Service Distribution
                            </h3>
                            {monthlyData.service_stats && Object.keys(monthlyData.service_stats).length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {Object.entries(monthlyData.service_stats).map(([service, count]: any) => (
                                        <div key={service} className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-between group hover:bg-white hover:shadow-sm hover:border-slate-200 transition h-24">
                                            <p className="text-xs text-slate-500 font-bold uppercase mb-1 truncate" title={service}>{service}</p>
                                            <div className="flex items-end justify-between">
                                                <span className="text-2xl font-bold text-slate-800">{count}</span>
                                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">Txn</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">No service data available.</p>
                            )}
                        </div>

                        {/* Recent Transactions List (Mini) */}
                        <div className="bg-white rounded-2xl shadow-soft p-6 flex flex-col h-full">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div> Recent Activity
                            </h3>
                            <div className="flex-1 overflow-y-auto max-h-[240px] pr-2 space-y-3 custom-scrollbar">
                                {monthlyData.transactions && monthlyData.transactions.length > 0 ? (
                                    monthlyData.transactions.slice(0, 10).map((trx: any) => (
                                        <div key={trx.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-medium text-slate-700 truncate max-w-[120px]">{trx.transaction_code}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(trx.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <span className="font-bold text-emerald-600">{formatRupiah(trx.total_amount)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-slate-400 text-sm">No transactions yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      <hr className="border-slate-200"/>

      {/* 2. SECTION: SHIFT CASHFLOW REPORT */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <DollarSign size={20} className="text-slate-500"/> Shift Cashflow
            </h2>
            <p className="text-xs text-slate-500">Filter per hari atau rentang tanggal untuk melihat rangkuman semua shift.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[150px_150px_180px_minmax(260px,1fr)_120px] gap-2 w-full xl:w-auto">
            <input
              type="date"
              value={shiftFilter.start_date}
              onChange={(e) => handleShiftDateChange('start_date', e.target.value)}
              className="bg-slate-50 text-slate-700 py-2.5 px-3 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
            />
            <input
              type="date"
              value={shiftFilter.end_date}
              onChange={(e) => handleShiftDateChange('end_date', e.target.value)}
              className="bg-slate-50 text-slate-700 py-2.5 px-3 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
            />
            <button
              onClick={handleLoadShiftRangeReport}
              disabled={loading || !shiftFilter.start_date || !shiftFilter.end_date}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16}/> : <Calendar size={16}/>}
              Load Range
            </button>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="bg-slate-50 text-slate-700 py-2.5 px-4 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
            >
              <option value="">Shift di range terpilih ({shiftList.length})</option>
              {shiftList.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  #{shift.id} - {shift.cashier?.name || 'Cashier'} - {new Date(shift.opened_at).toLocaleString('id-ID')} ({shift.status})
                </option>
              ))}
            </select>
            <button
              onClick={handleLoadShiftReport}
              disabled={loading || !selectedShiftId}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16}/> : <Search size={16}/>}
              Shift
            </button>
          </div>
        </div>

        {shiftReport && (
          <div className="p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-800">{shiftReportTitle}</h3>
                <p className="text-xs text-slate-500">
                  {isRangeShiftReport
                    ? `${shiftSummary.total_shifts || 0} shifts in selected range`
                    : `${shiftReport.shift?.status || 'open'} shift detail`}
                </p>
              </div>
              {isRangeShiftReport && (
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full w-fit">
                  {(shiftReport.cash_flows || []).filter((f: any) => f.category !== 'tukar_qris').length} cash records · {shiftReport.transactions?.length || 0} transactions
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Start"
                value={formatRupiah(isRangeShiftReport ? shiftSummary.total_opening_balance : shiftReport.shift?.opening_balance)}
                icon={<Wallet size={20}/>}
                trend={isRangeShiftReport ? 'Total opening' : 'Opening balance'}
              />
              <StatCard
                label="Expected"
                value={formatRupiah(isRangeShiftReport ? shiftSummary.total_expected_closing_balance : shiftReport.expected_closing_balance)}
                icon={<DollarSign size={20}/>}
                trend="Expected closing"
              />
              <StatCard
                label="End Balance"
                value={
                  isRangeShiftReport
                    ? formatRupiah(shiftSummary.total_closing_balance)
                    : shiftReport.shift?.closing_balance != null
                      ? formatRupiah(shiftReport.shift.closing_balance)
                      : '—'
                }
                icon={<Wallet size={20}/>}
                trend={isRangeShiftReport ? 'Total actual closing' : (shiftReport.shift?.status === 'closed' ? 'Actual closing' : 'Shift still open')}
                highlight={
                  isRangeShiftReport
                    ? shiftSummary.total_closing_balance > 0
                    : shiftReport.shift?.closing_balance != null
                }
              />
              {(() => {
                const diff = isRangeShiftReport ? shiftSummary.total_difference : shiftReport.shift?.difference;
                const isOpen = !isRangeShiftReport && shiftReport.shift?.status !== 'closed';
                const isZero = (diff || 0) === 0;
                return (
                  <StatCard
                    label="Difference"
                    value={formatRupiah(diff)}
                    icon={<Activity size={20}/>}
                    trend={isOpen ? 'Shift still open' : isZero ? 'Balanced ✓' : `Selisih: ${formatRupiah(Math.abs(diff || 0))}`}
                    highlight={!isOpen && isZero}
                    danger={!isOpen && !isZero}
                  />
                );
              })()}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {(() => {
                  const visibleFlows = (shiftReport.cash_flows || []).filter((item: any) => item.category !== 'tukar_qris');
                  const totalIn  = visibleFlows.filter((f: any) => f.type === 'in'  || f.type === 'income') .reduce((s: number, f: any) => s + f.amount, 0);
                  const totalOut = visibleFlows.filter((f: any) => f.type === 'out' || f.type === 'expense').reduce((s: number, f: any) => s + f.amount, 0);
                  return (
                    <>
                      <div className="px-4 py-3 bg-slate-50 font-bold text-sm text-slate-700">Cash Records ({visibleFlows.length})</div>
                      <div className="max-h-80 overflow-y-auto">
                        {visibleFlows.map((item: any) => (
                          <div key={item.id} className="px-4 py-3 border-t border-slate-100 flex justify-between gap-3 text-sm">
                            <div>
                              <p className="font-medium text-slate-800">{item.description}</p>
                              <p className="text-xs text-slate-400">{item.category} · {new Date(item.created_at).toLocaleTimeString('id-ID')}</p>
                            </div>
                            <p className={`font-bold ${item.type === 'in' || item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {item.type === 'in' || item.type === 'income' ? '+' : '-'} {formatRupiah(item.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-between text-sm">
                        <span className="text-emerald-600 font-semibold">In: {formatRupiah(totalIn)}</span>
                        <span className="text-rose-600 font-semibold">Out: {formatRupiah(totalOut)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {(() => {
                  const trxList = shiftReport.transactions || [];
                  const total = trxList.reduce((s: number, t: any) => s + (t.total_amount || 0), 0);
                  return (
                    <>
                      <div className="px-4 py-3 bg-slate-50 font-bold text-sm text-slate-700">Transactions ({trxList.length})</div>
                      <div className="max-h-80 overflow-y-auto">
                        {trxList.map((trx: any) => (
                          <div key={trx.id} className="px-4 py-3 border-t border-slate-100 flex justify-between gap-3 text-sm">
                            <div>
                              <p className="font-mono font-medium text-slate-800">{trx.transaction_code}</p>
                              <p className="text-xs text-slate-400">{trx.user?.name || 'Walk-in'} · {trx.payment_method?.name || '-'}</p>
                            </div>
                            <p className="font-bold text-slate-800">{formatRupiah(trx.total_amount)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-between text-sm">
                        <span className="font-semibold text-slate-500">Total {trxList.length} transaksi</span>
                        <span className="font-bold text-slate-800">{formatRupiah(total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {isRangeShiftReport && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 font-bold text-sm text-slate-700">Shift Summary ({shiftReport.shifts?.length || 0})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase text-slate-400 border-t border-slate-100">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Cashier</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Opening</th>
                        <th className="p-3 text-right">Closing</th>
                        <th className="p-3 text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(shiftReport.shifts || []).map((shift: any) => (
                        <tr key={shift.id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-600">
                            <p className="font-medium">#{shift.id}</p>
                            <p className="text-xs text-slate-400">{new Date(shift.opened_at).toLocaleString('id-ID')}</p>
                          </td>
                          <td className="p-3 font-medium text-slate-700">{shift.cashier?.name || '-'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${shift.status === 'closed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {shift.status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">{formatRupiah(shift.opening_balance)}</td>
                          <td className="p-3 text-right font-mono">{shift.closing_balance != null ? formatRupiah(shift.closing_balance) : '-'}</td>
                          <td className={`p-3 text-right font-mono font-bold ${(shift.difference || 0) === 0 ? 'text-slate-700' : 'text-rose-600'}`}>
                            {formatRupiah(shift.difference || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <ShiftReportSections report={shiftReport.report} compact />
          </div>
        )}
      </div>

      {/* 3. SECTION: ADVANCED REPORT (NEW FEATURE) */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Filter size={20} className="text-slate-500"/> Data Explorer
                </h2>
                <p className="text-xs text-slate-500">Deep dive into transaction history with custom filters</p>
            </div>
            {hasSearched && (
                <button 
                    onClick={handleResetFilter}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-full transition"
                >
                    <RefreshCcw size={12}/> Reset Filters
                </button>
            )}
        </div>

        {/* Filter Controls */}
        <div className="p-6 bg-slate-50/50 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
            
            {/* Search Input (Autocomplete) */}
            <div className="col-span-1 md:col-span-2 relative" ref={wrapperRef}>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Search Query</label>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder="Search by Name, Code, or Info..."
                        value={advancedFilter.search}
                        onChange={handleInputChange}
                        onFocus={() => setShowDropdown(true)}
                        className="w-full pl-10 pr-10 py-2 shadow-soft rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white shadow-sm"
                        autoComplete="off"
                    />
                    {isSuggesting ? (
                        <Loader2 size={16} className="absolute right-3 top-3 animate-spin text-slate-400"/>
                    ) : advancedFilter.search && (
                        <button onClick={() => setAdvancedFilter({...advancedFilter, search: ''})} className="absolute right-3 top-2.5 text-slate-400 hover:text-rose-500">
                            <X size={16}/>
                        </button>
                    )}
                </div>

                {/* Dropdown Suggestions */}
                {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-white shadow-soft rounded-lg shadow-soft-xl mt-1 py-1 max-h-60 overflow-y-auto">
                        {suggestions.map((s, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => handleSelectSuggestion(s)}
                                className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 font-medium transition-colors"
                            >
                                {s.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Date Range */}
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">From Date</label>
                <input 
                    type="date" 
                    value={advancedFilter.start_date}
                    onChange={e => setAdvancedFilter({...advancedFilter, start_date: e.target.value})}
                    className="w-full py-2 px-3 shadow-soft rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 outline-none bg-white shadow-sm"
                />
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">To Date</label>
                <input 
                    type="date" 
                    value={advancedFilter.end_date}
                    onChange={e => setAdvancedFilter({...advancedFilter, end_date: e.target.value})}
                    className="w-full py-2 px-3 shadow-soft rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 outline-none bg-white shadow-sm"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <button 
                    onClick={handleAdvancedSearch}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl transition shadow-soft flex justify-center items-center"
                    title="Search Data"
                >
                    <Search size={18}/>
                </button>
                <button 
                    onClick={() => handleExport('advanced')}
                    disabled={loading}
                    className="flex-1 bg-white shadow-soft hover:bg-white hover:border-emerald-500 hover:text-emerald-600 text-slate-700 py-2 rounded-lg transition flex justify-center items-center shadow-sm"
                    title="Export Filtered Data"
                >
                    <FileSpreadsheet size={18}/>
                </button>
            </div>
        </div>

        {/* Results Table */}
        {hasSearched && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm">Search Results ({filteredTransactions.length})</h3>
                    {filteredTransactions.length > 0 && (
                        <div className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full shadow-soft">
                            Total: {formatRupiah(filteredTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0))}
                        </div>
                    )}
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 font-semibold w-32">Date</th>
                                <th className="p-4 font-semibold">Code</th>
                                <th className="p-4 font-semibold">Customer</th>
                                <th className="p-4 font-semibold">Payment</th>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                                        No transactions found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50 transition group">
                                        <td className="p-4 text-slate-600">
                                            <div className="font-medium">{new Date(t.created_at).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="p-4 font-mono text-slate-600 group-hover:text-blue-600 transition-colors">{t.transaction_code}</td>
                                        <td className="p-4 font-medium text-slate-900">{t.user?.name || t.guest_name || 'Walk-in'}</td>
                                        <td className="p-4 text-slate-600">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${t.payment_method_id === 1 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                {t.payment_method_id === 1 ? 'Cash' : 'QRIS'}
                                            </span>
                                        </td>
                                        <td className="p-4"><StatusBadge status={t.status}/></td>
                                        <td className="p-4 text-right font-bold text-slate-800">{formatRupiah(t.total_amount)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      {/* 3. SECTION: BULK EXPORT (EXISTING BUT REDESIGNED) */}
      <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-soft-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute right-0 top-0 p-10 opacity-5 pointer-events-none"><FileSpreadsheet size={160}/></div>
          
          <div className="relative z-10 max-w-lg">
              <h3 className="text-2xl font-bold mb-2">Transaction Archive</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Need raw data for accounting? Download complete transaction history in Excel format. 
                Select date range to generate bulk report.
              </p>
          </div>
          
          <div className="relative z-10 flex flex-col sm:flex-row bg-blue-700/50 p-2 rounded-2xl border border-slate-700 gap-2 w-full md:w-auto">
              <input 
                type="date" 
                className="bg-blue-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                value={exportFilter.start_date} 
                onChange={e => setExportFilter({...exportFilter, start_date: e.target.value})}
              />
              <div className="hidden sm:flex items-center text-slate-500">-</div>
              <input 
                type="date" 
                className="bg-blue-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                value={exportFilter.end_date} 
                onChange={e => setExportFilter({...exportFilter, end_date: e.target.value})}
              />
              <button 
                onClick={() => handleExport('simple')}
                disabled={loading || !exportFilter.start_date || !exportFilter.end_date}
                className="bg-white text-slate-900 px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={16}/> : <><Download size={16}/> Export</>}
              </button>
          </div>
      </div>

    </div>
  );
}

// --- SUB COMPONENTS ---

const StatCard = ({ label, value, icon, trend, highlight = false, danger = false }: any) => {
    const cardCls = danger
        ? 'bg-rose-50 border-rose-300 shadow-sm'
        : highlight
            ? 'bg-white border-emerald-200 shadow-sm'
            : 'bg-white border-slate-200';
    const valueCls = danger ? 'text-rose-600' : highlight ? 'text-emerald-600' : 'text-slate-800';
    const iconCls  = danger ? 'bg-rose-100 text-rose-500' : highlight ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500';
    const trendCls = danger ? 'text-rose-500 font-bold' : highlight ? 'text-emerald-600' : 'text-slate-400';
    return (
        <div className={`p-6 rounded-2xl border flex flex-col justify-between h-32 transition hover:shadow-md ${cardCls}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1">{label}</p>
                    <h3 className={`text-2xl font-bold ${valueCls}`}>{value}</h3>
                </div>
                <div className={`p-2.5 rounded-lg ${iconCls}`}>{icon}</div>
            </div>
            <p className={`text-xs font-medium mt-2 ${trendCls}`}>{trend}</p>
        </div>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
        paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        pending: 'bg-amber-50 text-amber-700 border-amber-100',
        cancelled: 'bg-slate-100 text-slate-600 border-slate-200'
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[status] || styles.cancelled}`}>
            {status}
        </span>
    );
};
