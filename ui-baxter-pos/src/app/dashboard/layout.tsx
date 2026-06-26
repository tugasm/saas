'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import Link from 'next/link';
import Image from "next/image";
import { shifts, users, transactions } from '@/lib/api';
import ChatWidget from '@/components/ChatWidget';
import { toast } from 'react-hot-toast';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  FileText,
  DollarSign,
  Briefcase,
  Menu,
  X,
  Wallet,
  Loader2,
  CheckCircle,
} from 'lucide-react';

const ALL_MENU_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: ShoppingCart, label: 'Transaksi', href: '/dashboard/transactions' },
  { icon: Package, label: 'Service', href: '/dashboard/services' },
  { icon: Users, label: 'Membership', href: '/dashboard/memberships' },
  { icon: Briefcase, label: 'Employees', href: '/dashboard/employees' },
  { icon: CreditCard, label: 'Kasir', href: '/dashboard/cashier' },
  { icon: DollarSign, label: 'Shift Management', href: '/dashboard/cashflow' },
  { icon: FileText, label: 'Ledger', href: '/dashboard/ledger' },
  { icon: BarChart3, label: 'Reports', href: '/dashboard/reports' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [checkingShift, setCheckingShift] = useState(false);
  const [showStartShift, setShowStartShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [shiftNote, setShiftNote] = useState('');
  const [pendingTxs, setPendingTxs] = useState<any[]>([]);
  const [showPendingTxs, setShowPendingTxs] = useState(false);
  const [finishingTxId, setFinishingTxId] = useState<string | null>(null);
  const [allowedMenus, setAllowedMenus] = useState<string[]>(
    ALL_MENU_ITEMS.map(item => item.href)
  );

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userData = Cookies.get('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      if (parsedUser.role === 'cashier') {
        fetchCurrentShift();
      }
    }

    const fetchMenuAccess = async () => {
      try {
        const response = await users.getMenus();
        if (response.data && Array.isArray(response.data.allowed_menus)) {
          setAllowedMenus(response.data.allowed_menus);
        }
      } catch (error) {
        console.error("Gagal mengambil hak akses menu", error);
      }
    };

    fetchMenuAccess();
  }, [router]);

  // Close sidebar on route change (tablet)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const fetchCurrentShift = async () => {
    setCheckingShift(true);
    try {
      const response = await shifts.current();
      const shift = response.data?.shift || null;
      setActiveShift(shift);
      setShiftSummary(response.data?.summary || null);
      setShowStartShift(!shift);
    } catch {
      setShowStartShift(true);
    } finally {
      setCheckingShift(false);
    }
  };

  const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount || 0);

  const parseRupiahInput = (value: string) => {
    return Number(value.replace(/[^\d]/g, '')) || 0;
  };

  const formatRupiahInput = (value: string) => {
    const digits = value.replace(/[^\d]/g, '').replace(/^0+/, '');
    if (!digits) return '';
    return new Intl.NumberFormat('id-ID').format(Number(digits));
  };

  const forceLogout = () => {
    Cookies.remove('token');
    Cookies.remove('user');
    localStorage.removeItem('baxter_local_transactions');
    router.push('/login');
  };

  const handleLogout = async () => {
    // Check for pending local transactions first (all roles)
    try {
      const stored = localStorage.getItem('baxter_local_transactions');
      const pending = stored ? JSON.parse(stored) : [];
      if (Array.isArray(pending) && pending.length > 0) {
        setPendingTxs(pending);
        setShowPendingTxs(true);
        return;
      }
    } catch { /* ignore parse errors */ }

    if (user?.role !== 'cashier') {
      forceLogout();
      return;
    }

    await proceedToShiftClose();
  };

  const proceedToShiftClose = async () => {
    try {
      const response = await shifts.current();
      const shift = response.data?.shift || null;
      setActiveShift(shift);
      setShiftSummary(response.data?.summary || null);
      if (shift) {
        setClosingBalance('');
        setShiftNote('');
        setShowCloseShift(true);
      } else {
        forceLogout();
      }
    } catch {
      toast.error('Gagal memuat shift aktif');
    }
  };

  const handleFinishPendingTx = async (tx: any) => {
    setFinishingTxId(tx.localId);
    const isBuyingMembership = tx.items.some((i: any) => i.category === 'membership');
    const note = tx.customerType === 'member'
      ? `Member: ${tx.plate}`
      : `Guest: ${tx.plate} ${tx.vehicleModel}`;
    const payload: any = {
      items: tx.items.map((item: any) => ({ service_id: item.id, quantity: 1 })),
      user_id: tx.userId ?? null,
      customer_name: tx.customerName,
      notes: note,
      vehicle_id: tx.vehicleId ?? null,
      use_points: tx.usePoints,
      payment_method_id: 1,
    };
    if (tx.customerType === 'guest' && isBuyingMembership && tx.email) {
      payload.customer_email = tx.email;
      payload.guest_plate = tx.plate;
      payload.guest_vehicle_model = tx.vehicleModel;
    }
    try {
      const res = await transactions.manualCheckout(payload);
      await transactions.updateStatus(res.data.id, 'completed');
      const updated = pendingTxs.filter((t: any) => t.localId !== tx.localId);
      setPendingTxs(updated);
      localStorage.setItem('baxter_local_transactions', JSON.stringify(updated));
      toast.success(`Transaksi ${tx.plate} selesai`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Gagal menyelesaikan transaksi');
    } finally {
      setFinishingTxId(null);
    }
  };

  const handlePendingTxsContinueLogout = async () => {
    setShowPendingTxs(false);
    if (user?.role !== 'cashier') {
      forceLogout();
      return;
    }
    await proceedToShiftClose();
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftSubmitting(true);
    try {
      const response = await shifts.open({
        opening_balance: parseRupiahInput(openingBalance),
        opening_note: shiftNote,
      });
      setActiveShift(response.data?.shift || null);
      setShiftSummary(response.data?.summary || null);
      setShowStartShift(false);
      setOpeningBalance('');
      setShiftNote('');
      toast.success('Shift berhasil dibuka');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal membuka shift');
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftSubmitting(true);
    try {
      await shifts.close({
        closing_balance: parseRupiahInput(closingBalance),
        closing_note: shiftNote,
      });
      toast.success('Shift berhasil ditutup');
      forceLogout();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menutup shift');
    } finally {
      setShiftSubmitting(false);
    }
  };

  const filteredMenuItems = ALL_MENU_ITEMS.filter(item =>
    allowedMenus.includes(item.href)
  );

  if (!user) return null;

  return (
    <div className="flex h-[100dvh] bg-surface">
      {/* Backdrop overlay for tablet */}
      <div
        className={`sidebar-backdrop xl:hidden ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar - Overlay on tablet, fixed on desktop */}
      <aside
        className={`
          fixed xl:relative z-50 h-[100dvh] bg-white shadow-soft flex flex-col
          transition-transform duration-300 ease-in-out w-72
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          xl:translate-x-0
        `}
      >
        {/* Close button - tablet only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="xl:hidden absolute top-5 right-4 p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
        >
          <X size={20} />
        </button>

        {/* Logo */}
        <div className="h-20 flex items-center justify-center px-6 shrink-0">
          <div className="relative w-full h-10">
            <Image
              src="/bexter_logo.png"
              alt="Bexter Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 font-medium
                  ${isActive
                    ? 'bg-blue-50 text-blue-600 shadow-soft'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700 active:bg-gray-100'
                  }
                `}
              >
                <Icon
                  size={20}
                  className={`shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-700'}`}
                />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full rounded-2xl p-3.5 transition-colors text-red-500 hover:bg-red-50 active:bg-red-100"
          >
            <LogOut size={20} className="shrink-0" />
            <div className="text-left">
              <p className="text-sm font-semibold">Sign Out</p>
              <p className="text-xs text-red-400">End session</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Top Navbar */}
        <div className="bg-white/80 backdrop-blur-md shadow-soft px-4 md:px-6 py-3.5 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Hamburger - tablet only */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="xl:hidden p-2.5 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition"
              >
                <Menu size={22} />
              </button>
              <h2 className="text-lg md:text-xl font-bold text-gray-800">
                {ALL_MENU_ITEMS.find((item) => item.href === pathname)?.label || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user.role || 'User'}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-sm">
                {user.name?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">{children}</div>
      </main>

      <ChatWidget />

      {user?.role === 'cashier' && (showStartShift || checkingShift) && (
        <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-soft-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Wallet size={20}/></div>
              <div>
                <h3 className="font-bold text-slate-800">Buka Shift Kasir</h3>
                <p className="text-xs text-slate-500">Masukkan saldo awal sebelum mulai transaksi.</p>
              </div>
            </div>
            {checkingShift ? (
              <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline-block mr-2" size={18}/>Memeriksa shift...</div>
            ) : (
              <form onSubmit={handleOpenShift} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Start Balance</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(formatRupiahInput(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 font-mono font-bold text-slate-800"
                    placeholder="100.000"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Catatan</label>
                  <textarea
                    value={shiftNote}
                    onChange={(e) => setShiftNote(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 text-sm"
                    placeholder="Opsional"
                  />
                </div>
                <button disabled={shiftSubmitting} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {shiftSubmitting ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                  Mulai Shift
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {showPendingTxs && (
        <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-soft-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800">Transaksi Berjalan</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Selesaikan semua transaksi sebelum logout, atau lanjutkan tanpa menyelesaikan.
                </p>
              </div>
              <span className="shrink-0 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {pendingTxs.length} aktif
              </span>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {pendingTxs.map((tx: any) => {
                const total = tx.items.reduce((s: number, i: any) => s + i.finalPrice, 0);
                const isFinishing = finishingTxId === tx.localId;
                return (
                  <div key={tx.localId} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-slate-900 text-sm">{tx.plate || '—'}</p>
                      {tx.vehicleModel && <p className="text-xs text-slate-500 truncate">{tx.vehicleModel}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{tx.customerName || 'Guest'} · {tx.items.length} item</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tx.items.map((item: any, idx: number) => (
                          <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">{item.name}</span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <p className="text-sm font-bold text-blue-600">{formatRupiah(total)}</p>
                      <button
                        onClick={() => handleFinishPendingTx(tx)}
                        disabled={!!finishingTxId}
                        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition"
                      >
                        {isFinishing ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle size={12}/>}
                        Selesaikan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPendingTxs(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handlePendingTxsContinueLogout}
                disabled={!!finishingTxId}
                className={`flex-1 py-3 disabled:opacity-50 text-white rounded-xl font-bold transition ${pendingTxs.length === 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-500 hover:bg-rose-600'}`}
              >
                {pendingTxs.length === 0 ? 'Logout' : 'Logout Tanpa Selesaikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseShift && (
        <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-soft-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Tutup Shift & Logout</h3>
              <p className="text-xs text-slate-500 mt-1">Cek rangkuman shift sebelum konfirmasi logout.</p>
            </div>
            <form onSubmit={handleCloseShift} className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Start Balance</p>
                  <p className="font-bold text-slate-800">{formatRupiah(activeShift?.opening_balance)}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-emerald-600">Cash In</p>
                  <p className="font-bold text-emerald-700">{formatRupiah(shiftSummary?.cash_in)}</p>
                </div>
                <div className="bg-rose-50 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-rose-600">Cash Out</p>
                  <p className="font-bold text-rose-700">{formatRupiah(shiftSummary?.cash_out)}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-blue-600">Expected</p>
                  <p className="font-bold text-blue-700">{formatRupiah((activeShift?.opening_balance || 0) + (shiftSummary?.net_cashflow || 0))}</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Closing Balance</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(formatRupiahInput(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 font-mono font-bold text-slate-800"
                  placeholder="Hitung uang fisik di laci"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Catatan Closing</label>
                <textarea
                  value={shiftNote}
                  onChange={(e) => setShiftNote(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 text-sm"
                  placeholder="Opsional"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCloseShift(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600">
                  Batal
                </button>
                <button disabled={shiftSubmitting} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {shiftSubmitting ? <Loader2 className="animate-spin" size={18}/> : null}
                  Tutup & Logout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
