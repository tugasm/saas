'use client';

import { useEffect, useState, useMemo } from 'react';
import { memberships, vehicles } from '@/lib/api';
import {
  Users, Car, Calendar, AlertCircle, CheckCircle,
  Search, X, CreditCard, Banknote, Loader2, RefreshCw, 
  Filter, ChevronRight, Activity, Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Memberships() {
  const [membershipData, setMembershipData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail & Renew State
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('1');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await memberships.getAll();
      const items = res.data?.data ?? res.data;
      setMembershipData(Array.isArray(items) ? items : []);
    } catch (error) { 
      console.error(error); 
      toast.error("Failed to load memberships");
    } finally { 
      setLoading(false); 
    }
  };

  // --- LOGIC: FILTERING ---
  const filteredData = useMemo(() => {
    return membershipData.filter(m => {
      const matchStatus = filterStatus === 'all' ? true : m.status === filterStatus;
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = 
        m.user?.name?.toLowerCase().includes(searchLower) || 
        m.vehicle?.license_plate?.toLowerCase().includes(searchLower);
      return matchStatus && matchSearch;
    });
  }, [membershipData, filterStatus, searchQuery]);

  // --- LOGIC: STATS ---
  const stats = useMemo(() => {
    const total = membershipData.length;
    const active = membershipData.filter(m => m.status === 'active').length;
    const pending = membershipData.filter(m => m.status === 'pending').length;
    const expired = membershipData.filter(m => m.status === 'expired').length;
    return { total, active, pending, expired };
  }, [membershipData]);

  // --- LOGIC: RENEWAL (Admin Override) ---
  const handleRenewMembership = async () => {
    if (!selectedMembership) return;
    if (!confirm("Confirm manual renewal for this member?")) return;

    setIsSubmitting(true);
    try {
      await memberships.renew({
        membership_id: selectedMembership.id,
        payment_method_id: parseInt(renewPaymentMethod)
      });
      toast.success("Membership renewed successfully!");
      setSelectedMembership(null);
      setIsRenewing(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Renewal failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- HELPERS ---
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  
  const getDaysRemaining = (end: string) => {
    if (!end) return 0;
    const diff = new Date(end).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      expired: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[status] || 'bg-slate-100'}`}>
        {status}
      </span>
    );
  };

  // --- COMPONENT: STAT CARD ---
  const StatCard = ({ label, value, icon, color }: any) => (
    <div className="p-4 md:p-6 rounded-3xl bg-white shadow-soft flex flex-col justify-between h-28 md:h-32 hover:shadow-sm transition group">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-[10px] md:text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">{label}</p>
                <h3 className={`text-2xl md:text-3xl font-bold text-slate-800 group-hover:text-${color}-600 transition`}>{value}</h3>
            </div>
            <div className={`p-2 md:p-2.5 rounded-lg bg-${color}-50 text-${color}-600`}>
                {icon}
            </div>
        </div>
    </div>
  );

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-slate-400 h-8 w-8" /></div>;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      
      {/* 1. HEADER & STATS */}
      <div className="space-y-6">
          <div className="flex justify-between items-center">
              <div>
                  <h1 className="text-2xl font-bold text-slate-800">Membership Management</h1>
                  <p className="text-slate-500 text-sm">Monitor member status, vehicles, and expiration.</p>
              </div>
              {/* Add Button Removed as requested (Moved to Cashier) */}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Members" value={stats.total} icon={<Users size={20}/>} color="blue"/>
              <StatCard label="Active Members" value={stats.active} icon={<CheckCircle size={20}/>} color="emerald"/>
              <StatCard label="Pending Payment" value={stats.pending} icon={<Clock size={20}/>} color="amber"/>
              <StatCard label="Expired / Inactive" value={stats.expired} icon={<AlertCircle size={20}/>} color="rose"/>
          </div>
      </div>

      <hr className="border-slate-200"/>

      {/* 2. MAIN CONTENT (FILTER & TABLE) */}
      <div className="bg-white rounded-3xl shadow-soft overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                {['all', 'active', 'pending', 'expired'].map(s => (
                    <button 
                        key={s} 
                        onClick={() => setFilterStatus(s)}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition ${
                            filterStatus === s 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                <input 
                    type="text" 
                    placeholder="Search Name or License Plate..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 shadow-soft rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                />
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                <tr>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Vehicle</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Period</th>
                    <th className="px-6 py-4">Remaining</th>
                    <th className="px-6 py-4 text-center">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">No memberships found.</td></tr>
                ) : (
                    filteredData.map(m => {
                        const days = m.end_date ? getDaysRemaining(m.end_date) : 0;
                        const isExpiringSoon = days <= 7 && days > 0;

                        return (
                            <tr key={m.id} className="hover:bg-slate-50 transition group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                            {m.user?.name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{m.user?.name}</p>
                                            <p className="text-xs text-slate-500">{m.user?.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-start gap-2">
                                        <Car className="text-slate-400 mt-0.5" size={14}/>
                                        <div>
                                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 rounded">{m.vehicle?.license_plate}</span>
                                            <p className="text-xs text-slate-500 mt-0.5">{m.vehicle?.brand} {m.vehicle?.model}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4"><StatusBadge status={m.status}/></td>
                                <td className="px-6 py-4 text-slate-600">
                                    {m.start_date ? (
                                        <div className="flex flex-col text-xs">
                                            <span>{formatDate(m.start_date)}</span>
                                            <span className="text-slate-400">to</span>
                                            <span className="font-medium">{formatDate(m.end_date)}</span>
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="px-6 py-4">
                                    {m.end_date ? (
                                        <span className={`font-bold ${isExpiringSoon ? 'text-amber-600' : (days > 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                                            {days > 0 ? `${days} Days` : 'Expired'}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button 
                                        onClick={() => setSelectedMembership(m)}
                                        className="text-slate-400 hover:text-slate-900 transition"
                                    >
                                        <ChevronRight size={20}/>
                                    </button>
                                </td>
                            </tr>
                        )
                    })
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. DETAIL & MANUAL RENEWAL MODAL */}
      {selectedMembership && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-soft-xl overflow-hidden">
                  
                  {/* Header */}
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="font-bold text-lg text-slate-800">Membership Details</h3>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">ID: #{selectedMembership.id}</p>
                      </div>
                      <button onClick={() => {setSelectedMembership(null); setIsRenewing(false);}} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
                  </div>

                  <div className="p-6 space-y-6">
                      {/* Status Card */}
                      <div className={`p-4 rounded-3xl border flex items-center justify-between ${
                          selectedMembership.status === 'active' 
                          ? 'bg-emerald-50 border-emerald-100' 
                          : 'bg-rose-50 border-rose-100'
                      }`}>
                          <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${selectedMembership.status === 'active' ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'}`}>
                                  <Activity size={20}/>
                              </div>
                              <div>
                                  <p className={`text-xs font-bold uppercase ${selectedMembership.status === 'active' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                      {selectedMembership.status}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                      Until {formatDate(selectedMembership.end_date)}
                                  </p>
                              </div>
                          </div>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">Customer</p>
                              <p className="font-medium text-slate-800">{selectedMembership.user?.name}</p>
                              <p className="text-xs text-slate-500">{selectedMembership.user?.email}</p>
                          </div>
                          <div>
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">Vehicle</p>
                              <p className="font-medium text-slate-800 font-mono">{selectedMembership.vehicle?.license_plate}</p>
                              <p className="text-xs text-slate-500">{selectedMembership.vehicle?.brand} {selectedMembership.vehicle?.model}</p>
                          </div>
                      </div>

                      {/* Admin Actions */}
                      <div className="pt-4 border-t border-slate-100">
                          {!isRenewing ? (
                              <button 
                                onClick={() => setIsRenewing(true)}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-soft-md"
                              >
                                <RefreshCw size={16}/> Manual Renewal (Admin)
                              </button>
                          ) : (
                              <div className="space-y-4 bg-slate-50 p-4 rounded-3xl shadow-soft animate-in slide-in-from-bottom-2">
                                  <div>
                                      <h4 className="font-bold text-slate-800 text-sm mb-2">Confirm Renewal Payment</h4>
                                      <p className="text-xs text-slate-500 mb-3">This action will extend the membership immediately.</p>
                                      
                                      <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Payment Method</label>
                                      <div className="grid grid-cols-2 gap-2">
                                          <button type="button" onClick={() => setRenewPaymentMethod('1')} className={`py-2 text-xs font-bold rounded border ${renewPaymentMethod === '1' ? 'bg-white border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' : 'bg-white border-slate-200 text-slate-500'}`}>Cash</button>
                                          <button type="button" onClick={() => setRenewPaymentMethod('2')} className={`py-2 text-xs font-bold rounded border ${renewPaymentMethod === '2' ? 'bg-white border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'bg-white border-slate-200 text-slate-500'}`}>QRIS</button>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => setIsRenewing(false)} className="flex-1 py-2 text-slate-600 font-bold text-xs bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                                      <button onClick={handleRenewMembership} disabled={isSubmitting} className="flex-1 py-2 text-white font-bold text-xs bg-emerald-600 rounded hover:bg-emerald-700 flex justify-center items-center gap-2">
                                          {isSubmitting ? <Loader2 className="animate-spin" size={14}/> : 'Confirm Renewal'}
                                      </button>
                                  </div>
                              </div>
                          )}
                          <p className="text-[10px] text-slate-400 text-center mt-3">
                              Note: Regular renewals should be done via Cashier page.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}