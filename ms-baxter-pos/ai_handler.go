package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

const schemaDescription = `Schema database (PostgreSQL):
- users (id, email, name, phone, address, birth_place, birth_date, gender, role['admin'|'customer'|'cashier'], points, is_active, created_at, updated_at)
- vehicles (id, user_id, type['car'|'bike'], brand, model, year, color, license_plate, created_at)
- memberships (id, user_id, vehicle_id, status['pending'|'active'|'expired'], start_date, end_date, transaction_id, created_at)
- services (id, name, category['carwash'|'bikewash'|'membership'|'food'|'beverage'|'cafe'], price, description, duration, points_awarded, member_discount_pct, duration_months, is_active)
- transactions (id, transaction_code, user_id, total_amount, points_earned, status['pending'|'paid'|'cancelled'|'failed'], payment_method_id, payment_type, cashier_id, notes, paid_at, created_at)
- transaction_items (id, transaction_id, service_id, quantity, base_price, discount_amount, final_price, subtotal)
- payment_methods (id, name, type, is_active)
- cash_flows (id, type['in'|'out'], amount, description, category, created_by, created_at)
- ledgers (id, date, type, category, amount, description, created_by, created_at)
- employees (id, name, phone, position, hourly_rate, join_date, is_active)
- attendances (id, employee_id, date, clock_in, clock_out, duration_hours, daily_wage, status)
- employee_loans (id, employee_id, amount, remaining_amount, reason, status)
- payrolls (id, employee_id, period_start, period_end, total_hours, base_salary, loan_deduction, bonus, net_salary, status)
Catatan: kolom soft-delete deleted_at di sebagian tabel — tambahkan WHERE deleted_at IS NULL kalau perlu data aktif.

GLOSARIUM BISNIS (PENTING — pakai definisi ini, bukan asumsi):
- "omzet" / "pendapatan" / "revenue" / "penjualan" = SUM(transactions.total_amount) WHERE status='paid'
- "transaksi" (count) = COUNT(transactions) tanpa filter status, kecuali user menyebut "transaksi paid"
- "member aktif" = memberships WHERE status='active' AND end_date >= NOW()
- "member baru" = memberships WHERE created_at di periode tertentu
- "service paling laku" = ranking berdasarkan SUM(transaction_items.quantity), bukan revenue, kecuali user spesifik minta "by revenue"
- "profit kotor" = revenue - cost (saat ini cost tidak ditrack, jadi laporkan revenue saja dengan disclaimer)
- "cashflow net" = SUM(cash_in) - SUM(cash_out) untuk periode
- "rata-rata transaksi" = AVG(total_amount) WHERE status='paid'
- "customer aktif" = users dengan minimal 1 transaksi paid di periode terakhir
- nilai uang dalam Rupiah, format dengan pemisah titik (Rp 1.250.000)`

const openRouterURL = "https://openrouter.ai/api/v1/chat/completions"

type aiToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type aiMessage struct {
	Role       string       `json:"role"`
	Content    string       `json:"content,omitempty"`
	ToolCalls  []aiToolCall `json:"tool_calls,omitempty"`
	ToolCallID string       `json:"tool_call_id,omitempty"`
	Name       string       `json:"name,omitempty"`
}

type aiChoice struct {
	Message      aiMessage `json:"message"`
	FinishReason string    `json:"finish_reason"`
}

type aiResponse struct {
	Choices []aiChoice `json:"choices"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// AIArtifact is a structured payload rendered by the front-end alongside the
// text reply. Kept intentionally permissive — Data is any JSON.
type AIArtifact struct {
	Type  string      `json:"type"` // stat | table | chart | download
	Title string      `json:"title,omitempty"`
	Data  interface{} `json:"data"`
}

// toolOutput wraps the data the LLM sees plus optional UI artifacts.
type toolOutput struct {
	Data      interface{}
	Artifacts []AIArtifact
}

// Tool definitions exposed to the LLM. Read-only access to business data.
var aiTools = []map[string]any{
	{
		"type": "function",
		"function": map[string]any{
			"name":        "get_dashboard_overview",
			"description": "Snapshot omzet hari ini, jumlah transaksi, member aktif, dan top 3 services. Pakai untuk pertanyaan umum 'bagaimana hari ini' / 'overview bisnis'. Sekaligus produce 3 stat cards dan 1 chart.",
			"parameters": map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "query_transactions",
			"description": "List transaksi terbaru dengan filter date range & status. Tabel artifact otomatis dihasilkan untuk UI.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"start_date": map[string]any{"type": "string", "description": "ISO date YYYY-MM-DD (inclusive)"},
					"end_date":   map[string]any{"type": "string", "description": "ISO date YYYY-MM-DD (inclusive)"},
					"status":     map[string]any{"type": "string", "enum": []string{"paid", "pending", "cancelled", "failed"}},
					"limit":      map[string]any{"type": "integer", "description": "Max rows (default 20, max 100)"},
				},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "get_revenue_summary",
			"description": "Total omzet (status='paid') untuk periode tertentu. Bandingkan dengan periode sebelumnya secara otomatis.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period": map[string]any{
						"type": "string",
						"enum": []string{"today", "yesterday", "this_week", "this_month", "this_year", "last_7_days", "last_30_days"},
					},
				},
				"required": []string{"period"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "get_revenue_trend",
			"description": "Tren omzet harian untuk N hari terakhir. Menghasilkan chart artifact tipe line/bar. Gunakan saat user minta 'grafik omzet', 'tren penjualan', 'pendapatan per hari'.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"days":       map[string]any{"type": "integer", "description": "Jumlah hari ke belakang. Default 7, max 90."},
					"chart_type": map[string]any{"type": "string", "enum": []string{"line", "bar"}, "description": "default line"},
				},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "get_top_services",
			"description": "Top services ranking by quantity sold dalam periode. Selalu produce chart bar.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period": map[string]any{"type": "string", "enum": []string{"today", "this_week", "this_month", "this_year"}},
					"limit":  map[string]any{"type": "integer", "description": "Default 5"},
				},
				"required": []string{"period"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "get_memberships_stats",
			"description": "Count member by status + list member yang akan expired dalam 14 hari. Produce 1 stat card per status + tabel upcoming.",
			"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "get_cashflow_summary",
			"description": "Cashflow in/out dalam periode. Produce stat cards.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period": map[string]any{"type": "string", "enum": []string{"today", "this_week", "this_month"}},
				},
				"required": []string{"period"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "execute_sql_query",
			"description": "Jalankan SELECT PostgreSQL bebas (read-only). Pakai kalau tidak ada tool spesifik yang cocok. " +
				"Wajib SELECT/WITH, tanpa DML/DDL. Max 200 rows. Hasil otomatis di-render sebagai tabel artifact kalau >1 baris.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"sql":   map[string]any{"type": "string", "description": "Single SELECT statement. ORDER BY + LIMIT diharuskan untuk stabilitas."},
					"title": map[string]any{"type": "string", "description": "Judul tabel artifact (optional)"},
				},
				"required": []string{"sql"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "export_data",
			"description": "Generate file CSV atau Excel dari query SQL custom. WAJIB digunakan saat user minta 'download', 'export', 'unduh laporan', 'kasih file excel'. " +
				"Return URL download yang ditampilkan sebagai tombol di UI. SQL harus SELECT/WITH read-only.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"sql":      map[string]any{"type": "string", "description": "SELECT statement"},
					"format":   map[string]any{"type": "string", "enum": []string{"csv", "xlsx"}, "description": "default csv"},
					"filename": map[string]any{"type": "string", "description": "Nama file tanpa ekstensi, contoh 'transaksi_mei_2026'"},
				},
				"required": []string{"sql", "filename"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "generate_chart",
			"description": "Buat chart custom dari hasil SELECT. Pakai saat user minta visualisasi yang tidak tercover tool standar (misal 'grafik per kategori service', 'pie chart pembayaran'). " +
				"SQL harus return minimal 2 kolom: kolom pertama jadi label X, kolom kedua jadi value Y. Untuk pie/donut, kolom pertama label, kedua value.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"sql":        map[string]any{"type": "string", "description": "SELECT returning [label, value] columns"},
					"chart_type": map[string]any{"type": "string", "enum": []string{"bar", "line", "pie", "area"}},
					"title":      map[string]any{"type": "string"},
				},
				"required": []string{"sql", "chart_type", "title"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "get_top_customers",
			"description": "Ranking customer berdasarkan jumlah transaksi (count) atau total belanja (revenue) dalam periode. " +
				"WAJIB dipakai untuk: 'customer paling banyak/sedikit transaksi', 'top spender', 'pelanggan loyal', 'customer paling jarang datang', 'big spender'. " +
				"Gunakan order='desc' untuk paling banyak (default), order='asc' untuk paling sedikit. " +
				"Hanya menghitung transaksi paid milik user terdaftar (user_id IS NOT NULL).",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period":  map[string]any{"type": "string", "enum": []string{"today", "this_week", "this_month", "this_year", "all_time"}},
					"rank_by": map[string]any{"type": "string", "enum": []string{"count", "revenue"}, "description": "count = berdasarkan jumlah transaksi (default). revenue = berdasarkan total spending."},
					"order":   map[string]any{"type": "string", "enum": []string{"desc", "asc"}, "description": "desc = paling banyak/besar (default). asc = paling sedikit/kecil."},
					"limit":   map[string]any{"type": "integer", "description": "default 10, max 50"},
				},
				"required": []string{"period"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "get_top_membership_owners",
			"description": "Ranking user berdasarkan jumlah membership yang dimiliki. " +
				"Pakai untuk: 'siapa yang paling banyak punya membership', 'user dengan member terbanyak', 'pelanggan multi-kendaraan'.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"status": map[string]any{"type": "string", "enum": []string{"active", "all"}, "description": "all = hitung semua status (default). active = hanya yang aktif."},
					"order":  map[string]any{"type": "string", "enum": []string{"desc", "asc"}, "description": "default desc"},
					"limit":  map[string]any{"type": "integer", "description": "default 10, max 50"},
				},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "get_peak_times",
			"description": "Analisis kapan transaksi paling rame: per hari-dalam-minggu (Sen–Min), per jam (00–23), dan top 10 tanggal tersibuk. " +
				"WAJIB dipakai untuk: 'hari apa paling rame', 'jam berapa paling banyak transaksi', 'tanggal paling laris', 'peak hours', 'kapan paling sibuk'.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period": map[string]any{"type": "string", "enum": []string{"this_month", "this_year", "last_30_days", "all_time"}, "description": "default this_month"},
					"metric": map[string]any{"type": "string", "enum": []string{"count", "revenue"}, "description": "count = jumlah transaksi (default). revenue = total omzet."},
				},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "get_inactive_customers",
			"description": "List customer yang sudah lama tidak transaksi (churn risk). " +
				"Pakai untuk: 'customer yang gak pernah balik', 'siapa yang udah lama gak datang', 'customer hilang', 'churn list', 'customer yang perlu di-reach out'. " +
				"Hanya hitung customer yang pernah transaksi sebelumnya (bukan zero-purchase users).",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"inactive_days": map[string]any{"type": "integer", "description": "Customer yang tidak transaksi lebih dari N hari. Default 30."},
					"limit":         map[string]any{"type": "integer", "description": "Default 20, max 100"},
				},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "get_service_category_breakdown",
			"description": "Breakdown revenue & quantity per kategori service (carwash, bikewash, membership, food, beverage, cafe). " +
				"Pakai untuk: 'carwash vs bikewash mana lebih banyak', 'kategori paling laku', 'pie chart revenue per kategori', 'composition'.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period": map[string]any{"type": "string", "enum": []string{"today", "this_week", "this_month", "this_year", "last_month", "all_time"}},
					"metric": map[string]any{"type": "string", "enum": []string{"count", "revenue"}, "description": "count = quantity sold (default). revenue = total Rupiah."},
				},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "get_payment_method_analysis",
			"description": "Breakdown transaksi per metode pembayaran (Cash, QRIS, dll). " +
				"Pakai untuk: 'cash vs qris lebih banyak mana', 'metode pembayaran favorit', 'breakdown pembayaran'.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period": map[string]any{"type": "string", "enum": []string{"today", "this_week", "this_month", "this_year", "all_time"}},
				},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "get_cashier_performance",
			"description": "Ranking performance cashier/admin berdasarkan jumlah transaksi yang di-handle dan total omzet. " +
				"Pakai untuk: 'cashier siapa paling produktif', 'kasir terbaik', 'performa karyawan kasir'.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period": map[string]any{"type": "string", "enum": []string{"today", "this_week", "this_month", "this_year", "all_time"}},
					"order":  map[string]any{"type": "string", "enum": []string{"desc", "asc"}, "description": "default desc"},
					"limit":  map[string]any{"type": "integer", "description": "default 10"},
				},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "compare_periods",
			"description": "Bandingkan 2 periode side-by-side. Menampilkan omzet, jumlah transaksi, AOV, dan growth % untuk masing-masing periode. " +
				"Pakai untuk: 'bandingkan bulan ini sama bulan lalu', 'minggu ini vs minggu lalu', 'tahun ini lebih baik dari tahun lalu?'",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period_a": map[string]any{"type": "string", "enum": []string{"today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year", "last_year"}},
					"period_b": map[string]any{"type": "string", "enum": []string{"today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year", "last_year"}},
				},
				"required": []string{"period_a", "period_b"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name": "get_business_kpis",
			"description": "Dashboard KPI lengkap: omzet, jumlah transaksi, AOV (avg order value), unique customers, new customers, returning customers, member conversion rate, net cashflow. " +
				"Pakai untuk: 'kpi bisnis', 'health bisnis', 'performance lengkap', 'overview menyeluruh', 'rata-rata transaksi'.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"period": map[string]any{"type": "string", "enum": []string{"today", "this_week", "this_month", "this_year", "last_month", "last_30_days"}},
				},
				"required": []string{"period"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "search_member_by_plate",
			"description": "Lookup member + vehicle + status membership by plat nomor.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"plate": map[string]any{"type": "string", "description": "License plate, any format"},
				},
				"required": []string{"plate"},
			},
		},
	},
}

// periodRange resolves a named period into [start, end] timestamps.
func periodRange(period string) (time.Time, time.Time) {
	now := time.Now()
	loc := now.Location()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	endToday := today.Add(24*time.Hour - time.Nanosecond)

	switch period {
	case "today":
		return today, endToday
	case "yesterday":
		y := today.Add(-24 * time.Hour)
		return y, y.Add(24*time.Hour - time.Nanosecond)
	case "this_week":
		offset := (int(today.Weekday()) + 6) % 7 // Monday=0
		start := today.Add(-time.Duration(offset) * 24 * time.Hour)
		return start, endToday
	case "this_month":
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc), endToday
	case "this_year":
		return time.Date(now.Year(), 1, 1, 0, 0, 0, 0, loc), endToday
	case "last_7_days":
		return today.Add(-6 * 24 * time.Hour), endToday
	case "last_30_days":
		return today.Add(-29 * 24 * time.Hour), endToday
	case "last_week":
		offset := (int(today.Weekday()) + 6) % 7
		thisWeekStart := today.Add(-time.Duration(offset) * 24 * time.Hour)
		lastWeekEnd := thisWeekStart.Add(-time.Nanosecond)
		lastWeekStart := thisWeekStart.Add(-7 * 24 * time.Hour)
		return lastWeekStart, lastWeekEnd
	case "last_month":
		thisMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		lastMonthEnd := thisMonthStart.Add(-time.Nanosecond)
		lastMonthStart := time.Date(lastMonthEnd.Year(), lastMonthEnd.Month(), 1, 0, 0, 0, 0, loc)
		return lastMonthStart, lastMonthEnd
	case "last_year":
		thisYearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, loc)
		lastYearEnd := thisYearStart.Add(-time.Nanosecond)
		lastYearStart := time.Date(now.Year()-1, 1, 1, 0, 0, 0, 0, loc)
		return lastYearStart, lastYearEnd
	default:
		return today, endToday
	}
}

// previousPeriodRange returns the comparable previous window of equal length.
func previousPeriodRange(period string) (time.Time, time.Time) {
	s, e := periodRange(period)
	duration := e.Sub(s)
	prevEnd := s.Add(-time.Nanosecond)
	prevStart := prevEnd.Add(-duration)
	return prevStart, prevEnd
}

func runAITool(name string, argsJSON string) toolOutput {
	var args map[string]any
	_ = json.Unmarshal([]byte(argsJSON), &args)

	switch name {
	case "get_dashboard_overview":
		s, e := periodRange("today")
		var revenue float64
		DB.Model(&Transaction{}).Where("status = 'paid' AND created_at BETWEEN ? AND ?", s, e).
			Select("COALESCE(SUM(total_amount), 0)").Scan(&revenue)
		var trxCount int64
		DB.Model(&Transaction{}).Where("created_at BETWEEN ? AND ?", s, e).Count(&trxCount)
		var activeMembers int64
		DB.Model(&Membership{}).Where("status = 'active' AND end_date >= ?", time.Now()).Count(&activeMembers)
		topRows := topServicesRows("today", 3)

		artifacts := []AIArtifact{
			{Type: "stat", Title: "Omzet Hari Ini", Data: map[string]any{"value": revenue, "format": "currency", "icon": "money"}},
			{Type: "stat", Title: "Transaksi Hari Ini", Data: map[string]any{"value": trxCount, "format": "number", "icon": "receipt"}},
			{Type: "stat", Title: "Member Aktif", Data: map[string]any{"value": activeMembers, "format": "number", "icon": "users"}},
		}
		if len(topRows) > 0 {
			points := make([]map[string]any, 0, len(topRows))
			for _, r := range topRows {
				points = append(points, map[string]any{"label": r["name"], "value": r["quantity"]})
			}
			artifacts = append(artifacts, AIArtifact{
				Type: "chart", Title: "Top Services Hari Ini",
				Data: map[string]any{"chart_type": "bar", "points": points, "y_label": "Quantity"},
			})
		}

		return toolOutput{
			Data: map[string]any{
				"date":               time.Now().Format("2006-01-02"),
				"revenue_today":      revenue,
				"transactions_today": trxCount,
				"active_memberships": activeMembers,
				"top_services_today": topRows,
			},
			Artifacts: artifacts,
		}

	case "query_transactions":
		limit := 20
		if v, ok := args["limit"].(float64); ok && int(v) > 0 {
			limit = int(v)
			if limit > 100 {
				limit = 100
			}
		}
		q := DB.Model(&Transaction{}).Preload("PaymentMethod").Preload("User")
		if s, ok := args["start_date"].(string); ok && s != "" {
			q = q.Where("created_at >= ?", s)
		}
		if e, ok := args["end_date"].(string); ok && e != "" {
			q = q.Where("created_at <= ?", e+" 23:59:59")
		}
		if st, ok := args["status"].(string); ok && st != "" {
			q = q.Where("status = ?", st)
		}
		var rows []Transaction
		q.Order("created_at desc").Limit(limit).Find(&rows)

		out := make([]map[string]any, 0, len(rows))
		tableRows := make([][]any, 0, len(rows))
		for _, t := range rows {
			pm := t.PaymentMethod.Name
			customer := ""
			if t.User.Name != "" {
				customer = t.User.Name
			}
			out = append(out, map[string]any{
				"code":           t.TransactionCode,
				"customer":       customer,
				"total":          t.TotalAmount,
				"status":         t.Status,
				"payment_method": pm,
				"created_at":     t.CreatedAt.Format(time.RFC3339),
			})
			tableRows = append(tableRows, []any{
				t.CreatedAt.Format("02 Jan 2006 15:04"),
				t.TransactionCode,
				customer,
				t.TotalAmount,
				t.Status,
				pm,
			})
		}

		artifacts := []AIArtifact{}
		if len(tableRows) > 0 {
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: "Transaksi",
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "Waktu"},
						{"key": "1", "label": "Kode"},
						{"key": "2", "label": "Customer"},
						{"key": "3", "label": "Total", "format": "currency"},
						{"key": "4", "label": "Status"},
						{"key": "5", "label": "Bayar"},
					},
					"rows": tableRows,
				},
			})
		}
		return toolOutput{Data: map[string]any{"count": len(out), "transactions": out}, Artifacts: artifacts}

	case "get_revenue_summary":
		period, _ := args["period"].(string)
		s, e := periodRange(period)
		ps, pe := previousPeriodRange(period)
		var revenue, prevRevenue float64
		DB.Model(&Transaction{}).Where("status = 'paid' AND created_at BETWEEN ? AND ?", s, e).
			Select("COALESCE(SUM(total_amount), 0)").Scan(&revenue)
		DB.Model(&Transaction{}).Where("status = 'paid' AND created_at BETWEEN ? AND ?", ps, pe).
			Select("COALESCE(SUM(total_amount), 0)").Scan(&prevRevenue)
		var count int64
		DB.Model(&Transaction{}).Where("status = 'paid' AND created_at BETWEEN ? AND ?", s, e).Count(&count)

		trendPct := 0.0
		if prevRevenue > 0 {
			trendPct = (revenue - prevRevenue) / prevRevenue * 100
		}

		return toolOutput{
			Data: map[string]any{
				"period":             period,
				"start":              s.Format(time.RFC3339),
				"end":                e.Format(time.RFC3339),
				"total_revenue":      revenue,
				"transactions_count": count,
				"previous_revenue":   prevRevenue,
				"trend_percent":      trendPct,
			},
			Artifacts: []AIArtifact{
				{Type: "stat", Title: "Omzet " + humanPeriod(period), Data: map[string]any{
					"value": revenue, "format": "currency",
					"trend_percent": trendPct, "sub": fmt.Sprintf("%d transaksi", count),
				}},
			},
		}

	case "get_revenue_trend":
		days := 7
		if v, ok := args["days"].(float64); ok && int(v) > 0 {
			days = int(v)
			if days > 90 {
				days = 90
			}
		}
		chartType, _ := args["chart_type"].(string)
		if chartType == "" {
			chartType = "line"
		}
		type row struct {
			Day     time.Time `json:"day"`
			Revenue float64   `json:"revenue"`
		}
		var rows []row
		DB.Raw(`
			SELECT DATE_TRUNC('day', created_at) AS day,
			       COALESCE(SUM(total_amount), 0) AS revenue
			FROM transactions
			WHERE status = 'paid'
			  AND created_at >= ?
			GROUP BY day
			ORDER BY day ASC
		`, time.Now().AddDate(0, 0, -days+1)).Scan(&rows)

		points := make([]map[string]any, 0, len(rows))
		data := make([]map[string]any, 0, len(rows))
		for _, r := range rows {
			label := r.Day.Format("02 Jan")
			points = append(points, map[string]any{"label": label, "value": r.Revenue})
			data = append(data, map[string]any{"date": r.Day.Format("2006-01-02"), "revenue": r.Revenue})
		}

		return toolOutput{
			Data: map[string]any{"days": days, "series": data},
			Artifacts: []AIArtifact{
				{Type: "chart", Title: fmt.Sprintf("Tren Omzet %d Hari Terakhir", days),
					Data: map[string]any{"chart_type": chartType, "points": points, "y_format": "currency"}},
			},
		}

	case "get_top_services":
		period, _ := args["period"].(string)
		limit := 5
		if v, ok := args["limit"].(float64); ok && int(v) > 0 {
			limit = int(v)
		}
		topRows := topServicesRows(period, limit)
		points := make([]map[string]any, 0, len(topRows))
		for _, r := range topRows {
			points = append(points, map[string]any{"label": r["name"], "value": r["quantity"]})
		}
		return toolOutput{
			Data: topRows,
			Artifacts: []AIArtifact{
				{Type: "chart", Title: "Top Services " + humanPeriod(period),
					Data: map[string]any{"chart_type": "bar", "points": points, "y_label": "Qty Terjual"}},
			},
		}

	case "get_memberships_stats":
		var active, expired, pending int64
		DB.Model(&Membership{}).Where("status = ?", "active").Count(&active)
		DB.Model(&Membership{}).Where("status = ?", "expired").Count(&expired)
		DB.Model(&Membership{}).Where("status = ?", "pending").Count(&pending)
		var upcoming []Membership
		DB.Preload("User").Preload("Vehicle").
			Where("status = ? AND end_date BETWEEN ? AND ?", "active", time.Now(), time.Now().Add(14*24*time.Hour)).
			Order("end_date asc").Limit(10).Find(&upcoming)
		upcomingOut := make([]map[string]any, 0, len(upcoming))
		tableRows := make([][]any, 0, len(upcoming))
		for _, m := range upcoming {
			name, plate := "", ""
			if m.User != nil {
				name = m.User.Name
			}
			if m.Vehicle != nil {
				plate = m.Vehicle.LicensePlate
			}
			endStr := ""
			if m.EndDate != nil {
				endStr = m.EndDate.Format("2006-01-02")
			}
			upcomingOut = append(upcomingOut, map[string]any{"name": name, "plate": plate, "end_date": endStr})
			daysLeft := 0
			if m.EndDate != nil {
				daysLeft = int(time.Until(*m.EndDate).Hours() / 24)
			}
			tableRows = append(tableRows, []any{name, plate, endStr, daysLeft})
		}

		artifacts := []AIArtifact{
			{Type: "stat", Title: "Member Aktif", Data: map[string]any{"value": active, "format": "number", "icon": "users"}},
			{Type: "stat", Title: "Member Pending", Data: map[string]any{"value": pending, "format": "number", "icon": "clock"}},
			{Type: "stat", Title: "Member Expired", Data: map[string]any{"value": expired, "format": "number", "icon": "alert"}},
		}
		if len(tableRows) > 0 {
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: "Akan Expired Dalam 14 Hari",
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "Nama"},
						{"key": "1", "label": "Plat"},
						{"key": "2", "label": "Expired"},
						{"key": "3", "label": "Sisa Hari", "format": "number"},
					},
					"rows": tableRows,
				},
			})
		}
		return toolOutput{
			Data: map[string]any{
				"active": active, "expired": expired, "pending": pending,
				"upcoming_expirations_14d": upcomingOut,
			},
			Artifacts: artifacts,
		}

	case "get_cashflow_summary":
		period, _ := args["period"].(string)
		s, e := periodRange(period)
		var in, out float64
		DB.Model(&CashFlow{}).Where("type = 'in' AND created_at BETWEEN ? AND ?", s, e).
			Select("COALESCE(SUM(amount), 0)").Scan(&in)
		DB.Model(&CashFlow{}).Where("type = 'out' AND created_at BETWEEN ? AND ?", s, e).
			Select("COALESCE(SUM(amount), 0)").Scan(&out)
		return toolOutput{
			Data: map[string]any{"period": period, "cash_in": in, "cash_out": out, "net": in - out},
			Artifacts: []AIArtifact{
				{Type: "stat", Title: "Cash In " + humanPeriod(period), Data: map[string]any{"value": in, "format": "currency", "icon": "arrow-down"}},
				{Type: "stat", Title: "Cash Out " + humanPeriod(period), Data: map[string]any{"value": out, "format": "currency", "icon": "arrow-up"}},
				{Type: "stat", Title: "Net Cashflow", Data: map[string]any{"value": in - out, "format": "currency", "icon": "money", "trend_percent": 0.0}},
			},
		}

	case "execute_sql_query":
		sqlStr, _ := args["sql"].(string)
		title, _ := args["title"].(string)
		res, err := runReadOnlyQuery(sqlStr)
		if err != nil {
			return toolOutput{Data: map[string]any{"error": err.Error()}}
		}
		artifacts := []AIArtifact{}
		rowsAny, _ := res["rows"].([]map[string]any)
		if len(rowsAny) > 1 {
			cols, tableRows := mapsToTable(rowsAny)
			if title == "" {
				title = "Hasil Query"
			}
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: title,
				Data: map[string]any{"columns": cols, "rows": tableRows},
			})
		}
		return toolOutput{Data: res, Artifacts: artifacts}

	case "export_data":
		sqlStr, _ := args["sql"].(string)
		format, _ := args["format"].(string)
		filename, _ := args["filename"].(string)
		if format == "" {
			format = "csv"
		}
		if filename == "" {
			filename = "export_" + time.Now().Format("20060102_150405")
		}
		res, err := runReadOnlyQuery(sqlStr)
		if err != nil {
			return toolOutput{Data: map[string]any{"error": err.Error()}}
		}
		rowsAny, _ := res["rows"].([]map[string]any)
		if len(rowsAny) == 0 {
			return toolOutput{Data: map[string]any{"error": "query mengembalikan 0 baris, tidak ada yang di-export"}}
		}
		url, sizeBytes, err := writeExportFile(filename, format, rowsAny)
		if err != nil {
			return toolOutput{Data: map[string]any{"error": err.Error()}}
		}
		return toolOutput{
			Data: map[string]any{
				"download_url": url, "rows": len(rowsAny), "format": format, "size_bytes": sizeBytes,
			},
			Artifacts: []AIArtifact{
				{Type: "download", Title: filename + "." + format,
					Data: map[string]any{
						"url": url, "filename": filename + "." + format,
						"format": format, "rows": len(rowsAny), "size_bytes": sizeBytes,
					}},
			},
		}

	case "generate_chart":
		sqlStr, _ := args["sql"].(string)
		chartType, _ := args["chart_type"].(string)
		title, _ := args["title"].(string)
		if chartType == "" {
			chartType = "bar"
		}
		res, err := runReadOnlyQuery(sqlStr)
		if err != nil {
			return toolOutput{Data: map[string]any{"error": err.Error()}}
		}
		rowsAny, _ := res["rows"].([]map[string]any)
		if len(rowsAny) == 0 {
			return toolOutput{Data: map[string]any{"error": "query mengembalikan 0 baris"}}
		}
		points, dataForLLM, err := rowsToChartPoints(rowsAny)
		if err != nil {
			return toolOutput{Data: map[string]any{"error": err.Error()}}
		}
		return toolOutput{
			Data: map[string]any{"chart_type": chartType, "title": title, "data": dataForLLM},
			Artifacts: []AIArtifact{
				{Type: "chart", Title: title,
					Data: map[string]any{"chart_type": chartType, "points": points}},
			},
		}

	case "get_top_customers":
		period, _ := args["period"].(string)
		if period == "" {
			period = "this_month"
		}
		rankBy, _ := args["rank_by"].(string)
		if rankBy != "revenue" {
			rankBy = "count"
		}
		order, _ := args["order"].(string)
		if order != "asc" {
			order = "desc"
		}
		limit := 10
		if v, ok := args["limit"].(float64); ok && int(v) > 0 {
			limit = int(v)
			if limit > 50 {
				limit = 50
			}
		}

		type row struct {
			UserID     uint    `json:"user_id"`
			Name       string  `json:"name"`
			Email      string  `json:"email"`
			Phone      string  `json:"phone"`
			TrxCount   int     `json:"trx_count"`
			TotalSpent float64 `json:"total_spent"`
		}

		q := DB.Table("transactions t").
			Select("t.user_id as user_id, u.name, u.email, u.phone, COUNT(t.id) as trx_count, COALESCE(SUM(t.total_amount), 0) as total_spent").
			Joins("JOIN users u ON u.id = t.user_id").
			Where("t.status = 'paid' AND t.user_id IS NOT NULL")

		if period != "all_time" {
			s, e := periodRange(period)
			q = q.Where("t.created_at BETWEEN ? AND ?", s, e)
		}

		orderField := "trx_count"
		if rankBy == "revenue" {
			orderField = "total_spent"
		}
		orderDir := "DESC"
		if order == "asc" {
			orderDir = "ASC"
		}

		var rows []row
		q.Group("t.user_id, u.name, u.email, u.phone").
			Order(orderField + " " + orderDir).
			Limit(limit).
			Scan(&rows)

		dataOut := make([]map[string]any, 0, len(rows))
		tableRows := make([][]any, 0, len(rows))
		points := make([]map[string]any, 0, len(rows))
		for i, r := range rows {
			dataOut = append(dataOut, map[string]any{
				"rank":        i + 1,
				"user_id":     r.UserID,
				"name":        r.Name,
				"email":       r.Email,
				"phone":       r.Phone,
				"trx_count":   r.TrxCount,
				"total_spent": r.TotalSpent,
			})
			tableRows = append(tableRows, []any{
				i + 1, r.Name, r.Phone, r.TrxCount, r.TotalSpent,
			})
			var v any
			if rankBy == "revenue" {
				v = r.TotalSpent
			} else {
				v = r.TrxCount
			}
			points = append(points, map[string]any{"label": r.Name, "value": v})
		}

		artifacts := []AIArtifact{}
		if len(rows) > 0 {
			rankLabel := "Jumlah Transaksi"
			yFormat := ""
			if rankBy == "revenue" {
				rankLabel = "Total Belanja"
				yFormat = "currency"
			}
			direction := "Top"
			if order == "asc" {
				direction = "Paling Sedikit"
			}
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: direction + " Customer " + humanPeriod(period) + " (by " + rankLabel + ")",
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "#"},
						{"key": "1", "label": "Nama"},
						{"key": "2", "label": "Telp"},
						{"key": "3", "label": "Jml Trx", "format": "number"},
						{"key": "4", "label": "Total Belanja", "format": "currency"},
					},
					"rows": tableRows,
				},
			})
			artifacts = append(artifacts, AIArtifact{
				Type: "chart", Title: rankLabel + " — " + humanPeriod(period),
				Data: map[string]any{"chart_type": "bar", "points": points, "y_format": yFormat},
			})
		}

		return toolOutput{
			Data: map[string]any{
				"period":  period,
				"rank_by": rankBy,
				"order":   order,
				"top":     dataOut,
			},
			Artifacts: artifacts,
		}

	case "get_top_membership_owners":
		statusFilter, _ := args["status"].(string)
		if statusFilter != "active" {
			statusFilter = "all"
		}
		order, _ := args["order"].(string)
		if order != "asc" {
			order = "desc"
		}
		limit := 10
		if v, ok := args["limit"].(float64); ok && int(v) > 0 {
			limit = int(v)
			if limit > 50 {
				limit = 50
			}
		}

		type row struct {
			UserID          uint   `json:"user_id"`
			Name            string `json:"name"`
			Email           string `json:"email"`
			Phone           string `json:"phone"`
			MembershipCount int    `json:"membership_count"`
			ActiveCount     int    `json:"active_count"`
		}

		q := DB.Table("memberships m").
			Select(`m.user_id AS user_id, u.name, u.email, u.phone,
				COUNT(m.id) AS membership_count,
				SUM(CASE WHEN m.status = 'active' AND (m.end_date IS NULL OR m.end_date >= NOW()) THEN 1 ELSE 0 END) AS active_count`).
			Joins("JOIN users u ON u.id = m.user_id").
			Where("m.deleted_at IS NULL")
		if statusFilter == "active" {
			q = q.Where("m.status = 'active' AND (m.end_date IS NULL OR m.end_date >= NOW())")
		}

		orderDir := "DESC"
		if order == "asc" {
			orderDir = "ASC"
		}

		var rows []row
		q.Group("m.user_id, u.name, u.email, u.phone").
			Order("membership_count " + orderDir).
			Limit(limit).
			Scan(&rows)

		dataOut := make([]map[string]any, 0, len(rows))
		tableRows := make([][]any, 0, len(rows))
		points := make([]map[string]any, 0, len(rows))
		for i, r := range rows {
			dataOut = append(dataOut, map[string]any{
				"rank":             i + 1,
				"user_id":          r.UserID,
				"name":             r.Name,
				"email":            r.Email,
				"phone":            r.Phone,
				"membership_count": r.MembershipCount,
				"active_count":     r.ActiveCount,
			})
			tableRows = append(tableRows, []any{
				i + 1, r.Name, r.Phone, r.MembershipCount, r.ActiveCount,
			})
			points = append(points, map[string]any{"label": r.Name, "value": r.MembershipCount})
		}

		artifacts := []AIArtifact{}
		if len(rows) > 0 {
			title := "Top Pemilik Membership"
			if order == "asc" {
				title = "User dengan Membership Paling Sedikit"
			}
			if statusFilter == "active" {
				title += " (Status Aktif)"
			}
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: title,
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "#"},
						{"key": "1", "label": "Nama"},
						{"key": "2", "label": "Telp"},
						{"key": "3", "label": "Total Membership", "format": "number"},
						{"key": "4", "label": "Aktif", "format": "number"},
					},
					"rows": tableRows,
				},
			})
			artifacts = append(artifacts, AIArtifact{
				Type: "chart", Title: title,
				Data: map[string]any{"chart_type": "bar", "points": points, "y_label": "Jumlah Membership"},
			})
		}

		return toolOutput{
			Data: map[string]any{
				"status_filter": statusFilter,
				"order":         order,
				"top":           dataOut,
			},
			Artifacts: artifacts,
		}

	case "get_peak_times":
		period, _ := args["period"].(string)
		if period == "" {
			period = "this_month"
		}
		metric, _ := args["metric"].(string)
		if metric != "revenue" {
			metric = "count"
		}

		whereClause := "status = 'paid'"
		queryArgs := []interface{}{}
		if period != "all_time" {
			s, e := periodRange(period)
			whereClause += " AND created_at BETWEEN ? AND ?"
			queryArgs = append(queryArgs, s, e)
		}

		valueCol := "COUNT(*)"
		yFormat := ""
		yLabel := "Jumlah Transaksi"
		if metric == "revenue" {
			valueCol = "COALESCE(SUM(total_amount), 0)"
			yFormat = "currency"
			yLabel = "Omzet"
		}

		// Day of week (0=Sunday..6=Saturday in PostgreSQL)
		type dowRow struct {
			Dow   int     `json:"dow"`
			Value float64 `json:"value"`
		}
		var dowRows []dowRow
		dowSQL := "SELECT EXTRACT(DOW FROM created_at)::int AS dow, " + valueCol + " AS value " +
			"FROM transactions WHERE " + whereClause + " GROUP BY dow ORDER BY dow"
		DB.Raw(dowSQL, queryArgs...).Scan(&dowRows)

		dowNames := []string{"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"}
		dowPoints := make([]map[string]any, 0, 7)
		dowMap := map[int]float64{}
		for _, r := range dowRows {
			dowMap[r.Dow] = r.Value
		}
		for i := 0; i < 7; i++ {
			dowPoints = append(dowPoints, map[string]any{"label": dowNames[i], "value": dowMap[i]})
		}

		// Hour of day
		type hourRow struct {
			Hour  int     `json:"hour"`
			Value float64 `json:"value"`
		}
		var hourRows []hourRow
		hourSQL := "SELECT EXTRACT(HOUR FROM created_at)::int AS hour, " + valueCol + " AS value " +
			"FROM transactions WHERE " + whereClause + " GROUP BY hour ORDER BY hour"
		DB.Raw(hourSQL, queryArgs...).Scan(&hourRows)

		hourMap := map[int]float64{}
		for _, r := range hourRows {
			hourMap[r.Hour] = r.Value
		}
		hourPoints := make([]map[string]any, 0, 24)
		for i := 0; i < 24; i++ {
			hourPoints = append(hourPoints, map[string]any{"label": fmt.Sprintf("%02d:00", i), "value": hourMap[i]})
		}

		// Top dates
		type dateRow struct {
			Date  time.Time `json:"date"`
			Value float64   `json:"value"`
		}
		var dateRows []dateRow
		dateSQL := "SELECT DATE(created_at) AS date, " + valueCol + " AS value " +
			"FROM transactions WHERE " + whereClause + " GROUP BY date ORDER BY value DESC LIMIT 10"
		DB.Raw(dateSQL, queryArgs...).Scan(&dateRows)

		topDateRows := make([][]any, 0, len(dateRows))
		topDateData := make([]map[string]any, 0, len(dateRows))
		for i, r := range dateRows {
			dateStr := r.Date.Format("02 Jan 2006") + " (" + dowNames[int(r.Date.Weekday())] + ")"
			topDateRows = append(topDateRows, []any{i + 1, dateStr, r.Value})
			topDateData = append(topDateData, map[string]any{
				"rank": i + 1, "date": r.Date.Format("2006-01-02"),
				"day_of_week": dowNames[int(r.Date.Weekday())], "value": r.Value,
			})
		}

		// Find peak DOW and peak hour for summary
		peakDow, peakDowVal := -1, -1.0
		for i := 0; i < 7; i++ {
			if dowMap[i] > peakDowVal {
				peakDowVal = dowMap[i]
				peakDow = i
			}
		}
		peakHour, peakHourVal := -1, -1.0
		for i := 0; i < 24; i++ {
			if hourMap[i] > peakHourVal {
				peakHourVal = hourMap[i]
				peakHour = i
			}
		}

		peakDowName := ""
		if peakDow >= 0 {
			peakDowName = dowNames[peakDow]
		}

		valueColLabel := "value"
		if metric == "revenue" {
			valueColLabel = "omzet"
		} else {
			valueColLabel = "transaksi"
		}

		artifacts := []AIArtifact{
			{Type: "stat", Title: "Hari Terlaris", Data: map[string]any{
				"value": peakDowName, "sub": fmt.Sprintf("%.0f %s", peakDowVal, valueColLabel),
			}},
			{Type: "stat", Title: "Jam Terlaris", Data: map[string]any{
				"value": fmt.Sprintf("%02d:00", peakHour), "sub": fmt.Sprintf("%.0f %s", peakHourVal, valueColLabel),
			}},
			{Type: "chart", Title: "Per Hari Dalam Minggu (" + humanPeriod(period) + ")",
				Data: map[string]any{"chart_type": "bar", "points": dowPoints, "y_label": yLabel, "y_format": yFormat}},
			{Type: "chart", Title: "Per Jam (" + humanPeriod(period) + ")",
				Data: map[string]any{"chart_type": "line", "points": hourPoints, "y_label": yLabel, "y_format": yFormat}},
		}
		if len(topDateRows) > 0 {
			valueColTitle := "Jml Transaksi"
			tableFormat := "number"
			if metric == "revenue" {
				valueColTitle = "Omzet"
				tableFormat = "currency"
			}
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: "Top 10 Tanggal Tersibuk",
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "#"},
						{"key": "1", "label": "Tanggal"},
						{"key": "2", "label": valueColTitle, "format": tableFormat},
					},
					"rows": topDateRows,
				},
			})
		}

		return toolOutput{
			Data: map[string]any{
				"period":    period,
				"metric":    metric,
				"peak_dow":  peakDowName,
				"peak_hour": peakHour,
				"by_dow":    dowPoints,
				"by_hour":   hourPoints,
				"top_dates": topDateData,
			},
			Artifacts: artifacts,
		}

	case "get_inactive_customers":
		days := 30
		if v, ok := args["inactive_days"].(float64); ok && int(v) > 0 {
			days = int(v)
		}
		limit := 20
		if v, ok := args["limit"].(float64); ok && int(v) > 0 {
			limit = int(v)
			if limit > 100 {
				limit = 100
			}
		}

		type row struct {
			UserID     uint      `json:"user_id"`
			Name       string    `json:"name"`
			Email      string    `json:"email"`
			Phone      string    `json:"phone"`
			Points     int       `json:"points"`
			LastVisit  time.Time `json:"last_visit"`
			TotalTrx   int       `json:"total_trx"`
			TotalSpent float64   `json:"total_spent"`
		}

		cutoff := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
		var rows []row
		DB.Raw(`
			SELECT u.id AS user_id, u.name, u.email, u.phone, u.points,
			       MAX(t.created_at) AS last_visit,
			       COUNT(t.id) AS total_trx,
			       COALESCE(SUM(t.total_amount), 0) AS total_spent
			FROM users u
			JOIN transactions t ON t.user_id = u.id AND t.status = 'paid'
			WHERE u.role = 'customer' AND u.is_active = true AND u.deleted_at IS NULL
			GROUP BY u.id, u.name, u.email, u.phone, u.points
			HAVING MAX(t.created_at) < ?
			ORDER BY MAX(t.created_at) ASC
			LIMIT ?
		`, cutoff, limit).Scan(&rows)

		dataOut := make([]map[string]any, 0, len(rows))
		tableRows := make([][]any, 0, len(rows))
		for i, r := range rows {
			daysAgo := int(time.Since(r.LastVisit).Hours() / 24)
			dataOut = append(dataOut, map[string]any{
				"rank": i + 1, "user_id": r.UserID, "name": r.Name, "phone": r.Phone,
				"last_visit": r.LastVisit.Format("2006-01-02"), "days_inactive": daysAgo,
				"total_trx": r.TotalTrx, "total_spent": r.TotalSpent, "points": r.Points,
			})
			tableRows = append(tableRows, []any{
				i + 1, r.Name, r.Phone, r.LastVisit.Format("02 Jan 2006"),
				daysAgo, r.TotalTrx, r.TotalSpent,
			})
		}

		artifacts := []AIArtifact{
			{Type: "stat", Title: "Customer Tidak Aktif", Data: map[string]any{
				"value": len(rows), "format": "number", "icon": "users",
				"sub": fmt.Sprintf("> %d hari tidak transaksi", days),
			}},
		}
		if len(tableRows) > 0 {
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: fmt.Sprintf("Customer Tidak Transaksi > %d Hari", days),
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "#"},
						{"key": "1", "label": "Nama"},
						{"key": "2", "label": "Telp"},
						{"key": "3", "label": "Terakhir Datang"},
						{"key": "4", "label": "Hari Lalu", "format": "number"},
						{"key": "5", "label": "Total Trx", "format": "number"},
						{"key": "6", "label": "Total Belanja", "format": "currency"},
					},
					"rows": tableRows,
				},
			})
		}

		return toolOutput{
			Data:      map[string]any{"inactive_days": days, "count": len(rows), "customers": dataOut},
			Artifacts: artifacts,
		}

	case "get_service_category_breakdown":
		period, _ := args["period"].(string)
		if period == "" {
			period = "this_month"
		}
		metric, _ := args["metric"].(string)
		if metric != "revenue" {
			metric = "count"
		}

		valueCol := "SUM(ti.quantity)"
		yFormat := ""
		valueLabel := "Quantity"
		if metric == "revenue" {
			valueCol = "SUM(ti.subtotal)"
			yFormat = "currency"
			valueLabel = "Omzet"
		}

		whereClause := "t.status = 'paid'"
		queryArgs := []interface{}{}
		if period != "all_time" {
			s, e := periodRange(period)
			whereClause += " AND t.created_at BETWEEN ? AND ?"
			queryArgs = append(queryArgs, s, e)
		}

		type row struct {
			Category string  `json:"category"`
			Value    float64 `json:"value"`
		}
		var rows []row
		sqlStr := "SELECT s.category, " + valueCol + " AS value " +
			"FROM transaction_items ti " +
			"JOIN services s ON s.id = ti.service_id " +
			"JOIN transactions t ON t.id = ti.transaction_id " +
			"WHERE " + whereClause + " GROUP BY s.category ORDER BY value DESC"
		DB.Raw(sqlStr, queryArgs...).Scan(&rows)

		points := make([]map[string]any, 0, len(rows))
		tableRows := make([][]any, 0, len(rows))
		dataOut := make([]map[string]any, 0, len(rows))
		var total float64
		for _, r := range rows {
			total += r.Value
		}
		for _, r := range rows {
			pct := 0.0
			if total > 0 {
				pct = r.Value / total * 100
			}
			points = append(points, map[string]any{"label": r.Category, "value": r.Value})
			tableRows = append(tableRows, []any{r.Category, r.Value, fmt.Sprintf("%.1f%%", pct)})
			dataOut = append(dataOut, map[string]any{"category": r.Category, "value": r.Value, "percent": pct})
		}

		artifacts := []AIArtifact{}
		if len(points) > 0 {
			artifacts = append(artifacts, AIArtifact{
				Type: "chart", Title: "Breakdown per Kategori (" + humanPeriod(period) + ")",
				Data: map[string]any{"chart_type": "pie", "points": points, "y_format": yFormat},
			})
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: "Detail per Kategori",
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "Kategori"},
						{"key": "1", "label": valueLabel, "format": yFormat},
						{"key": "2", "label": "% Share"},
					},
					"rows": tableRows,
				},
			})
		}

		return toolOutput{
			Data:      map[string]any{"period": period, "metric": metric, "total": total, "breakdown": dataOut},
			Artifacts: artifacts,
		}

	case "get_payment_method_analysis":
		period, _ := args["period"].(string)
		if period == "" {
			period = "this_month"
		}

		whereClause := "t.status = 'paid'"
		queryArgs := []interface{}{}
		if period != "all_time" {
			s, e := periodRange(period)
			whereClause += " AND t.created_at BETWEEN ? AND ?"
			queryArgs = append(queryArgs, s, e)
		}

		type row struct {
			Method   string  `json:"method"`
			TrxCount int     `json:"trx_count"`
			Revenue  float64 `json:"revenue"`
		}
		var rows []row
		DB.Raw("SELECT pm.name AS method, COUNT(t.id) AS trx_count, COALESCE(SUM(t.total_amount), 0) AS revenue "+
			"FROM transactions t JOIN payment_methods pm ON pm.id = t.payment_method_id "+
			"WHERE "+whereClause+" GROUP BY pm.name ORDER BY revenue DESC", queryArgs...).Scan(&rows)

		var totalCount int
		var totalRevenue float64
		for _, r := range rows {
			totalCount += r.TrxCount
			totalRevenue += r.Revenue
		}

		countPoints := make([]map[string]any, 0, len(rows))
		revenuePoints := make([]map[string]any, 0, len(rows))
		tableRows := make([][]any, 0, len(rows))
		dataOut := make([]map[string]any, 0, len(rows))
		for _, r := range rows {
			countPct := 0.0
			revPct := 0.0
			if totalCount > 0 {
				countPct = float64(r.TrxCount) / float64(totalCount) * 100
			}
			if totalRevenue > 0 {
				revPct = r.Revenue / totalRevenue * 100
			}
			countPoints = append(countPoints, map[string]any{"label": r.Method, "value": r.TrxCount})
			revenuePoints = append(revenuePoints, map[string]any{"label": r.Method, "value": r.Revenue})
			tableRows = append(tableRows, []any{
				r.Method, r.TrxCount, fmt.Sprintf("%.1f%%", countPct),
				r.Revenue, fmt.Sprintf("%.1f%%", revPct),
			})
			dataOut = append(dataOut, map[string]any{
				"method": r.Method, "trx_count": r.TrxCount, "revenue": r.Revenue,
				"count_percent": countPct, "revenue_percent": revPct,
			})
		}

		artifacts := []AIArtifact{}
		if len(rows) > 0 {
			artifacts = append(artifacts, AIArtifact{
				Type: "chart", Title: "Payment Method by Transaction Count (" + humanPeriod(period) + ")",
				Data: map[string]any{"chart_type": "pie", "points": countPoints},
			})
			artifacts = append(artifacts, AIArtifact{
				Type: "chart", Title: "Payment Method by Revenue (" + humanPeriod(period) + ")",
				Data: map[string]any{"chart_type": "pie", "points": revenuePoints, "y_format": "currency"},
			})
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: "Detail per Metode Pembayaran",
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "Metode"},
						{"key": "1", "label": "Jml Trx", "format": "number"},
						{"key": "2", "label": "% Trx"},
						{"key": "3", "label": "Omzet", "format": "currency"},
						{"key": "4", "label": "% Omzet"},
					},
					"rows": tableRows,
				},
			})
		}

		return toolOutput{
			Data:      map[string]any{"period": period, "breakdown": dataOut},
			Artifacts: artifacts,
		}

	case "get_cashier_performance":
		period, _ := args["period"].(string)
		if period == "" {
			period = "this_month"
		}
		order, _ := args["order"].(string)
		if order != "asc" {
			order = "desc"
		}
		limit := 10
		if v, ok := args["limit"].(float64); ok && int(v) > 0 {
			limit = int(v)
		}

		whereClause := "t.status = 'paid' AND t.cashier_id IS NOT NULL"
		queryArgs := []interface{}{}
		if period != "all_time" {
			s, e := periodRange(period)
			whereClause += " AND t.created_at BETWEEN ? AND ?"
			queryArgs = append(queryArgs, s, e)
		}

		type row struct {
			CashierID    uint    `json:"cashier_id"`
			Name         string  `json:"name"`
			TrxCount     int     `json:"trx_count"`
			TotalRevenue float64 `json:"total_revenue"`
		}
		var rows []row
		orderDir := "DESC"
		if order == "asc" {
			orderDir = "ASC"
		}
		DB.Raw("SELECT t.cashier_id, u.name, COUNT(t.id) AS trx_count, COALESCE(SUM(t.total_amount), 0) AS total_revenue "+
			"FROM transactions t JOIN users u ON u.id = t.cashier_id "+
			"WHERE "+whereClause+" GROUP BY t.cashier_id, u.name ORDER BY trx_count "+orderDir+" LIMIT ?",
			append(queryArgs, limit)...).Scan(&rows)

		dataOut := make([]map[string]any, 0, len(rows))
		tableRows := make([][]any, 0, len(rows))
		countPoints := make([]map[string]any, 0, len(rows))
		for i, r := range rows {
			avgTicket := 0.0
			if r.TrxCount > 0 {
				avgTicket = r.TotalRevenue / float64(r.TrxCount)
			}
			dataOut = append(dataOut, map[string]any{
				"rank": i + 1, "name": r.Name, "trx_count": r.TrxCount,
				"total_revenue": r.TotalRevenue, "avg_ticket": avgTicket,
			})
			tableRows = append(tableRows, []any{i + 1, r.Name, r.TrxCount, r.TotalRevenue, avgTicket})
			countPoints = append(countPoints, map[string]any{"label": r.Name, "value": r.TrxCount})
		}

		artifacts := []AIArtifact{}
		if len(rows) > 0 {
			artifacts = append(artifacts, AIArtifact{
				Type: "table", Title: "Cashier Performance (" + humanPeriod(period) + ")",
				Data: map[string]any{
					"columns": []map[string]any{
						{"key": "0", "label": "#"},
						{"key": "1", "label": "Cashier"},
						{"key": "2", "label": "Jml Trx", "format": "number"},
						{"key": "3", "label": "Total Omzet", "format": "currency"},
						{"key": "4", "label": "Avg Ticket", "format": "currency"},
					},
					"rows": tableRows,
				},
			})
			artifacts = append(artifacts, AIArtifact{
				Type: "chart", Title: "Transaksi per Cashier",
				Data: map[string]any{"chart_type": "bar", "points": countPoints, "y_label": "Jml Transaksi"},
			})
		}

		return toolOutput{
			Data:      map[string]any{"period": period, "ranking": dataOut},
			Artifacts: artifacts,
		}

	case "compare_periods":
		periodA, _ := args["period_a"].(string)
		periodB, _ := args["period_b"].(string)
		if periodA == "" || periodB == "" {
			return toolOutput{Data: map[string]any{"error": "period_a dan period_b wajib diisi"}}
		}

		compute := func(p string) (float64, int64, float64) {
			s, e := periodRange(p)
			var rev float64
			var count int64
			DB.Model(&Transaction{}).Where("status = 'paid' AND created_at BETWEEN ? AND ?", s, e).
				Select("COALESCE(SUM(total_amount), 0)").Scan(&rev)
			DB.Model(&Transaction{}).Where("status = 'paid' AND created_at BETWEEN ? AND ?", s, e).Count(&count)
			aov := 0.0
			if count > 0 {
				aov = rev / float64(count)
			}
			return rev, count, aov
		}

		revA, cntA, aovA := compute(periodA)
		revB, cntB, aovB := compute(periodB)

		pct := func(now, prev float64) float64 {
			if prev == 0 {
				return 0
			}
			return (now - prev) / prev * 100
		}

		revPct := pct(revA, revB)
		cntPct := pct(float64(cntA), float64(cntB))
		aovPct := pct(aovA, aovB)

		labelA := humanPeriod(periodA)
		labelB := humanPeriod(periodB)

		artifacts := []AIArtifact{
			{Type: "stat", Title: "Omzet " + labelA, Data: map[string]any{
				"value": revA, "format": "currency", "trend_percent": revPct,
				"sub": "vs " + labelB,
			}},
			{Type: "stat", Title: "Transaksi " + labelA, Data: map[string]any{
				"value": cntA, "format": "number", "trend_percent": cntPct, "sub": "vs " + labelB,
			}},
			{Type: "stat", Title: "Avg Ticket " + labelA, Data: map[string]any{
				"value": aovA, "format": "currency", "trend_percent": aovPct, "sub": "vs " + labelB,
			}},
			{Type: "chart", Title: "Perbandingan Omzet",
				Data: map[string]any{"chart_type": "bar", "y_format": "currency",
					"points": []map[string]any{
						{"label": labelB, "value": revB},
						{"label": labelA, "value": revA},
					}}},
			{Type: "chart", Title: "Perbandingan Jumlah Transaksi",
				Data: map[string]any{"chart_type": "bar",
					"points": []map[string]any{
						{"label": labelB, "value": cntB},
						{"label": labelA, "value": cntA},
					}}},
		}

		return toolOutput{
			Data: map[string]any{
				"period_a": map[string]any{"name": labelA, "revenue": revA, "transactions": cntA, "aov": aovA},
				"period_b": map[string]any{"name": labelB, "revenue": revB, "transactions": cntB, "aov": aovB},
				"growth": map[string]any{
					"revenue_pct": revPct, "transactions_pct": cntPct, "aov_pct": aovPct,
				},
			},
			Artifacts: artifacts,
		}

	case "get_business_kpis":
		period, _ := args["period"].(string)
		if period == "" {
			period = "this_month"
		}
		s, e := periodRange(period)

		var revenue float64
		DB.Model(&Transaction{}).Where("status = 'paid' AND created_at BETWEEN ? AND ?", s, e).
			Select("COALESCE(SUM(total_amount), 0)").Scan(&revenue)

		var trxCount int64
		DB.Model(&Transaction{}).Where("status = 'paid' AND created_at BETWEEN ? AND ?", s, e).Count(&trxCount)

		aov := 0.0
		if trxCount > 0 {
			aov = revenue / float64(trxCount)
		}

		var uniqueCustomers int64
		DB.Raw(`SELECT COUNT(DISTINCT user_id) FROM transactions
			WHERE status = 'paid' AND user_id IS NOT NULL AND created_at BETWEEN ? AND ?`, s, e).
			Scan(&uniqueCustomers)

		// New customers = users whose first paid transaction lies in [s, e]
		var newCustomers int64
		DB.Raw(`SELECT COUNT(*) FROM (
			SELECT user_id, MIN(created_at) AS first_trx
			FROM transactions WHERE status = 'paid' AND user_id IS NOT NULL
			GROUP BY user_id
		) firsts WHERE first_trx BETWEEN ? AND ?`, s, e).Scan(&newCustomers)

		returningCustomers := uniqueCustomers - newCustomers
		if returningCustomers < 0 {
			returningCustomers = 0
		}

		// Member conversion: of users who transacted in period, how many have membership
		var convertedCount int64
		DB.Raw(`SELECT COUNT(DISTINCT t.user_id) FROM transactions t
			JOIN memberships m ON m.user_id = t.user_id
			WHERE t.status = 'paid' AND t.user_id IS NOT NULL
			  AND t.created_at BETWEEN ? AND ? AND m.deleted_at IS NULL`, s, e).Scan(&convertedCount)
		conversionPct := 0.0
		if uniqueCustomers > 0 {
			conversionPct = float64(convertedCount) / float64(uniqueCustomers) * 100
		}

		var cashIn, cashOut float64
		DB.Model(&CashFlow{}).Where("type = 'in' AND created_at BETWEEN ? AND ?", s, e).
			Select("COALESCE(SUM(amount), 0)").Scan(&cashIn)
		DB.Model(&CashFlow{}).Where("type = 'out' AND created_at BETWEEN ? AND ?", s, e).
			Select("COALESCE(SUM(amount), 0)").Scan(&cashOut)
		netCashflow := cashIn - cashOut

		periodLabel := humanPeriod(period)
		artifacts := []AIArtifact{
			{Type: "stat", Title: "Omzet " + periodLabel, Data: map[string]any{"value": revenue, "format": "currency", "icon": "money"}},
			{Type: "stat", Title: "Transaksi", Data: map[string]any{"value": trxCount, "format": "number", "icon": "receipt"}},
			{Type: "stat", Title: "Avg Ticket", Data: map[string]any{"value": aov, "format": "currency", "icon": "money"}},
			{Type: "stat", Title: "Unique Customer", Data: map[string]any{"value": uniqueCustomers, "format": "number", "icon": "users"}},
			{Type: "stat", Title: "Customer Baru", Data: map[string]any{"value": newCustomers, "format": "number", "icon": "users"}},
			{Type: "stat", Title: "Customer Balik", Data: map[string]any{"value": returningCustomers, "format": "number", "icon": "users"}},
			{Type: "stat", Title: "Member Conversion", Data: map[string]any{
				"value": fmt.Sprintf("%.1f%%", conversionPct),
				"sub":   fmt.Sprintf("%d dari %d customer", convertedCount, uniqueCustomers),
			}},
			{Type: "stat", Title: "Net Cashflow", Data: map[string]any{"value": netCashflow, "format": "currency", "icon": "money"}},
		}

		return toolOutput{
			Data: map[string]any{
				"period":              period,
				"revenue":             revenue,
				"transactions":        trxCount,
				"aov":                 aov,
				"unique_customers":    uniqueCustomers,
				"new_customers":       newCustomers,
				"returning_customers": returningCustomers,
				"member_conversion":   conversionPct,
				"cash_in":             cashIn,
				"cash_out":            cashOut,
				"net_cashflow":        netCashflow,
			},
			Artifacts: artifacts,
		}

	case "search_member_by_plate":
		plate, _ := args["plate"].(string)
		normalized := strings.ToUpper(strings.ReplaceAll(plate, " ", ""))
		var v Vehicle
		err := DB.Preload("User").Preload("Memberships").
			Where("UPPER(REPLACE(license_plate, ' ', '')) = ?", normalized).First(&v).Error
		if err != nil {
			return toolOutput{Data: map[string]any{"found": false}}
		}
		memOut := make([]map[string]any, 0, len(v.Memberships))
		for _, m := range v.Memberships {
			endStr := ""
			if m.EndDate != nil {
				endStr = m.EndDate.Format("2006-01-02")
			}
			memOut = append(memOut, map[string]any{"status": m.Status, "end_date": endStr})
		}
		owner := map[string]any{}
		if v.User != nil {
			owner["name"] = v.User.Name
			owner["email"] = v.User.Email
			owner["phone"] = v.User.Phone
		}
		return toolOutput{Data: map[string]any{
			"found": true, "plate": v.LicensePlate, "model": v.Model,
			"owner": owner, "memberships": memOut,
		}}
	}
	return toolOutput{Data: map[string]any{"error": "unknown tool: " + name}}
}

func humanPeriod(p string) string {
	switch p {
	case "today":
		return "Hari Ini"
	case "yesterday":
		return "Kemarin"
	case "this_week":
		return "Minggu Ini"
	case "this_month":
		return "Bulan Ini"
	case "this_year":
		return "Tahun Ini"
	case "last_7_days":
		return "7 Hari Terakhir"
	case "last_30_days":
		return "30 Hari Terakhir"
	case "last_week":
		return "Minggu Lalu"
	case "last_month":
		return "Bulan Lalu"
	case "last_year":
		return "Tahun Lalu"
	}
	return p
}

func topServicesRows(period string, limit int) []map[string]any {
	s, e := periodRange(period)
	type row struct {
		Name     string  `json:"name"`
		Quantity int     `json:"quantity"`
		Revenue  float64 `json:"revenue"`
	}
	var rows []row
	DB.Table("transaction_items ti").
		Select("s.name, SUM(ti.quantity) as quantity, SUM(ti.subtotal) as revenue").
		Joins("JOIN services s ON s.id = ti.service_id").
		Joins("JOIN transactions t ON t.id = ti.transaction_id").
		Where("t.status = 'paid' AND t.created_at BETWEEN ? AND ?", s, e).
		Group("s.name").Order("quantity desc").Limit(limit).Scan(&rows)
	out := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		out = append(out, map[string]any{"name": r.Name, "quantity": r.Quantity, "revenue": r.Revenue})
	}
	return out
}

// mapsToTable converts an unordered list of row-maps into ordered columns+rows.
func mapsToTable(rows []map[string]any) ([]map[string]any, [][]any) {
	if len(rows) == 0 {
		return nil, nil
	}
	keys := make([]string, 0, len(rows[0]))
	for k := range rows[0] {
		keys = append(keys, k)
	}
	// keep insertion-ish stable-ish — sort alphabetically for determinism
	for i := 1; i < len(keys); i++ {
		for j := i; j > 0 && keys[j-1] > keys[j]; j-- {
			keys[j-1], keys[j] = keys[j], keys[j-1]
		}
	}
	cols := make([]map[string]any, 0, len(keys))
	for i, k := range keys {
		cols = append(cols, map[string]any{"key": fmt.Sprintf("%d", i), "label": k})
	}
	out := make([][]any, 0, len(rows))
	for _, r := range rows {
		row := make([]any, len(keys))
		for i, k := range keys {
			row[i] = r[k]
		}
		out = append(out, row)
	}
	return cols, out
}

// rowsToChartPoints expects [label, value] as first two columns.
func rowsToChartPoints(rows []map[string]any) ([]map[string]any, []map[string]any, error) {
	if len(rows) == 0 {
		return nil, nil, fmt.Errorf("empty rows")
	}
	keys := make([]string, 0, len(rows[0]))
	for k := range rows[0] {
		keys = append(keys, k)
	}
	if len(keys) < 2 {
		return nil, nil, fmt.Errorf("query harus return minimal 2 kolom: label & value")
	}
	for i := 1; i < len(keys); i++ {
		for j := i; j > 0 && keys[j-1] > keys[j]; j-- {
			keys[j-1], keys[j] = keys[j], keys[j-1]
		}
	}
	labelKey, valueKey := keys[0], keys[1]
	points := make([]map[string]any, 0, len(rows))
	data := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		points = append(points, map[string]any{"label": r[labelKey], "value": r[valueKey]})
		data = append(data, r)
	}
	return points, data, nil
}

var sqlForbiddenKeywords = []string{
	"insert", "update", "delete", "drop", "alter", "create",
	"truncate", "grant", "revoke", "merge", "call", "copy", "vacuum",
}

// runReadOnlyQuery validates and executes a single SELECT/WITH statement
// inside a read-only postgres transaction. Returns at most 200 rows.
func runReadOnlyQuery(rawSQL string) (map[string]any, error) {
	stmt := strings.TrimSpace(rawSQL)
	if stmt == "" {
		return nil, fmt.Errorf("query kosong")
	}
	lower := strings.ToLower(stmt)
	if !(strings.HasPrefix(lower, "select") || strings.HasPrefix(lower, "with")) {
		return nil, fmt.Errorf("hanya SELECT atau WITH yang diizinkan")
	}
	core := strings.TrimRight(stmt, "; \t\r\n")
	if strings.Contains(core, ";") {
		return nil, fmt.Errorf("multiple statements tidak diizinkan")
	}
	padded := " " + strings.ToLower(core) + " "
	for _, kw := range sqlForbiddenKeywords {
		if strings.Contains(padded, " "+kw+" ") {
			return nil, fmt.Errorf("keyword tidak diizinkan: %s", kw)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tx := DB.WithContext(ctx).Begin(&sql.TxOptions{ReadOnly: true})
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer tx.Rollback()

	var rows []map[string]any
	if err := tx.Raw(core).Scan(&rows).Error; err != nil {
		return nil, err
	}

	truncated := false
	if len(rows) > 200 {
		rows = rows[:200]
		truncated = true
	}
	return map[string]any{"rows": rows, "count": len(rows), "truncated": truncated}, nil
}

// exportDir is where generated CSV/Excel files are written. Served at /api/exports/:token.
func exportDir() string {
	d := os.Getenv("EXPORT_DIR")
	if d == "" {
		d = filepath.Join(os.TempDir(), "baxter_exports")
	}
	_ = os.MkdirAll(d, 0o755)
	return d
}

func randomToken() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// writeExportFile writes rows into a CSV or XLSX inside exportDir and returns
// the public URL + size.
func writeExportFile(baseName, format string, rows []map[string]any) (string, int64, error) {
	keys := make([]string, 0, len(rows[0]))
	for k := range rows[0] {
		keys = append(keys, k)
	}
	for i := 1; i < len(keys); i++ {
		for j := i; j > 0 && keys[j-1] > keys[j]; j-- {
			keys[j-1], keys[j] = keys[j], keys[j-1]
		}
	}

	token := randomToken()
	safeName := sanitizeFilename(baseName)
	storedName := token + "_" + safeName + "." + format
	fullPath := filepath.Join(exportDir(), storedName)

	switch format {
	case "csv":
		f, err := os.Create(fullPath)
		if err != nil {
			return "", 0, err
		}
		w := csv.NewWriter(f)
		_ = w.Write(keys)
		for _, r := range rows {
			rec := make([]string, len(keys))
			for i, k := range keys {
				rec[i] = fmt.Sprintf("%v", r[k])
			}
			_ = w.Write(rec)
		}
		w.Flush()
		f.Close()
	case "xlsx":
		x := excelize.NewFile()
		sheet := "Sheet1"
		for i, k := range keys {
			cell, _ := excelize.CoordinatesToCellName(i+1, 1)
			_ = x.SetCellValue(sheet, cell, k)
		}
		for ri, r := range rows {
			for ci, k := range keys {
				cell, _ := excelize.CoordinatesToCellName(ci+1, ri+2)
				_ = x.SetCellValue(sheet, cell, r[k])
			}
		}
		if err := x.SaveAs(fullPath); err != nil {
			return "", 0, err
		}
		x.Close()
	default:
		return "", 0, fmt.Errorf("format tidak didukung: %s", format)
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		return "", 0, err
	}
	return "/api/exports/" + storedName, info.Size(), nil
}

func sanitizeFilename(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9', c == '_', c == '-':
			out = append(out, c)
		case c == ' ':
			out = append(out, '_')
		}
	}
	if len(out) == 0 {
		return "export"
	}
	return string(out)
}

// downloadExport serves a previously generated export file.
func downloadExport(c *gin.Context) {
	name := c.Param("filename")
	if strings.Contains(name, "..") || strings.Contains(name, "/") {
		c.JSON(400, gin.H{"error": "invalid filename"})
		return
	}
	full := filepath.Join(exportDir(), name)
	if _, err := os.Stat(full); err != nil {
		c.JSON(404, gin.H{"error": "file not found"})
		return
	}
	c.FileAttachment(full, name)
}

func callOpenRouter(messages []aiMessage) (*aiResponse, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY tidak diset")
	}
	model := os.Getenv("LLM_MODEL")
	if model == "" {
		model = "anthropic/claude-sonnet-4.6"
	}

	body, _ := json.Marshal(map[string]any{
		"model":    model,
		"messages": messages,
		"tools":    aiTools,
	})
	req, _ := http.NewRequest("POST", openRouterURL, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://baxter-pos.local")
	req.Header.Set("X-Title", "Baxter POS Assistant")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	var parsed aiResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("decode openrouter response: %w; raw=%s", err, string(raw))
	}
	if parsed.Error != nil {
		return nil, fmt.Errorf("openrouter error: %s", parsed.Error.Message)
	}
	return &parsed, nil
}

// AIChatRequest is the body coming from the UI.
type AIChatRequest struct {
	Messages []aiMessage `json:"messages" binding:"required"`
}

func AIChat(c *gin.Context) {
	var req AIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	systemPrompt := aiMessage{
		Role: "system",
		Content: "Kamu adalah Info Baxter, AI Business Assistant untuk Baxter POS (sistem kasir cuci kendaraan + cafe).\n\n" +
			"ATURAN MUTLAK:\n" +
			"1. JANGAN PERNAH menebak angka. Setiap angka WAJIB datang dari hasil tool call. Kalau hasil tool kosong, katakan jujur 'tidak ada data', jangan dikarang.\n" +
			"2. Sebelum menjawab pertanyaan yang melibatkan data bisnis (omzet, transaksi, member, dll), WAJIB panggil tool dulu.\n" +
			"3. Pakai glosarium di bawah — jangan asumsi sendiri arti istilah bisnis.\n" +
			"4. Tool punya 2 jenis output: data untuk kamu reasoning + artifact untuk UI render. Setelah memanggil tool yang menghasilkan artifact (stat/table/chart/download), JANGAN duplikasi data tersebut di teks reply — cukup berikan insight/komentar singkat. User sudah melihat artifact-nya.\n" +
			"5. Format angka rupiah: 'Rp 1.250.000' (pemisah titik, tanpa desimal).\n" +
			"6. Format tanggal: '14 Mei 2026'.\n\n" +
			"STRATEGI MENJAWAB:\n" +
			"- Pertanyaan umum 'gimana hari ini' → get_dashboard_overview\n" +
			"- 'omzet/pendapatan periode X' → get_revenue_summary\n" +
			"- 'grafik/tren omzet' → get_revenue_trend\n" +
			"- 'service paling laku' → get_top_services\n" +
			"- 'customer paling banyak/sedikit transaksi / top spender / pelanggan loyal' → get_top_customers (set order='asc' untuk paling sedikit, 'desc' untuk paling banyak)\n" +
			"- 'siapa paling banyak punya membership / user dengan member terbanyak' → get_top_membership_owners\n" +
			"- 'hari/jam/tanggal paling rame / peak hours / kapan paling sibuk' → get_peak_times\n" +
			"- 'customer yang lama gak datang / churn / customer hilang' → get_inactive_customers\n" +
			"- 'carwash vs bikewash / breakdown kategori / komposisi' → get_service_category_breakdown\n" +
			"- 'cash vs qris / metode pembayaran / breakdown bayar' → get_payment_method_analysis\n" +
			"- 'cashier paling produktif / performa kasir' → get_cashier_performance\n" +
			"- 'bandingkan X dengan Y / vs / lebih baik dari' → compare_periods\n" +
			"- 'kpi / health bisnis / overview lengkap / rata-rata transaksi / new vs returning customer / member conversion' → get_business_kpis\n" +
			"- 'member' → get_memberships_stats atau search_member_by_plate\n" +
			"- 'cashflow' → get_cashflow_summary\n" +
			"- 'grafik/chart custom' yang tidak tercover tool standar → generate_chart\n" +
			"- Pertanyaan custom lain → execute_sql_query\n\n" +
			"ATURAN DOWNLOAD: Kalau user minta 'download', 'export', 'unduh', 'kasih csv/excel', 'file' — kamu HARUS panggil 2 tool: " +
			"(1) tool analytics yang relevan untuk display infografis, DAN (2) export_data dengan SQL equivalent untuk generate file. " +
			"Contoh: user minta 'download top 5 customer bulan ini' → panggil get_top_customers DAN export_data dengan SELECT yang sama. " +
			"Kalau user hanya minta data tanpa kata download, panggil tool analytics saja (cukup infografis di UI).\n\n" +
			"GAYA REPLY:\n" +
			"- Singkat, padat, profesional. Bahasa Indonesia santai-bisnis.\n" +
			"- Berikan 1-2 kalimat insight setelah data (mis. 'omzet naik 12% dari minggu lalu, didorong oleh paket Wash & Wax').\n" +
			"- Kalau ada anomali (drop besar, member expired banyak), highlight dengan jelas.\n\n" +
			"Hari ini: " + time.Now().Format("Monday, 2 January 2006") + ".\n\n" +
			schemaDescription,
	}
	conv := append([]aiMessage{systemPrompt}, req.Messages...)

	collectedArtifacts := []AIArtifact{}

	for i := 0; i < 6; i++ {
		resp, err := callOpenRouter(conv)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		if len(resp.Choices) == 0 {
			c.JSON(500, gin.H{"error": "empty response from model"})
			return
		}
		msg := resp.Choices[0].Message

		if len(msg.ToolCalls) == 0 {
			c.JSON(200, gin.H{"reply": msg.Content, "artifacts": collectedArtifacts})
			return
		}

		conv = append(conv, msg)
		for _, tc := range msg.ToolCalls {
			result := runAITool(tc.Function.Name, tc.Function.Arguments)
			collectedArtifacts = append(collectedArtifacts, result.Artifacts...)
			resultJSON, _ := json.Marshal(result.Data)
			conv = append(conv, aiMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Name:       tc.Function.Name,
				Content:    string(resultJSON),
			})
		}
	}

	c.JSON(500, gin.H{"error": "tool loop limit reached"})
}
