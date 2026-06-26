package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/skip2/go-qrcode"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func googleAuth(c *gin.Context) {
	var req struct {
		IDToken string `json:"id_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[ERROR] Failed to bind JSON: %v", err)
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[INFO] Verifying Google ID token: %s", req.IDToken)

	// Verify token using Google API
	resp, err := http.Get(fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", req.IDToken))
	if err != nil {
		log.Printf("[ERROR] Failed to call Google tokeninfo: %v", err)
		c.JSON(400, gin.H{"error": "failed to verify token"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[ERROR] Invalid Google token. Status: %d, Body: %s", resp.StatusCode, string(body))
		c.JSON(400, gin.H{"error": "invalid google token"})
		return
	}

	var googleData struct {
		Sub     string `json:"sub"` // Google user ID
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
		Aud     string `json:"aud"` // Client ID
	}

	if err := json.NewDecoder(resp.Body).Decode(&googleData); err != nil {
		log.Printf("[ERROR] Failed to decode Google token response: %v", err)
		c.JSON(400, gin.H{"error": "failed to decode token info"})
		return
	}

	// Validate audience
	if googleData.Aud != os.Getenv("GOOGLE_CLIENT_ID") {
		log.Printf("[ERROR] Invalid audience. Got: %s, Expected: %s", googleData.Aud, os.Getenv("GOOGLE_CLIENT_ID"))
		c.JSON(400, gin.H{"error": "invalid audience"})
		return
	}

	log.Printf("[INFO] Google token verified for user: %s (%s)", googleData.Name, googleData.Email)

	// Find or create user
	var user User
	result := DB.Where("google_id = ?", googleData.Sub).First(&user)

	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			googleID := googleData.Sub
			user = User{
				GoogleID: &googleID,
				Email:    googleData.Email,
				Name:     googleData.Name,
				Photo:    googleData.Picture,
				Role:     "customer",
				IsActive: true,
			}
			if err := DB.Create(&user).Error; err != nil {
				log.Printf("[ERROR] Failed to create user: %v", err)
				c.JSON(500, gin.H{"error": "failed to create user"})
				return
			}
			log.Printf("[INFO] Created new user: %v", user)
		} else {
			log.Printf("[ERROR] Database error: %v", result.Error)
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
	} else {
		// Update existing user
		user.Name = googleData.Name
		user.Photo = googleData.Picture
		if err := DB.Save(&user).Error; err != nil {
			log.Printf("[ERROR] Failed to update user: %v", err)
			c.JSON(500, gin.H{"error": "failed to update user"})
			return
		}
		log.Printf("[INFO] Updated existing user: %v", user)
	}

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(7 * 24 * time.Hour).Unix(),
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		log.Printf("[ERROR] Failed to sign JWT: %v", err)
		c.JSON(500, gin.H{"error": "failed to generate token"})
		return
	}

	log.Printf("[INFO] Successfully authenticated user %s, JWT generated", user.Email)

	c.JSON(200, gin.H{
		"token": tokenString,
		"user":  user,
	})
}

// @Summary Admin Login
// @Description Login for admin users with email and password
// @Tags Authentication
// @Accept json
// @Produce json
// @Param request body object{email=string,password=string} true "Admin Credentials"
// @Success 200 {object} object{token=string,user=User}
// @Failure 401 {object} object{error=string}
// @Router /admin/login [post]
func adminLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var user User
	if err := DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 8).Unix(),
	})

	tokenString, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

	// Log activity
	logActivity(user.ID, "login", "Admin logged in", c.ClientIP())

	c.JSON(200, gin.H{
		"token": tokenString,
		"user":  user,
	})
}

// @Summary Get User Profile
// @Description Get current user profile information
// @Tags Customer
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} User
// @Failure 401 {object} object{error=string}
// @Router /customer/profile [get]
func getProfile(c *gin.Context) {
	userID := c.GetUint("user_id")

	var resp ProfileResponse

	// --- Query 1 : Ambil User
	err := DB.Raw(`
		SELECT * FROM users WHERE id = ? AND deleted_at IS NULL
	`, userID).Scan(&resp.User).Error

	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	if resp.User.ID == 0 {
		c.JSON(404, gin.H{"error": "user not found"})
		return
	}

	// --- Query 2: Ambil Vehicles
	DB.Raw(`
		SELECT * FROM vehicles 
		WHERE user_id = ? AND deleted_at IS NULL
	`, userID).Scan(&resp.Vehicles)

	// --- Query 3: Ambil Memberships + Preload Vehicle & Transaction
	DB.Where("user_id = ?", userID).
		Preload("Vehicle").
		Preload("Transaction").
		Find(&resp.Memberships)

	c.JSON(200, resp)
}

// @Summary Update Profile
// @Description Update customer profile data (name, phone, address, birth place, birth date, gender)
// @Tags Customer
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{name=string,phone=string,address=string,birth_place=string,birth_date=string,gender=string} true "Profile Data. birth_date format: YYYY-MM-DD. gender: male|female"
// @Success 200 {object} object{message=string,user=User}
// @Failure 400 {object} object{error=string}
// @Router /customer/profile [put]
func updateProfile(c *gin.Context) {
	userID := c.GetUint("user_id")
	var req struct {
		Name       *string `json:"name"`
		Phone      *string `json:"phone"`
		Address    *string `json:"address"`
		BirthPlace *string `json:"birth_place"`
		BirthDate  *string `json:"birth_date"` // YYYY-MM-DD
		Gender     *string `json:"gender"`     // male | female
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}
	if req.Address != nil {
		updates["address"] = *req.Address
	}
	if req.BirthPlace != nil {
		updates["birth_place"] = *req.BirthPlace
	}
	if req.BirthDate != nil {
		if *req.BirthDate == "" {
			updates["birth_date"] = nil
		} else {
			t, err := time.Parse("2006-01-02", *req.BirthDate)
			if err != nil {
				c.JSON(400, gin.H{"error": "invalid birth_date format, expected YYYY-MM-DD"})
				return
			}
			updates["birth_date"] = t
		}
	}
	if req.Gender != nil {
		g := *req.Gender
		if g != "" && g != "male" && g != "female" {
			c.JSON(400, gin.H{"error": "invalid gender, expected male or female"})
			return
		}
		updates["gender"] = g
	}

	if len(updates) == 0 {
		c.JSON(400, gin.H{"error": "no fields to update"})
		return
	}

	if err := DB.Model(&User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		c.JSON(500, gin.H{"error": "failed to update profile"})
		return
	}

	var user User
	DB.First(&user, userID)
	c.JSON(200, gin.H{"message": "Profile updated", "user": user})
}

// @Summary Update FCM Token
// @Description Store / refresh the customer's Firebase Cloud Messaging device token for mobile push notifications. Mobile app should call this on login and on token refresh.
// @Tags Customer
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{fcm_token=string} true "FCM device token"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Router /customer/fcm-token [put]
func updateFCMToken(c *gin.Context) {
	userID := c.GetUint("user_id")
	var req struct {
		FCMToken string `json:"fcm_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	token := strings.TrimSpace(req.FCMToken)
	if token == "" {
		c.JSON(400, gin.H{"error": "fcm_token cannot be empty"})
		return
	}

	if err := DB.Model(&User{}).Where("id = ?", userID).Update("fcm_token", token).Error; err != nil {
		c.JSON(500, gin.H{"error": "failed to save token"})
		return
	}
	c.JSON(200, gin.H{"message": "FCM token saved"})
}

// @Summary Get Customer Memberships
// @Description Get list of memberships owned by the logged-in user
// @Tags Customer - Membership
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} Membership
// @Router /customer/memberships [get]
func getMembership(c *gin.Context) {
	userID := c.GetUint("user_id")
	var memberships []Membership
	DB.Preload("Vehicle").Preload("Transaction").Where("user_id = ?", userID).Order("created_at desc").Find(&memberships)
	c.JSON(200, memberships)
}

// @Summary Apply Membership
// @Description Register new membership for a user
// @Tags Admin - Membership
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{user_id=int,vehicle_id=int,payment_method_id=int} true "Apply Data"
// @Success 200 {object} Membership
// @Router /admin/membership/apply [post]
func applyMembership(c *gin.Context) {
	// 1. Definisikan request body
	var req struct {
		UserID          uint `json:"user_id" binding:"required"`
		VehicleID       uint `json:"vehicle_id" binding:"required"`
		PaymentMethodID uint `json:"payment_method_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	targetUserID := req.UserID

	// 2. Ambil Config Poin & Harga Membership Terbaru
	var pointConfig PointConfig
	if err := DB.First(&pointConfig).Error; err != nil {
		c.JSON(500, gin.H{"error": "Point configuration not found"})
		return
	}

	// 3. Create membership record (Status Pending)
	membership := Membership{
		UserID:    targetUserID,
		VehicleID: req.VehicleID,
		Status:    "pending",
	}

	// 4. Create transaction
	applyPMID := req.PaymentMethodID
	transaction := Transaction{
		UserID:          &targetUserID,
		TransactionCode: generateTransactionCode(),
		TotalAmount:     pointConfig.MembershipPrice,
		PointsEarned:    pointConfig.MembershipPointsAwarded,
		Status:          "pending",
		PaymentMethodID: &applyPMID,
		Notes:           "New Membership Application",
	}

	// Save Transaction dulu untuk dapat ID
	if err := DB.Create(&transaction).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create transaction"})
		return
	}

	// Link transaction ke membership
	membership.TransactionID = &transaction.ID
	if err := DB.Create(&membership).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create membership record"})
		return
	}

	// 5. Handle payment gateway (Xendit vs Cash)
	if req.PaymentMethodID > 1 { // Asumsi ID 1 = Cash, >1 = Cashless/Xendit
		invoiceURL, invoiceID := createXenditInvoice(transaction.TransactionCode, pointConfig.MembershipPrice, "Membership Fee")
		DB.Model(&transaction).Updates(map[string]interface{}{
			"xendit_invoice_id":  invoiceID,
			"xendit_payment_url": invoiceURL,
			"payment_type":       "xendit",
		})
	} else {
		// Jika Cash, status masih pending menunggu konfirmasi kasir (atau bisa langsung paid jika logic admin)
		transaction.PaymentType = "cash"
		DB.Save(&transaction)
	}

	// Return data dengan preload
	DB.Preload("Transaction").First(&membership, membership.ID)
	c.JSON(200, membership)
}

// @Summary Renew Membership
// @Description Renew existing membership with payment
// @Tags Customer - Membership
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{membership_id=int,payment_method_id=int} true "Renew Membership"
// @Success 200 {object} object{message=string,transaction=Transaction}
// @Router /customer/memberships/renew [post]
func renewMembership(c *gin.Context) {
	var req struct {
		MembershipID    uint `json:"membership_id" binding:"required"`
		PaymentMethodID uint `json:"payment_method_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Validasi Membership
	var membership Membership
	if err := DB.Preload("User").First(&membership, req.MembershipID).Error; err != nil {
		c.JSON(404, gin.H{"error": "Membership not found"})
		return
	}

	// Ambil Config Harga & Poin
	var pointConfig PointConfig
	if err := DB.First(&pointConfig).Error; err != nil {
		c.JSON(500, gin.H{"error": "Point configuration not found"})
		return
	}

	// Create renewal transaction
	renewPMID := req.PaymentMethodID
	transaction := Transaction{
		UserID:          &membership.UserID,
		TransactionCode: generateTransactionCode(),
		TotalAmount:     pointConfig.MembershipPrice,
		PointsEarned:    pointConfig.MembershipPointsAwarded,
		Status:          "pending",
		PaymentMethodID: &renewPMID,
		Notes:           fmt.Sprintf("Membership renewal #%d", membership.ID),
	}

	if err := DB.Create(&transaction).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create transaction"})
		return
	}

	// Handle Payment
	if req.PaymentMethodID > 1 {
		invoiceURL, invoiceID := createXenditInvoice(transaction.TransactionCode, pointConfig.MembershipPrice, "Membership Renewal")
		DB.Model(&transaction).Updates(map[string]interface{}{
			"xendit_invoice_id":  invoiceID,
			"xendit_payment_url": invoiceURL,
			"payment_type":       "xendit",
		})
	} else {
		transaction.PaymentType = "cash"
		DB.Save(&transaction)
	}

	c.JSON(200, gin.H{
		"message":     "Renewal transaction created",
		"transaction": transaction,
	})
}

// @Summary Get User Transactions
// @Description Get all transactions by the logged-in customer
// @Tags Customer
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} Transaction
// @Router /customer/transactions [get]
func getCustomerTransactions(c *gin.Context) {
	userID := c.GetUint("user_id")
	var transactions []Transaction
	DB.Preload("Items.Service").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&transactions)

	result := make([]CustomerTransactionResp, 0, len(transactions))
	for _, tx := range transactions {
		items := make([]CustomerTransactionItemResp, 0, len(tx.Items))
		for _, item := range tx.Items {
			name := item.Name
			if name == "" {
				name = item.Service.Name
			}
			items = append(items, CustomerTransactionItemResp{
				ID:       item.ID,
				Name:     name,
				Quantity: item.Quantity,
				Price:    item.FinalPrice,
				Subtotal: item.Subtotal,
			})
		}
		result = append(result, CustomerTransactionResp{
			ID:              tx.ID,
			TransactionCode: tx.TransactionCode,
			TotalAmount:     tx.TotalAmount,
			PointsEarned:    tx.PointsEarned,
			Status:          tx.Status,
			PaymentType:     tx.PaymentType,
			PaidAt:          tx.PaidAt,
			CreatedAt:       tx.CreatedAt,
			Items:           items,
		})
	}
	c.JSON(200, result)
}

// @Summary Customer Checkout
// @Description Checkout transaction for customer
// @Tags Customer - Transaction
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{items=[]object{service_id=int,quantity=int},payment_method_id=int} true "Checkout Data"
// @Success 200 {object} Transaction
// @Router /api/customer/checkout [post]
// func customerCheckout(c *gin.Context) {
// 	userID := c.GetUint("user_id") // ID Customer dari Token JWT
// 	var req struct {
// 		Items []struct {
// 			ServiceID uint `json:"service_id"`
// 			Quantity  int  `json:"quantity"`
// 		} `json:"items" binding:"required"`
// 		PaymentMethodID uint `json:"payment_method_id" binding:"required"`
// 	}
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		c.JSON(400, gin.H{"error": err.Error()})
// 		return
// 	}

// 	// Inisialisasi Transaksi Header
// 	transaction := Transaction{
// 		UserID:          &userID,
// 		TransactionCode: generateTransactionCode(),
// 		Status:          "pending",
// 		PaymentMethodID: req.PaymentMethodID,
// 	}

// 	var totalAmount float64
// 	var totalPointsEarned int // <-- Variable akumulasi poin
// 	var items []TransactionItem

// 	// Loop Items untuk hitung Subtotal & Poin
// 	for _, item := range req.Items {
// 		var service Service
// 		// Pastikan service active
// 		if err := DB.Where("is_active = ?", true).First(&service, item.ServiceID).Error; err != nil {
// 			c.JSON(400, gin.H{"error": fmt.Sprintf("Service ID %d not found or inactive", item.ServiceID)})
// 			return
// 		}

// 		// Hitung Subtotal Harga
// 		subtotal := service.Price * float64(item.Quantity)
// 		totalAmount += subtotal

// 		// Hitung Poin Item (Logic Baru)
// 		itemPoints := service.PointsAwarded * item.Quantity // <-- UBAH: Poin dari service
// 		totalPointsEarned += itemPoints

// 		// Masukkan ke array items
// 		items = append(items, TransactionItem{
// 			ServiceID: service.ID,
// 			Quantity:  item.Quantity,
// 			Price:     service.Price,
// 			Subtotal:  subtotal,
// 		})
// 	}

// 	// Assign Total ke Struct Transaction
// 	transaction.TotalAmount = totalAmount
// 	transaction.PointsEarned = totalPointsEarned // <-- Masukkan hasil akumulasi

// 	// Simpan Transaksi Header
// 	if err := DB.Create(&transaction).Error; err != nil {
// 		c.JSON(500, gin.H{"error": "Failed to create transaction"})
// 		return
// 	}

// 	// Simpan Detail Items (Assign TransactionID yg baru dibuat)
// 	for i := range items {
// 		items[i].TransactionID = transaction.ID
// 	}
// 	if err := DB.Create(&items).Error; err != nil {
// 		c.JSON(500, gin.H{"error": "Failed to save transaction items"})
// 		return
// 	}

// 	// Handle Payment Gateway
// 	if req.PaymentMethodID > 1 {
// 		invoiceURL, invoiceID := createXenditInvoice(transaction.TransactionCode, totalAmount, "Service Payment")
// 		DB.Model(&transaction).Updates(map[string]interface{}{
// 			"xendit_invoice_id":  invoiceID,
// 			"xendit_payment_url": invoiceURL,
// 			"payment_type":       "xendit",
// 		})
// 	} else {
// 		transaction.PaymentType = "cash"
// 		DB.Save(&transaction)
// 	}

// 	// Response dengan Preload agar Data Service & Payment muncul
// 	DB.Preload("Items.Service").Preload("PaymentMethod").First(&transaction, transaction.ID)
// 	c.JSON(200, transaction)
// }

// @Summary Get User Points
// @Description Get current loyalty points of logged-in customer
// @Tags Customer
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} object{points=int}
// @Router /customer/points [get]
func getPoints(c *gin.Context) {
	userID := c.GetUint("user_id")
	var user User
	DB.Select("points").First(&user, userID)
	c.JSON(200, gin.H{"points": user.Points})
}

// @Summary Generate Customer QR
// @Description Generate QR code containing customer identity
// @Tags Customer
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} object{qr_code=string,data=object}
// @Router /customer/qr [get]
func generateCustomerQR(c *gin.Context) {
	userID := c.GetUint("user_id")
	var user User
	DB.Preload("Vehicles").Preload("Memberships.Vehicle").First(&user, userID)

	data := map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
		"name":    user.Name,
		"points":  user.Points,
	}

	jsonData, _ := json.Marshal(data)
	qr, _ := qrcode.Encode(string(jsonData), qrcode.Medium, 256)
	qrBase64 := base64.StdEncoding.EncodeToString(qr)

	c.JSON(200, gin.H{
		"qr_code": "data:image/png;base64," + qrBase64,
		"data":    data,
	})
}

// @Summary Get All Services
// @Description Get list of all active services (carwash & bikewash)
// @Tags Services
// @Accept json
// @Produce json
// @Param category query string false "Service category" Enums(carwash, bikewash)
// @Success 200 {array} Service
// @Router /services [get]
func getServices(c *gin.Context) {
	var services []Service
	query := DB.Where("is_active = ?", true)

	// Filter by Category (carwash, bikewash, membership)
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	// Sort membership agar rapi (misal urut harga)
	query.Order("category asc, price asc").Find(&services)

	c.JSON(200, services)
}

// @Summary Create Service
// @Description Create new service (admin only)
// @Tags Admin - Services
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Service true "Service Data"
// @Success 200 {object} Service
// @Failure 400 {object} object{error=string}
// @Router /admin/services [post]
func createService(c *gin.Context) {
	var service Service
	if err := c.ShouldBindJSON(&service); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if err := DB.Create(&service).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create service"})
		return
	}
	logActivity(c.GetUint("user_id"), "create_service", fmt.Sprintf("Created service: %s", service.Name), c.ClientIP())
	c.JSON(200, service)
}

// @Summary Update Service
// @Description Update service data by ID
// @Tags Admin - Services
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Service ID"
// @Param request body Service true "Updated Data"
// @Success 200 {object} Service
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Router /admin/services/{id} [put]
func updateService(c *gin.Context) {
	id := c.Param("id")
	var service Service
	if err := DB.First(&service, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Service not found"})
		return
	}

	var req Service
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	service.Name = req.Name
	service.Price = req.Price
	service.Category = req.Category
	service.Description = req.Description
	service.Duration = req.Duration
	service.PointsAwarded = req.PointsAwarded
	service.PointsPrice = req.PointsPrice
	service.MemberDiscountPct = req.MemberDiscountPct
	service.DurationMonths = req.DurationMonths
	service.VehicleType = req.VehicleType
	service.Features = req.Features
	service.IsPopular = req.IsPopular
	service.IsActive = req.IsActive

	DB.Save(&service)
	logActivity(c.GetUint("user_id"), "update_service", fmt.Sprintf("Updated service: %s", service.Name), c.ClientIP())
	c.JSON(200, service)
}

// @Summary Update Service
// @Description Update service data by ID
// @Tags Admin - Services
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Service ID"
// @Param request body Service true "Updated Data"
// @Success 200 {object} Service
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Router /admin/services/{id} [put]
func deleteService(c *gin.Context) {
	id := c.Param("id")
	DB.Delete(&Service{}, id)
	logActivity(c.GetUint("user_id"), "delete_service", fmt.Sprintf("Deleted service ID: %s", id), c.ClientIP())
	c.JSON(200, gin.H{"message": "Service deleted"})
}

func getCategories(c *gin.Context) {
	var cats []ServiceCategory
	DB.Order("sort_order asc, id asc").Find(&cats)
	c.JSON(200, cats)
}

func createCategory(c *gin.Context) {
	var cat ServiceCategory
	if err := c.ShouldBindJSON(&cat); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if cat.Slug == "" || cat.Name == "" {
		c.JSON(400, gin.H{"error": "slug and name are required"})
		return
	}
	if err := DB.Create(&cat).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to create category, slug may already exist"})
		return
	}
	logActivity(c.GetUint("user_id"), "create_category", fmt.Sprintf("Created category: %s", cat.Name), c.ClientIP())
	c.JSON(200, cat)
}

func updateCategory(c *gin.Context) {
	id := c.Param("id")
	var cat ServiceCategory
	if err := DB.First(&cat, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Category not found"})
		return
	}
	var req ServiceCategory
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	cat.Name = req.Name
	cat.Type = req.Type
	cat.SortOrder = req.SortOrder
	cat.IsActive = req.IsActive
	DB.Save(&cat)
	logActivity(c.GetUint("user_id"), "update_category", fmt.Sprintf("Updated category: %s", cat.Name), c.ClientIP())
	c.JSON(200, cat)
}

func deleteCategory(c *gin.Context) {
	id := c.Param("id")
	var cat ServiceCategory
	if err := DB.First(&cat, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Category not found"})
		return
	}
	var count int64
	DB.Model(&Service{}).Where("category = ?", cat.Slug).Count(&count)
	if count > 0 {
		c.JSON(400, gin.H{"error": fmt.Sprintf("Tidak bisa menghapus, masih ada %d produk di kategori ini", count)})
		return
	}
	DB.Delete(&ServiceCategory{}, id)
	logActivity(c.GetUint("user_id"), "delete_category", fmt.Sprintf("Deleted category: %s", cat.Name), c.ClientIP())
	c.JSON(200, gin.H{"message": "Category deleted"})
}

// @Summary Generate Point Redemption QR
// @Description Generate a QR code for redeeming a service with points. QR is valid for 5 minutes.
// @Tags Customer
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{service_id=int,vehicle_id=int} true "Redemption request"
// @Success 200 {object} object{qr_code=string,points_cost=int,expires_at=string,service=Service,vehicle=Vehicle}
// @Router /customer/redeem-qr [post]
func generateRedeemQR(c *gin.Context) {
	userID := c.GetUint("user_id")
	var req struct {
		ServiceID uint `json:"service_id" binding:"required"`
		VehicleID uint `json:"vehicle_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var service Service
	if err := DB.Where("id = ? AND is_active = ?", req.ServiceID, true).First(&service).Error; err != nil {
		c.JSON(404, gin.H{"error": "service not found"})
		return
	}
	if service.PointsPrice <= 0 {
		c.JSON(400, gin.H{"error": "service cannot be redeemed with points"})
		return
	}

	var vehicle Vehicle
	if err := DB.Where("id = ? AND user_id = ?", req.VehicleID, userID).First(&vehicle).Error; err != nil {
		c.JSON(403, gin.H{"error": "vehicle not found or does not belong to you"})
		return
	}

	var user User
	DB.Select("points").First(&user, userID)
	if user.Points < service.PointsPrice {
		c.JSON(400, gin.H{"error": fmt.Sprintf("poin tidak cukup: kamu punya %d, butuh %d", user.Points, service.PointsPrice)})
		return
	}

	expiresAt := time.Now().Add(5 * time.Minute)
	payload := map[string]interface{}{
		"type":        "redeem",
		"user_id":     userID,
		"vehicle_id":  req.VehicleID,
		"service_id":  req.ServiceID,
		"points_cost": service.PointsPrice,
		"expires_at":  expiresAt.Unix(),
	}

	jsonData, _ := json.Marshal(payload)
	qr, _ := qrcode.Encode(string(jsonData), qrcode.Medium, 256)
	qrBase64 := base64.StdEncoding.EncodeToString(qr)

	c.JSON(200, gin.H{
		"qr_code":     "data:image/png;base64," + qrBase64,
		"points_cost": service.PointsPrice,
		"expires_at":  expiresAt,
		"service":     service,
		"vehicle":     vehicle,
	})
}

// Helper functions
func generateTransactionCode() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("TRX%s%d", base64.URLEncoding.EncodeToString(b)[:8], time.Now().Unix())
}

func logActivity(userID uint, action, description, ip string) {
	log := ActivityLog{
		UserID:      userID,
		Action:      action,
		Description: description,
		IPAddress:   ip,
	}
	DB.Create(&log)
}

func createXenditInvoice(externalID string, amount float64, description string) (string, string) {
	// Placeholder - implement actual Xendit API call
	return "https://xendit.co/pay/..." + externalID, "inv_" + externalID
}
