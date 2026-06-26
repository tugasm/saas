'use client';

import { useEffect, useState, useMemo } from 'react';
import { reports, transactions as trxApi, cashflow, memberships } from '@/lib/api';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  TrendingUp, TrendingDown, Users, DollarSign, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Clock, CreditCard, Banknote,
  AlertTriangle, RefreshCw, Loader2, CalendarDays, Activity,
  ArrowDownLeft, ArrowUpLeft, Wallet
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

type Period = 'weekly' | 'monthly' | 'yearly';

const PERIOD_LABELS: Record<Period, string> = {
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
};

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { start, end };
}

function getYesterdayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
  return { start, end };
}

function formatDateParam(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [analytics, setAnalytics] = useState<any>(null);
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [cashflowData, setCashflowData] = useState<any[]>([]);
  const [membershipData, setMembershipData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const now = new Date();
      const [analyticsRes, monthlyRes, revenueRes, trxRes, cfRes, memRes] = await Promise.all([
        reports.analytics(),
        reports.monthly({ month: now.getMonth() + 1, year: now.getFullYear() }),
        reports.revenue({ year: now.getFullYear() }),
        trxApi.getAll(),
        cashflow.getAll(),
        memberships.getAll(),
      ]);

      setAnalytics(analyticsRes.data);
      setMonthlyReport(monthlyRes.data);
      setRevenueData(revenueRes.data);
      setAllTransactions(Array.isArray(trxRes.data) ? trxRes.data : []);
      setCashflowData(Array.isArray(cfRes.data) ? cfRes.data : []);
      const memItems = memRes.data?.data ?? memRes.data;
      setMembershipData(Array.isArray(memItems) ? memItems : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatShortRupiah = (amount: number) => {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}jt`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}rb`;
    return amount.toString();
  };

  // --- PERIOD-FILTERED STATS ---
  const periodStats = useMemo(() => {
    const paidTrx = allTransactions.filter(t => t.status === 'paid');

    if (period === 'yearly') {
      const year = new Date().getFullYear();
      const yearTrx = paidTrx.filter(t => new Date(t.created_at).getFullYear() === year);
      const revenue = yearTrx.reduce((s, t) => s + (t.total_amount || 0), 0);
      return { revenue, transactions: yearTrx.length, label: `Tahun ${year}` };
    }

    if (period === 'weekly') {
      const { start, end } = getWeekRange();
      const weekTrx = paidTrx.filter(t => {
        const d = new Date(t.created_at);
        return d >= start && d <= end;
      });
      const revenue = weekTrx.reduce((s, t) => s + (t.total_amount || 0), 0);
      return { revenue, transactions: weekTrx.length, label: 'Minggu Ini' };
    }

    return {
      revenue: monthlyReport?.total_revenue || 0,
      transactions: monthlyReport?.total_transactions || 0,
      label: 'Bulan Ini',
    };
  }, [period, allTransactions, monthlyReport]);

  // --- TODAY'S PERFORMANCE ---
  const todayStats = useMemo(() => {
    const paidTrx = allTransactions.filter(t => t.status === 'paid');
    const { start: todayStart, end: todayEnd } = getTodayRange();
    const { start: yestStart, end: yestEnd } = getYesterdayRange();

    const todayTrx = paidTrx.filter(t => {
      const d = new Date(t.created_at);
      return d >= todayStart && d <= todayEnd;
    });
    const yesterdayTrx = paidTrx.filter(t => {
      const d = new Date(t.created_at);
      return d >= yestStart && d <= yestEnd;
    });

    const todayRevenue = todayTrx.reduce((s, t) => s + (t.total_amount || 0), 0);
    const yestRevenue = yesterdayTrx.reduce((s, t) => s + (t.total_amount || 0), 0);
    const revenueChange = yestRevenue > 0 ? ((todayRevenue - yestRevenue) / yestRevenue) * 100 : 0;
    const avgTransaction = todayTrx.length > 0 ? todayRevenue / todayTrx.length : 0;

    return {
      revenue: todayRevenue,
      count: todayTrx.length,
      avgTransaction,
      revenueChange,
      yesterdayRevenue: yestRevenue,
      yesterdayCount: yesterdayTrx.length,
    };
  }, [allTransactions]);

  // --- RECENT TRANSACTIONS (LIVE FEED) ---
  const recentTransactions = useMemo(() => {
    return [...allTransactions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [allTransactions]);

  // --- HOURLY DISTRIBUTION (TODAY) ---
  const hourlyData = useMemo(() => {
    const { start, end } = getTodayRange();
    const todayTrx = allTransactions.filter(t => {
      const d = new Date(t.created_at);
      return d >= start && d <= end && t.status === 'paid';
    });

    const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 07:00 - 18:00
    const counts = hours.map(h =>
      todayTrx.filter(t => new Date(t.created_at).getHours() === h).length
    );
    const revenues = hours.map(h =>
      todayTrx.filter(t => new Date(t.created_at).getHours() === h)
        .reduce((s, t) => s + (t.total_amount || 0), 0)
    );

    return {
      labels: hours.map(h => `${h.toString().padStart(2, '0')}:00`),
      counts,
      revenues,
      peakHour: hours[counts.indexOf(Math.max(...counts))],
    };
  }, [allTransactions]);

  // --- CASH FLOW SUMMARY ---
  const cfSummary = useMemo(() => {
    const now = new Date();
    const thisMonth = cashflowData.filter(d => {
      const date = new Date(d.created_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const totalIn = thisMonth.filter(d => d.type === 'in').reduce((s, d) => s + d.amount, 0);
    const totalOut = thisMonth.filter(d => d.type === 'out').reduce((s, d) => s + d.amount, 0);
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [cashflowData]);

  // --- EXPIRING MEMBERSHIPS ---
  const expiringMembers = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return membershipData
      .filter(m => {
        if (m.status !== 'active' || !m.end_date) return false;
        const end = new Date(m.end_date);
        return end >= now && end <= in7Days;
      })
      .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
  }, [membershipData]);

  // --- PENDING TRANSACTIONS ---
  const pendingCount = useMemo(() => {
    return allTransactions.filter(t => t.status === 'pending').length;
  }, [allTransactions]);

  // --- CHART DATA ---
  const revenueChartData = {
    labels: revenueData
      ? revenueData.map((d: any) => {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          return months[d.month - 1];
        })
      : [],
    datasets: [
      {
        label: 'Revenue',
        data: revenueData ? revenueData.map((d: any) => d.revenue) : [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const hourlyChartData = {
    labels: hourlyData.labels,
    datasets: [
      {
        label: 'Transaksi',
        data: hourlyData.counts,
        backgroundColor: hourlyData.counts.map((_, i) =>
          hourlyData.labels[i]?.startsWith(String(hourlyData.peakHour).padStart(2, '0'))
            ? 'rgba(59, 130, 246, 0.8)'
            : 'rgba(59, 130, 246, 0.25)'
        ),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header + Period Filter + Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-400 text-sm">Pantau performa bisnis secara realtime</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white p-1 rounded-2xl shadow-soft">
            {(['weekly', 'monthly', 'yearly'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                  period === p
                    ? 'bg-blue-600 text-white shadow-soft-md'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 bg-white rounded-xl shadow-soft hover:shadow-soft-md transition text-gray-400 hover:text-blue-600 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft hover:shadow-soft-md transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <DollarSign size={22} className="text-blue-500" />
            </div>
            <span className="text-[10px] md:text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-lg">
              {periodStats.label}
            </span>
          </div>
          <h3 className="text-lg md:text-2xl font-bold text-gray-800 mb-1">
            {formatRupiah(periodStats.revenue)}
          </h3>
          <p className="text-gray-400 text-xs md:text-sm">Total Revenue</p>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft hover:shadow-soft-md transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="p-2.5 bg-green-50 rounded-xl">
              <ShoppingBag size={22} className="text-green-500" />
            </div>
            <span className="text-[10px] md:text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-lg">
              {periodStats.label}
            </span>
          </div>
          <h3 className="text-lg md:text-2xl font-bold text-gray-800 mb-1">
            {periodStats.transactions}
          </h3>
          <p className="text-gray-400 text-xs md:text-sm">Total Transaksi</p>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft hover:shadow-soft-md transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="p-2.5 bg-purple-50 rounded-xl">
              <Users size={22} className="text-purple-500" />
            </div>
            <span className="text-[10px] md:text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-lg">
              Active
            </span>
          </div>
          <h3 className="text-lg md:text-2xl font-bold text-gray-800 mb-1">
            {analytics?.active_memberships || 0}
          </h3>
          <p className="text-gray-400 text-xs md:text-sm">Membership Aktif</p>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft hover:shadow-soft-md transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="p-2.5 bg-orange-50 rounded-xl">
              <TrendingUp size={22} className="text-orange-500" />
            </div>
            <span className="text-[10px] md:text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-lg">
              {period === 'monthly' ? 'Bulan Ini' : periodStats.label}
            </span>
          </div>
          <h3 className="text-lg md:text-2xl font-bold text-gray-800 mb-1">
            {formatRupiah(monthlyReport?.net_income || 0)}
          </h3>
          <p className="text-gray-400 text-xs md:text-sm">Net Income</p>
        </div>
      </div>

      {/* Today's Performance + Hourly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today's Performance */}
        <div className="bg-white rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
              <Activity size={16} className="text-blue-500" /> Hari Ini
            </h3>
            <div className="flex items-center gap-1 text-xs font-medium text-gray-400">
              <Clock size={12} />
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
          </div>

          <div className="space-y-4">
            {/* Revenue Today */}
            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-xs text-blue-400 font-bold uppercase mb-1">Revenue Hari Ini</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-gray-800">{formatRupiah(todayStats.revenue)}</h3>
                {todayStats.revenueChange !== 0 && (
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                    todayStats.revenueChange > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {todayStats.revenueChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(todayStats.revenueChange).toFixed(0)}%
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Kemarin: {formatRupiah(todayStats.yesterdayRevenue)}</p>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Transaksi</p>
                <p className="text-xl font-bold text-gray-800">{todayStats.count}</p>
                <p className="text-[10px] text-gray-400">Kemarin: {todayStats.yesterdayCount}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Rata-rata</p>
                <p className="text-xl font-bold text-gray-800">{formatShortRupiah(todayStats.avgTransaction)}</p>
                <p className="text-[10px] text-gray-400">per transaksi</p>
              </div>
            </div>

            {/* Pending alert */}
            {pendingCount > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800">{pendingCount} Pending</p>
                  <p className="text-[10px] text-amber-600">Menunggu approval</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hourly Distribution Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
              <CalendarDays size={16} className="text-blue-500" /> Distribusi Jam Hari Ini
            </h3>
            {hourlyData.peakHour > 0 && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                Peak: {String(hourlyData.peakHour).padStart(2, '0')}:00
              </span>
            )}
          </div>
          <Bar
            data={hourlyChartData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: { legend: { display: false } },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { stepSize: 1, font: { size: 11 } },
                  grid: { color: 'rgba(0,0,0,0.04)' },
                },
                x: {
                  grid: { display: false },
                  ticks: { font: { size: 10 } },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-soft">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-500" /> Grafik Pemasukan Tahunan
        </h3>
        {revenueData && revenueData.length > 0 ? (
          <Line
            data={revenueChartData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { callback: (value) => formatShortRupiah(Number(value)), font: { size: 11 } },
                  grid: { color: 'rgba(0,0,0,0.04)' },
                },
                x: { grid: { display: false } },
              },
            }}
          />
        ) : (
          <p className="text-gray-400 text-center py-8">Belum ada data</p>
        )}
      </div>

      {/* Live Activity + Cash Flow + Membership Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Live Activity Feed */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-soft">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Activity size={16} className="text-green-500" /> Aktivitas Terkini
          </h3>
          <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
            {recentTransactions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Belum ada transaksi</p>
            ) : (
              recentTransactions.map((trx) => {
                const statusColor: Record<string, string> = {
                  paid: 'bg-green-500',
                  pending: 'bg-amber-500',
                  failed: 'bg-red-500',
                  cancelled: 'bg-gray-400',
                };
                const timeAgo = getTimeAgo(trx.created_at);

                return (
                  <div key={trx.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xs">
                        {(trx.user?.name || trx.guest_name || 'G')?.[0]?.toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColor[trx.status] || 'bg-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {trx.user?.name || trx.guest_name || 'Walk-in'}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1">
                          {trx.payment_method_id === 1 ? <Banknote size={10} /> : <CreditCard size={10} />}
                          {trx.payment_method_id === 1 ? 'Cash' : 'QRIS'}
                        </span>
                        <span>{timeAgo}</span>
                      </div>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${trx.status === 'paid' ? 'text-green-600' : 'text-gray-500'}`}>
                      {formatRupiah(trx.total_amount)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cash Flow Summary */}
        <div className="bg-white rounded-2xl p-6 shadow-soft">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Wallet size={16} className="text-blue-500" /> Cash Flow Bulan Ini
          </h3>

          <div className="space-y-4">
            <div className="bg-green-50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ArrowDownLeft size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-600 font-bold uppercase">Pemasukan</p>
                  <p className="text-lg font-bold text-gray-800">{formatRupiah(cfSummary.totalIn)}</p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ArrowUpLeft size={18} className="text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-red-600 font-bold uppercase">Pengeluaran</p>
                  <p className="text-lg font-bold text-gray-800">{formatRupiah(cfSummary.totalOut)}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-xl p-4 ${cfSummary.net >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
              <p className={`text-xs font-bold uppercase mb-1 ${cfSummary.net >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                Saldo Bersih
              </p>
              <p className="text-2xl font-bold text-gray-800">{formatRupiah(cfSummary.net)}</p>
            </div>

            {/* Membership expiring alerts */}
            {expiringMembers.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-bold text-amber-600 uppercase mb-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> Member Segera Expired
                </p>
                <div className="space-y-2">
                  {expiringMembers.slice(0, 3).map(m => {
                    const daysLeft = Math.ceil((new Date(m.end_date).getTime() - Date.now()) / (1000 * 3600 * 24));
                    return (
                      <div key={m.id} className="flex items-center justify-between bg-amber-50 rounded-lg p-2.5">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{m.user?.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{m.vehicle?.license_plate}</p>
                        </div>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                          {daysLeft}d left
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category Revenue & Top Customers (stacked) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-soft">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-blue-500" /> Revenue per Kategori
            </h3>
            <div className="space-y-3">
              {analytics?.category_revenue?.map((cat: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800 capitalize text-sm">{cat.category}</p>
                    <p className="text-xs text-gray-400">{cat.count} trx</p>
                  </div>
                  <p className="text-sm font-bold text-blue-600">{formatRupiah(cat.revenue)}</p>
                </div>
              ))}
              {(!analytics?.category_revenue || analytics.category_revenue.length === 0) && (
                <p className="text-gray-400 text-sm text-center py-4">Belum ada data</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-soft">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Users size={16} className="text-purple-500" /> Top Customers
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {analytics?.top_customers?.slice(0, 5).map((customer: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{customer.name}</p>
                      <p className="text-[10px] text-gray-400">{customer.transactions} trx</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-green-600">{formatShortRupiah(customer.total_spent)}</p>
                </div>
              ))}
              {(!analytics?.top_customers || analytics.top_customers.length === 0) && (
                <p className="text-gray-400 text-sm text-center py-4">Belum ada data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin}m lalu`;
  if (diffHour < 24) return `${diffHour}j lalu`;
  if (diffDay < 7) return `${diffDay}h lalu`;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}
