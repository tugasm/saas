package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"log"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// invoiceTemplate is the HTML body sent to the customer.
// Inline CSS only — email clients strip <style> blocks aggressively.
const invoiceTemplate = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice {{.TransactionCode}}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;color:#333333;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#ffffff;padding:24px 12px;">
  <tr><td align="center">

    <!-- Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #898989;">

      <!-- Header -->
      <tr>
        <td style="background-color:#ffffff;padding:32px 36px;border-bottom:1px solid #898989;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#333333;">{{.BusinessName}}</td>
              <td align="right" style="font-size:12px;color:#333333;">{{.DateLabel}}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:14px;font-size:26px;font-weight:700;letter-spacing:-0.5px;color:#333333;">Invoice</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:4px;font-size:13px;color:#333333;font-family:'SF Mono',Menlo,monospace;">#{{.TransactionCode}}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td style="padding:30px 36px 8px 36px;">
          <p style="margin:0 0 6px 0;font-size:18px;font-weight:600;color:#333333;">Halo {{.CustomerName}} 👋</p>
          <p style="margin:0;font-size:14px;color:#333333;line-height:1.55;">
            Terima kasih telah menggunakan layanan kami. Berikut detail transaksi Anda:
          </p>
        </td>
      </tr>

      <!-- Customer & Payment -->
      <tr>
        <td style="padding:20px 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #898989;border-radius:12px;padding:18px;">
            <tr>
              <td style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#333333;padding-bottom:4px;">Customer</td>
              <td style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#333333;padding-bottom:4px;">Pembayaran</td>
            </tr>
            <tr>
              <td style="font-size:14px;font-weight:600;color:#333333;padding-bottom:2px;">{{.CustomerName}}</td>
              <td style="font-size:14px;font-weight:600;color:#333333;padding-bottom:2px;">{{.PaymentMethod}}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#333333;">{{.CustomerEmail}}</td>
              <td style="font-size:12px;color:#333333;">Dibayar {{.PaidAtLabel}}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Items -->
      <tr>
        <td style="padding:8px 36px;">
          <p style="margin:14px 0 12px 0;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#333333;">Rincian Pembelian</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <thead>
              <tr>
                <th align="left" style="padding:10px 8px 10px 0;font-size:11px;font-weight:700;color:#333333;border-bottom:1px solid #898989;text-transform:uppercase;letter-spacing:0.8px;">Item</th>
                <th align="center" style="padding:10px 8px;font-size:11px;font-weight:700;color:#333333;border-bottom:1px solid #898989;text-transform:uppercase;letter-spacing:0.8px;">Qty</th>
                <th align="right" style="padding:10px 8px;font-size:11px;font-weight:700;color:#333333;border-bottom:1px solid #898989;text-transform:uppercase;letter-spacing:0.8px;">Harga</th>
                <th align="right" style="padding:10px 0 10px 8px;font-size:11px;font-weight:700;color:#333333;border-bottom:1px solid #898989;text-transform:uppercase;letter-spacing:0.8px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {{range .Items}}
              <tr>
                <td style="padding:14px 8px 14px 0;font-size:14px;color:#333333;border-bottom:1px solid #898989;">
                  <div style="font-weight:600;">{{.Name}}</div>
                  {{if .HasDiscount}}<div style="font-size:11px;color:#333333;font-weight:600;margin-top:2px;">Diskon Member −{{.DiscountLabel}}</div>{{end}}
                </td>
                <td align="center" style="padding:14px 8px;font-size:14px;color:#333333;border-bottom:1px solid #898989;">{{.Quantity}}</td>
                <td align="right" style="padding:14px 8px;font-size:14px;color:#333333;border-bottom:1px solid #898989;">{{.PriceLabel}}</td>
                <td align="right" style="padding:14px 0 14px 8px;font-size:14px;font-weight:600;color:#333333;border-bottom:1px solid #898989;">{{.SubtotalLabel}}</td>
              </tr>
              {{end}}
            </tbody>
          </table>
        </td>
      </tr>

      <!-- Total box -->
      <tr>
        <td style="padding:18px 36px 28px 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #898989;border-radius:14px;padding:22px 24px;">
            <tr>
              <td>
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#333333;font-weight:600;">Total Pembayaran</div>
                <div style="font-size:28px;font-weight:700;margin-top:4px;letter-spacing:-0.5px;color:#333333;">{{.TotalLabel}}</div>
              </td>
              <td align="right">
                {{if gt .PointsEarned 0}}
                <div style="display:inline-block;background-color:#ffffff;border:1px solid #898989;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:600;color:#333333;">⭐ +{{.PointsEarned}} Poin</div>
                {{end}}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      {{if .HasMembership}}
      <!-- Membership box -->
      <tr>
        <td style="padding:0 36px 24px 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #898989;border-radius:14px;padding:18px;">
            <tr>
              <td style="font-size:12px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;color:#333333;padding-bottom:6px;">🎉 Membership Aktif</td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#333333;">
                Membership Anda berlaku hingga <strong>{{.MembershipEndLabel}}</strong>. Nikmati diskon spesial di setiap kunjungan!
              </td>
            </tr>
          </table>
        </td>
      </tr>
      {{end}}

      <!-- Footer -->
      <tr>
        <td style="padding:0 36px 32px 36px;text-align:center;border-top:1px solid #898989;">
          <p style="margin:16px 0 8px 0;font-size:13px;color:#333333;line-height:1.6;">
            Simpan invoice ini sebagai bukti transaksi.<br>
            Sampai jumpa kembali di {{.BusinessName}}! 🚗✨
          </p>
          {{if .BusinessPhone}}<p style="margin:14px 0 0 0;font-size:11px;color:#333333;">Butuh bantuan? Hubungi {{.BusinessPhone}}</p>{{end}}
        </td>
      </tr>

    </table>

    <!-- Outer footer -->
    <p style="margin:18px 0 0 0;font-size:11px;color:#333333;">© {{.Year}} {{.BusinessName}}. Email otomatis — jangan dibalas.</p>

  </td></tr>
</table>
</body>
</html>`

type invoiceItemData struct {
	Name          string
	Quantity      int
	PriceLabel    string
	SubtotalLabel string
	HasDiscount   bool
	DiscountLabel string
}

type invoiceData struct {
	BusinessName       string
	BusinessPhone      string
	TransactionCode    string
	DateLabel          string
	CustomerName       string
	CustomerEmail      string
	PaymentMethod      string
	PaidAtLabel        string
	Items              []invoiceItemData
	TotalLabel         string
	PointsEarned       int
	HasMembership      bool
	MembershipEndLabel string
	Year               int
}

func formatRupiah(v float64) string {
	whole := int64(v + 0.5)
	negative := whole < 0
	if negative {
		whole = -whole
	}
	s := fmt.Sprintf("%d", whole)
	if len(s) <= 3 {
		if negative {
			return "Rp -" + s
		}
		return "Rp " + s
	}
	var out strings.Builder
	first := len(s) % 3
	if first > 0 {
		out.WriteString(s[:first])
		if len(s) > first {
			out.WriteByte('.')
		}
	}
	for i := first; i < len(s); i += 3 {
		out.WriteString(s[i : i+3])
		if i+3 < len(s) {
			out.WriteByte('.')
		}
	}
	if negative {
		return "Rp -" + out.String()
	}
	return "Rp " + out.String()
}

func buildInvoiceData(t Transaction, customerName, customerEmail string, membershipEnd *time.Time) invoiceData {
	businessName := os.Getenv("BUSINESS_NAME")
	if businessName == "" {
		businessName = "Baxter Car Wash"
	}

	items := make([]invoiceItemData, 0, len(t.Items))
	for _, it := range t.Items {
		hasDisc := it.DiscountAmount > 0
		discLabel := ""
		if hasDisc {
			discLabel = formatRupiah(it.DiscountAmount * float64(it.Quantity))
		}
		items = append(items, invoiceItemData{
			Name:          it.Service.Name,
			Quantity:      it.Quantity,
			PriceLabel:    formatRupiah(it.FinalPrice),
			SubtotalLabel: formatRupiah(it.Subtotal),
			HasDiscount:   hasDisc,
			DiscountLabel: discLabel,
		})
	}

	paidAt := time.Now()
	if t.PaidAt != nil {
		paidAt = *t.PaidAt
	}

	paymentMethod := t.PaymentMethod.Name
	if paymentMethod == "" {
		paymentMethod = strings.Title(t.PaymentType)
	}

	data := invoiceData{
		BusinessName:    businessName,
		BusinessPhone:   os.Getenv("BUSINESS_PHONE"),
		TransactionCode: t.TransactionCode,
		DateLabel:       paidAt.Format("02 Jan 2006 · 15:04"),
		CustomerName:    customerName,
		CustomerEmail:   customerEmail,
		PaymentMethod:   paymentMethod,
		PaidAtLabel:     paidAt.Format("02 Jan 2006 15:04"),
		Items:           items,
		TotalLabel:      formatRupiah(t.TotalAmount),
		PointsEarned:    t.PointsEarned,
		Year:            time.Now().Year(),
	}

	if membershipEnd != nil && membershipEnd.After(time.Now()) {
		data.HasMembership = true
		data.MembershipEndLabel = membershipEnd.Format("02 January 2006")
	}

	return data
}

// sendInvoiceEmail loads the full transaction + customer + (optional) membership
// and sends an HTML invoice. Errors are logged, not returned, because this
// runs async via goroutine after the POS response is already returned.
func sendInvoiceEmail(transactionID uint) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[EMAIL] panic: %v", r)
		}
	}()

	log.Printf("[EMAIL] ── start trx_id=%d", transactionID)

	var t Transaction
	if err := DB.Preload("Items.Service").Preload("PaymentMethod").Preload("User").
		First(&t, transactionID).Error; err != nil {
		log.Printf("[EMAIL] ✗ trx %d not found: %v", transactionID, err)
		return
	}
	log.Printf("[EMAIL] trx=%s status=%s user_id=%v", t.TransactionCode, t.Status, t.UserID)

	if t.Status != "paid" {
		log.Printf("[EMAIL] ✗ skipped: status is %q (not paid)", t.Status)
		return
	}

	if t.UserID == nil {
		log.Printf("[EMAIL] ✗ skipped: no linked user (guest checkout — link a customer in POS)")
		return
	}

	customerEmail := strings.TrimSpace(t.User.Email)
	log.Printf("[EMAIL] customer: id=%d name=%q email=%q", t.User.ID, t.User.Name, customerEmail)
	if customerEmail == "" || !strings.Contains(customerEmail, "@") {
		log.Printf("[EMAIL] ✗ skipped: user %d has no valid email address", t.User.ID)
		return
	}

	var membershipEnd *time.Time
	var m Membership
	if err := DB.Where("transaction_id = ?", t.ID).First(&m).Error; err == nil {
		membershipEnd = m.EndDate
		log.Printf("[EMAIL] membership active until %s", m.EndDate.Format("2006-01-02"))
	}

	data := buildInvoiceData(t, t.User.Name, customerEmail, membershipEnd)

	tmpl, err := template.New("invoice").Parse(invoiceTemplate)
	if err != nil {
		log.Printf("[EMAIL] ✗ template parse failed: %v", err)
		return
	}

	var bodyBuf bytes.Buffer
	if err := tmpl.Execute(&bodyBuf, data); err != nil {
		log.Printf("[EMAIL] ✗ template execute failed: %v", err)
		return
	}

	subject := fmt.Sprintf("Invoice %s — %s", t.TransactionCode, data.BusinessName)
	log.Printf("[EMAIL] sending → to=%s subject=%q", customerEmail, subject)
	if err := sendHTMLEmail(customerEmail, data.CustomerName, subject, bodyBuf.String()); err != nil {
		log.Printf("[EMAIL] ✗ SMTP send failed: %v", err)
		return
	}
	log.Printf("[EMAIL] ✓ invoice sent → trx=%s to=%s", t.TransactionCode, customerEmail)
}

// sendHTMLEmail sends a single HTML email using SMTP configured via env vars.
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM are required.
// SMTP_FROM_NAME is optional (display name).
func sendHTMLEmail(toAddr, toName, subject, htmlBody string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("SMTP_FROM")
	fromName := os.Getenv("SMTP_FROM_NAME")

	log.Printf("[EMAIL] SMTP config: host=%s port=%s user=%s from=%s auth=%v",
		host, port, user, from, user != "" && pass != "")
	if host == "" || port == "" || from == "" {
		return fmt.Errorf("SMTP not configured (need SMTP_HOST, SMTP_PORT, SMTP_FROM)")
	}
	if fromName == "" {
		fromName = os.Getenv("BUSINESS_NAME")
		if fromName == "" {
			fromName = "Baxter POS"
		}
	}

	fromHeader := fmt.Sprintf("%s <%s>", fromName, from)
	toHeader := toAddr
	if toName != "" {
		toHeader = fmt.Sprintf("%s <%s>", toName, toAddr)
	}

	var msg bytes.Buffer
	msg.WriteString("From: " + fromHeader + "\r\n")
	msg.WriteString("To: " + toHeader + "\r\n")
	msg.WriteString("Subject: " + subject + "\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	addr := host + ":" + port

	var auth smtp.Auth
	if user != "" && pass != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}

	// Port 465 = implicit TLS. Anything else = STARTTLS upgrade if possible.
	if port == "465" {
		return sendWithTLS(addr, host, auth, from, toAddr, msg.Bytes())
	}
	return smtp.SendMail(addr, auth, from, []string{toAddr}, msg.Bytes())
}

func sendWithTLS(addr, host string, auth smtp.Auth, from, to string, body []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer c.Close()

	if auth != nil {
		if ok, _ := c.Extension("AUTH"); ok {
			if err := c.Auth(auth); err != nil {
				return fmt.Errorf("auth: %w", err)
			}
		}
	}
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("mail: %w", err)
	}
	if err := c.Rcpt(to); err != nil {
		return fmt.Errorf("rcpt: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write(body); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("close data: %w", err)
	}
	return c.Quit()
}

// testInvoiceEmail renders the sample invoice and sends it to the requested
// address. Useful to validate SMTP credentials before relying on real
// transaction flow.
//
// POST /api/admin/test-email   body: { "to": "user@example.com" }
func testInvoiceEmail(c *gin.Context) {
	var req struct {
		To string `json:"to" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	businessName := os.Getenv("BUSINESS_NAME")
	if businessName == "" {
		businessName = "Baxter Car Wash"
	}

	sample := invoiceData{
		BusinessName:    businessName,
		BusinessPhone:   os.Getenv("BUSINESS_PHONE"),
		TransactionCode: "TEST-" + time.Now().Format("20060102-150405"),
		DateLabel:       time.Now().Format("02 Jan 2006 · 15:04"),
		CustomerName:    "Test Customer",
		CustomerEmail:   req.To,
		PaymentMethod:   "QRIS",
		PaidAtLabel:     time.Now().Format("02 Jan 2006 15:04"),
		Items: []invoiceItemData{
			{Name: "Wash & Wax", Quantity: 1, PriceLabel: formatRupiah(75000), SubtotalLabel: formatRupiah(75000)},
			{Name: "Es Kopi Susu", Quantity: 2, PriceLabel: formatRupiah(22000), SubtotalLabel: formatRupiah(44000)},
		},
		TotalLabel:   formatRupiah(119000),
		PointsEarned: 50,
		Year:         time.Now().Year(),
	}

	tmpl, err := template.New("invoice").Parse(invoiceTemplate)
	if err != nil {
		c.JSON(500, gin.H{"error": "template parse: " + err.Error()})
		return
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, sample); err != nil {
		c.JSON(500, gin.H{"error": "template execute: " + err.Error()})
		return
	}

	subject := "[TEST] Invoice " + sample.TransactionCode + " — " + businessName
	if err := sendHTMLEmail(req.To, "Test Customer", subject, buf.String()); err != nil {
		c.JSON(500, gin.H{"error": "SMTP send failed: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"message": "Test invoice sent",
		"to":      req.To,
		"from":    os.Getenv("SMTP_FROM"),
	})
}
