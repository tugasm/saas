package main

import (
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// pointsPerRupiah menentukan berapa rupiah yang diperlukan untuk 1 poin.
// Ubah konstanta ini untuk menyesuaikan kebijakan poin.
const pointsPerRupiah = 10_000

// ---------- Midtrans client ----------

func midtransIsProduction() bool {
	return os.Getenv("MIDTRANS_IS_PRODUCTION") == "true"
}

// finishRedirectURL mengembalikan deep-link yang dibuka Midtrans setelah pembayaran selesai.
// Default: "baxter://payment/finish" (deep-link Flutter). Override via env MIDTRANS_FINISH_URL.
func finishRedirectURL() string {
	if u := os.Getenv("MIDTRANS_FINISH_URL"); u != "" {
		return u
	}
	return "baxter://payment/finish"
}

func midtransSnapEndpoint() string {
	if midtransIsProduction() {
		return "https://app.midtrans.com/snap/v1/transactions"
	}
	return "https://app.sandbox.midtrans.com/snap/v1/transactions"
}

func midtransStatusEndpoint(orderID string) string {
	if midtransIsProduction() {
		return fmt.Sprintf("https://api.midtrans.com/v2/%s/status", orderID)
	}
	return fmt.Sprintf("https://api.sandbox.midtrans.com/v2/%s/status", orderID)
}

func midtransAuthHeader() string {
	key := os.Getenv("MIDTRANS_SERVER_KEY")
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(key+":"))
}

func midtransCreateSnap(orderID string, svc Service, user User) (string, error) {
	payload := map[string]interface{}{
		"transaction_details": map[string]interface{}{
			"order_id":     orderID,
			"gross_amount": int64(svc.Price),
		},
		"item_details": []map[string]interface{}{
			{
				"id":       fmt.Sprintf("pkg-%d", svc.ID),
				"price":    int64(svc.Price),
				"quantity": 1,
				"name":     svc.Name,
			},
		},
		"customer_details": map[string]interface{}{
			"first_name": user.Name,
			"email":      user.Email,
			"phone":      user.Phone,
		},
		"credit_card": map[string]interface{}{"secure": true},
		"callbacks": map[string]string{
			"finish": finishRedirectURL(),
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, midtransSnapEndpoint(), strings.NewReader(string(body)))
	if err != nil {
		return "", fmt.Errorf("midtrans snap: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", midtransAuthHeader())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("midtrans snap: request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("midtrans snap: status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil || result.Token == "" {
		return "", fmt.Errorf("midtrans snap: unexpected response: %s", string(respBody))
	}
	return result.Token, nil
}

type midtransStatusResult struct {
	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	PaymentType       string `json:"payment_type"`
}

func midtransFetchStatus(orderID string) (*midtransStatusResult, error) {
	req, err := http.NewRequest(http.MethodGet, midtransStatusEndpoint(orderID), nil)
	if err != nil {
		return nil, fmt.Errorf("midtrans status: build request: %w", err)
	}
	req.Header.Set("Authorization", midtransAuthHeader())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("midtrans status: request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result midtransStatusResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("midtrans status: decode: %w", err)
	}
	return &result, nil
}

// computeMidtransSignature menghitung SHA512(order_id + status_code + gross_amount + SERVER_KEY).
func computeMidtransSignature(orderID, statusCode, grossAmount string) string {
	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	raw := orderID + statusCode + grossAmount + serverKey
	h := sha512.Sum512([]byte(raw))
	return fmt.Sprintf("%x", h)
}

// verifyMidtransSignature membandingkan signature yang diterima dengan yang dihitung.
func verifyMidtransSignature(orderID, statusCode, grossAmount, received string) bool {
	return computeMidtransSignature(orderID, statusCode, grossAmount) == received
}

// notifStringField membaca field dari notif sebagai string.
// Midtrans resmi kirim string ("400000.00"), tapi handle number juga untuk keamanan.
func notifStringField(notif map[string]interface{}, key string) string {
	switch v := notif[key].(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', 2, 64)
	case int64:
		return strconv.FormatInt(v, 10)
	}
	return ""
}

// tail16 mengembalikan 16 karakter terakhir dari string — untuk log signature tanpa expose full hash.
func tail16(s string) string {
	if len(s) <= 16 {
		return s
	}
	return s[len(s)-16:]
}

// ---------- order ID ----------

// generateMembOrderID menghasilkan ID unik format MBX-{unixMillis}-{rand4}.
func generateMembOrderID() string {
	b := make([]byte, 3)
	rand.Read(b)
	suffix := base64.URLEncoding.EncodeToString(b)[:4]
	return fmt.Sprintf("MBX-%d-%s", time.Now().UnixMilli(), suffix)
}

// ---------- repository ----------

// repoFindPackage mencari service membership berdasarkan ID.
// Validasi category='membership' mencegah penggunaan service non-membership sebagai paket.
func repoFindPackage(id uint) (*Service, error) {
	var svc Service
	if err := DB.Where("id = ? AND category = 'membership' AND is_active = true", id).First(&svc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("membership service find: %w", err)
	}
	return &svc, nil
}

func repoFindVehicleForUser(vehicleID, userID uint) (*Vehicle, error) {
	var v Vehicle
	if err := DB.Where("id = ? AND user_id = ?", vehicleID, userID).First(&v).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("vehicle find: %w", err)
	}
	return &v, nil
}

func repoCreateVehicle(userID uint, vType, plate, brand, model, color string, year int) (*Vehicle, error) {
	v := Vehicle{
		UserID:       userID,
		Type:         vType,
		LicensePlate: plate,
		Brand:        brand,
		Model:        model,
		Color:        color,
		Year:         year,
	}
	if err := DB.Create(&v).Error; err != nil {
		return nil, fmt.Errorf("vehicle create: %w", err)
	}
	return &v, nil
}

// ---------- membership activation (dipanggil dari webhook) ----------

// activateMembershipOnPayment mengaktifkan atau memperpanjang membership setelah pembayaran sukses.
//
// Case 1 — Perpanjang: ada membership aktif (end_date > now) untuk vehicle → extend end_date.
// Case 2 — Baru/expired: tidak ada yang aktif → buat membership baru mulai dari sekarang.
func activateMembershipOnPayment(userID, vehicleID, packageID, transactionID uint, durationMonths int) error {
	now := time.Now()

	// Gunakan nil jika 0 — mencegah FK violation (tidak ada service/transaction dengan id=0)
	var pkgIDPtr *uint
	if packageID > 0 {
		pkgIDPtr = &packageID
	}
	var txIDPtr *uint
	if transactionID > 0 {
		txIDPtr = &transactionID
	}

	// Cari membership terakhir dengan end_date konkret (skip pending yang end_date-nya NULL)
	var existing Membership
	err := DB.Where("vehicle_id = ? AND end_date IS NOT NULL", vehicleID).
		Order("end_date DESC").
		First(&existing).Error

	if err == nil && existing.Status == "active" && existing.EndDate != nil && existing.EndDate.After(now) {
		// PERPANJANG: tambah durasi dari end_date yang ada
		newEnd := existing.EndDate.AddDate(0, durationMonths, 0)
		if updateErr := DB.Model(&existing).Updates(map[string]interface{}{
			"end_date":       newEnd,
			"package_id":     pkgIDPtr,
			"transaction_id": txIDPtr,
		}).Error; updateErr != nil {
			return updateErr
		}
		// Bersihkan pending row agar tidak menumpuk
		DB.Model(&Membership{}).
			Where("vehicle_id = ? AND status = 'pending'", vehicleID).
			Update("status", "cancelled")
		return nil
	}

	// BARU / EXPIRED: mulai dari sekarang
	// Expire + soft-delete membership aktif/expired lama, cancel pending
	DB.Exec(
		"UPDATE memberships SET status='expired', deleted_at=? WHERE vehicle_id=? AND status IN ('active','expired') AND deleted_at IS NULL",
		now, vehicleID,
	)
	DB.Exec(
		"UPDATE memberships SET status='cancelled', deleted_at=? WHERE vehicle_id=? AND status='pending' AND deleted_at IS NULL",
		now, vehicleID,
	)

	endDate := now.AddDate(0, durationMonths, 0)
	return DB.Create(&Membership{
		UserID:        userID,
		VehicleID:     vehicleID,
		PackageID:     pkgIDPtr,
		Status:        "active",
		StartDate:     &now,
		EndDate:       &endDate,
		TransactionID: txIDPtr,
	}).Error
}

// ---------- handler: POST /api/customer/membership ----------

type createMembershipReq struct {
	PackageID uint `json:"package_id" binding:"required"`
	VehicleID uint `json:"vehicle_id"` // untuk perpanjang kendaraan yang sudah ada
	Vehicle   *struct {
		Type         string `json:"type"`          // "car" | "motorcycle"
		LicensePlate string `json:"license_plate"` // wajib untuk kendaraan baru
		Brand        string `json:"brand"`
		Model        string `json:"model"`
		Year         int    `json:"year"`
		Color        string `json:"color"`
	} `json:"vehicle"` // untuk mendaftarkan kendaraan baru
}

func createMembershipOrder(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req createMembershipReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "ERR_REQUEST"})
		return
	}

	var user User
	if err := DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user tidak ditemukan", "code": "ERR_USER"})
		return
	}

	// Harga & durasi WAJIB dari DB — jangan percaya client
	pkg, err := repoFindPackage(req.PackageID)
	if err != nil {
		log.Printf("[ERROR] createMembershipOrder: load package %d: %v", req.PackageID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat paket", "code": "ERR_DB"})
		return
	}
	if pkg == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "paket tidak ditemukan", "code": "ERR_PACKAGE_NOT_FOUND"})
		return
	}

	// Resolusi kendaraan
	var vehicle *Vehicle
	switch {
	case req.VehicleID != 0:
		vehicle, err = repoFindVehicleForUser(req.VehicleID, userID)
		if err != nil {
			log.Printf("[ERROR] createMembershipOrder: find vehicle %d: %v", req.VehicleID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memuat kendaraan", "code": "ERR_DB"})
			return
		}
		if vehicle == nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "kendaraan tidak ditemukan atau bukan milik Anda", "code": "ERR_VEHICLE_FORBIDDEN"})
			return
		}
		if vehicle.Type != pkg.VehicleType {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "tipe kendaraan tidak cocok dengan paket", "code": "ERR_TYPE_MISMATCH"})
			return
		}

	case req.Vehicle != nil:
		if req.Vehicle.Type == "" || req.Vehicle.LicensePlate == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type dan license_plate wajib diisi", "code": "ERR_VEHICLE_FIELDS"})
			return
		}
		if req.Vehicle.Type != pkg.VehicleType {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "tipe kendaraan tidak cocok dengan paket", "code": "ERR_TYPE_MISMATCH"})
			return
		}
		vehicle, err = repoCreateVehicle(userID, req.Vehicle.Type, req.Vehicle.LicensePlate,
			req.Vehicle.Brand, req.Vehicle.Model, req.Vehicle.Color, req.Vehicle.Year)
		if err != nil {
			log.Printf("[ERROR] createMembershipOrder: create vehicle: %v", err)
			msg := "gagal mendaftarkan kendaraan"
			if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "23505") {
				msg = "plat nomor sudah terdaftar"
			}
			c.JSON(http.StatusConflict, gin.H{"error": msg, "code": "ERR_VEHICLE_CREATE"})
			return
		}

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "vehicle_id atau vehicle wajib diisi", "code": "ERR_VEHICLE_REQUIRED"})
		return
	}

	orderID := generateMembOrderID()
	refID := vehicle.ID

	// Buat transaksi dengan status pending
	tx := Transaction{
		UserID:          &userID,
		TransactionCode: orderID,
		TxType:          "membership",
		ReferenceID:     &refID,
		TotalAmount:     float64(pkg.Price),
		Status:          "pending",
	}
	if err := DB.Create(&tx).Error; err != nil {
		log.Printf("[ERROR] createMembershipOrder: create transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membuat transaksi", "code": "ERR_TX_CREATE"})
		return
	}

	// Buat transaction item
	DB.Create(&TransactionItem{
		TransactionID: tx.ID,
		Name:          pkg.Name,
		Quantity:      1,
		BasePrice:     float64(pkg.Price),
		FinalPrice:    float64(pkg.Price),
		Subtotal:      float64(pkg.Price),
	})

	// Buat membership pending sebagai jejak awal; tanggal akan diisi saat webhook settlement
	pkgID := pkg.ID
	if err := DB.Create(&Membership{
		UserID:        userID,
		VehicleID:     vehicle.ID,
		PackageID:     &pkgID,
		Status:        "pending",
		TransactionID: &tx.ID,
	}).Error; err != nil {
		// Non-fatal tapi harus diketahui — pending list tidak akan tampil tanpa row ini
		log.Printf("[ERROR] createMembershipOrder: create pending membership user=%d vehicle=%d: %v", userID, vehicle.ID, err)
	}

	// Minta Snap token ke Midtrans (server key hanya di sisi server)
	snapToken, err := midtransCreateSnap(orderID, *pkg, user)
	if err != nil {
		log.Printf("[ERROR] createMembershipOrder: snap create order_id=%s: %v", orderID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "gagal membuat sesi pembayaran", "code": "ERR_SNAP"})
		return
	}

	DB.Model(&tx).Update("snap_token", snapToken)

	log.Printf("[INFO] createMembershipOrder: created order_id=%s user=%d vehicle=%d pkg=%d", orderID, userID, vehicle.ID, pkg.ID)

	// Kirim notif pending + simpan ke inbox notifikasi (fire-and-forget)
	go sendMembershipPendingNotification(userID, pkg.Name, vehicle.LicensePlate, orderID, snapToken)

	c.JSON(http.StatusCreated, gin.H{
		"order_id":     orderID,
		"snap_token":   snapToken,
		"gross_amount": pkg.Price,
	})
}

// ---------- handler: POST /api/payment/midtrans/notification ----------

func midtransNotification(c *gin.Context) {
	var notif map[string]interface{}
	if err := c.ShouldBindJSON(&notif); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body", "code": "ERR_BODY"})
		return
	}

	// Log raw body di awal — penting untuk debug signature mismatch
	rawBytes, _ := json.Marshal(notif)
	rawStr := string(rawBytes)
	log.Printf("[MIDTRANS] incoming notification: %s", rawStr)

	orderID, _ := notif["order_id"].(string)
	statusCode, _ := notif["status_code"].(string)
	txStatus, _ := notif["transaction_status"].(string)
	fraudStatus, _ := notif["fraud_status"].(string)
	paymentType, _ := notif["payment_type"].(string)
	signatureKey, _ := notif["signature_key"].(string)

	// gross_amount bisa datang sebagai string ("400000.00") atau number (400000.00)
	// Midtrans resmi kirim string, tapi handle keduanya agar robust
	grossAmount := notifStringField(notif, "gross_amount")

	log.Printf("[MIDTRANS] fields: order_id=%s status_code=%s gross_amount=%s tx_status=%s fraud=%s payment=%s",
		orderID, statusCode, grossAmount, txStatus, fraudStatus, paymentType)

	// 1. Verifikasi signature
	computed := computeMidtransSignature(orderID, statusCode, grossAmount)
	sigMatch := computed == signatureKey
	log.Printf("[MIDTRANS] signature check: match=%v computed_tail=...%s received_tail=...%s",
		sigMatch, tail16(computed), tail16(signatureKey))

	if !sigMatch {
		log.Printf("[MIDTRANS] WARN: signature mismatch — order_id=%s order_id+status+amount=%s+%s+%s",
			orderID, orderID, statusCode, grossAmount)
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid signature", "code": "ERR_SIGNATURE"})
		return
	}

	// 2. Re-fetch status dari Midtrans (anti-spoofing)
	if fetched, fetchErr := midtransFetchStatus(orderID); fetchErr == nil {
		log.Printf("[MIDTRANS] re-fetch OK: tx_status=%s fraud=%s payment=%s",
			fetched.TransactionStatus, fetched.FraudStatus, fetched.PaymentType)
		txStatus = fetched.TransactionStatus
		fraudStatus = fetched.FraudStatus
		paymentType = fetched.PaymentType
	} else {
		log.Printf("[MIDTRANS] WARN: re-fetch failed order_id=%s: %v — pakai data dari notifikasi", orderID, fetchErr)
	}

	// 3. Load transaksi
	var transaction Transaction
	if err := DB.Where("transaction_code = ?", orderID).First(&transaction).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("[MIDTRANS] WARN: transaction not found order_id=%s — return 200 agar Midtrans berhenti retry", orderID)
			c.JSON(http.StatusOK, gin.H{"message": "unknown order"})
			return
		}
		log.Printf("[MIDTRANS] ERROR: db error loading transaction order_id=%s: %v", orderID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error", "code": "ERR_DB"})
		return
	}
	log.Printf("[MIDTRANS] transaction found: id=%d current_status=%s tx_type=%s ref_id=%v user_id=%v",
		transaction.ID, transaction.Status, transaction.TxType, transaction.ReferenceID, transaction.UserID)

	// 4. Idempoten
	if transaction.Status == "paid" {
		log.Printf("[MIDTRANS] already processed order_id=%s — skip", orderID)
		c.JSON(http.StatusOK, gin.H{"message": "already processed"})
		return
	}

	// 5. Tentukan hasil berdasarkan transaction_status
	// "settlement" = e-wallet/VA/qris; "capture"+"accept" = kartu kredit
	isSettlement := txStatus == "settlement" || (txStatus == "capture" && fraudStatus == "accept")
	log.Printf("[MIDTRANS] processing: tx_status=%s fraud=%s is_settlement=%v", txStatus, fraudStatus, isSettlement)

	if isSettlement {
		now := time.Now()
		if err := DB.Model(&transaction).Updates(map[string]interface{}{
			"status":           "paid",
			"payment_type":     paymentType,
			"paid_at":          &now,
			"raw_notification": rawStr,
		}).Error; err != nil {
			log.Printf("[MIDTRANS] ERROR: update transaction %s: %v", orderID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error", "code": "ERR_DB"})
			return
		}
		log.Printf("[MIDTRANS] transaction marked paid: order_id=%s payment_type=%s", orderID, paymentType)

		// pkgID dideklarasi di sini agar bisa dipakai di blok poin di bawah
		var pkgID uint

		// Aktivasi/perpanjang membership (hanya untuk tipe membership)
		if transaction.TxType == "membership" && transaction.ReferenceID != nil && transaction.UserID != nil {
			vehicleID := *transaction.ReferenceID
			userID := *transaction.UserID
			durationMonths := 1

			// Ambil packageID & durationMonths dari pending membership milik transaksi ini
			var pendingMem Membership
			if DB.Where("transaction_id = ? AND status = 'pending'", transaction.ID).First(&pendingMem).Error == nil {
				if pendingMem.PackageID != nil {
					pkgID = *pendingMem.PackageID
					var svc Service
					if DB.First(&svc, pkgID).Error == nil {
						durationMonths = svc.DurationMonths
					}
				}
				log.Printf("[MIDTRANS] pending membership found: id=%d pkg_id=%d duration=%d months", pendingMem.ID, pkgID, durationMonths)
			} else {
				log.Printf("[MIDTRANS] WARN: no pending membership for transaction_id=%d — will create new active", transaction.ID)
			}

			if err := activateMembershipOnPayment(userID, vehicleID, pkgID, transaction.ID, durationMonths); err != nil {
				log.Printf("[MIDTRANS] ERROR: activate membership vehicle=%d: %v", vehicleID, err)
			} else {
				log.Printf("[MIDTRANS] membership activated/extended: vehicle=%d pkg=%d duration=%d months", vehicleID, pkgID, durationMonths)
			}
		}

		// Tambah poin reward
		pointsEarned := int(transaction.TotalAmount) / pointsPerRupiah
		if pointsEarned > 0 && transaction.UserID != nil {
			DB.Model(&transaction).Update("points_earned", pointsEarned)
			DB.Model(&User{}).Where("id = ?", *transaction.UserID).
				UpdateColumn("points", gorm.Expr("points + ?", pointsEarned))

			// Catat aktivitas poin — dipanggil setelah users.points diupdate
			txRef := transaction.ID
			pointTitle := "Pembayaran Membership"
			if pkgID > 0 {
				var svc Service
				if DB.Select("name").First(&svc, pkgID).Error == nil {
					pointTitle = svc.Name
				}
			}
			recordPointActivity(*transaction.UserID, pointTitle,
				"Transaksi #"+transaction.TransactionCode, "earned", pointsEarned, &txRef)
		}
		log.Printf("[MIDTRANS] points awarded: %d (total_amount=%.0f)", pointsEarned, transaction.TotalAmount)

		// Kirim FCM push notification ke user (fire-and-forget)
		go sendMembershipPaidNotification(transaction.ID)
		log.Printf("[MIDTRANS] FCM goroutine launched for tx_id=%d", transaction.ID)

	} else {
		statusMap := map[string]string{
			"pending": "pending",
			"deny":    "failed",
			"cancel":  "failed",
			"failure": "failed",
			"expire":  "expired",
		}
		newStatus, ok := statusMap[txStatus]
		if !ok {
			newStatus = "failed"
		}
		DB.Model(&transaction).Updates(map[string]interface{}{
			"status":           newStatus,
			"raw_notification": rawStr,
		})
		log.Printf("[INFO] midtrans notification: %s→%s order_id=%s", txStatus, newStatus, orderID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// ---------- handler: GET /api/customer/membership/pending ----------

type pendingMembershipResp struct {
	MembershipID   uint      `json:"membership_id"`
	OrderID        string    `json:"order_id"`
	SnapToken      string    `json:"snap_token"`
	GrossAmount    float64   `json:"gross_amount"`
	PackageName    string    `json:"package_name"`
	DurationMonths int       `json:"duration_months"`
	VehicleID      uint      `json:"vehicle_id"`
	VehicleType    string    `json:"vehicle_type"`
	LicensePlate   string    `json:"license_plate"`
	Brand          string    `json:"brand"`
	Model          string    `json:"model"`
	CreatedAt      time.Time `json:"created_at"`
}

func getPendingMemberships(c *gin.Context) {
	userID := c.GetUint("user_id")

	var memberships []Membership
	DB.Where("user_id = ? AND status = 'pending'", userID).
		Preload("Vehicle").
		Find(&memberships)

	result := make([]pendingMembershipResp, 0, len(memberships))
	for _, m := range memberships {
		if m.TransactionID == nil {
			continue
		}

		// Ambil transaksi — harus masih pending dan punya snap_token
		var tx Transaction
		if err := DB.Where("id = ? AND status = 'pending'", *m.TransactionID).First(&tx).Error; err != nil {
			continue
		}
		if tx.SnapToken == "" {
			continue
		}

		resp := pendingMembershipResp{
			MembershipID: m.ID,
			OrderID:      tx.TransactionCode,
			SnapToken:    tx.SnapToken,
			GrossAmount:  tx.TotalAmount,
			CreatedAt:    m.CreatedAt,
		}

		if m.Vehicle != nil {
			resp.VehicleID = m.Vehicle.ID
			resp.VehicleType = m.Vehicle.Type
			resp.LicensePlate = m.Vehicle.LicensePlate
			resp.Brand = m.Vehicle.Brand
			resp.Model = m.Vehicle.Model
		}

		if m.PackageID != nil {
			var svc Service
			if DB.Select("name", "duration_months").First(&svc, *m.PackageID).Error == nil {
				resp.PackageName = svc.Name
				resp.DurationMonths = svc.DurationMonths
			}
		}

		result = append(result, resp)
	}

	c.JSON(http.StatusOK, gin.H{"pending_memberships": result})
}

// ---------- handler: GET /api/customer/transactions/:order_id ----------

// getTransactionByOrderID dipakai Flutter setelah redirect balik dari Snap
// untuk polling status pembayaran.
func getTransactionByOrderID(c *gin.Context) {
	orderID := c.Param("order_id")
	userID := c.GetUint("user_id")

	var tx Transaction
	if err := DB.Where("transaction_code = ? AND user_id = ?", orderID, userID).First(&tx).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "transaksi tidak ditemukan", "code": "ERR_NOT_FOUND"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error", "code": "ERR_DB"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"order_id": tx.TransactionCode,
		"status":   tx.Status,
	})
}
