package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func currentShiftDate() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

func getActiveShift(userID uint) (*Shift, error) {
	var shift Shift
	err := DB.Preload("Cashier").
		Where("cashier_id = ? AND status = ?", userID, "open").
		Order("opened_at desc").
		First(&shift).Error
	if err != nil {
		return nil, err
	}
	return &shift, nil
}

func requireShiftForCashier(c *gin.Context) (*Shift, bool) {
	role := c.GetString("role")
	if role != "cashier" {
		return nil, true
	}

	shift, err := getActiveShift(c.GetUint("user_id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Shift belum dibuka. Masukkan start balance terlebih dahulu."})
		return nil, false
	}
	return shift, true
}

func shiftSummary(shiftID uint) gin.H {
	type TotalRow struct {
		Type   string
		Amount float64
	}
	var rows []TotalRow
	DB.Raw(`
		SELECT type, COALESCE(SUM(amount), 0) as amount
		FROM cash_flows
		WHERE shift_id = ?
		GROUP BY type
	`, shiftID).Scan(&rows)

	var cashIn, cashOut float64
	for _, row := range rows {
		if row.Type == "in" || row.Type == "income" {
			cashIn += row.Amount
		}
		if row.Type == "out" || row.Type == "expense" {
			cashOut += row.Amount
		}
	}

	var cashSales float64
	var totalTransactions int64
	DB.Model(&Transaction{}).
		Where("shift_id = ? AND status = ?", shiftID, "paid").
		Count(&totalTransactions)
	DB.Model(&Transaction{}).
		Where("shift_id = ? AND status = ? AND payment_method_id = ?", shiftID, "paid", 1).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&cashSales)

	return gin.H{
		"cash_in":            cashIn,
		"cash_out":           cashOut,
		"cash_sales":         cashSales,
		"net_cashflow":       cashIn - cashOut,
		"total_transactions": totalTransactions,
	}
}

// @Summary Get All Transactions
// @Description Get list of transactions with filters
// @Tags Admin - Transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param status query string false "Transaction status" Enums(pending, paid, cancelled, failed)
// @Param start_date query string false "Start date filter (YYYY-MM-DD)"
// @Param end_date query string false "End date filter (YYYY-MM-DD)"
// @Param user_id query int false "Filter by user ID"
// @Success 200 {array} Transaction
// @Failure 401 {object} object{error=string}
// @Router /admin/transactions [get]
func getTransactions(c *gin.Context) {
	var transactions []Transaction
	query := DB.Preload("User").Preload("Cashier").Preload("Items.Service").Preload("PaymentMethod")

	// Filters
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("created_at <= ?", endDate)
	}
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	query.Order("created_at desc").Limit(limit).Find(&transactions)
	c.JSON(200, transactions)
}

func getAdvanceTransaction(c *gin.Context) {
	var transactions []Transaction

	// Mulai Query dasar dengan Preload relasi
	// Kita gunakan Model(&Transaction{}) agar GORM tahu tabel utamanya
	query := DB.Model(&Transaction{}).
		Preload("User").
		Preload("Cashier").
		Preload("Items.Service").
		Preload("PaymentMethod")

	// --- 1. Filter Payment Method (ID: 1=Cash, 2=QRIS, dll) ---
	if pmID := c.Query("payment_method_id"); pmID != "" {
		query = query.Where("transactions.payment_method_id = ?", pmID)
	}

	// --- 2. Filter Status (paid, pending, cancelled) ---
	if status := c.Query("status"); status != "" {
		query = query.Where("transactions.status = ?", status)
	}

	// --- 3. Filter Tanggal (Start & End) ---
	// Frontend mengirim format YYYY-MM-DD. Kita perlu tambahkan jam agar akurat.
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(transactions.created_at) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(transactions.created_at) <= ?", endDate)
	}

	// --- 4. Filter SEARCH (Powerful Filter) ---
	// Mencari di: Kode Transaksi, Nama Tamu, Plat Nomor (di Notes), dan Nama Member
	if search := c.Query("search"); search != "" {
		searchStr := "%" + search + "%"

		// Kita perlu JOIN ke tabel users karena kita ingin mencari berdasarkan nama member juga.
		// LEFT JOIN digunakan agar transaksi tamu (yang user_id null) tetap masuk pencarian.
		query = query.Joins("LEFT JOIN users ON users.id = transactions.user_id").
			Where(`
				transactions.transaction_code ILIKE ? OR
				transactions.notes ILIKE ? OR
				users.name ILIKE ?
			`, searchStr, searchStr, searchStr)
	}

	// --- Eksekusi Query ---
	// Order by created_at descending (terbaru diatas)
	if err := query.Order("transactions.created_at desc").Find(&transactions).Error; err != nil {
		c.JSON(500, gin.H{"error": "Gagal mengambil data transaksi: " + err.Error()})
		return
	}

	// Return format standard { "data": [...] }
	c.JSON(200, gin.H{"data": transactions})
}

// @Summary Manual Checkout (POS) with Auto-Membership Logic
// @Router /admin/transactions/manual [post]
// @Summary Manual Checkout (POS) with Membership Duration Accumulation
// @Router /admin/transactions/manual [post]
func manualCheckout(c *gin.Context) {
	cashierID := c.GetUint("user_id")
	activeShift, ok := requireShiftForCashier(c)
	if !ok {
		return
	}
	var req struct {
		UserID       *uint  `json:"user_id"`
		VehicleID    *uint  `json:"vehicle_id"`
		CustomerName string `json:"customer_name"`
		Items        []struct {
			ServiceID uint `json:"service_id"`
			Quantity  int  `json:"quantity"`
		} `json:"items" binding:"required"`
		PaymentMethodID   uint   `json:"payment_method_id" binding:"required"`
		Notes             string `json:"notes"`
		CustomerEmail     string `json:"customer_email"`
		GuestPlate        string `json:"guest_plate"`
		GuestVehicleModel string `json:"guest_vehicle_model"`
		UsePoints         bool   `json:"use_points"` // Bayar item redeemable dengan poin
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// 1. Cek Status Membership User Saat Ini (Untuk validasi diskon service lain)
	isExistingMember := false
	var currentMembership Membership

	if req.UserID != nil && req.VehicleID != nil {
		// Cek membership aktif user+vehicle ini
		err := DB.Where("user_id = ? AND vehicle_id = ? AND status = 'active' AND end_date >= ?",
			*req.UserID, *req.VehicleID, time.Now()).First(&currentMembership).Error
		if err == nil {
			isExistingMember = true
		}
	}

	// 2. LOGIC BARU: Cek & Akumulasi Durasi Membership di Keranjang
	// Kita harus loop dulu untuk menghitung total durasi jika beli > 1 item membership
	isBuyingMembership := false
	totalMembershipMonths := 0

	for _, itemReq := range req.Items {
		var s Service
		// Cek service di DB (Error handling skip dulu disini, nanti di loop utama dicek lagi)
		if err := DB.First(&s, itemReq.ServiceID).Error; err == nil {
			if s.Category == "membership" {
				isBuyingMembership = true
				// Rumus: Durasi per produk * Jumlah yang dibeli
				// Misal: Beli 2x "Paket 1 Bulan" = 2 Bulan tambahan
				totalMembershipMonths += (s.DurationMonths * itemReq.Quantity)
			}
		}
	}

	// Auto-resolve User & Vehicle dari email + plat (saat beli membership tanpa member mode)
	if isBuyingMembership && (req.UserID == nil || req.VehicleID == nil) {
		email := strings.TrimSpace(strings.ToLower(req.CustomerEmail))
		if email == "" || req.CustomerName == "" || req.GuestPlate == "" {
			c.JSON(400, gin.H{"error": "Email, nama, dan plat nomor wajib diisi untuk registrasi membership"})
			return
		}

		// Lookup user by email (case-insensitive); create kalau belum ada
		var user User
		if err := DB.Where("LOWER(email) = ?", email).First(&user).Error; err != nil {
			user = User{
				Email:    email,
				Name:     req.CustomerName,
				Role:     "customer",
				IsActive: true,
			}
			if err := DB.Create(&user).Error; err != nil {
				c.JSON(500, gin.H{"error": "Gagal membuat akun pelanggan: " + err.Error()})
				return
			}
		}

		// Lookup vehicle by plat (normalized); create kalau belum ada
		normalizedPlate := strings.ToUpper(strings.ReplaceAll(req.GuestPlate, " ", ""))
		var vehicle Vehicle
		err := DB.Where("UPPER(REPLACE(license_plate, ' ', '')) = ?", normalizedPlate).First(&vehicle).Error
		if err == nil {
			if vehicle.UserID != user.ID {
				c.JSON(400, gin.H{"error": "Plat nomor sudah terdaftar atas akun lain"})
				return
			}
		} else {
			vehicle = Vehicle{
				UserID:       user.ID,
				LicensePlate: normalizedPlate,
				Model:        req.GuestVehicleModel,
			}
			if err := DB.Create(&vehicle).Error; err != nil {
				c.JSON(500, gin.H{"error": "Gagal membuat data kendaraan: " + err.Error()})
				return
			}
		}

		req.UserID = &user.ID
		req.VehicleID = &vehicle.ID
	}

	// 3. Tentukan Hak Diskon
	// Diskon berlaku jika: Sudah Member ATAU Sedang Beli Member di struk ini
	eligibleForDiscount := isExistingMember || isBuyingMembership

	// --- MULAI HITUNG TRANSAKSI ---
	pmID := req.PaymentMethodID
	transaction := Transaction{
		TransactionCode: generateTransactionCode(),
		Status:          "pending", // Dikonfirmasi saat pembayaran via confirmPayment
		PaymentMethodID: &pmID,
		CashierID:       &cashierID,
		UserID:          req.UserID,
		VehicleID:       req.VehicleID,
		Notes:           req.Notes,
	}
	if activeShift != nil {
		transaction.ShiftID = &activeShift.ID
	}

	var totalAmount float64
	var totalPoints int
	var totalPointsUsed int
	var transactionItems []TransactionItem

	for _, itemReq := range req.Items {
		var service Service
		if err := DB.First(&service, itemReq.ServiceID).Error; err != nil {
			c.JSON(400, gin.H{"error": "Service not found"})
			return
		}

		basePrice := service.Price
		discountAmount := 0.0
		finalPrice := basePrice

		if req.UsePoints && service.PointsPrice > 0 {
			// Item ini dibayar dengan poin — gratis secara cash
			discountAmount = basePrice
			finalPrice = 0
			totalPointsUsed += service.PointsPrice * itemReq.Quantity
			// Tidak menambah poin earned untuk item yang dibayar poin
		} else {
			if eligibleForDiscount && service.Category != "membership" {
				discountAmount = basePrice * (service.MemberDiscountPct / 100)
				finalPrice = basePrice - discountAmount
			}
			totalPoints += service.PointsAwarded * itemReq.Quantity
		}

		subtotal := finalPrice * float64(itemReq.Quantity)
		totalAmount += subtotal

		transactionItems = append(transactionItems, TransactionItem{
			ServiceID:      service.ID,
			Quantity:       itemReq.Quantity,
			BasePrice:      basePrice,
			DiscountAmount: discountAmount,
			FinalPrice:     finalPrice,
			Subtotal:       subtotal,
		})
	}

	// Validasi poin cukup sebelum mulai transaksi
	if req.UsePoints && totalPointsUsed > 0 {
		if req.UserID == nil {
			c.JSON(400, gin.H{"error": "user_id diperlukan untuk bayar dengan poin"})
			return
		}
		var customerUser User
		if err := DB.Select("points").First(&customerUser, *req.UserID).Error; err != nil {
			c.JSON(404, gin.H{"error": "user tidak ditemukan"})
			return
		}
		if customerUser.Points < totalPointsUsed {
			c.JSON(400, gin.H{"error": fmt.Sprintf("poin tidak cukup: punya %d, butuh %d", customerUser.Points, totalPointsUsed)})
			return
		}
	}

	transaction.TotalAmount = totalAmount
	transaction.PointsEarned = totalPoints
	transaction.PointsUsed = totalPointsUsed

	// Tentukan payment type
	if req.UsePoints && totalPointsUsed > 0 {
		if totalAmount == 0 {
			transaction.PaymentType = "points"
		} else {
			transaction.PaymentType = "mixed"
		}
	}

	// Database Transaction START
	tx := DB.Begin()

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed create trx header"})
		return
	}

	for i := range transactionItems {
		transactionItems[i].TransactionID = transaction.ID
	}
	if err := tx.Create(&transactionItems).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed create trx items"})
		return
	}

	tx.Commit()

	DB.Preload("Items.Service").Preload("PaymentMethod").First(&transaction, transaction.ID)
	c.JSON(200, transaction)
}

// getOpenTransactions returns all transactions with status "pending" for the open bills panel.
func getOpenTransactions(c *gin.Context) {
	var transactions []Transaction
	DB.Where("status = 'pending'").
		Preload("User").
		Preload("Items.Service").
		Preload("PaymentMethod").
		Order("created_at desc").
		Find(&transactions)
	c.JSON(200, transactions)
}

// addItemsToTransaction appends items to an open (pending) transaction.
func addItemsToTransaction(c *gin.Context) {
	id := c.Param("id")
	cashierID := c.GetUint("user_id")

	var transaction Transaction
	if err := DB.Preload("Items.Service").First(&transaction, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Transaksi tidak ditemukan"})
		return
	}
	if transaction.Status != "pending" {
		c.JSON(400, gin.H{"error": "Hanya transaksi pending yang bisa ditambah item"})
		return
	}

	var req struct {
		Items []struct {
			ServiceID int `json:"service_id"`
			Quantity  int `json:"quantity"`
		} `json:"items"`
		UsePoints bool `json:"use_points"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Items) == 0 {
		c.JSON(400, gin.H{"error": "items diperlukan"})
		return
	}

	// Determine discount eligibility from existing transaction context
	var isEligibleForDiscount bool
	if transaction.UserID != nil {
		var mem Membership
		err := DB.Where("user_id = ? AND status = 'active' AND end_date > ?", *transaction.UserID, time.Now()).First(&mem).Error
		isEligibleForDiscount = err == nil
	}

	var newItems []TransactionItem
	var addedAmount float64
	var addedPoints int
	var addedPointsUsed int

	for _, itemReq := range req.Items {
		var service Service
		if err := DB.First(&service, itemReq.ServiceID).Error; err != nil {
			c.JSON(400, gin.H{"error": fmt.Sprintf("service %d tidak ditemukan", itemReq.ServiceID)})
			return
		}

		basePrice := service.Price
		discountAmount := 0.0
		finalPrice := basePrice

		if req.UsePoints && service.PointsPrice > 0 {
			discountAmount = basePrice
			finalPrice = 0
			addedPointsUsed += service.PointsPrice * itemReq.Quantity
		} else {
			if isEligibleForDiscount && service.Category != "membership" {
				discountAmount = basePrice * (service.MemberDiscountPct / 100)
				finalPrice = basePrice - discountAmount
			}
			addedPoints += service.PointsAwarded * itemReq.Quantity
		}

		subtotal := finalPrice * float64(itemReq.Quantity)
		addedAmount += subtotal

		newItems = append(newItems, TransactionItem{
			TransactionID:  transaction.ID,
			ServiceID:      service.ID,
			Quantity:       itemReq.Quantity,
			BasePrice:      basePrice,
			DiscountAmount: discountAmount,
			FinalPrice:     finalPrice,
			Subtotal:       subtotal,
		})
	}

	// Validate points sufficiency if using points
	if req.UsePoints && addedPointsUsed > 0 {
		if transaction.UserID == nil {
			c.JSON(400, gin.H{"error": "user_id diperlukan untuk bayar dengan poin"})
			return
		}
		var customerUser User
		if err := DB.Select("points").First(&customerUser, *transaction.UserID).Error; err != nil {
			c.JSON(404, gin.H{"error": "user tidak ditemukan"})
			return
		}
		alreadyUsed := transaction.PointsUsed
		if customerUser.Points < alreadyUsed+addedPointsUsed {
			c.JSON(400, gin.H{"error": fmt.Sprintf("poin tidak cukup: punya %d, butuh %d", customerUser.Points, alreadyUsed+addedPointsUsed)})
			return
		}
	}

	tx := DB.Begin()
	if err := tx.Create(&newItems).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Gagal menambah item"})
		return
	}

	newTotal := transaction.TotalAmount + addedAmount
	newPointsEarned := transaction.PointsEarned + addedPoints
	newPointsUsed := transaction.PointsUsed + addedPointsUsed

	newPaymentType := transaction.PaymentType
	if newPointsUsed > 0 {
		if newTotal == 0 {
			newPaymentType = "points"
		} else {
			newPaymentType = "mixed"
		}
	}

	if err := tx.Model(&transaction).Updates(map[string]interface{}{
		"total_amount":  newTotal,
		"points_earned": newPointsEarned,
		"points_used":   newPointsUsed,
		"payment_type":  newPaymentType,
		"cashier_id":    cashierID,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Gagal update transaksi"})
		return
	}

	tx.Commit()

	DB.Preload("Items.Service").Preload("User").Preload("PaymentMethod").First(&transaction, transaction.ID)
	c.JSON(200, transaction)
}

// confirmPayment marks a pending transaction as paid and executes all side effects.
func confirmPayment(c *gin.Context) {
	id := c.Param("id")
	cashierID := c.GetUint("user_id")
	activeShift, ok := requireShiftForCashier(c)
	if !ok {
		return
	}

	var req struct {
		PaymentMethodID uint `json:"payment_method_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var transaction Transaction
	if err := DB.Preload("Items.Service").First(&transaction, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Transaksi tidak ditemukan"})
		return
	}
	if transaction.Status != "pending" {
		c.JSON(400, gin.H{"error": "Hanya transaksi pending yang bisa dikonfirmasi"})
		return
	}

	paymentMethodID := req.PaymentMethodID
	if paymentMethodID == 0 && transaction.PaymentMethodID != nil {
		paymentMethodID = *transaction.PaymentMethodID
	}

	// Override payment method to "points" PM if fully paid by points
	if transaction.PointsUsed > 0 && transaction.TotalAmount == 0 {
		var pm PaymentMethod
		if DB.Where("type = ?", "points").First(&pm).Error == nil {
			paymentMethodID = pm.ID
		}
	}

	// Determine totalMembershipMonths from items for membership activation
	var totalMembershipMonths int
	for _, item := range transaction.Items {
		if item.Service.Category == "membership" {
			totalMembershipMonths += item.Service.DurationMonths * item.Quantity
		}
	}
	isBuyingMembership := totalMembershipMonths > 0

	now := time.Now()
	tx := DB.Begin()
	shiftID := transaction.ShiftID
	if activeShift != nil {
		shiftID = &activeShift.ID
	}

	// 1. Mark paid
	paidUpdates := map[string]interface{}{
		"status":            "paid",
		"paid_at":           now,
		"payment_method_id": paymentMethodID,
		"cashier_id":        cashierID,
	}
	if shiftID != nil {
		paidUpdates["shift_id"] = *shiftID
	}
	if err := tx.Model(&transaction).Updates(paidUpdates).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Gagal konfirmasi pembayaran"})
		return
	}

	// 2. Membership activation / renewal
	if isBuyingMembership && transaction.UserID != nil && transaction.VehicleID != nil {
		var mem Membership
		err := tx.Where("user_id = ? AND vehicle_id = ?", *transaction.UserID, *transaction.VehicleID).First(&mem).Error

		startDate := now
		endDate := startDate.AddDate(0, totalMembershipMonths, 0)

		if err == nil {
			if mem.Status == "active" && mem.EndDate != nil && mem.EndDate.After(now) {
				startDate = *mem.EndDate
				endDate = startDate.AddDate(0, totalMembershipMonths, 0)
			}
			mem.Status = "active"
			mem.StartDate = &startDate
			mem.EndDate = &endDate
			mem.TransactionID = &transaction.ID
			tx.Save(&mem)
		} else {
			newMem := Membership{
				UserID:        *transaction.UserID,
				VehicleID:     *transaction.VehicleID,
				Status:        "active",
				StartDate:     &startDate,
				EndDate:       &endDate,
				TransactionID: &transaction.ID,
			}
			tx.Create(&newMem)
		}
	}

	// 3. Points: earn + deduct
	if transaction.UserID != nil {
		if transaction.PointsEarned > 0 {
			tx.Model(&User{}).Where("id = ?", *transaction.UserID).
				Update("points", gorm.Expr("points + ?", transaction.PointsEarned))
		}
		if transaction.PointsUsed > 0 {
			tx.Model(&User{}).Where("id = ?", *transaction.UserID).
				Update("points", gorm.Expr("points - ?", transaction.PointsUsed))
		}
	}

	// 4. Finance records
	tx.Create(&Ledger{
		Date:        now,
		Type:        "income",
		Category:    "service",
		Amount:      transaction.TotalAmount,
		Description: fmt.Sprintf("POS #%s", transaction.TransactionCode),
		CreatedBy:   cashierID,
	})
	if paymentMethodID == 1 { // Cash
		cashFlow := CashFlow{
			Type:        "in",
			Category:    "service",
			Amount:      transaction.TotalAmount,
			Description: fmt.Sprintf("POS Sales #%s", transaction.TransactionCode),
			CreatedBy:   cashierID,
		}
		if shiftID != nil {
			cashFlow.ShiftID = shiftID
		}
		tx.Create(&cashFlow)
	}

	tx.Commit()

	go sendInvoiceEmail(transaction.ID)
	go sendTransactionPaidNotification(transaction.ID)

	DB.Preload("Items.Service").Preload("User").Preload("PaymentMethod").First(&transaction, transaction.ID)
	c.JSON(200, transaction)
}

// @Summary Update Transaction Status
// @Description Update status of a transaction (pending/paid/cancelled/failed)
// @Tags Admin - Transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Transaction ID"
// @Param request body object{status=string} true "Status Update"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Router /admin/transactions/{id}/status [put]

func updateTransactionStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var transaction Transaction
	if err := DB.First(&transaction, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Transaction not found"})
		return
	}

	updates := map[string]interface{}{
		"status": req.Status,
	}

	if req.Status == "paid" {
		activeShift, ok := requireShiftForCashier(c)
		if !ok {
			return
		}
		now := time.Now()
		updates["paid_at"] = &now
		updates["cashier_id"] = c.GetUint("user_id")
		if activeShift != nil {
			updates["shift_id"] = activeShift.ID
		}

		// Award points
		DB.Model(&User{}).Where("id = ?", transaction.UserID).Update("points", DB.Raw("points + ?", transaction.PointsEarned))

		// Create ledger entry
		DB.Create(&Ledger{
			Date:        time.Now(),
			Type:        "income",
			Category:    "service",
			Amount:      transaction.TotalAmount,
			Description: fmt.Sprintf("Transaction %s marked as paid", transaction.TransactionCode),
			Reference:   transaction.TransactionCode,
			CreatedBy:   c.GetUint("user_id"),
		})
		if transaction.PaymentMethodID != nil && *transaction.PaymentMethodID == 1 {
			cashFlow := CashFlow{
				Type:        "in",
				Category:    "service",
				Amount:      transaction.TotalAmount,
				Description: fmt.Sprintf("Transaction %s marked as paid", transaction.TransactionCode),
				CreatedBy:   c.GetUint("user_id"),
			}
			if activeShift != nil {
				cashFlow.ShiftID = &activeShift.ID
			} else if transaction.ShiftID != nil {
				cashFlow.ShiftID = transaction.ShiftID
			}
			DB.Create(&cashFlow)
		}
	}

	DB.Model(&transaction).Updates(updates)
	logActivity(c.GetUint("user_id"), "update_transaction", fmt.Sprintf("Updated transaction %s to %s", transaction.TransactionCode, req.Status), c.ClientIP())

	// Fire invoice email + mobile push when transaction transitions to paid
	if req.Status == "paid" {
		go sendInvoiceEmail(transaction.ID)
		go sendTransactionPaidNotification(transaction.ID)
	}

	c.JSON(200, gin.H{"message": "Transaction updated"})
}

// @Summary Scan Customer QR
// @Description Decode QR and get user information
// @Tags Admin - Users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{qr_data=string} true "QR Data"
// @Success 200 {object} User
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Router /admin/scan-qr [post]

func scanCustomerQR(c *gin.Context) {
	var req struct {
		QRData string `json:"qr_data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var data map[string]interface{}
	if err := json.Unmarshal([]byte(req.QRData), &data); err != nil {
		c.JSON(400, gin.H{"error": "Invalid QR data"})
		return
	}

	userID := uint(data["user_id"].(float64))
	var user User
	if err := DB.Preload("Vehicles").Preload("Memberships.Vehicle").First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "User not found"})
		return
	}

	c.JSON(200, user)
}

// @Summary Get Membership List
// @Description Get all memberships with optional status filter
// @Tags Admin - Memberships
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param status query string false "Membership status"
// @Success 200 {array} Membership
// @Failure 401 {object} object{error=string}
// @Router /admin/memberships [get]
func getMemberships(c *gin.Context) {
	var memberships []Membership
	query := DB.Preload("User").Preload("Vehicle").Preload("Transaction")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if vehicleID := c.Query("vehicle_id"); vehicleID != "" {
		query = query.Where("vehicle_id = ?", vehicleID)
	}

	page, limit := parsePagination(c)
	offset := (page - 1) * limit

	var total int64
	query.Model(&Membership{}).Count(&total)
	query.Order("created_at desc").Limit(limit).Offset(offset).Find(&memberships)

	c.JSON(200, gin.H{
		"data":  memberships,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func SearchMember(c *gin.Context) {
	searchType := c.Query("type")  // "plate" atau "qr"
	queryParam := c.Query("query") // value, misal "B 1234 XYZ"

	if queryParam == "" {
		c.JSON(400, gin.H{"error": "Query parameter is required"})
		return
	}

	var user User
	var err error

	// --- LOGIC PENCARIAN ---
	db := DB.Preload("Vehicles") // Selalu load semua kendaraan si user

	if searchType == "plate" {
		normalized := strings.ToUpper(strings.ReplaceAll(queryParam, " ", ""))
		err = db.Joins("JOIN vehicles ON vehicles.user_id = users.id").
			Where("UPPER(REPLACE(vehicles.license_plate, ' ', '')) = ?", normalized).
			First(&user).Error

	} else if searchType == "qr" {
		// Cari berdasarkan Member Code / QR string
		err = db.Where("member_code = ?", queryParam).First(&user).Error

	} else if searchType == "email" {
		err = db.Where("LOWER(email) = ? AND role = 'customer'", strings.ToLower(queryParam)).First(&user).Error

	} else if searchType == "user_id" {
		err = db.Where("id = ? AND role = 'customer'", queryParam).First(&user).Error

	} else {
		c.JSON(400, gin.H{"error": "Invalid search type. Use 'plate', 'qr', 'email', or 'user_id'"})
		return
	}

	// --- ERROR HANDLING ---
	if err != nil {
		// Record not found
		c.JSON(404, gin.H{"error": "Member tidak ditemukan"})
		return
	}

	// --- MAPPING KE RESPONSE JSON KHUSUS ---
	// Kita map manual agar JSON outputnya bersih sesuai request kamu

	var vehicleResponses []VehicleResponse
	for _, v := range user.Vehicles {
		vehicleResponses = append(vehicleResponses, VehicleResponse{
			ID:          v.ID,
			PlateNumber: v.LicensePlate,
			Model:       v.Model,
		})
	}

	response := MemberResponse{
		ID:       user.ID,
		Name:     user.Name,
		Email:    user.Email,
		Points:   user.Points,
		Tier:     "Reguler",
		Vehicles: vehicleResponses,
	}

	c.JSON(200, response)
}

// UserAutocomplete returns top 10 customers whose email matches the query (LIKE).
// Used by cashier UI to pick existing user when buying a membership for a walk-in customer.
func UserAutocomplete(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(200, gin.H{"data": []any{}})
		return
	}

	type item struct {
		ID    uint   `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	var items []item

	DB.Model(&User{}).
		Where("role = ? AND LOWER(email) LIKE ?", "customer", "%"+strings.ToLower(q)+"%").
		Order("email asc").
		Limit(10).
		Select("id, email, name").
		Find(&items)

	c.JSON(200, gin.H{"data": items})
}

func getUsers(c *gin.Context) {
	var users []User
	query := DB.Model(&User{})

	page, limit := parsePagination(c)
	offset := (page - 1) * limit

	var total int64
	query.Count(&total)
	query.Order("created_at desc").Limit(limit).Offset(offset).Find(&users)

	c.JSON(200, gin.H{
		"data":  users,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// @Summary Get Vehicle List
// @Description Get all registered vehicles
// @Tags Admin - Vehicles
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} Vehicle
// @Router /admin/vehicles [get]
func getVehicles(c *gin.Context) {
	var vehicles []Vehicle
	query := DB.Preload("User").Preload("Memberships")

	page, limit := parsePagination(c)
	offset := (page - 1) * limit

	var total int64
	DB.Model(&Vehicle{}).Count(&total)
	query.Order("created_at desc").Limit(limit).Offset(offset).Find(&vehicles)

	c.JSON(200, gin.H{
		"data":  vehicles,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func createVehicleAdmin(c *gin.Context) {
	var req struct {
		UserID       uint   `json:"user_id" binding:"required"`
		Type         string `json:"type" binding:"required"` // car, bike
		Brand        string `json:"brand" binding:"required"`
		Model        string `json:"model" binding:"required"`
		Year         int    `json:"year" binding:"required"`
		Color        string `json:"color" binding:"required"`
		LicensePlate string `json:"license_plate" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	vehicle := Vehicle{
		UserID:       req.UserID,
		Type:         req.Type,
		Brand:        req.Brand,
		Model:        req.Model,
		Year:         req.Year,
		Color:        req.Color,
		LicensePlate: req.LicensePlate,
	}

	if err := DB.Create(&vehicle).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create vehicle: " + err.Error()})
		return
	}

	c.JSON(200, vehicle)
}

// @Summary Get Monthly Report
// @Description Get detailed monthly report with statistics
// @Tags Admin - Reports
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param year query int false "Year (default: current year)"
// @Param month query int false "Month (default: current month)"
// @Success 200 {object} object{total_revenue=float64,total_transactions=int,service_stats=object,cash_in=float64,cash_out=float64,net_income=float64,transactions=[]Transaction}
// @Failure 401 {object} object{error=string}
// @Router /admin/reports/monthly [get]
func getMonthlyReport(c *gin.Context) {
	// 1. Ambil Parameter sebagai String
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	monthStr := c.DefaultQuery("month", strconv.Itoa(int(time.Now().Month())))

	// 2. Konversi ke Integer
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		year = time.Now().Year()
	}
	month, err := strconv.Atoi(monthStr)
	if err != nil {
		month = int(time.Now().Month())
	}

	// 3. Logic Waktu yang Benar (Menggunakan time.Date)
	// Start Date: Tanggal 1 bulan tersebut, jam 00:00:00
	location := time.Local // Sesuaikan dengan timezone server/DB kamu (bisa time.UTC)
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, location)

	// End Date: Start Date + 1 Bulan (Ini otomatis menangani ganti tahun/jumlah hari)
	// Kita pakai logika: created_at >= startDate AND created_at < nextMonth
	nextMonthDate := startDate.AddDate(0, 1, 0)

	// 4. Aggregate revenue & count langsung di SQL (tidak load semua row ke memory)
	var summary struct {
		TotalRevenue      float64 `json:"total_revenue"`
		TotalTransactions int     `json:"total_transactions"`
	}
	if err := DB.Raw(`
		SELECT COALESCE(SUM(total_amount), 0) as total_revenue,
		       COUNT(*) as total_transactions
		FROM transactions
		WHERE status = 'paid' AND created_at >= ? AND created_at < ?
	`, startDate, nextMonthDate).Scan(&summary).Error; err != nil {
		c.JSON(500, gin.H{"error": "Database error: " + err.Error()})
		return
	}

	// 5. Service stats aggregate di SQL
	type ServiceStat struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	var serviceStatsArr []ServiceStat
	DB.Raw(`
		SELECT COALESCE(s.name, 'Unknown Service') as name,
		       SUM(ti.quantity) as count
		FROM transaction_items ti
		JOIN transactions t ON ti.transaction_id = t.id
		LEFT JOIN services s ON ti.service_id = s.id
		WHERE t.status = 'paid' AND t.created_at >= ? AND t.created_at < ?
		GROUP BY s.name
		ORDER BY count DESC
	`, startDate, nextMonthDate).Scan(&serviceStatsArr)

	serviceStats := make(map[string]int)
	for _, ss := range serviceStatsArr {
		serviceStats[ss.Name] = ss.Count
	}

	// 6. Cash flow aggregate di SQL
	type CashFlowSummary struct {
		Type   string  `json:"type"`
		Amount float64 `json:"amount"`
	}
	var cfSummaries []CashFlowSummary
	DB.Raw(`
		SELECT type, COALESCE(SUM(amount), 0) as amount
		FROM cash_flows
		WHERE created_at >= ? AND created_at < ?
		GROUP BY type
	`, startDate, nextMonthDate).Scan(&cfSummaries)

	var cashIn, cashOut float64
	for _, cf := range cfSummaries {
		if cf.Type == "in" || cf.Type == "income" {
			cashIn += cf.Amount
		} else if cf.Type == "out" || cf.Type == "expense" {
			cashOut += cf.Amount
		}
	}

	// 7. Tetap load transaksi untuk detail, tapi dengan LIMIT
	var transactions []Transaction
	DB.Preload("Items.Service").Preload("User").Preload("PaymentMethod").
		Where("status = ? AND created_at >= ? AND created_at < ?", "paid", startDate, nextMonthDate).
		Order("created_at desc").Limit(200).
		Find(&transactions)

	c.JSON(200, gin.H{
		"period":             startDate.Format("January 2006"),
		"total_revenue":      summary.TotalRevenue,
		"total_transactions": summary.TotalTransactions,
		"service_stats":      serviceStats,
		"cash_in":            cashIn,
		"cash_out":           cashOut,
		"net_income":         summary.TotalRevenue + cashIn - cashOut,
		"transactions":       transactions,
	})
}

// @Summary Revenue Chart
// @Description Get monthly revenue for a given year
// @Tags Admin - Reports
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param year query int false "Year"
// @Success 200 {array} object{month=int,revenue=float64}
// @Router /admin/reports/revenue-chart [get]
func getRevenueChart(c *gin.Context) {
	year := c.DefaultQuery("year", fmt.Sprintf("%d", time.Now().Year()))

	type MonthlyRevenue struct {
		Month   int     `json:"month"`
		Revenue float64 `json:"revenue"`
	}

	var dbResults []MonthlyRevenue
	DB.Raw(`
		SELECT
			EXTRACT(MONTH FROM created_at)::int as month,
			COALESCE(SUM(total_amount), 0) as revenue
		FROM transactions
		WHERE status = 'paid'
			AND EXTRACT(YEAR FROM created_at) = ?
		GROUP BY month
		ORDER BY month
	`, year).Scan(&dbResults)

	revenueMap := make(map[int]float64)
	for _, r := range dbResults {
		revenueMap[r.Month] = r.Revenue
	}

	results := make([]MonthlyRevenue, 12)
	for i := 0; i < 12; i++ {
		results[i] = MonthlyRevenue{Month: i + 1, Revenue: revenueMap[i+1]}
	}

	c.JSON(200, results)
}

// @Summary Export Transactions to Excel
// @Description Export paid transactions to XLSX file
// @Tags Admin - Transactions
// @Produce application/octet-stream
// @Security BearerAuth
// @Param start_date query string false "Start date"
// @Param end_date query string false "End date"
// @Success 200 "Excel File"
// @Router /admin/transactions/export [get]
func exportTransactions(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var transactions []Transaction
	query := DB.Preload("User").Preload("Items.Service").Preload("PaymentMethod").
		Where("status = ?", "paid")

	if startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate)
	}

	query.Find(&transactions)

	f := excelize.NewFile()
	sheet := "Transactions"
	f.NewSheet(sheet)

	headers := []string{"Transaction Code", "Date", "Customer", "Total Amount", "Payment Method", "Cashier", "Services"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	for i, t := range transactions {
		row := i + 2
		var services string
		for _, item := range t.Items {
			services += fmt.Sprintf("%s x%d, ", item.Service.Name, item.Quantity)
		}

		customerName := t.Notes // Guest name from notes
		if t.UserID != nil && t.User.ID != 0 {
			customerName = t.User.Name
		}

		cashier := ""
		if t.Cashier != nil {
			cashier = t.Cashier.Name
		}

		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), t.TransactionCode)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), t.CreatedAt.Format("2006-01-02 15:04"))
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), customerName)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), t.TotalAmount)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), t.PaymentMethod.Name)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), cashier)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), services)
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=transactions.xlsx")
	f.Write(c.Writer)
}

// @Summary Get Business Analytics
// @Description Get revenue by category, top customers, and active memberships
// @Tags Admin - Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} object{category_revenue=object,top_customers=object,active_memberships=int}
// @Router /admin/analytics [get]
func getAnalytics(c *gin.Context) {
	// Revenue by service category
	type CategoryRevenue struct {
		Category string  `json:"category"`
		Revenue  float64 `json:"revenue"`
		Count    int     `json:"count"`
	}

	var categoryRevenue []CategoryRevenue
	DB.Raw(`
		SELECT 
			s.category,
			SUM(ti.subtotal) as revenue,
			SUM(ti.quantity) as count
		FROM transaction_items ti
		JOIN services s ON ti.service_id = s.id
		JOIN transactions t ON ti.transaction_id = t.id
		WHERE t.status = 'paid'
		GROUP BY s.category
	`).Scan(&categoryRevenue)

	// Top customers
	type TopCustomer struct {
		UserID       uint    `json:"user_id"`
		Name         string  `json:"name"`
		TotalSpent   float64 `json:"total_spent"`
		Transactions int     `json:"transactions"`
	}

	var topCustomers []TopCustomer
	DB.Raw(`
		SELECT 
			u.id as user_id,
			u.name,
			SUM(t.total_amount) as total_spent,
			COUNT(*) as transactions
		FROM transactions t
		JOIN users u ON t.user_id = u.id
		WHERE t.status = 'paid'
		GROUP BY u.id, u.name
		ORDER BY total_spent DESC
		LIMIT 10
	`).Scan(&topCustomers)

	// Active memberships
	var activeMemberships int64
	DB.Model(&Membership{}).Where("status = ?", "active").Count(&activeMemberships)

	c.JSON(200, gin.H{
		"category_revenue":   categoryRevenue,
		"top_customers":      topCustomers,
		"active_memberships": activeMemberships,
	})
}

// @Summary Get Ledger Entries
// @Description Retrieve ledger entries with optional filters
// @Tags Admin - Ledger
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param start_date query string false "Start date"
// @Param end_date query string false "End date"
// @Param type query string false "Type (income/expense)"
// @Success 200 {array} Ledger
// @Router /admin/ledger [get]
func getLedger(c *gin.Context) {
	var ledgers []Ledger
	query := DB.Preload("Creator")

	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("date >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("date <= ?", endDate)
	}
	if ledgerType := c.Query("type"); ledgerType != "" {
		query = query.Where("type = ?", ledgerType)
	}

	query.Order("date desc").Find(&ledgers)
	c.JSON(200, ledgers)
}

// @Summary Create Ledger Entry
// @Description Create income or expense ledger entry
// @Tags Admin - Ledger
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Ledger true "Ledger Data"
// @Success 200 {object} Ledger
// @Failure 400 {object} object{error=string}
// @Router /admin/ledger [post]
func createLedgerEntry(c *gin.Context) {
	var ledger Ledger
	if err := c.ShouldBindJSON(&ledger); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	ledger.CreatedBy = c.GetUint("user_id")
	DB.Create(&ledger)

	logActivity(c.GetUint("user_id"), "create_ledger", fmt.Sprintf("Created ledger entry: %s", ledger.Description), c.ClientIP())
	c.JSON(200, ledger)
}

func getShifts(c *gin.Context) {
	var shifts []Shift
	query := DB.Preload("Cashier").Order("opened_at desc")

	if c.GetString("role") == "cashier" {
		query = query.Where("cashier_id = ?", c.GetUint("user_id"))
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("shift_date >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("shift_date <= ?", endDate)
	}

	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	query.Limit(limit).Find(&shifts)
	c.JSON(200, shifts)
}

func getCurrentShift(c *gin.Context) {
	shift, err := getActiveShift(c.GetUint("user_id"))
	if err != nil {
		c.JSON(200, gin.H{"shift": nil})
		return
	}

	summary := shiftSummary(shift.ID)
	expected := shift.OpeningBalance + summary["net_cashflow"].(float64)
	c.JSON(200, gin.H{
		"shift":                    shift,
		"summary":                  summary,
		"expected_closing_balance": expected,
	})
}

func openShift(c *gin.Context) {
	var req struct {
		OpeningBalance float64 `json:"opening_balance"`
		OpeningNote    string  `json:"opening_note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if req.OpeningBalance < 0 {
		c.JSON(400, gin.H{"error": "Start balance tidak boleh negatif"})
		return
	}

	userID := c.GetUint("user_id")
	if existing, err := getActiveShift(userID); err == nil {
		summary := shiftSummary(existing.ID)
		c.JSON(200, gin.H{
			"shift":                    existing,
			"summary":                  summary,
			"expected_closing_balance": existing.OpeningBalance + summary["net_cashflow"].(float64),
		})
		return
	}

	now := time.Now()
	shift := Shift{
		CashierID:              userID,
		ShiftDate:              currentShiftDate(),
		OpeningBalance:         req.OpeningBalance,
		ExpectedClosingBalance: req.OpeningBalance,
		Status:                 "open",
		OpenedAt:               now,
		OpeningNote:            req.OpeningNote,
	}
	if err := DB.Create(&shift).Error; err != nil {
		c.JSON(500, gin.H{"error": "Gagal membuka shift"})
		return
	}

	logActivity(userID, "open_shift", fmt.Sprintf("Opened shift with start balance Rp%.2f", req.OpeningBalance), c.ClientIP())
	c.JSON(200, gin.H{
		"shift":                    shift,
		"summary":                  shiftSummary(shift.ID),
		"expected_closing_balance": req.OpeningBalance,
	})
}

func closeShift(c *gin.Context) {
	var req struct {
		ClosingBalance float64 `json:"closing_balance"`
		ClosingNote    string  `json:"closing_note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if req.ClosingBalance < 0 {
		c.JSON(400, gin.H{"error": "Closing balance tidak boleh negatif"})
		return
	}

	shift, err := getActiveShift(c.GetUint("user_id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Tidak ada shift aktif"})
		return
	}

	summary := shiftSummary(shift.ID)
	expected := shift.OpeningBalance + summary["net_cashflow"].(float64)
	diff := req.ClosingBalance - expected
	if math.Abs(diff) < 0.5 {
		diff = 0
	}
	now := time.Now()

	if err := DB.Model(shift).Updates(map[string]interface{}{
		"status":                   "closed",
		"closing_balance":          req.ClosingBalance,
		"expected_closing_balance": expected,
		"difference":               diff,
		"closed_at":                now,
		"closing_note":             req.ClosingNote,
	}).Error; err != nil {
		c.JSON(500, gin.H{"error": "Gagal menutup shift"})
		return
	}

	DB.Preload("Cashier").First(shift, shift.ID)
	logActivity(c.GetUint("user_id"), "close_shift", fmt.Sprintf("Closed shift #%d difference Rp%.2f", shift.ID, diff), c.ClientIP())
	c.JSON(200, gin.H{
		"shift":                    shift,
		"summary":                  summary,
		"expected_closing_balance": expected,
		"difference":               diff,
	})
}

func getShiftReport(c *gin.Context) {
	var shift Shift
	if err := DB.Preload("Cashier").First(&shift, c.Param("id")).Error; err != nil {
		c.JSON(404, gin.H{"error": "Shift tidak ditemukan"})
		return
	}
	if c.GetString("role") == "cashier" && shift.CashierID != c.GetUint("user_id") {
		c.JSON(403, gin.H{"error": "Tidak bisa melihat shift cashier lain"})
		return
	}

	var cashFlows []CashFlow
	DB.Preload("Creator").Where("shift_id = ?", shift.ID).Order("created_at asc").Find(&cashFlows)

	var transactions []Transaction
	DB.Preload("User").Preload("Cashier").Preload("Items.Service").Preload("PaymentMethod").
		Where("shift_id = ?", shift.ID).
		Order("created_at asc").
		Find(&transactions)

	summary := shiftSummary(shift.ID)
	report, err := buildShiftReport(DB, []uint{shift.ID})
	if err != nil {
		c.JSON(500, gin.H{"error": "Gagal menghitung report shift: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{
		"shift":                    shift,
		"summary":                  summary,
		"expected_closing_balance": shift.OpeningBalance + summary["net_cashflow"].(float64),
		"cash_flows":               cashFlows,
		"transactions":             transactions,
		"report":                   report,
	})
}

func getShiftRangeReport(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" {
		startDate = currentShiftDate().Format("2006-01-02")
	}
	if endDate == "" {
		endDate = startDate
	}

	var shifts []Shift
	query := DB.Preload("Cashier").
		Where("shift_date >= ? AND shift_date <= ?", startDate, endDate).
		Order("shift_date asc, opened_at asc")
	if c.GetString("role") == "cashier" {
		query = query.Where("cashier_id = ?", c.GetUint("user_id"))
	}
	if err := query.Find(&shifts).Error; err != nil {
		c.JSON(500, gin.H{"error": "Gagal mengambil data shift"})
		return
	}

	var shiftIDs []uint
	var totalOpening, totalClosing, totalExpected, totalDifference float64
	for _, shift := range shifts {
		shiftIDs = append(shiftIDs, shift.ID)
		totalOpening += shift.OpeningBalance
		if shift.ClosingBalance != nil {
			totalClosing += *shift.ClosingBalance
		}
		summary := shiftSummary(shift.ID)
		expected := shift.OpeningBalance + summary["net_cashflow"].(float64)
		totalExpected += expected
		if shift.Status == "closed" {
			totalDifference += shift.Difference
		}
	}

	var cashFlows []CashFlow
	var transactions []Transaction
	if len(shiftIDs) > 0 {
		DB.Preload("Creator").Preload("Shift.Cashier").
			Where("shift_id IN ?", shiftIDs).
			Order("created_at asc").
			Find(&cashFlows)
		DB.Preload("User").Preload("Cashier").Preload("Items.Service").Preload("PaymentMethod").Preload("Shift.Cashier").
			Where("shift_id IN ?", shiftIDs).
			Order("created_at asc").
			Find(&transactions)
	}

	var cashIn, cashOut, cashSales float64
	for _, cf := range cashFlows {
		if cf.Type == "in" || cf.Type == "income" {
			cashIn += cf.Amount
		}
		if cf.Type == "out" || cf.Type == "expense" {
			cashOut += cf.Amount
		}
	}
	for _, trx := range transactions {
		if trx.Status == "paid" && trx.PaymentMethodID != nil && *trx.PaymentMethodID == 1 {
			cashSales += trx.TotalAmount
		}
	}

	report, err := buildShiftReport(DB, shiftIDs)
	if err != nil {
		c.JSON(500, gin.H{"error": "Gagal menghitung report shift: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"period": gin.H{
			"start_date": startDate,
			"end_date":   endDate,
		},
		"shifts": shifts,
		"summary": gin.H{
			"total_shifts":                   len(shifts),
			"total_opening_balance":          totalOpening,
			"total_closing_balance":          totalClosing,
			"total_expected_closing_balance": totalExpected,
			"total_difference":               totalDifference,
			"cash_in":                        cashIn,
			"cash_out":                       cashOut,
			"cash_sales":                     cashSales,
			"net_cashflow":                   cashIn - cashOut,
			"total_transactions":             len(transactions),
		},
		"cash_flows":   cashFlows,
		"transactions": transactions,
		"report":       report,
	})
}

// @Summary Get Cash Flow
// @Description List cash-in and cash-out records
// @Tags Admin - Cash Flow
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param start_date query string false "Start date"
// @Param end_date query string false "End date"
// @Success 200 {array} CashFlow
// @Router /admin/cashflow [get]
func getCashFlow(c *gin.Context) {
	var cashFlows []CashFlow
	query := DB.Preload("Creator").Preload("Shift.Cashier")

	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("created_at <= ?", endDate)
	}
	if shiftID := c.Query("shift_id"); shiftID != "" {
		query = query.Where("shift_id = ?", shiftID)
	}
	if c.Query("current_shift") == "true" {
		if shift, err := getActiveShift(c.GetUint("user_id")); err == nil {
			query = query.Where("shift_id = ?", shift.ID)
		} else {
			c.JSON(200, []CashFlow{})
			return
		}
	}

	query.Order("created_at desc").Find(&cashFlows)
	c.JSON(200, cashFlows)
}

// @Summary Cash In
// @Description Add income cash flow
// @Tags Admin - Cash Flow
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{amount=float64,description=string} true "Cash In Data"
// @Success 200 {object} CashFlow
// @Failure 400 {object} object{error=string}
// @Router /admin/cashflow/in [post]
func cashIn(c *gin.Context) {
	activeShift, ok := requireShiftForCashier(c)
	if !ok {
		return
	}
	var req struct {
		Amount      float64 `json:"amount" binding:"required"`
		Description string  `json:"description" binding:"required"`
		Category    string  `json:"category"` // Optional, default: "general"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Set default category jika kosong
	cat := req.Category
	if cat == "" {
		cat = "general"
	}

	cashFlow := CashFlow{
		Type:        "in",
		Category:    cat, // <-- Simpan Kategori
		Amount:      req.Amount,
		Description: req.Description,
		CreatedBy:   c.GetUint("user_id"),
	}
	if activeShift != nil {
		cashFlow.ShiftID = &activeShift.ID
	}

	DB.Create(&cashFlow)
	logActivity(c.GetUint("user_id"), "cash_in", fmt.Sprintf("Cash in: Rp%.2f - %s", req.Amount, req.Description), c.ClientIP())
	c.JSON(200, cashFlow)
}

// @Summary Cash Out
// @Description Add expense cash flow
// @Router /admin/cashflow/out [post]
func cashOut(c *gin.Context) {
	activeShift, ok := requireShiftForCashier(c)
	if !ok {
		return
	}
	var req struct {
		Amount      float64 `json:"amount" binding:"required"`
		Description string  `json:"description" binding:"required"`
		Evidence    string  `json:"evidence"`
		Category    string  `json:"category"` // Optional, default: "operational"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Set default category untuk pengeluaran manual biasanya operasional
	cat := req.Category
	if cat == "" {
		cat = "operational"
	}

	cashFlow := CashFlow{
		Type:        "out",
		Category:    cat, // <-- Simpan Kategori
		Amount:      req.Amount,
		Description: req.Description,
		Evidence:    req.Evidence,
		CreatedBy:   c.GetUint("user_id"),
	}
	if activeShift != nil {
		cashFlow.ShiftID = &activeShift.ID
	}

	DB.Create(&cashFlow)
	logActivity(c.GetUint("user_id"), "cash_out", fmt.Sprintf("Cash out: Rp%.2f - %s", req.Amount, req.Description), c.ClientIP())
	c.JSON(200, cashFlow)
}

// @Summary Get Activity Logs
// @Description Get latest admin activity logs with filters
// @Tags Admin - Activity Logs
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param user_id query int false "Filter by user ID"
// @Param action query string false "Filter by action"
// @Success 200 {array} ActivityLog
// @Router /admin/activity [get]
func getActivityLogs(c *gin.Context) {
	var logs []ActivityLog
	query := DB.Preload("User")

	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}

	query.Order("created_at desc").Limit(100).Find(&logs)
	c.JSON(200, logs)
}

// @Summary Get Point Configuration
// @Description Retrieve current point reward configuration
// @Tags Admin - Config
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} PointConfig
// @Router /admin/config/points [get]
func getPointConfig(c *gin.Context) {
	var config PointConfig
	DB.First(&config)
	c.JSON(200, config)
}

// @Summary Update Point Configuration
// @Description Update point reward settings
// @Tags Admin - Config
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body PointConfig true "Point Config"
// @Success 200 {object} PointConfig
// @Failure 400 {object} object{error=string}
// @Router /admin/config/points [put]
func updatePointConfig(c *gin.Context) {
	var req PointConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var config PointConfig
	DB.First(&config)

	config.MembershipPointsAwarded = req.MembershipPointsAwarded
	config.MembershipPrice = req.MembershipPrice

	DB.Save(&config)
	logActivity(c.GetUint("user_id"), "update_config", "Updated point configuration", c.ClientIP())
	c.JSON(200, config)
}

// @Summary Get All Role Access Configurations
// @Description List all roles and their permitted menus
// @Tags Admin - RBAC
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} RoleAccess
// @Router /admin/rbac/roles [get]
func getAllRoleAccess(c *gin.Context) {
	var roles []RoleAccess
	if err := DB.Find(&roles).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch role configs"})
		return
	}
	if len(roles) == 0 {
		seedDefaultRoleAccess()
		DB.Find(&roles)
	}
	c.JSON(200, roles)
}

// @Summary Update Role Access
// @Description Configure menu access for a specific role
// @Tags Admin - RBAC
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body RoleAccess true "Role Configuration"
// @Success 200 {object} RoleAccess
// @Router /admin/rbac/roles [post]
func updateRoleAccess(c *gin.Context) {
	var req RoleAccess
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if req.Role == "" {
		c.JSON(400, gin.H{"error": "Role name is required"})
		return
	}

	var roleAccess RoleAccess
	err := DB.First(&roleAccess, "role = ?", req.Role).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(500, gin.H{"error": "Failed to save role config"})
		return
	}

	if err == gorm.ErrRecordNotFound {
		roleAccess = RoleAccess{Role: req.Role, Menus: req.Menus}
		if err := DB.Create(&roleAccess).Error; err != nil {
			c.JSON(500, gin.H{"error": "Failed to create role config"})
			return
		}
	} else {
		roleAccess.Menus = req.Menus
		if err := DB.Save(&roleAccess).Error; err != nil {
			c.JSON(500, gin.H{"error": "Failed to update role config"})
			return
		}
	}

	logActivity(c.GetUint("user_id"), "update_role_access", fmt.Sprintf("Updated access for role %s", req.Role), c.ClientIP())
	c.JSON(200, roleAccess)
}

// @Summary Get Current User Menu Access
// @Description Get list of allowed menu hrefs for the logged-in user
// @Tags General
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} object{role=string, allowed_menus=[]string}
// @Router /user/menus [get]
func getMyMenuAccess(c *gin.Context) {
	userID := c.GetUint("user_id")

	// 1. Ambil Role User dari tabel Users
	var user User
	if err := DB.Select("role").First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"error": "User not found"})
		return
	}

	// 2. Ambil Access Config berdasarkan Role user tersebut
	var roleAccess RoleAccess
	if err := DB.First(&roleAccess, "role = ?", user.Role).Error; err != nil {
		// Jika konfigurasi role belum dibuat, return array kosong atau default public
		c.JSON(200, gin.H{
			"role":          user.Role,
			"allowed_menus": []string{"/dashboard"}, // Minimal dashboard
		})
		return
	}

	c.JSON(200, gin.H{
		"role":          user.Role,
		"allowed_menus": roleAccess.Menus,
	})
}

// @Summary Create User
// @Description Create a new dashboard user (admin/cashier)
// @Tags Admin - Users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{name=string,email=string,password=string,role=string} true "User Data"
// @Success 200 {object} User
// @Router /admin/users [post]
func createUser(c *gin.Context) {
	var req struct {
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Role     string `json:"role" binding:"required"` // admin, cashier, customer
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Cek email duplikat
	var existing User
	if err := DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(400, gin.H{"error": "Email already registered"})
		return
	}

	// Hash Password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to hash password"})
		return
	}

	user := User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashedPassword),
		Role:     req.Role,
		Points:   0,
	}

	if err := DB.Create(&user).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create user"})
		return
	}

	// Hide password di response
	user.Password = ""
	c.JSON(200, user)
}

// @Summary Update User
// @Description Update user details and role
// @Tags Admin - Users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "User ID"
// @Param request body object{name=string,email=string,password=string,role=string} true "User Data"
// @Success 200 {object} User
// @Router /admin/users/{id} [put]
func updateUser(c *gin.Context) {
	id := c.Param("id")
	var user User

	if err := DB.First(&user, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"` // Optional
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Role != "" {
		user.Role = req.Role
	}

	// Hash password baru jika ada input password
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to hash password"})
			return
		}
		user.Password = string(hashedPassword)
	}

	if err := DB.Save(&user).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to update user"})
		return
	}

	user.Password = ""
	c.JSON(200, user)
}

// @Summary Delete User
// @Description Soft delete a user
// @Tags Admin - Users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "User ID"
// @Success 200 {object} object{message=string}
// @Router /admin/users/{id} [delete]
func deleteUser(c *gin.Context) {
	id := c.Param("id")

	// Cegah delete diri sendiri (optional security)
	// currentUserID := c.GetUint("user_id")
	// convert string id to uint utk perbandingan (skip logic ini kalau ribet konversi)

	if err := DB.Delete(&User{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete user"})
		return
	}

	// Opsional: Hapus session/token user tersebut jika ada mekanisme blacklist

	c.JSON(200, gin.H{"message": "User deleted successfully"})
}

// @Router /admin/employees [get]
func getEmployees(c *gin.Context) {
	var employees []Employee
	query := DB.Model(&Employee{}).Where("is_active = ?", true)

	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}
	query.Order("created_at desc").Find(&employees)
	c.JSON(200, employees)
}

// @Router /admin/employees [post]
func createEmployee(c *gin.Context) {
	var req struct {
		Name         string  `json:"name" binding:"required"`
		Phone        string  `json:"phone"`
		Position     string  `json:"position"`
		DeviceUserID string  `json:"device_user_id" binding:"required"`
		HourlyRate   float64 `json:"hourly_rate" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Cek duplikat Device ID
	var count int64
	DB.Model(&Employee{}).Where("device_user_id = ?", req.DeviceUserID).Count(&count)
	if count > 0 {
		c.JSON(400, gin.H{"error": "Fingerprint ID already used"})
		return
	}

	emp := Employee{
		Name: req.Name, Phone: req.Phone, Position: req.Position,
		DeviceUserID: req.DeviceUserID, HourlyRate: req.HourlyRate, JoinDate: time.Now(),
	}

	if err := DB.Create(&emp).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create employee"})
		return
	}
	c.JSON(200, emp)
}

// @Router /admin/employees/{id} [put]
func updateEmployee(c *gin.Context) {
	id := c.Param("id")
	var req Employee
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var emp Employee
	if err := DB.First(&emp, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Employee not found"})
		return
	}

	// Update fields
	emp.Name = req.Name
	emp.Phone = req.Phone
	emp.Position = req.Position
	emp.DeviceUserID = req.DeviceUserID
	emp.HourlyRate = req.HourlyRate

	DB.Save(&emp)
	c.JSON(200, emp)
}

// @Router /admin/employees/{id} [delete]
func deleteEmployee(c *gin.Context) {
	id := c.Param("id")
	// Soft Delete (Set is_active false atau pakai Gorm DeletedAt)
	if err := DB.Delete(&Employee{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed"})
		return
	}
	c.JSON(200, gin.H{"message": "Employee deleted"})
}

// @Summary Receive Fingerprint Log
// @Description Endpoint for biometric device to push attendance data
// @Tags Device
// @Accept json
// @Produce json
// @Router /api/device/push [post]
func receiveFingerprintLog(c *gin.Context) {
	var req struct {
		DeviceUserID string `json:"user_id"`   // ID di mesin fingerprint (misal "101")
		Timestamp    string `json:"timestamp"` // "2023-11-29 08:00:00"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// 1. Cari Employee berdasarkan Device ID
	var emp Employee
	if err := DB.Where("device_user_id = ?", req.DeviceUserID).First(&emp).Error; err != nil {
		c.JSON(404, gin.H{"error": "Employee with this Device ID not found"})
		return
	}

	// Parse Waktu
	layout := "2006-01-02 15:04:05"
	scanTime, err := time.ParseInLocation(layout, req.Timestamp, time.Local)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid timestamp format"})
		return
	}

	// Ambil tanggal saja (jam 00:00)
	dateOnly := time.Date(scanTime.Year(), scanTime.Month(), scanTime.Day(), 0, 0, 0, 0, time.Local)

	// 2. Logic Clock In/Out
	// Cek apakah ada record absen hari ini untuk karyawan ini yang belum Clock Out
	var attendance Attendance
	err = DB.Where("employee_id = ? AND date = ? AND clock_out IS NULL", emp.ID, dateOnly).First(&attendance).Error

	if err != nil {
		// Record Not Found -> Berarti ini CLOCK IN (Masuk)
		newAtt := Attendance{
			EmployeeID: emp.ID,
			Date:       dateOnly,
			ClockIn:    scanTime,
			Status:     "present",
		}
		DB.Create(&newAtt)

		c.JSON(200, gin.H{
			"status":   "Clock In Success",
			"employee": emp.Name,
			"time":     scanTime.Format("15:04"),
		})
	} else {
		// Record Found -> Berarti ini CLOCK OUT (Pulang)

		// Hitung durasi kerja (dalam Jam)
		duration := scanTime.Sub(attendance.ClockIn).Hours()

		// Hitung Upah Harian (Durasi x Gaji Per Jam)
		wage := duration * emp.HourlyRate

		// Update Record
		attendance.ClockOut = &scanTime
		attendance.DurationH = duration
		attendance.DailyWage = wage

		DB.Save(&attendance)

		c.JSON(200, gin.H{
			"status":         "Clock Out Success",
			"employee":       emp.Name,
			"duration_hours": fmt.Sprintf("%.2f", duration),
			"daily_wage":     wage,
		})
	}
}

// @Summary Get Attendance Logs
// @Description Get history of attendance
// @Tags Admin - Attendance
// @Accept json
// @Produce json
// @Router /admin/attendance [get]
func getAttendanceLogs(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	empID := c.Query("employee_id") // Ganti filter dari user_id ke employee_id

	var logs []Attendance
	// Preload Employee, bukan User
	query := DB.Preload("Employee").Order("date desc, clock_in desc")

	if startDate != "" {
		query = query.Where("date >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("date <= ?", endDate)
	}
	if empID != "" {
		query = query.Where("employee_id = ?", empID)
	}

	query.Find(&logs)
	c.JSON(200, logs)
}

// @Summary Manual Attendance
// @Description Input attendance manually (if fingerprint error)
// @Tags Admin - Attendance
// @Accept json
// @Produce json
// @Router /admin/attendance/manual [post]
func manualAttendance(c *gin.Context) {
	var req struct {
		EmployeeID uint   `json:"employee_id" binding:"required"`
		Date       string `json:"date" binding:"required"` // YYYY-MM-DD
		ClockIn    string `json:"clock_in"`                // HH:mm (wajib saat masuk)
		ClockOut   string `json:"clock_out"`               // HH:mm (wajib saat pulang)
		Notes      string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if req.ClockIn == "" && req.ClockOut == "" {
		c.JSON(400, gin.H{"error": "clock_in atau clock_out harus diisi"})
		return
	}

	// 1. Ambil Data Karyawan
	var emp Employee
	if err := DB.First(&emp, req.EmployeeID).Error; err != nil {
		c.JSON(404, gin.H{"error": "Employee not found"})
		return
	}

	layoutDate := "2006-01-02"
	layoutTime := "2006-01-02 15:04"

	dateObj, err := time.Parse(layoutDate, req.Date)
	if err != nil {
		c.JSON(400, gin.H{"error": "Format date tidak valid (gunakan YYYY-MM-DD)"})
		return
	}

	// 2. Cek apakah sudah ada record absensi hari ini
	var existing Attendance
	hasExisting := DB.Where("employee_id = ? AND date = ?", req.EmployeeID, dateObj).First(&existing).Error == nil

	if !hasExisting {
		// --- CLOCK IN: Buat record baru ---
		if req.ClockIn == "" {
			c.JSON(400, gin.H{"error": "Belum ada absensi di tanggal ini, clock_in wajib diisi"})
			return
		}

		inObj, err := time.Parse(layoutTime, req.Date+" "+req.ClockIn)
		if err != nil {
			c.JSON(400, gin.H{"error": "Format clock_in tidak valid (gunakan HH:mm)"})
			return
		}

		att := Attendance{
			EmployeeID: req.EmployeeID,
			Date:       dateObj,
			ClockIn:    inObj,
			Status:     "present",
			Notes:      req.Notes + " (Manual Input)",
		}

		// Jika clock_out juga dikirim, langsung hitung sekaligus
		if req.ClockOut != "" {
			outObj, err := time.Parse(layoutTime, req.Date+" "+req.ClockOut)
			if err != nil {
				c.JSON(400, gin.H{"error": "Format clock_out tidak valid (gunakan HH:mm)"})
				return
			}
			duration := outObj.Sub(inObj).Hours()
			if duration < 0 {
				c.JSON(400, gin.H{"error": "Clock Out tidak boleh lebih awal dari Clock In"})
				return
			}
			att.ClockOut = &outObj
			att.DurationH = duration
			att.DailyWage = duration * emp.HourlyRate
		}

		if err := DB.Create(&att).Error; err != nil {
			c.JSON(500, gin.H{"error": "Gagal menyimpan absensi"})
			return
		}

		DB.Preload("Employee").First(&att, att.ID)
		c.JSON(200, gin.H{"status": "Clock In berhasil", "data": att})
	} else {
		// --- CLOCK OUT: Update record yang sudah ada ---
		if existing.ClockOut != nil {
			c.JSON(400, gin.H{"error": "Karyawan ini sudah clock in dan clock out di tanggal tersebut"})
			return
		}

		if req.ClockOut == "" {
			c.JSON(400, gin.H{"error": "Sudah ada clock in, clock_out wajib diisi untuk absen pulang"})
			return
		}

		outObj, err := time.Parse(layoutTime, req.Date+" "+req.ClockOut)
		if err != nil {
			c.JSON(400, gin.H{"error": "Format clock_out tidak valid (gunakan HH:mm)"})
			return
		}

		duration := outObj.Sub(existing.ClockIn).Hours()
		if duration < 0 {
			c.JSON(400, gin.H{"error": "Clock Out tidak boleh lebih awal dari Clock In"})
			return
		}

		existing.ClockOut = &outObj
		existing.DurationH = duration
		existing.DailyWage = duration * emp.HourlyRate
		if req.Notes != "" {
			existing.Notes = existing.Notes + " | " + req.Notes
		}

		if err := DB.Save(&existing).Error; err != nil {
			c.JSON(500, gin.H{"error": "Gagal update absensi"})
			return
		}

		DB.Preload("Employee").First(&existing, existing.ID)
		c.JSON(200, gin.H{"status": "Clock Out berhasil", "data": existing})
	}
}

// @Summary Create Loan (Cashbon)
// @Description Creates a loan and triggers Cash Out automatically
// @Router /admin/loans [post]
func createLoan(c *gin.Context) {
	var req struct {
		EmployeeID uint    `json:"employee_id" binding:"required"` // Ganti user_id
		Amount     float64 `json:"amount" binding:"required"`
		Reason     string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	tx := DB.Begin()

	// 1. Create Loan Record
	loan := EmployeeLoan{
		EmployeeID: req.EmployeeID, Amount: req.Amount, RemainingAmount: req.Amount, Reason: req.Reason, Status: "active",
	}
	if err := tx.Create(&loan).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "DB Error"})
		return
	}

	// 2. Create CashFlow OUT (Uang keluar dari laci)
	cashflow := CashFlow{
		Type: "out", Category: "loan", Amount: req.Amount,
		Description: fmt.Sprintf("Cashbon User ID: %d - %s", req.EmployeeID, req.Reason), CreatedBy: c.GetUint("user_id"),
	}
	if err := tx.Create(&cashflow).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Cashflow Error"})
		return
	}

	tx.Commit()
	c.JSON(200, loan)
}

// @Summary Get Loans
// @Router /admin/loans [get]
func getLoans(c *gin.Context) {
	var loans []EmployeeLoan
	status := c.Query("status") // active, paid_off
	query := DB.Preload("Employee").Order("created_at desc")

	if status != "" {
		query = query.Where("status = ?", status)
	} else {
		query = query.Where("remaining_amount > 0") // Default active only
	}
	query.Find(&loans)
	c.JSON(200, loans)
}

// @Summary Preview Payroll
// @Description Calculate estimated payroll based on attendance and loans
// @Router /admin/payroll/preview [get]
func getPayrollPreview(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	if startDate == "" || endDate == "" {
		c.JSON(400, gin.H{"error": "start_date dan end_date wajib diisi (format: YYYY-MM-DD)"})
		return
	}

	type PayrollDetail struct {
		EmployeeID    uint    `json:"employee_id"`
		Name          string  `json:"name"`
		Position      string  `json:"position"`
		TotalHours    float64 `json:"total_hours"`
		BaseSalary    float64 `json:"base_salary"`
		ActiveLoan    float64 `json:"active_loan"`
		LoanDeduction float64 `json:"loan_deduction"`
		NetSalary     float64 `json:"net_salary"`
	}
	var details []PayrollDetail

	sql := `
		SELECT
			e.id, e.name, e.position,
			COALESCE(SUM(a.duration_h), 0) as hours,
			COALESCE(SUM(a.daily_wage), 0) as base,
			(SELECT COALESCE(SUM(remaining_amount), 0) FROM employee_loans WHERE employee_id = e.id AND status = 'active') as loan
		FROM employees e
		LEFT JOIN attendances a ON e.id = a.employee_id AND a.date >= ? AND a.date <= ?
		WHERE e.is_active = true AND e.deleted_at IS NULL
		GROUP BY e.id, e.name, e.position
	`
	rows, err := DB.Raw(sql, startDate, endDate).Rows()
	if err != nil {
		c.JSON(500, gin.H{"error": "Database error: " + err.Error()})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var d PayrollDetail
		if err := rows.Scan(&d.EmployeeID, &d.Name, &d.Position, &d.TotalHours, &d.BaseSalary, &d.ActiveLoan); err != nil {
			continue
		}

		if d.BaseSalary >= d.ActiveLoan {
			d.LoanDeduction = d.ActiveLoan
		} else {
			d.LoanDeduction = d.BaseSalary * 0.5
		}

		d.NetSalary = d.BaseSalary - d.LoanDeduction
		if d.BaseSalary > 0 {
			details = append(details, d)
		}
	}
	c.JSON(200, details)
}

// @Summary Generate Payroll
// @Description Execute payroll payment, create ledger, deduct loans
// @Router /admin/payroll/generate [post]
func generatePayroll(c *gin.Context) {
	var req struct {
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
		Details   []struct {
			EmployeeID    uint    `json:"employee_id"` // <-- Ganti UserID ke EmployeeID
			LoanDeduction float64 `json:"loan_deduction"`
			Bonus         float64 `json:"bonus"`
		} `json:"details"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	tx := DB.Begin()
	now := time.Now()

	for _, det := range req.Details {
		// 1. Recalculate Base Wage (Hitung ulang gaji dasar dari absensi)
		var baseWage float64
		var hours float64

		// Query ke tabel attendance berdasarkan employee_id
		tx.Model(&Attendance{}).
			Select("COALESCE(SUM(daily_wage),0), COALESCE(SUM(duration_h),0)").
			Where("employee_id = ? AND date >= ? AND date <= ?", det.EmployeeID, req.StartDate, req.EndDate).
			Row().Scan(&baseWage, &hours)

		netSalary := baseWage + det.Bonus - det.LoanDeduction

		// 2. Create Payroll Record
		payroll := Payroll{
			EmployeeID:    det.EmployeeID, // <-- Gunakan EmployeeID
			PeriodStart:   parseDate(req.StartDate),
			PeriodEnd:     parseDate(req.EndDate),
			TotalHours:    hours,
			BaseSalary:    baseWage,
			LoanDeduction: det.LoanDeduction,
			Bonus:         det.Bonus,
			NetSalary:     netSalary,
			Status:        "paid",
			PaymentDate:   &now,
		}

		if err := tx.Create(&payroll).Error; err != nil {
			tx.Rollback()
			c.JSON(500, gin.H{"error": "Failed to create payroll record"})
			return
		}

		// 3. Deduct Loan (Potong Saldo Hutang Karyawan)
		if det.LoanDeduction > 0 {
			var loans []EmployeeLoan
			// Cari hutang aktif berdasarkan employee_id
			tx.Where("employee_id = ? AND remaining_amount > 0", det.EmployeeID).Order("created_at asc").Find(&loans)

			deductionLeft := det.LoanDeduction

			for _, loan := range loans {
				if deductionLeft <= 0 {
					break
				}

				if loan.RemainingAmount <= deductionLeft {
					// Hutang ini lunas, lanjut ke hutang berikutnya (jika ada sisa potongan)
					deductionLeft -= loan.RemainingAmount
					loan.RemainingAmount = 0
					loan.Status = "paid_off"
				} else {
					// Hutang ini berkurang tapi belum lunas
					loan.RemainingAmount -= deductionLeft
					deductionLeft = 0
				}
				tx.Save(&loan)
			}
		}

		// 4. Finance Integration (Ledger & CashFlow)

		// Ledger: Expense Payroll (Pengeluaran Gaji)
		tx.Create(&Ledger{
			Date:        now,
			Type:        "expense",
			Category:    "payroll",
			Amount:      netSalary,
			Description: fmt.Sprintf("Gaji Employee #%d (%s - %s)", det.EmployeeID, req.StartDate, req.EndDate),
			CreatedBy:   c.GetUint("user_id"), // Admin yang klik tombol bayar
		})

		// Cashflow: Uang keluar real
		tx.Create(&CashFlow{
			Type:        "out",
			Category:    "salary",
			Amount:      netSalary,
			Description: fmt.Sprintf("Payroll Payment Employee #%d", det.EmployeeID),
			CreatedBy:   c.GetUint("user_id"),
		})
	}

	tx.Commit()
	c.JSON(200, gin.H{"message": "Payroll generated successfully"})
}

// @Summary Get Payroll History
// @Router /admin/payroll/history [get]
func getPayrollHistory(c *gin.Context) {
	var history []Payroll
	// Preload Employee (bukan User) karena relasinya sudah diubah
	query := DB.Preload("Employee").Order("payment_date desc")

	if empID := c.Query("employee_id"); empID != "" {
		query = query.Where("employee_id = ?", empID)
	}

	query.Find(&history)
	c.JSON(200, history)
}

// --- Helper Utils ---

func parsePagination(c *gin.Context) (int, int) {
	page := 1
	limit := 100
	if p := c.Query("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}
	return page, limit
}

func parseDate(d string) time.Time {
	t, _ := time.Parse("2006-01-02", d)
	return t
}

func stringToUint(s string) uint {
	val, _ := strconv.Atoi(s)
	return uint(val)
}

type redeemPayload struct {
	Type       string `json:"type"`
	UserID     uint   `json:"user_id"`
	VehicleID  uint   `json:"vehicle_id"`
	ServiceID  uint   `json:"service_id"`
	PointsCost int    `json:"points_cost"`
	ExpiresAt  int64  `json:"expires_at"`
}

func parseRedeemQR(qrData string) (*redeemPayload, error) {
	var p redeemPayload
	if err := json.Unmarshal([]byte(qrData), &p); err != nil {
		return nil, fmt.Errorf("invalid QR data")
	}
	if p.Type != "redeem" {
		return nil, fmt.Errorf("invalid QR type")
	}
	if time.Now().Unix() > p.ExpiresAt {
		return nil, fmt.Errorf("QR code sudah expired")
	}
	return &p, nil
}

// @Summary Scan Point Redemption QR (Preview)
// @Description Parse and validate a redemption QR code, return confirmation details for the cashier
// @Tags Admin - Transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{qr_data=string} true "Raw QR string"
// @Success 200 {object} object{user=User,vehicle=Vehicle,service=Service,points_cost=int,expires_at=string}
// @Router /admin/redeem/scan [post]
func scanRedeemQR(c *gin.Context) {
	var req struct {
		QRData string `json:"qr_data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	payload, err := parseRedeemQR(req.QRData)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var user User
	if err := DB.First(&user, payload.UserID).Error; err != nil {
		c.JSON(404, gin.H{"error": "user not found"})
		return
	}
	if user.Points < payload.PointsCost {
		c.JSON(400, gin.H{"error": fmt.Sprintf("poin user tidak cukup: punya %d, butuh %d", user.Points, payload.PointsCost)})
		return
	}

	var vehicle Vehicle
	DB.First(&vehicle, payload.VehicleID)
	var service Service
	DB.First(&service, payload.ServiceID)

	c.JSON(200, gin.H{
		"user":        user,
		"vehicle":     vehicle,
		"service":     service,
		"points_cost": payload.PointsCost,
		"expires_at":  time.Unix(payload.ExpiresAt, 0),
	})
}

// @Summary Submit Point Redemption
// @Description Execute a point redemption: create transaction and deduct user points
// @Tags Admin - Transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{qr_data=string} true "Raw QR string (same as scan)"
// @Success 200 {object} object{message=string,transaction=Transaction,points_deducted=int}
// @Router /admin/redeem/submit [post]
func submitRedeem(c *gin.Context) {
	cashierID := c.GetUint("user_id")
	var req struct {
		QRData string `json:"qr_data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	payload, err := parseRedeemQR(req.QRData)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var user User
	if err := DB.First(&user, payload.UserID).Error; err != nil {
		c.JSON(404, gin.H{"error": "user not found"})
		return
	}
	if user.Points < payload.PointsCost {
		c.JSON(400, gin.H{"error": fmt.Sprintf("poin user tidak cukup: punya %d, butuh %d", user.Points, payload.PointsCost)})
		return
	}

	var service Service
	if err := DB.First(&service, payload.ServiceID).Error; err != nil {
		c.JSON(404, gin.H{"error": "service not found"})
		return
	}

	var pm PaymentMethod
	if err := DB.Where("type = ?", "points").First(&pm).Error; err != nil {
		c.JSON(500, gin.H{"error": "payment method 'points' belum dikonfigurasi, jalankan migration terbaru"})
		return
	}

	userID := payload.UserID
	paidAt := time.Now()

	tx := DB.Begin()

	redeemPMID := pm.ID
	transaction := Transaction{
		UserID:          &userID,
		TransactionCode: generateTransactionCode(),
		TotalAmount:     0,
		PointsEarned:    0,
		Status:          "paid",
		PaymentMethodID: &redeemPMID,
		PaymentType:     "points",
		CashierID:       &cashierID,
		PaidAt:          &paidAt,
		Notes:           fmt.Sprintf("Redeem poin: %s", service.Name),
	}
	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "gagal membuat transaksi"})
		return
	}

	item := TransactionItem{
		TransactionID:  transaction.ID,
		ServiceID:      service.ID,
		Quantity:       1,
		BasePrice:      service.Price,
		DiscountAmount: service.Price,
		FinalPrice:     0,
		Subtotal:       0,
	}
	if err := tx.Create(&item).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "gagal membuat item transaksi"})
		return
	}

	if err := tx.Model(&User{}).Where("id = ?", userID).Update("points", gorm.Expr("points - ?", payload.PointsCost)).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "gagal memotong poin"})
		return
	}

	tx.Commit()

	DB.Preload("Items.Service").Preload("User").First(&transaction, transaction.ID)
	c.JSON(200, gin.H{
		"message":         "Redeem berhasil",
		"transaction":     transaction,
		"points_deducted": payload.PointsCost,
	})
}
