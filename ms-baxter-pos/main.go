package main

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	_ "ms-baxter-pos/docs" // Import generated docs
)

var DB *gorm.DB

// @title Carwash Management API
// @version 1.0
// @description Complete carwash management system API with membership, transactions, and analytics
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.carwash.com/support
// @contact.email support@carwash.com

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /api

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	// Load environment variables
	godotenv.Load()

	// Initialize database
	initDB()

	// Setup Gin router
	r := gin.Default()

	// CORS configuration
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "https://ui-baxter-pos-tugasmeilyanto7522-3yjmjcnm.leapcell.dev"
	}
	origins := strings.Split(allowedOrigins, ",")

	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Swagger documentation route
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Routes
	setupRoutes(r)

	// Run server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on port %s", port)
	log.Printf("Swagger docs available at http://localhost:%s/swagger/index.html", port)
	r.Run(":" + port)
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=carwash port=5432 sslmode=disable TimeZone=Asia/Jakarta"
	} else if !strings.Contains(dsn, "TimeZone=") {
		dsn += " TimeZone=Asia/Jakarta"
	}

	isPooler := strings.Contains(dsn, "pooler.supabase.com")
	var err error
	DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: isPooler,
	}), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatal("Failed to get underlying sql.DB:", err)
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(3)
	sqlDB.SetConnMaxLifetime(10 * time.Minute)
	sqlDB.SetConnMaxIdleTime(3 * time.Minute)

	// Auto migrate models
	// DB.AutoMigrate(
	// 	&User{},
	// 	&Vehicle{},
	// 	&Membership{},
	// 	&Service{},
	// 	&Transaction{},
	// 	&TransactionItem{},
	// 	&PaymentMethod{},
	// 	&PointConfig{},
	// 	&ActivityLog{},
	// 	&Ledger{},
	// 	&CashFlow{},
	// 	&RoleAccess{},
	// 	&Employee{},
	// 	&Attendance{},
	// 	&EmployeeLoan{},
	// 	&Payroll{},
	// )

	// // Seed initial data
	// seedInitialData()

	// New tables (safe to always run — creates if not exists, never drops)
	if err := DB.AutoMigrate(&ServiceCategory{}); err != nil {
		log.Printf("Warning: failed to migrate ServiceCategory: %v", err)
	}
	if err := DB.AutoMigrate(&RoleAccess{}, &Shift{}, &Transaction{}, &CashFlow{}); err != nil {
		log.Printf("Warning: failed to migrate shift management fields: %v", err)
	}
	if err := DB.AutoMigrate(&Service{}, &TransactionItem{}, &Membership{}, &UserNotification{}, &PointActivity{}); err != nil {
		log.Printf("Warning: failed to migrate membership payment fields: %v", err)
	}
	if err := DB.AutoMigrate(&Reimbursement{}, &OvertimeRequest{}); err != nil {
		log.Printf("Warning: failed to migrate HRIS tables: %v", err)
	}
	DB.Exec("ALTER TABLE memberships      DROP CONSTRAINT IF EXISTS fk_memberships_package")
	DB.Exec("ALTER TABLE transactions     DROP CONSTRAINT IF EXISTS fk_transactions_payment_method")
	DB.Exec("ALTER TABLE transaction_items DROP CONSTRAINT IF EXISTS fk_transaction_items_service")
	seedDefaultCategories()
	seedDefaultRoleAccess()
	seedMembershipPackages()
}

func seedInitialData() {
	// Create default payment methods
	var count int64
	DB.Model(&PaymentMethod{}).Count(&count)
	if count == 0 {
		paymentMethods := []PaymentMethod{
			{Name: "Cash", Type: "cash", IsActive: true},
			{Name: "Credit Card", Type: "xendit", IsActive: true},
			{Name: "QRIS", Type: "xendit", IsActive: true},
		}
		DB.Create(&paymentMethods)
	}

	var pointConfig PointConfig
	if err := DB.First(&pointConfig).Error; err != nil {
		DB.Create(&PointConfig{MembershipPointsAwarded: 50}) // Sisa poin reward aja
	}

	// Create default services
	var serviceCount int64
	DB.Model(&Service{}).Count(&serviceCount)
	if serviceCount == 0 {
		services := []Service{
			{Category: "carwash", Name: "Wash & Wax", Description: "Complete wash with wax protection", Price: 150000, PointsAwarded: 30, IsActive: true},
			{Category: "carwash", Name: "Fast Wash", Description: "Quick exterior wash", Price: 75000, PointsAwarded: 20, IsActive: true},
			{Category: "carwash", Name: "Regular Wash", Description: "Standard wash service", Price: 100000, PointsAwarded: 20, IsActive: true},
			{Category: "bikewash", Name: "Wash & Wax", Description: "Complete wash with wax protection", Price: 50000, PointsAwarded: 30, IsActive: true},
			{Category: "bikewash", Name: "Fast Wash", Description: "Quick exterior wash", Price: 25000, PointsAwarded: 20, IsActive: true},
			{Category: "bikewash", Name: "Regular Wash", Description: "Standard wash service", Price: 35000, PointsAwarded: 20, IsActive: true},
			{
				Category: "membership", Name: "Member 1 Bulan", Price: 100000,
				PointsAwarded: 50, DurationMonths: 1, MemberDiscountPct: 0,
				Description: "Paket Membership Basic 30 Hari",
			},
			{
				Category: "membership", Name: "Member 6 Bulan", Price: 500000, // Lebih hemat
				PointsAwarded: 300, DurationMonths: 6, MemberDiscountPct: 0,
				Description: "Paket Membership Semester",
			},
			{
				Category: "membership", Name: "Member 1 Tahun", Price: 900000, // Best Value
				PointsAwarded: 1000, DurationMonths: 12, MemberDiscountPct: 0,
				Description: "Paket Membership Tahunan",
			},
		}
		DB.Create(&services)
	}

	DB.Model(&RoleAccess{}).Where("role = ?", "admin").Count(&count)
	if count == 0 {
		fullAccess := []string{
			"/dashboard",
			"/dashboard/transactions",
			"/dashboard/services",
			"/dashboard/memberships",
			"/dashboard/cashier",
			"/dashboard/cashflow",
			"/dashboard/ledger",
			"/dashboard/reports",
			"/dashboard/settings",
		}

		DB.Create(&RoleAccess{
			Role:  "admin",
			Menus: fullAccess,
		})
	}

	DB.Model(&RoleAccess{}).Where("role = ?", "cashier").Count(&count)
	if count == 0 {
		cashierAccess := []string{
			"/dashboard",
			"/dashboard/transactions",
			"/dashboard/memberships",
			"/dashboard/cashier",
		}
		DB.Create(&RoleAccess{
			Role:  "cashier",
			Menus: cashierAccess,
		})
	}
}

func seedDefaultCategories() {
	var count int64
	DB.Model(&ServiceCategory{}).Count(&count)
	if count == 0 {
		defaults := []ServiceCategory{
			{Slug: "carwash", Name: "Car Wash", Type: "service", SortOrder: 1, IsActive: true},
			{Slug: "bikewash", Name: "Bike Wash", Type: "service", SortOrder: 2, IsActive: true},
			{Slug: "membership", Name: "Membership", Type: "membership", SortOrder: 3, IsActive: true},
		}
		DB.Create(&defaults)
	}
}

func seedDefaultRoleAccess() {
	var count int64
	DB.Model(&RoleAccess{}).Where("role = ?", "admin").Count(&count)
	if count == 0 {
		DB.Create(&RoleAccess{
			Role: "admin",
			Menus: []string{
				"/dashboard",
				"/dashboard/transactions",
				"/dashboard/services",
				"/dashboard/memberships",
				"/dashboard/employees",
				"/dashboard/cashier",
				"/dashboard/cashflow",
				"/dashboard/ledger",
				"/dashboard/reports",
				"/dashboard/settings",
			},
		})
	}

	DB.Model(&RoleAccess{}).Where("role = ?", "cashier").Count(&count)
	if count == 0 {
		DB.Create(&RoleAccess{
			Role: "cashier",
			Menus: []string{
				"/dashboard",
				"/dashboard/transactions",
				"/dashboard/memberships",
				"/dashboard/cashier",
				"/dashboard/cashflow",
			},
		})
	}

	DB.Model(&RoleAccess{}).Where("role = ?", "employee").Count(&count)
	if count == 0 {
		DB.Create(&RoleAccess{
			Role: "employee",
			Menus: []string{
				"/hris",
				"/hris/reimbursements",
				"/hris/overtime",
			},
		})
	}
}

func setupRoutes(r *gin.Engine) {
	// Public routes
	public := r.Group("/api")
	{
		public.POST("/auth/google", googleAuth)
		public.GET("/services", getServices)
		public.GET("/membership/packages", getMembershipPackages)
	}

	// Customer routes (require auth)
	customer := r.Group("/api/customer")
	customer.Use(authMiddleware("customer"))
	{
		customer.GET("/profile", getProfile)
		customer.PUT("/profile", updateProfile)
		customer.PUT("/fcm-token", updateFCMToken)
		customer.GET("/membership", getMembership)
		customer.GET("/membership/pending", getPendingMemberships)
		customer.POST("/membership", createMembershipOrder)
		customer.GET("/transactions", getCustomerTransactions)
		customer.GET("/transactions/:order_id", getTransactionByOrderID)
		customer.GET("/points/activity", getPointActivity)
		customer.GET("/notifications", getCustomerNotifications)
		customer.PATCH("/notifications/read-all", markAllNotificationsRead)
		customer.PATCH("/notifications/:id/read", markNotificationRead)
		// customer.POST("/checkout", customerCheckout)
		customer.GET("/points", getPoints)
		customer.GET("/qrcode", generateCustomerQR)
		customer.POST("/redeem-qr", generateRedeemQR)
	}

	r.POST("/api/device/push", receiveFingerprintLog)

	// Exports (AI-generated CSV/Excel). Auth-gated to any logged-in user.
	exportGroup := r.Group("/api/exports")
	exportGroup.Use(authMiddleware())
	{
		exportGroup.GET("/:filename", downloadExport)
	}

	// Backoffice routes (require admin auth)
	admin := r.Group("/api/admin")
	admin.POST("/login", adminLogin)
	// --- Routes accessible by both admin and cashier ---
	adminCashier := admin.Group("")
	adminCashier.Use(authMiddleware("admin", "cashier"))
	{
		// Category management (read by all staff, write by admin only)
		adminCashier.GET("/categories", getCategories)

		// Service management
		adminCashier.GET("/services", getServices)
		adminCashier.POST("/services", createService)
		adminCashier.PUT("/services/:id", updateService)

		// Transaction management
		adminCashier.GET("/transactions", getTransactions)
		adminCashier.GET("/transactions/open", getOpenTransactions)
		adminCashier.POST("/transactions/manual", manualCheckout)
		adminCashier.POST("/transactions/:id/items", addItemsToTransaction)
		adminCashier.POST("/transactions/:id/confirm", confirmPayment)
		adminCashier.PATCH("/transactions/:id/status", updateTransactionStatus)
		adminCashier.POST("/transactions/scan-qr", scanCustomerQR)
		adminCashier.POST("/redeem/scan", scanRedeemQR)
		adminCashier.POST("/redeem/submit", submitRedeem)

		// Membership management
		adminCashier.GET("/members/search", SearchMember)
		adminCashier.GET("/users/autocomplete", UserAutocomplete)

		// AI Assistant
		adminCashier.POST("/ai/chat", AIChat)
		adminCashier.GET("/memberships", getMemberships)
		adminCashier.POST("/membership/apply", applyMembership)
		adminCashier.POST("/membership/renew", renewMembership)

		// Vehicle management
		adminCashier.GET("/vehicles", getVehicles)
		adminCashier.POST("/vehicles", createVehicleAdmin)

		// Cash flow
		adminCashier.GET("/cashflow", getCashFlow)
		adminCashier.POST("/cashflow/in", cashIn)
		adminCashier.POST("/cashflow/out", cashOut)
		adminCashier.GET("/shifts", getShifts)
		adminCashier.GET("/shifts/current", getCurrentShift)
		adminCashier.GET("/shifts/report", getShiftRangeReport)
		adminCashier.GET("/shifts/:id/report", getShiftReport)
		adminCashier.POST("/shifts/open", openShift)
		adminCashier.POST("/shifts/close", closeShift)

		// --- ATTENDANCE ---
		adminCashier.GET("/attendance", getAttendanceLogs)
		adminCashier.POST("/attendance/manual", manualAttendance)
	}

	// --- Routes accessible by admin only ---
	adminOnly := admin.Group("")
	adminOnly.Use(authMiddleware("admin"))
	{
		// Service delete (admin only)
		adminOnly.DELETE("/services/:id", deleteService)

		// Category write (admin only)
		adminOnly.POST("/categories", createCategory)
		adminOnly.PUT("/categories/:id", updateCategory)
		adminOnly.DELETE("/categories/:id", deleteCategory)

		// User management
		adminOnly.GET("/users", getUsers)
		adminOnly.POST("/users", createUser)
		adminOnly.PUT("/users/:id", updateUser)
		adminOnly.DELETE("/users/:id", deleteUser)

		// Reports
		adminOnly.GET("/reports/monthly", getMonthlyReport)
		adminOnly.GET("/reports/revenue", getRevenueChart)
		adminOnly.GET("/reports/export", exportTransactions)
		adminOnly.GET("/reports/analytics", getAnalytics)
		adminOnly.GET("/reports/transaction", getAdvanceTransaction)

		// Ledger
		adminOnly.GET("/ledger", getLedger)
		adminOnly.POST("/ledger", createLedgerEntry)

		// Activity logs
		adminOnly.GET("/logs", getActivityLogs)

		// Point configuration
		adminOnly.GET("/config/points", getPointConfig)
		adminOnly.PUT("/config/points", updatePointConfig)

		// RBAC Management
		adminOnly.GET("/rbac/roles", getAllRoleAccess)
		adminOnly.POST("/rbac/roles", updateRoleAccess)

		// --- EMPLOYEE MANAGEMENT ---
		adminOnly.GET("/employees", getEmployees)
		adminOnly.POST("/employees", createEmployee)
		adminOnly.PUT("/employees/:id", updateEmployee)
		adminOnly.DELETE("/employees/:id", deleteEmployee)

		// --- FINANCE / CASHBON ---
		adminOnly.GET("/loans", getLoans)
		adminOnly.POST("/loans", createLoan)

		// Email test (verify SMTP config)
		adminOnly.POST("/test-email", testInvoiceEmail)

		// --- PAYROLL ---
		adminOnly.GET("/payroll/preview", getPayrollPreview)
		adminOnly.POST("/payroll/generate", generatePayroll)
		adminOnly.GET("/payroll/history", getPayrollHistory)
	}

	// Employee HRIS routes (role: employee)
	employee := r.Group("/api/employee")
	employee.Use(authMiddleware("employee"))
	{
		employee.GET("/reimbursements", getMyReimbursements)
		employee.POST("/reimbursements", submitReimbursement)
		employee.GET("/overtime", getMyOvertime)
		employee.POST("/overtime", submitOvertime)
	}

	// Admin HRIS management routes
	adminOnly.GET("/hris/reimbursements", adminGetReimbursements)
	adminOnly.PATCH("/hris/reimbursements/:id/review", adminReviewReimbursement)
	adminOnly.GET("/hris/overtime", adminGetOvertime)
	adminOnly.PATCH("/hris/overtime/:id/review", adminReviewOvertime)

	authenticated := r.Group("/api")
	authenticated.Use(authMiddleware())
	{
		authenticated.GET("/user/menus", getMyMenuAccess)
	}

	// Webhooks
	r.POST("/api/webhook/xendit", xenditWebhook)
	r.POST("/api/payment/midtrans/notification", midtransNotification)
}
