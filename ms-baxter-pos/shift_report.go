package main

import (
	"strings"

	"gorm.io/gorm"
)

var saleStatuses = []string{"paid", "completed"}

type ShiftReportMoneyRow struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
	Qty    int     `json:"qty,omitempty"`
}

type ShiftReportPaymentRow struct {
	PaymentMethod string  `json:"payment_method"`
	BankAccount   string  `json:"bank_account"`
	TotalSales    float64 `json:"total_sales"`
}

type ShiftReportAccountingLine struct {
	Label  string  `json:"label"`
	Amount float64 `json:"amount"`
}

type ShiftReportExpenseLine struct {
	Label    string  `json:"label"`
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

type ShiftReportAccountingSection struct {
	Title  string                      `json:"title"`
	Total  float64                     `json:"total"`
	Lines  []ShiftReportAccountingLine `json:"lines"`
	Items  []ShiftReportExpenseLine    `json:"items,omitempty"`
	Impact float64                     `json:"impact,omitempty"`
}

type ShiftReportCanceledOrderRow struct {
	Source     string  `json:"source"`
	TotalOrder float64 `json:"total_order"`
	Qty        int     `json:"qty"`
}

type ShiftReportData struct {
	CategorySales []ShiftReportMoneyRow `json:"category_sales"`
	Payment       struct {
		TotalSales float64                 `json:"total_sales"`
		Rows       []ShiftReportPaymentRow `json:"rows"`
	} `json:"payment_summary"`
	ProfitLoss struct {
		Revenue     ShiftReportAccountingSection `json:"revenue"`
		COGS        ShiftReportAccountingSection `json:"cogs"`
		GrossProfit float64                      `json:"gross_profit"`
		Expenses    ShiftReportAccountingSection `json:"expenses"`
		Stock       ShiftReportAccountingSection `json:"stock"`
		Purchases   ShiftReportAccountingSection `json:"purchases"`
		NetProfit   float64                      `json:"net_profit"`
	} `json:"profit_loss"`
	CanceledOrders struct {
		Rows []ShiftReportCanceledOrderRow `json:"rows"`
	} `json:"canceled_orders"`
}

func buildShiftReport(db *gorm.DB, shiftIDs []uint) (ShiftReportData, error) {
	report := emptyShiftReportData()
	if len(shiftIDs) == 0 {
		return report, nil
	}

	if err := loadCategorySales(db, shiftIDs, &report); err != nil {
		return report, err
	}
	if err := loadPaymentSummary(db, shiftIDs, &report); err != nil {
		return report, err
	}
	if err := loadExpenses(db, shiftIDs, &report); err != nil {
		return report, err
	}
	if err := loadCanceledOrders(db, shiftIDs, &report); err != nil {
		return report, err
	}

	finalizeProfitLoss(&report)
	return report, nil
}

func emptyShiftReportData() ShiftReportData {
	var report ShiftReportData
	report.ProfitLoss.Revenue = ShiftReportAccountingSection{
		Title: "A. Pendapatan",
		Lines: []ShiftReportAccountingLine{
			{Label: "SALES - POINT OF SALE"},
			{Label: "Pajak (exclude)"},
			{Label: "Pajak (include)"},
			{Label: "Pembulatan"},
			{Label: "Pengembalian (refund)"},
			{Label: "Total Deposit yang ditebus"},
		},
	}
	report.ProfitLoss.COGS = ShiftReportAccountingSection{
		Title: "B. Harga Pokok Penjualan",
		Lines: []ShiftReportAccountingLine{
			{Label: "Total Penjualan (Harga Modal)"},
			{Label: "Total Pengembalian (Harga Modal)"},
		},
	}
	report.ProfitLoss.Expenses = ShiftReportAccountingSection{Title: "D. Pengeluaran"}
	report.ProfitLoss.Stock = ShiftReportAccountingSection{
		Title: "E. Stok",
		Lines: []ShiftReportAccountingLine{
			{Label: "Stok Keluar"},
			{Label: "Opname Stok"},
		},
	}
	report.ProfitLoss.Purchases = ShiftReportAccountingSection{
		Title: "F. Pembelian",
		Lines: []ShiftReportAccountingLine{
			{Label: "Diskon"},
			{Label: "Pengiriman"},
			{Label: "Pajak"},
		},
	}
	return report
}

func loadCategorySales(db *gorm.DB, shiftIDs []uint, report *ShiftReportData) error {
	type row struct {
		Name   string
		Amount float64
		Qty    int
	}
	var rows []row
	if err := db.Raw(`
		SELECT
			COALESCE(NULLIF(sc.name, ''), NULLIF(s.category, ''), 'Uncategorized') AS name,
			COALESCE(SUM(ti.subtotal), 0) AS amount,
			COALESCE(SUM(ti.quantity), 0) AS qty
		FROM transaction_items ti
		JOIN transactions t ON ti.transaction_id = t.id
		LEFT JOIN services s ON ti.service_id = s.id
		LEFT JOIN service_categories sc ON sc.slug = s.category
		WHERE t.shift_id IN ? AND t.status IN ?
		GROUP BY COALESCE(NULLIF(sc.name, ''), NULLIF(s.category, ''), 'Uncategorized')
		ORDER BY amount DESC, name ASC
	`, shiftIDs, saleStatuses).Scan(&rows).Error; err != nil {
		return err
	}

	for _, r := range rows {
		report.CategorySales = append(report.CategorySales, ShiftReportMoneyRow{
			Name:   strings.ToUpper(r.Name),
			Amount: r.Amount,
			Qty:    r.Qty,
		})
	}
	return nil
}

func loadPaymentSummary(db *gorm.DB, shiftIDs []uint, report *ShiftReportData) error {
	type row struct {
		PaymentMethod string
		TotalSales    float64
	}
	var rows []row
	if err := db.Raw(`
		SELECT
			COALESCE(NULLIF(pm.name, ''), 'Unknown') AS payment_method,
			COALESCE(SUM(t.total_amount), 0) AS total_sales
		FROM transactions t
		LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
		WHERE t.shift_id IN ? AND t.status IN ?
		GROUP BY COALESCE(NULLIF(pm.name, ''), 'Unknown')
		ORDER BY total_sales DESC, payment_method ASC
	`, shiftIDs, saleStatuses).Scan(&rows).Error; err != nil {
		return err
	}

	for _, r := range rows {
		report.Payment.TotalSales += r.TotalSales
		report.Payment.Rows = append(report.Payment.Rows, ShiftReportPaymentRow{
			PaymentMethod: r.PaymentMethod,
			BankAccount:   "-",
			TotalSales:    r.TotalSales,
		})
	}
	return nil
}

func loadExpenses(db *gorm.DB, shiftIDs []uint, report *ShiftReportData) error {
	type row struct {
		Label    string
		Category string
		Amount   float64
	}
	var rows []row
	if err := db.Raw(`
		SELECT
			COALESCE(NULLIF(description, ''), NULLIF(category, ''), 'Expense') AS label,
			COALESCE(NULLIF(category, ''), 'operational') AS category,
			COALESCE(SUM(amount), 0) AS amount
		FROM cash_flows
		WHERE shift_id IN ? AND type IN ('out', 'expense')
		GROUP BY
			COALESCE(NULLIF(description, ''), NULLIF(category, ''), 'Expense'),
			COALESCE(NULLIF(category, ''), 'operational')
		ORDER BY amount DESC, label ASC
	`, shiftIDs).Scan(&rows).Error; err != nil {
		return err
	}

	for _, r := range rows {
		report.ProfitLoss.Expenses.Items = append(report.ProfitLoss.Expenses.Items, ShiftReportExpenseLine{
			Label:    r.Label,
			Category: r.Category,
			Amount:   r.Amount,
		})
		report.ProfitLoss.Expenses.Total += r.Amount
	}
	return nil
}

func loadCanceledOrders(db *gorm.DB, shiftIDs []uint, report *ShiftReportData) error {
	type row struct {
		Source     string
		TotalOrder float64
		Qty        int
	}
	var rows []row
	if err := db.Raw(`
		SELECT
			'POS' AS source,
			COALESCE(SUM(t.total_amount), 0) AS total_order,
			COALESCE(SUM(item_qty.qty), COUNT(t.id), 0) AS qty
		FROM transactions t
		LEFT JOIN (
			SELECT transaction_id, SUM(quantity) AS qty
			FROM transaction_items
			GROUP BY transaction_id
		) item_qty ON item_qty.transaction_id = t.id
		WHERE t.shift_id IN ? AND t.status = 'cancelled'
		GROUP BY source
	`, shiftIDs).Scan(&rows).Error; err != nil {
		return err
	}

	for _, r := range rows {
		if r.TotalOrder == 0 && r.Qty == 0 {
			continue
		}
		report.CanceledOrders.Rows = append(report.CanceledOrders.Rows, ShiftReportCanceledOrderRow{
			Source:     r.Source,
			TotalOrder: r.TotalOrder,
			Qty:        r.Qty,
		})
	}
	return nil
}

func finalizeProfitLoss(report *ShiftReportData) {
	totalA := report.Payment.TotalSales
	report.ProfitLoss.Revenue.Lines[0].Amount = report.Payment.TotalSales
	report.ProfitLoss.Revenue.Total = totalA

	totalSalesCost := report.ProfitLoss.COGS.Lines[0].Amount
	totalRefundCost := report.ProfitLoss.COGS.Lines[1].Amount
	report.ProfitLoss.COGS.Total = totalSalesCost - totalRefundCost

	report.ProfitLoss.GrossProfit = report.ProfitLoss.Revenue.Total - report.ProfitLoss.COGS.Total

	stockImpact := report.ProfitLoss.Stock.Lines[0].Amount + report.ProfitLoss.Stock.Lines[1].Amount
	report.ProfitLoss.Stock.Total = stockImpact
	report.ProfitLoss.Stock.Impact = stockImpact

	purchaseImpact := -report.ProfitLoss.Purchases.Lines[0].Amount + report.ProfitLoss.Purchases.Lines[1].Amount + report.ProfitLoss.Purchases.Lines[2].Amount
	report.ProfitLoss.Purchases.Total = purchaseImpact
	report.ProfitLoss.Purchases.Impact = purchaseImpact

	report.ProfitLoss.NetProfit = report.ProfitLoss.GrossProfit - report.ProfitLoss.Expenses.Total - stockImpact - purchaseImpact
}
