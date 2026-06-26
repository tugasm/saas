package main

import (
	"bytes"
	"html/template"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestRenderInvoicePreview generates a sample invoice HTML and writes it to
// /tmp/baxter-invoice-preview.html so you can open it in a browser.
//
// Run with:  go test -run TestRenderInvoicePreview -v
func TestRenderInvoicePreview(t *testing.T) {
	sample := invoiceData{
		BusinessName:    "Baxter Car Wash",
		BusinessPhone:   "+62 812-3456-7890",
		TransactionCode: "TRX9F2KQA7B1715692380",
		DateLabel:       time.Now().Format("02 Jan 2006 · 15:04"),
		CustomerName:    "Budi Santoso",
		CustomerEmail:   "budi.santoso@gmail.com",
		PaymentMethod:   "QRIS",
		PaidAtLabel:     time.Now().Format("02 Jan 2006 15:04"),
		Items: []invoiceItemData{
			{
				Name:          "Wash & Wax — Premium",
				Quantity:      1,
				PriceLabel:    formatRupiah(75000),
				SubtotalLabel: formatRupiah(75000),
				HasDiscount:   true,
				DiscountLabel: formatRupiah(75000),
			},
			{
				Name:          "Interior Detailing",
				Quantity:      1,
				PriceLabel:    formatRupiah(120000),
				SubtotalLabel: formatRupiah(120000),
			},
			{
				Name:          "Es Kopi Susu",
				Quantity:      2,
				PriceLabel:    formatRupiah(22000),
				SubtotalLabel: formatRupiah(44000),
			},
			{
				Name:          "Paket Membership 6 Bulan",
				Quantity:      1,
				PriceLabel:    formatRupiah(500000),
				SubtotalLabel: formatRupiah(500000),
			},
		},
		TotalLabel:         formatRupiah(664000),
		PointsEarned:       380,
		HasMembership:      true,
		MembershipEndLabel: time.Now().AddDate(0, 6, 0).Format("02 January 2006"),
		Year:               time.Now().Year(),
	}

	tmpl, err := template.New("invoice").Parse(invoiceTemplate)
	if err != nil {
		t.Fatalf("template parse: %v", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, sample); err != nil {
		t.Fatalf("template execute: %v", err)
	}

	out := filepath.Join(os.TempDir(), "baxter-invoice-preview.html")
	if err := os.WriteFile(out, buf.Bytes(), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	t.Logf("Invoice preview written to: %s", out)
	t.Logf("Open with: open %s", out)
}
