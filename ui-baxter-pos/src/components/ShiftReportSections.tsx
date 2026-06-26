'use client';

import { useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ChevronDown } from 'lucide-react';

export const DEFAULT_SHIFT_REPORT_LABELS = {
  categorySales: 'Penjualan berdasarkan Kategori',
  paymentSummary: 'Ringkasan Metode Pembayaran',
  profitLoss: 'Laba/Rugi',
  canceledOrders: 'Pesanan Dibatalkan',
  summary: 'Ringkasan',
  name: 'Nama',
  amount: 'Jumlah',
  qty: 'Qty',
  amountIdr: 'Jumlah (IDR)',
  paymentMethod: 'Cara Pembayaran',
  bankAccount: 'Akun Bank',
  totalSales: 'Total Penjualan',
  source: 'Sumber Penjualan',
  totalOrder: 'Total Pesanan',
  orderQty: 'Qty Pesanan',
  grossProfit: 'C. Laba Kotor',
  netProfit: 'G. Laba Bersih',
  noData: 'No Data',
};

type Labels = typeof DEFAULT_SHIFT_REPORT_LABELS;

type ShiftReportSectionsProps = {
  report: any;
  labels?: Partial<Labels>;
  defaultOpen?: string[];
  compact?: boolean;
};

const formatCurrency = (amount: number) => {
  return `IDR ${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)}`;
};

const formatPlain = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

const numberCell = (amount: number, withCurrency = true) => (
  <span className="font-medium tabular-nums">{withCurrency ? formatCurrency(amount) : formatPlain(amount)}</span>
);

function AccordionSection({
  id,
  title,
  children,
  openSections,
  setOpenSections,
  padded = true,
}: {
  id: string;
  title: string;
  children: ReactNode;
  openSections: string[];
  setOpenSections: Dispatch<SetStateAction<string[]>>;
  padded?: boolean;
}) {
  const isOpen = openSections.includes(id);
  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpenSections(prev => isOpen ? prev.filter(item => item !== id) : [...prev, id])}
        className={`w-full py-4 flex items-center justify-between gap-3 text-left ${padded ? 'px-4 sm:px-6' : 'px-2 sm:px-3'}`}
      >
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <ChevronDown size={18} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className={`pb-6 ${padded ? 'px-4 sm:px-6' : 'px-2 sm:px-3'}`}>{children}</div>}
    </section>
  );
}

function ReportTable({
  headers,
  children,
  empty,
  colSpan,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: boolean;
  colSpan?: number;
}) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-sm">
      <table className="w-full min-w-[640px] text-sm text-left border-collapse">
        <thead>
          <tr className="bg-white">
            {headers.map((header) => (
              <th key={header} className="p-4 font-bold text-slate-800 border-b border-r last:border-r-0 border-slate-200">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={colSpan || headers.length} className="p-8 text-center text-slate-400 border-slate-200">
                No Data
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

function AccountingRows({ lines, withCurrency = false }: { lines: any[]; withCurrency?: boolean }) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-sm">
      <table className="w-full min-w-[520px] text-sm border-collapse">
        <tbody>
          {(lines || []).map((line: any, index: number) => (
            <tr key={`${line.label}-${index}`} className={index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
              <td className="p-4 border-b border-r last:border-r-0 border-slate-200 text-slate-700">{line.label}</td>
              <td className="p-4 border-b border-slate-200 text-right text-slate-700">{numberCell(line.amount, withCurrency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfitLossSummary({ profitLoss, t }: { profitLoss: any; t: Labels }) {
  const [showDetail, setShowDetail] = useState(false);

  const netProfit: number = profitLoss.net_profit || 0;
  const isProfit = netProfit >= 0;

  const summaryRows: { label: string; value: number; bold?: boolean; accent?: 'green' | 'red' | 'blue' }[] = [
    { label: profitLoss.revenue?.title || 'A. Pendapatan',             value: profitLoss.revenue?.total || 0 },
    { label: profitLoss.cogs?.title    || 'B. HPP',                    value: profitLoss.cogs?.total    || 0 },
    { label: t.grossProfit,                                             value: profitLoss.gross_profit   || 0, bold: true, accent: 'blue' },
    { label: profitLoss.expenses?.title || 'D. Pengeluaran',           value: profitLoss.expenses?.total || 0 },
    { label: profitLoss.stock?.title   || 'E. Stok',                   value: profitLoss.stock?.total    || 0 },
    { label: profitLoss.purchases?.title || 'F. Pembelian',            value: profitLoss.purchases?.total || 0 },
    { label: t.netProfit,                                               value: netProfit, bold: true, accent: isProfit ? 'green' : 'red' },
  ];

  return (
    <div className="space-y-3">
      {/* Summary rows */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {summaryRows.map((row, i) => {
          const valueCls = row.accent === 'green'
            ? 'text-emerald-600'
            : row.accent === 'red'
              ? 'text-rose-600'
              : row.accent === 'blue'
                ? 'text-blue-600'
                : 'text-slate-700';
          const rowCls = row.bold
            ? 'bg-slate-50 border-t border-slate-200'
            : i % 2 === 1 ? 'bg-white' : 'bg-slate-50/40';
          return (
            <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${rowCls}`}>
              <span className={`text-sm ${row.bold ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                {row.label}
              </span>
              <span className={`text-sm tabular-nums font-semibold ${row.bold ? `font-bold ${valueCls}` : 'text-slate-700'}`}>
                {formatPlain(row.value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Detail toggle */}
      <button
        type="button"
        onClick={() => setShowDetail(prev => !prev)}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
      >
        <ChevronDown size={14} className={`transition-transform ${showDetail ? 'rotate-180' : ''}`} />
        {showDetail ? 'Sembunyikan detail' : 'Lihat detail rincian'}
      </button>

      {/* Full breakdown — only shown when expanded */}
      {showDetail && (
        <div className="space-y-5 pt-1">
          {/* A. Revenue */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-slate-800 text-sm">{profitLoss.revenue?.title}</h4>
              <p className="font-bold text-slate-800 text-sm">{formatPlain(profitLoss.revenue?.total)}</p>
            </div>
            <AccountingRows lines={profitLoss.revenue?.lines || []} />
          </div>

          {/* B. COGS */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-slate-800 text-sm">{profitLoss.cogs?.title}</h4>
              <p className="font-bold text-slate-800 text-sm">{formatPlain(profitLoss.cogs?.total)}</p>
            </div>
            <AccountingRows lines={profitLoss.cogs?.lines || []} />
          </div>

          {/* C. Gross Profit */}
          <div className="flex justify-between items-center px-4 py-3 bg-blue-50 rounded-xl">
            <h4 className="font-bold text-blue-800 text-sm">{t.grossProfit}</h4>
            <p className="font-bold text-blue-800 text-sm">{formatPlain(profitLoss.gross_profit)}</p>
          </div>

          {/* D. Expenses */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-slate-800 text-sm">{profitLoss.expenses?.title}</h4>
              <p className="font-bold text-slate-800 text-sm">{formatPlain(profitLoss.expenses?.total)}</p>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-sm">
              <table className="w-full min-w-[520px] text-sm border-collapse">
                <tbody>
                  {(profitLoss.expenses?.items || []).length === 0 ? (
                    <tr><td className="p-8 text-center text-slate-400">No Data</td></tr>
                  ) : profitLoss.expenses.items.map((item: any, index: number) => (
                    <tr key={`${item.label}-${index}`} className="even:bg-slate-50">
                      <td className="p-4 border-b border-r border-slate-200 text-slate-700">{item.label}</td>
                      <td className="p-4 border-b border-slate-200 text-right text-slate-700">{formatPlain(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* E. Stock */}
          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-2">{profitLoss.stock?.title}</h4>
            <AccountingRows lines={profitLoss.stock?.lines || []} withCurrency />
          </div>

          {/* F. Purchases */}
          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-2">{profitLoss.purchases?.title}</h4>
            <AccountingRows lines={profitLoss.purchases?.lines || []} />
          </div>

          {/* G. Net Profit */}
          <div className={`flex justify-between items-center px-4 py-3 rounded-xl ${isProfit ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            <h4 className={`font-bold text-sm ${isProfit ? 'text-emerald-800' : 'text-rose-800'}`}>{t.netProfit}</h4>
            <p className={`font-bold text-sm ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>{formatPlain(netProfit)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShiftReportSections({
  report,
  labels,
  defaultOpen = ['category', 'payment', 'profit', 'canceled'],
  compact = false,
}: ShiftReportSectionsProps) {
  const t = { ...DEFAULT_SHIFT_REPORT_LABELS, ...labels };
  const [openSections, setOpenSections] = useState<string[]>(defaultOpen);

  if (!report) return null;

  const categoryRows = report.category_sales || [];
  const paymentRows = report.payment_summary?.rows || [];
  const profitLoss = report.profit_loss || {};
  const canceledRows = report.canceled_orders?.rows || [];
  const spacing = compact ? 'space-y-4' : 'space-y-6';

  return (
    <div className={`bg-white ${compact ? '' : 'rounded-2xl shadow-soft overflow-hidden'} ${spacing}`}>
      <AccordionSection id="category" title={t.categorySales} openSections={openSections} setOpenSections={setOpenSections} padded={!compact}>
        <ReportTable headers={[t.name, t.amount, t.qty]} empty={categoryRows.length === 0}>
          {categoryRows.map((row: any) => (
            <tr key={row.name} className="even:bg-slate-50">
              <td className="p-4 border-b border-r border-slate-200 text-slate-700">{row.name}</td>
              <td className="p-4 border-b border-r border-slate-200 text-right text-slate-700">{numberCell(row.amount)}</td>
              <td className="p-4 border-b border-slate-200 text-slate-700">{row.qty || 0}</td>
            </tr>
          ))}
        </ReportTable>
      </AccordionSection>

      <AccordionSection id="payment" title={t.paymentSummary} openSections={openSections} setOpenSections={setOpenSections} padded={!compact}>
        <div className="border border-slate-200 rounded-sm overflow-hidden">
          <div className="bg-slate-50 p-4">
            <h4 className="text-lg text-slate-700 mb-3">{t.summary}</h4>
            <p className="text-sm text-slate-700">
              {t.amountIdr}: <span className="font-bold">{formatCurrency(report.payment_summary?.total_sales)}</span>
            </p>
          </div>
          <ReportTable headers={[t.paymentMethod, t.bankAccount, t.totalSales]} empty={paymentRows.length === 0}>
            {paymentRows.map((row: any) => (
              <tr key={row.payment_method} className="even:bg-slate-50">
                <td className="p-4 border-b border-r border-slate-200 text-slate-700">{row.payment_method}</td>
                <td className="p-4 border-b border-r border-slate-200 text-slate-700">{row.bank_account || '-'}</td>
                <td className="p-4 border-b border-slate-200 text-right text-slate-700">{numberCell(row.total_sales)}</td>
              </tr>
            ))}
          </ReportTable>
        </div>
      </AccordionSection>

      <AccordionSection id="profit" title={t.profitLoss} openSections={openSections} setOpenSections={setOpenSections} padded={!compact}>
        <ProfitLossSummary profitLoss={profitLoss} t={t} />
      </AccordionSection>

      <AccordionSection id="canceled" title={t.canceledOrders} openSections={openSections} setOpenSections={setOpenSections} padded={!compact}>
        <div className="border border-slate-200 rounded-sm overflow-hidden">
          <div className="bg-slate-50 p-4">
            <h4 className="text-lg text-slate-700">{t.summary}</h4>
          </div>
          <ReportTable headers={[t.source, t.totalOrder, t.orderQty]} empty={canceledRows.length === 0}>
            {canceledRows.map((row: any) => (
              <tr key={row.source} className="even:bg-slate-50">
                <td className="p-4 border-b border-r border-slate-200 text-slate-700">{row.source}</td>
                <td className="p-4 border-b border-r border-slate-200 text-right text-slate-700">{numberCell(row.total_order)}</td>
                <td className="p-4 border-b border-slate-200 text-slate-700">{row.qty || 0}</td>
              </tr>
            ))}
          </ReportTable>
        </div>
      </AccordionSection>
    </div>
  );
}
