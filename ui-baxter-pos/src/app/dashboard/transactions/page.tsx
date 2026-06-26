'use client';

import { useEffect, useState, useMemo } from 'react';
import { transactions } from '@/lib/api';
import {
  Search, Filter, Eye, CheckCircle, XCircle,
  Clock, DollarSign, Calendar, FileText, ChevronRight, X, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Transactions() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'history'>('ongoing');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [filters, setFilters] = useState({
    status: '',
    start_date: '',
    end_date: '',
    search: '',
  });

  const [selectedTrx, setSelectedTrx] = useState<any>(null);

  useEffect(() => {
    loadTransactions();
  }, [filters.status, filters.start_date, filters.end_date]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await transactions.getAll(params);
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    if (!confirm(`Are you sure you want to mark this transaction as ${status}?`)) return;

    setUpdatingId(id);
    try {
      await transactions.updateStatus(id, status);
      toast.success(`Transaction ${status === 'paid' ? 'approved' : 'rejected'} successfully`);
      setSelectedTrx(null);
      loadTransactions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const processedData = useMemo(() => {
    let filtered = data.filter((trx) => {
      if (!filters.search) return true;
      const search = filters.search.toLowerCase();
      return (
        trx.transaction_code?.toLowerCase().includes(search) ||
        trx.user?.name?.toLowerCase().includes(search) ||
        trx.guest_name?.toLowerCase().includes(search)
      );
    });

    if (activeTab === 'ongoing') {
        return filtered.filter(t => t.status === 'pending');
    } else {
        return filtered.filter(t => t.status !== 'pending');
    }
  }, [data, filters.search, activeTab]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
      paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      failed: 'bg-rose-50 text-rose-700 border-rose-200',
      cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[status] || styles.cancelled}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">

      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
          <div>
              <h1 className="text-2xl font-bold text-gray-800">Transactions</h1>
              <p className="text-gray-400 text-sm">Monitor sales and approval requests.</p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-2xl">
              <button
                onClick={() => setActiveTab('ongoing')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                    activeTab === 'ongoing' ? 'bg-white text-gray-800 shadow-soft' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Clock size={16} className={activeTab === 'ongoing' ? 'text-amber-500' : ''}/>
                Needs Approval
                {data.filter(t => t.status === 'pending').length > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        {data.filter(t => t.status === 'pending').length}
                    </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                    activeTab === 'history' ? 'bg-white text-gray-800 shadow-soft' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <FileText size={16}/> All History
              </button>
          </div>
      </div>

      <div className="bg-white p-4 md:p-5 rounded-2xl shadow-soft flex flex-col lg:flex-row gap-4 items-end">
         <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Search Transaction</label>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                    <input
                        type="text"
                        placeholder="Code, Customer Name..."
                        value={filters.search}
                        onChange={e => setFilters({...filters, search: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:bg-white outline-none transition"
                    />
                </div>
            </div>

            {activeTab === 'history' && (
                <div>
                    <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Status</label>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none appearance-none"
                    >
                        <option value="">All Status</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            )}

            <div>
                <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Date</label>
                <input
                    type="date"
                    value={filters.start_date}
                    onChange={e => setFilters({...filters, start_date: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none text-gray-600"
                />
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-xs">
              <tr>
                <th className="p-4 w-32">Code</th>
                <th className="p-4">Customer</th>
                <th className="p-4 w-40">Payment</th>
                <th className="p-4 w-32">Status</th>
                <th className="p-4 text-right w-40">Total</th>
                <th className="p-4 w-40">Date</th>
                <th className="p-4 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400"><Loader2 className="animate-spin inline-block mr-2" size={16}/>Loading data...</td></tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 italic">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                processedData.map((trx) => {
                  const isUpdating = updatingId === trx.id;
                  return (
                  <tr key={trx.id} className={`hover:bg-gray-50 transition group ${isUpdating ? 'opacity-50' : ''}`}>
                    <td className="p-4 font-mono font-medium text-gray-500">
                        {trx.transaction_code}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{trx.user?.name || trx.guest_name || 'Walk-in'}</p>
                      <p className="text-xs text-slate-500">{trx.user?.email || '-'}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded border text-[10px] font-bold uppercase ${trx.payment_method_id === 1 ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                        {trx.payment_method?.name || (trx.payment_method_id === 1 ? 'Cash' : 'QRIS')}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={trx.status}/>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-bold text-slate-800">{formatCurrency(trx.total_amount)}</p>
                      {trx.points_earned > 0 && <p className="text-[10px] text-amber-600 font-medium">+{trx.points_earned} pts</p>}
                    </td>
                    <td className="p-4 text-slate-500 text-xs">
                      {formatDate(trx.created_at)}
                      <div className="text-[10px] text-slate-400 mt-0.5">By: {trx.cashier?.name || '-'}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setSelectedTrx(trx)}
                          className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition shadow-sm"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>

                        {trx.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(trx.id, 'paid')}
                              disabled={isUpdating}
                              className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition shadow-sm disabled:opacity-50"
                              title="Approve / Mark as Paid"
                            >
                              {isUpdating ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle size={16} />}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(trx.id, 'cancelled')}
                              disabled={isUpdating}
                              className="p-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-100 transition shadow-sm disabled:opacity-50"
                              title="Reject / Cancel"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTrx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-soft-xl overflow-hidden flex flex-col max-h-[90vh]">

            <div className="p-5 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Transaction Details</h3>
                <p className="text-xs font-mono text-gray-400 mt-1">{selectedTrx.transaction_code}</p>
              </div>
              <button onClick={() => setSelectedTrx(null)} className="text-gray-400 hover:text-gray-600 transition p-1"><X size={20}/></button>
            </div>

            <div className="px-6 pb-6 overflow-y-auto space-y-6">

              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                  <div>
                      <p className="text-xs text-gray-400 font-bold uppercase mb-1">Current Status</p>
                      <StatusBadge status={selectedTrx.status}/>
                  </div>
                  <div className="text-right">
                      <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Amount</p>
                      <p className="text-xl font-bold text-gray-800">{formatCurrency(selectedTrx.total_amount)}</p>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">Customer</p>
                  <p className="font-medium text-slate-800">{selectedTrx.user?.name || selectedTrx.guest_name || 'Walk-in'}</p>
                  <p className="text-xs text-slate-500">{selectedTrx.user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">Date</p>
                  <p className="font-medium text-slate-800">{formatDate(selectedTrx.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">Payment Method</p>
                  <p className="font-medium text-slate-800">{selectedTrx.payment_method?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">Cashier</p>
                  <p className="font-medium text-slate-800">{selectedTrx.cashier?.name || '-'}</p>
                </div>
              </div>

              <hr className="border-slate-100"/>

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <DollarSign size={16}/> Purchased Items
                </h4>
                <div className="space-y-2">
                  {selectedTrx.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                      <div>
                        <p className="font-bold text-sm text-slate-700">{item.service?.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatCurrency(item.price)} x {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold text-sm text-slate-800">{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTrx.notes && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-800 text-sm">
                  <p className="font-bold mb-1 flex items-center gap-2"><FileText size={14}/> Notes</p>
                  <p>{selectedTrx.notes}</p>
                </div>
              )}
            </div>

            {selectedTrx.status === 'pending' && (
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                    <button
                        onClick={() => handleUpdateStatus(selectedTrx.id, 'cancelled')}
                        disabled={updatingId === selectedTrx.id}
                        className="flex-1 py-2.5 border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-white transition disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {updatingId === selectedTrx.id ? <Loader2 size={16} className="animate-spin"/> : null}
                        Reject
                    </button>
                    <button
                        onClick={() => handleUpdateStatus(selectedTrx.id, 'paid')}
                        disabled={updatingId === selectedTrx.id}
                        className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition shadow-md disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {updatingId === selectedTrx.id ? <Loader2 size={16} className="animate-spin"/> : null}
                        Approve Payment
                    </button>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
