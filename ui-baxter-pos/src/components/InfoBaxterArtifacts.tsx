'use client';

import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
    Download, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Wallet, Receipt, Users, Clock, AlertCircle,
} from 'lucide-react';
import Cookies from 'js-cookie';

export interface Artifact {
    type: 'stat' | 'table' | 'chart' | 'download';
    title?: string;
    data: any;
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

function formatCurrency(n: number) {
    if (typeof n !== 'number' || isNaN(n)) return String(n ?? '');
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function formatNumber(n: number) {
    if (typeof n !== 'number' || isNaN(n)) return String(n ?? '');
    return n.toLocaleString('id-ID');
}

function formatValue(v: any, fmt?: string) {
    if (fmt === 'currency') return formatCurrency(Number(v));
    if (fmt === 'number') return formatNumber(Number(v));
    if (v === null || v === undefined) return '-';
    return String(v);
}

function formatBytes(b: number) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

const ICON_MAP: Record<string, React.ReactNode> = {
    money: <Wallet size={14} />,
    receipt: <Receipt size={14} />,
    users: <Users size={14} />,
    clock: <Clock size={14} />,
    alert: <AlertCircle size={14} />,
    'arrow-up': <ArrowUpRight size={14} />,
    'arrow-down': <ArrowDownRight size={14} />,
};

function StatCard({ title, data }: { title?: string; data: any }) {
    const value = formatValue(data.value, data.format);
    const trend = typeof data.trend_percent === 'number' ? data.trend_percent : null;
    const trendUp = trend !== null && trend >= 0;
    const icon = data.icon ? ICON_MAP[data.icon] : null;
    return (
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 p-3 shadow-soft">
            <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate">{title}</p>
                {icon && <div className="text-blue-500">{icon}</div>}
            </div>
            <p className="text-base font-bold text-gray-800 leading-tight">{value}</p>
            {trend !== null && (
                <p className={`text-[10px] font-semibold mt-1 flex items-center gap-0.5 ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {trend.toFixed(1)}% vs sebelumnya
                </p>
            )}
            {data.sub && <p className="text-[10px] text-gray-500 mt-0.5">{data.sub}</p>}
        </div>
    );
}

function ChartArtifact({ title, data }: { title?: string; data: any }) {
    const chartType: string = data.chart_type || 'bar';
    const points: Array<{ label: any; value: any }> = data.points || [];
    const yFormat = data.y_format;

    const chartData = points.map(p => ({
        label: String(p.label ?? ''),
        value: Number(p.value) || 0,
    }));

    const yTickFormatter = (v: number) => {
        if (yFormat === 'currency') {
            if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'jt';
            if (v >= 1_000) return (v / 1_000).toFixed(0) + 'rb';
            return String(v);
        }
        return formatNumber(v);
    };

    const tooltipFormatter = (v: any) =>
        yFormat === 'currency' ? formatCurrency(Number(v)) : formatNumber(Number(v));

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-soft">
            {title && <p className="text-xs font-bold text-gray-700 mb-2">{title}</p>}
            <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                    {chartType === 'pie' ? (
                        <PieChart>
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="label"
                                outerRadius={70}
                                label={(entry: any) => entry.label}
                            >
                                {chartData.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={tooltipFormatter} />
                        </PieChart>
                    ) : chartType === 'line' ? (
                        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" fontSize={10} tickLine={false} />
                            <YAxis fontSize={10} tickFormatter={yTickFormatter} tickLine={false} width={45} />
                            <Tooltip formatter={tooltipFormatter} />
                            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    ) : chartType === 'area' ? (
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                            <defs>
                                <linearGradient id="ai_area" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" fontSize={10} tickLine={false} />
                            <YAxis fontSize={10} tickFormatter={yTickFormatter} tickLine={false} width={45} />
                            <Tooltip formatter={tooltipFormatter} />
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#ai_area)" />
                        </AreaChart>
                    ) : (
                        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" fontSize={10} tickLine={false} />
                            <YAxis fontSize={10} tickFormatter={yTickFormatter} tickLine={false} width={45} />
                            <Tooltip formatter={tooltipFormatter} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function TableArtifact({ title, data }: { title?: string; data: any }) {
    const columns: Array<{ key: string; label: string; format?: string }> = data.columns || [];
    const rows: any[][] = data.rows || [];
    return (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-soft overflow-hidden">
            {title && <p className="text-xs font-bold text-gray-700 px-3 pt-3">{title}</p>}
            <div className="overflow-x-auto mt-2">
                <table className="w-full text-[11px]">
                    <thead className="bg-gray-50">
                        <tr>
                            {columns.map((c, i) => (
                                <th key={i} className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.length === 0 ? (
                            <tr><td colSpan={columns.length} className="px-3 py-4 text-center text-gray-400 italic">Tidak ada data</td></tr>
                        ) : (
                            rows.map((row, ri) => (
                                <tr key={ri} className="hover:bg-gray-50">
                                    {columns.map((c, ci) => (
                                        <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                                            {formatValue(row[ci], c.format)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DownloadArtifact({ data }: { data: any }) {
    const url: string = data.url;
    const filename: string = data.filename || 'download';
    const rows: number = data.rows || 0;
    const size: number = data.size_bytes || 0;

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        const token = Cookies.get('token');
        try {
            const res = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error('download failed');
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
        } catch {
            window.open(url, '_blank');
        }
    };

    return (
        <button
            onClick={handleDownload}
            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition p-3 shadow-soft text-left"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="bg-blue-600 text-white p-2 rounded-xl shrink-0">
                    <Download size={16} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{filename}</p>
                    <p className="text-[10px] text-gray-500">
                        {rows} baris{size ? ' · ' + formatBytes(size) : ''}
                    </p>
                </div>
            </div>
            <span className="text-[10px] font-bold text-blue-600 uppercase shrink-0">Download</span>
        </button>
    );
}

export default function InfoBaxterArtifacts({ artifacts }: { artifacts: Artifact[] }) {
    if (!artifacts || artifacts.length === 0) return null;

    const stats = artifacts.filter(a => a.type === 'stat');
    const others = artifacts.filter(a => a.type !== 'stat');

    return (
        <div className="space-y-2 mt-2">
            {stats.length > 0 && (
                <div className={`grid gap-2 ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {stats.map((a, i) => (
                        <StatCard key={i} title={a.title} data={a.data} />
                    ))}
                </div>
            )}
            {others.map((a, i) => {
                if (a.type === 'chart') return <ChartArtifact key={i} title={a.title} data={a.data} />;
                if (a.type === 'table') return <TableArtifact key={i} title={a.title} data={a.data} />;
                if (a.type === 'download') return <DownloadArtifact key={i} data={a.data} />;
                return null;
            })}
        </div>
    );
}
