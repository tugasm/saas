'use client';

import { useEffect, useState, useMemo } from 'react';
import { employees, attendance, loans, payroll } from '@/lib/api';
import {
  Users, Calendar, Wallet, Banknote, Plus,
  CheckCircle2, Clock, Pencil, Trash2, X, Loader2, Search, Filter
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function EmployeeManagement() {
  const [activeTab, setActiveTab] = useState('staff');
  const [loading, setLoading] = useState(false);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loanList, setLoanList] = useState<any[]>([]);
  const [payrollPreview, setPayrollPreview] = useState<any[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);
  const [isPreviewingPayroll, setIsPreviewingPayroll] = useState(false);

  // Loan filters
  const [loanFilterEmployee, setLoanFilterEmployee] = useState('');
  const [loanFilterMonth, setLoanFilterMonth] = useState('');

  const [empForm, setEmpForm] = useState({
    name: '',
    phone: '',
    device_user_id: '',
    hourly_rate: 0,
    position: 'Washer'
  });

  const [payrollPeriod, setPayrollPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'staff') {
        const res = await employees.getAll();
        setStaffList(Array.isArray(res.data) ? res.data : []);
      } else if (activeTab === 'attendance') {
        const res = await attendance.getAll();
        setAttendanceLogs(Array.isArray(res.data) ? res.data : []);
      } else if (activeTab === 'loans') {
        // Load staff list too for the dropdown
        const [loanRes, staffRes] = await Promise.all([loans.getAll(), employees.getAll()]);
        setLoanList(Array.isArray(loanRes.data) ? loanRes.data : []);
        setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      } else if (activeTab === 'payroll') {
        const res = await payroll.getHistory();
        setPayrollHistory(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error("Gagal load data", error);
      if (activeTab === 'staff') setStaffList([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEmpForm({ name: '', phone: '', device_user_id: '', hourly_rate: 0, position: 'Washer' });
    setShowModal(true);
  };

  const openEditModal = (emp: any) => {
    setIsEditing(true);
    setSelectedEmpId(emp.id);
    setEmpForm({
        name: emp.name,
        phone: emp.phone || '',
        device_user_id: emp.device_user_id || '',
        hourly_rate: emp.hourly_rate || 0,
        position: emp.position || ''
    });
    setShowModal(true);
  };

  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...empForm, hourly_rate: Number(empForm.hourly_rate) };

      if (isEditing && selectedEmpId) {
          await employees.update(selectedEmpId, payload);
          toast.success('Data karyawan diperbarui');
      } else {
          await employees.create(payload);
          toast.success('Karyawan baru ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: number) => {
      if(!confirm("Hapus data karyawan ini?")) return;
      setDeletingId(id);
      try {
        await employees.delete(id);
        toast.success('Karyawan berhasil dihapus');
        loadData();
      } catch {
        toast.error("Gagal hapus");
      } finally {
        setDeletingId(null);
      }
  }

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLoan(true);
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      await loans.create({
        employee_id: Number(formData.get('employee_id')),
        amount: Number(formData.get('amount')),
        reason: formData.get('reason')
      });
      toast.success('Kasbon berhasil dicatat');
      (e.target as HTMLFormElement).reset();
      loadData();
    } catch {
      toast.error('Gagal menyimpan kasbon');
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const handlePreviewPayroll = async () => {
    setIsPreviewingPayroll(true);
    try {
      const res = await payroll.getPreview(payrollPeriod);
      setPayrollPreview(Array.isArray(res.data) ? res.data : []);
    } catch { setPayrollPreview([]); } finally { setIsPreviewingPayroll(false); }
  };

  const handleGeneratePayroll = async () => {
    if (!confirm('Proses gaji sekarang?')) return;
    setIsGeneratingPayroll(true);
    try {
      const details = payrollPreview.map(p => ({
        employee_id: p.employee_id || p.id,
        loan_deduction: p.loan_deduction,
        bonus: 0
      }));
      await payroll.generate({ ...payrollPeriod, details });
      toast.success('Gaji berhasil diproses!');
      setPayrollPreview([]);
      const res = await payroll.getHistory();
      setPayrollHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Gagal proses gaji');
    } finally {
      setIsGeneratingPayroll(false);
    }
  };

  const filteredLoanList = useMemo(() => {
    return loanList.filter(l => {
      const matchEmployee = !loanFilterEmployee || l.employee_id?.toString() === loanFilterEmployee || l.employee?.id?.toString() === loanFilterEmployee;
      if (!loanFilterMonth) return matchEmployee;
      // loanFilterMonth format: "2026-04"
      const loanDate = l.created_at ? new Date(l.created_at) : null;
      if (!loanDate) return matchEmployee;
      const loanYM = `${loanDate.getFullYear()}-${String(loanDate.getMonth() + 1).padStart(2, '0')}`;
      return matchEmployee && loanYM === loanFilterMonth;
    });
  }, [loanList, loanFilterEmployee, loanFilterMonth]);

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-soft p-1 flex overflow-x-auto">
        {[
          { id: 'staff', label: 'Data Karyawan', icon: Users },
          { id: 'attendance', label: 'Absensi', icon: Calendar },
          { id: 'loans', label: 'Kasbon', icon: Wallet },
          { id: 'payroll', label: 'Penggajian', icon: Banknote },
        ].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-lg transition ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
             <tab.icon size={18} /> {tab.label}
           </button>
        ))}
      </div>

      {/* TAB STAFF */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Daftar Karyawan</h3>
            <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 active:bg-blue-800">
              <Plus size={16} /> Tambah Karyawan
            </button>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500">
               <tr>
                 <th className="p-4">Nama</th>
                 <th className="p-4">Kontak</th>
                 <th className="p-4">Jabatan</th>
                 <th className="p-4">ID Fingerprint</th>
                 <th className="p-4">Gaji/Jam</th>
                 <th className="p-4 text-right">Aksi</th>
               </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500"><Loader2 className="animate-spin inline-block mr-2" size={16}/>Memuat...</td></tr>
              ) : !Array.isArray(staffList) || staffList.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Kosong</td></tr>
              ) : (
                staffList.map((emp) => {
                    const isDeleting = deletingId === emp.id;
                    return (
                    <tr key={emp.id} className={`hover:bg-gray-50 ${isDeleting ? 'opacity-50' : ''}`}>
                    <td className="p-4 font-medium text-gray-900">{emp.name}</td>
                    <td className="p-4 text-gray-500">{emp.phone || '-'}</td>
                    <td className="p-4 capitalize">{emp.position}</td>
                    <td className="p-4 font-mono bg-gray-50 w-fit rounded">{emp.device_user_id}</td>
                    <td className="p-4 font-bold text-green-600">{formatRupiah(emp.hourly_rate)}</td>
                    <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => openEditModal(emp)} disabled={isDeleting} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 active:bg-blue-200 transition"><Pencil size={16}/></button>
                            <button onClick={() => handleDeleteEmployee(emp.id)} disabled={isDeleting} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100 active:bg-red-200 transition disabled:opacity-50">
                                {isDeleting ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                            </button>
                        </div>
                    </td>
                    </tr>
                    )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
           <div className="p-6 border-b"><h3 className="font-bold text-gray-800">Log Absensi</h3></div>
           <div className="max-h-[600px] overflow-y-auto">
             <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                 <tr>
                   <th className="p-4">Tanggal</th>
                   <th className="p-4">Nama</th>
                   <th className="p-4">Masuk</th>
                   <th className="p-4">Pulang</th>
                   <th className="p-4">Durasi</th>
                   <th className="p-4">Upah Harian</th>
                 </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500"><Loader2 className="animate-spin inline-block mr-2" size={16}/>Memuat...</td></tr>
                ) : !Array.isArray(attendanceLogs) || attendanceLogs.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">Kosong</td></tr>
                ) : (
                    attendanceLogs.map((log) => (
                    <tr key={log.id}>
                        <td className="p-4">{new Date(log.date).toLocaleDateString('id-ID')}</td>
                        <td className="p-4 font-medium">{log.employee?.name}</td>
                        <td className="p-4 text-blue-600">{new Date(log.clock_in).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</td>
                        <td className="p-4 text-orange-600">{log.clock_out ? new Date(log.clock_out).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                        <td className="p-4">{log.duration_hours?.toFixed(1)} Jam</td>
                        <td className="p-4 font-mono">{formatRupiah(log.daily_wage || 0)}</td>
                    </tr>
                    ))
                )}
              </tbody>
             </table>
           </div>
        </div>
      )}

      {/* TAB LOANS */}
      {activeTab === 'loans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Input Form */}
           <div className="bg-white p-6 rounded-2xl shadow-soft h-fit">
              <h3 className="font-bold text-gray-800 mb-4">Input Kasbon</h3>
              <form onSubmit={handleSubmitLoan} className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Karyawan</label>
                    <select name="employee_id" className="w-full border p-2.5 rounded-lg" required>
                       <option value="">Pilih...</option>
                       {Array.isArray(staffList) && staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Jumlah (Rp)</label>
                    <input name="amount" type="number" className="w-full border p-2.5 rounded-lg" required />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Alasan</label>
                    <input name="reason" className="w-full border p-2.5 rounded-lg" required />
                 </div>
                 <button type="submit" disabled={isSubmittingLoan} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-50 flex justify-center items-center gap-2">
                    {isSubmittingLoan ? <><Loader2 size={16} className="animate-spin"/> Menyimpan...</> : 'Simpan'}
                 </button>
              </form>
           </div>

           {/* Loan List with Filters */}
           <div className="md:col-span-2 bg-white rounded-2xl shadow-soft overflow-hidden">
              <div className="p-5 border-b border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">Daftar Hutang</h3>
                  {(loanFilterEmployee || loanFilterMonth) && (
                    <button
                      onClick={() => { setLoanFilterEmployee(''); setLoanFilterMonth(''); }}
                      className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full hover:bg-rose-100 transition flex items-center gap-1"
                    >
                      <X size={12}/> Reset Filter
                    </button>
                  )}
                </div>

                {/* Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Karyawan</label>
                    <select
                      value={loanFilterEmployee}
                      onChange={e => setLoanFilterEmployee(e.target.value)}
                      className="w-full border border-gray-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white"
                    >
                      <option value="">Semua Karyawan</option>
                      {Array.isArray(staffList) && staffList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bulan</label>
                    <input
                      type="month"
                      value={loanFilterMonth}
                      onChange={e => setLoanFilterMonth(e.target.value)}
                      className="w-full border border-gray-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-gray-600"
                      placeholder="Pilih bulan"
                    />
                  </div>
                </div>
              </div>

              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                  <tr>
                    <th className="p-4">Nama</th>
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Sisa</th>
                    <th className="p-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                   {loading ? (
                       <tr><td colSpan={5} className="p-8 text-center text-gray-500"><Loader2 className="animate-spin inline-block mr-2" size={16}/>Memuat...</td></tr>
                   ) : filteredLoanList.length === 0 ? (
                       <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">
                         {loanList.length === 0 ? 'Belum ada data kasbon' : 'Tidak ada data sesuai filter'}
                       </td></tr>
                   ) : (
                       filteredLoanList.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50 transition">
                            <td className="p-4 font-medium text-gray-900">{l.employee?.name}</td>
                            <td className="p-4 text-gray-500 text-xs">
                              {l.created_at ? new Date(l.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                            </td>
                            <td className="p-4 text-gray-500">{formatRupiah(l.amount)}</td>
                            <td className="p-4 text-red-600 font-bold">{formatRupiah(l.remaining_amount)}</td>
                            <td className="p-4 text-xs text-gray-500">{l.reason}</td>
                        </tr>
                       ))
                   )}
                </tbody>
              </table>

              {/* Summary footer */}
              {filteredLoanList.length > 0 && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-sm">
                  <span className="text-gray-500">{filteredLoanList.length} data kasbon</span>
                  <div className="flex gap-6">
                    <span className="text-gray-500">Total: <span className="font-bold text-gray-800">{formatRupiah(filteredLoanList.reduce((sum, l) => sum + (l.amount || 0), 0))}</span></span>
                    <span className="text-gray-500">Sisa: <span className="font-bold text-red-600">{formatRupiah(filteredLoanList.reduce((sum, l) => sum + (l.remaining_amount || 0), 0))}</span></span>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* TAB PAYROLL */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
           <div className="bg-white rounded-2xl p-6 shadow-soft">
              <div className="flex gap-4 mb-4 flex-wrap">
                 <input type="date" value={payrollPeriod.start} onChange={e => setPayrollPeriod({...payrollPeriod, start: e.target.value})} className="border p-2 rounded" />
                 <input type="date" value={payrollPeriod.end} onChange={e => setPayrollPeriod({...payrollPeriod, end: e.target.value})} className="border p-2 rounded" />
                 <button onClick={handlePreviewPayroll} disabled={isPreviewingPayroll} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-50 flex items-center gap-2">
                    {isPreviewingPayroll ? <><Loader2 size={16} className="animate-spin"/> Memuat...</> : 'Preview'}
                 </button>
              </div>
              {Array.isArray(payrollPreview) && payrollPreview.length > 0 && (
                <div>
                   <table className="w-full text-sm text-left border rounded mb-4">
                      <thead className="bg-gray-50">
                         <tr><th className="p-3">Nama</th><th className="p-3">Jam</th><th className="p-3">Gaji</th><th className="p-3">Potongan</th><th className="p-3 text-right">Net</th></tr>
                      </thead>
                      <tbody>
                         {payrollPreview.map((p, i) => (
                            <tr key={i}>
                               <td className="p-3">{p.name}</td>
                               <td className="p-3">{p.total_hours?.toFixed(1)}</td>
                               <td className="p-3">{formatRupiah(p.base_salary)}</td>
                               <td className="p-3 text-red-500">-{formatRupiah(p.loan_deduction)}</td>
                               <td className="p-3 text-right font-bold">{formatRupiah(p.net_salary)}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                   <button onClick={handleGeneratePayroll} disabled={isGeneratingPayroll} className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 active:bg-green-800 transition disabled:opacity-50 flex items-center gap-2">
                      {isGeneratingPayroll ? <><Loader2 size={16} className="animate-spin"/> Memproses...</> : 'Bayar Gaji'}
                   </button>
                </div>
              )}
           </div>

           <div className="bg-white rounded-2xl shadow-soft p-6">
               <h3 className="font-bold mb-4">History</h3>
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50"><tr><th className="p-3">Tgl</th><th className="p-3">Nama</th><th className="p-3 text-right">Total</th></tr></thead>
                  <tbody>
                     {payrollHistory.map(h => (
                        <tr key={h.id}>
                           <td className="p-3">{new Date(h.payment_date).toLocaleDateString()}</td>
                           <td className="p-3">{h.employee?.name}</td>
                           <td className="p-3 text-right font-bold">{formatRupiah(h.net_salary)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
           </div>
        </div>
      )}

      {/* MODAL FORM */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
              <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Karyawan' : 'Tambah Karyawan'}</h3>
              <form onSubmit={handleSubmitEmployee} className="space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold block mb-1">Nama Lengkap</label>
                        <input className="w-full border p-2 rounded" value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} required />
                    </div>
                    <div>
                        <label className="text-xs font-bold block mb-1">No HP / Kontak</label>
                        <input className="w-full border p-2 rounded" value={empForm.phone} onChange={e => setEmpForm({...empForm, phone: e.target.value})} />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold block mb-1">Fingerprint ID</label>
                        <input className="w-full border p-2 rounded" value={empForm.device_user_id} onChange={e => setEmpForm({...empForm, device_user_id: e.target.value})} required />
                    </div>
                    <div>
                        <label className="text-xs font-bold block mb-1">Gaji Per Jam (Rp)</label>
                        <input type="number" className="w-full border p-2 rounded" value={empForm.hourly_rate} onChange={e => setEmpForm({...empForm, hourly_rate: Number(e.target.value)})} required />
                    </div>
                 </div>
                 <div>
                    <label className="text-xs font-bold block mb-1">Jabatan</label>
                    <input className="w-full border p-2 rounded" placeholder="Contoh: Washer" value={empForm.position} onChange={e => setEmpForm({...empForm, position: e.target.value})} />
                 </div>
                 <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-50 flex justify-center items-center gap-2">
                        {isSubmitting ? <><Loader2 size={16} className="animate-spin"/> Menyimpan...</> : 'Simpan'}
                    </button>
                    <button type="button" disabled={isSubmitting} onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 py-2.5 rounded-lg font-bold hover:bg-gray-300 transition disabled:opacity-50">Batal</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
