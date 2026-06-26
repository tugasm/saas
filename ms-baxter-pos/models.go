package main

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	GoogleID     *string        `gorm:"uniqueIndex" json:"google_id"`
	Email        string         `gorm:"uniqueIndex" json:"email"`
	Name         string         `json:"name"`
	Phone        string         `json:"phone"`
	Photo        string         `json:"photo"`
	Address      string         `json:"address"`
	BirthPlace   string         `json:"birth_place"`
	BirthDate    *time.Time     `gorm:"type:date" json:"birth_date"`
	Gender       string         `json:"gender"`                         // male, female
	FCMToken     string         `gorm:"type:text" json:"-"`             // Firebase Cloud Messaging device token (mobile push)
	Role         string         `gorm:"default:'customer'" json:"role"` // customer, admin
	Points       int            `gorm:"default:0" json:"points"`
	Password     string         `json:"-"` // For admin login
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	Vehicles     []Vehicle      `gorm:"foreignKey:UserID" json:"vehicles,omitempty"`
	Memberships  []Membership   `gorm:"foreignKey:UserID" json:"memberships,omitempty"`
	Transactions []Transaction  `gorm:"foreignKey:UserID" json:"transactions,omitempty"`
}

type Vehicle struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	UserID       uint           `json:"user_id"`
	Type         string         `json:"type"` // car, bike
	Brand        string         `json:"brand"`
	Model        string         `json:"model"`
	Year         int            `json:"year"`
	Color        string         `json:"color"`
	LicensePlate string         `gorm:"uniqueIndex" json:"license_plate"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	User         *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Memberships  []Membership   `gorm:"foreignKey:VehicleID" json:"memberships"`
}

type Membership struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserID        uint           `json:"user_id"`
	VehicleID     uint           `json:"vehicle_id"`
	PackageID     *uint          `json:"package_id"`
	Status        string         `gorm:"default:'pending'" json:"status"` // pending, active, expired, cancelled
	StartDate     *time.Time     `json:"start_date"`
	EndDate       *time.Time     `json:"end_date"`
	TransactionID *uint          `json:"transaction_id"`
	ReminderSent  bool           `gorm:"default:false" json:"reminder_sent"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	User          *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Vehicle       *Vehicle       `gorm:"foreignKey:VehicleID" json:"vehicle,omitempty"`
	Transaction   *Transaction   `gorm:"foreignKey:TransactionID" json:"transaction,omitempty"`
	Package       *Service       `gorm:"foreignKey:PackageID;constraint:OnDelete:SET NULL" json:"package,omitempty"`
}

type Service struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Category          string         `json:"category"` // 'carwash', 'bikewash', 'membership'
	Name              string         `json:"name"`
	Description       string         `json:"description"`
	Price             float64        `json:"price"`
	Duration          int            `json:"duration"`            // Durasi pengerjaan (menit)
	PointsAwarded     int            `json:"points_awarded"`      // Poin yg didapat
	MemberDiscountPct float64        `json:"member_discount_pct"` // 0 - 100 (e.g., 100 = Gratis, 50 = Bayar setengah)
	DurationMonths    int            `json:"duration_months"`     // Khusus category='membership' (e.g., 1, 6, 12)
	PointsPrice       int            `json:"points_price"`        // Poin untuk redeem service ini (0 = tidak bisa diredeem)
	VehicleType       string         `json:"vehicle_type"`        // Khusus membership: "car" | "motorcycle"
	Features          []string       `gorm:"serializer:json" json:"features"`
	IsPopular         bool           `gorm:"default:false" json:"is_popular"`
	IsActive          bool           `gorm:"default:true" json:"is_active"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type Transaction struct {
	ID               uint              `gorm:"primaryKey" json:"id"`
	UserID           *uint             `json:"user_id"`
	ShiftID          *uint             `gorm:"index" json:"shift_id"`
	TransactionCode  string            `gorm:"uniqueIndex" json:"transaction_code"`
	TxType           string            `gorm:"default:'service'" json:"tx_type"` // service, membership
	ReferenceID      *uint             `json:"reference_id"`
	TotalAmount      float64           `json:"total_amount"`
	PointsEarned     int               `json:"points_earned"`
	PointsUsed       int               `json:"points_used"`
	Status           string            `gorm:"default:'pending'" json:"status"` // pending, paid, cancelled, failed, expired
	PaymentMethodID  *uint             `json:"payment_method_id"`
	PaymentType      string            `json:"payment_type"` // cash, xendit, points, mixed, qris, gopay, etc.
	VehicleID        *uint             `json:"vehicle_id"`
	XenditInvoiceID  string            `json:"xendit_invoice_id,omitempty"`
	XenditPaymentURL string            `json:"xendit_payment_url,omitempty"`
	SnapToken        string            `gorm:"type:text" json:"-"`
	RawNotification  string            `gorm:"type:text" json:"-"`
	PaidAt           *time.Time        `json:"paid_at"`
	CashierID        *uint             `json:"cashier_id"` // Admin who processed
	Notes            string            `json:"notes"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
	DeletedAt        gorm.DeletedAt    `gorm:"index" json:"-"`
	User             User              `json:"user,omitempty"`
	Shift            *Shift            `gorm:"foreignKey:ShiftID" json:"shift,omitempty"`
	Cashier          *User             `gorm:"foreignKey:CashierID" json:"cashier,omitempty"`
	PaymentMethod    PaymentMethod     `json:"payment_method,omitempty"`
	Items            []TransactionItem `json:"items,omitempty"`
}
type TransactionItem struct {
	ID             uint    `gorm:"primaryKey" json:"id"`
	TransactionID  uint    `json:"transaction_id"`
	ServiceID      uint    `json:"service_id"`
	Name           string  `json:"name"`
	Quantity       int     `json:"quantity"`
	BasePrice      float64 `json:"base_price"`      // Harga Asli (Rp 50.000)
	DiscountAmount float64 `json:"discount_amount"` // Potongan Member (Rp 50.000 atau Rp 25.000)
	FinalPrice     float64 `json:"final_price"`
	Subtotal       float64 `json:"subtotal"` // FinalPrice * Qty
	Service        Service `gorm:"foreignKey:ServiceID;constraint:OnDelete:SET NULL" json:"service"`
}

type PaymentMethod struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `json:"name"`
	Type      string         `json:"type"` // cash, xendit
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type PointConfig struct {
	ID                      uint      `gorm:"primaryKey" json:"id"`
	MembershipPointsAwarded int       `json:"membership_points_awarded"` // Poin saat daftar/renew membership
	MembershipPrice         float64   `json:"membership_price"`
	UpdatedAt               time.Time `json:"updated_at"`
}

type ServiceCategory struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Slug      string         `gorm:"uniqueIndex;not null" json:"slug"` // 'carwash', 'bikewash', 'foodbeverage'
	Name      string         `gorm:"not null" json:"name"`             // 'Car Wash', 'Bike Wash'
	Type      string         `gorm:"default:'service'" json:"type"`    // 'service' | 'membership'
	SortOrder int            `gorm:"default:0" json:"sort_order"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type ActivityLog struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `json:"user_id"`
	Action      string    `json:"action"`
	Description string    `json:"description"`
	IPAddress   string    `json:"ip_address"`
	CreatedAt   time.Time `json:"created_at"`
	User        User      `json:"user,omitempty"`
}

type Ledger struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Date        time.Time      `json:"date"`
	Type        string         `json:"type"` // income, expense
	Category    string         `json:"category"`
	Amount      float64        `json:"amount"`
	Description string         `json:"description"`
	Reference   string         `json:"reference"`
	CreatedBy   uint           `json:"created_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Creator     User           `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
}

type CashFlow struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ShiftID     *uint          `gorm:"index" json:"shift_id"`
	Type        string         `json:"type"` // in, out
	Amount      float64        `json:"amount"`
	Description string         `json:"description"`
	Evidence    string         `json:"evidence"` // URL to receipt image for cash out
	Category    string         `json:"category"`
	CreatedBy   uint           `json:"created_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Shift       *Shift         `gorm:"foreignKey:ShiftID" json:"shift,omitempty"`
	Creator     User           `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
}

type Shift struct {
	ID                     uint           `gorm:"primaryKey" json:"id"`
	CashierID              uint           `gorm:"index" json:"cashier_id"`
	ShiftDate              time.Time      `gorm:"type:date;index" json:"shift_date"`
	OpeningBalance         float64        `json:"opening_balance"`
	ClosingBalance         *float64       `json:"closing_balance"`
	ExpectedClosingBalance float64        `json:"expected_closing_balance"`
	Difference             float64        `json:"difference"`
	Status                 string         `gorm:"default:'open';index" json:"status"` // open, closed
	OpenedAt               time.Time      `json:"opened_at"`
	ClosedAt               *time.Time     `json:"closed_at"`
	OpeningNote            string         `json:"opening_note"`
	ClosingNote            string         `json:"closing_note"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
	Cashier                User           `gorm:"foreignKey:CashierID" json:"cashier,omitempty"`
	CashFlows              []CashFlow     `gorm:"foreignKey:ShiftID" json:"cash_flows,omitempty"`
	Transactions           []Transaction  `gorm:"foreignKey:ShiftID" json:"transactions,omitempty"`
}

type ProfileResponse struct {
	User        User         `json:"user"`
	Vehicles    []Vehicle    `json:"vehicles"`
	Memberships []Membership `json:"memberships"`
}

// Struct Khusus untuk Response (Agar format JSON presisi sesuai request)
type MemberResponse struct {
	ID       uint              `json:"id"`
	Name     string            `json:"name"`
	Email    string            `json:"email"`
	Points   int               `json:"points"`
	Tier     string            `json:"tier"`
	Vehicles []VehicleResponse `json:"vehicles"`
}

type VehicleResponse struct {
	ID          uint   `json:"id"`
	PlateNumber string `json:"plate_number"`
	Model       string `json:"model"`
}

type PointActivity struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	UserID         uint      `gorm:"index;not null" json:"user_id"`
	Title          string    `json:"title"`
	Description    string    `gorm:"type:text" json:"description"`
	Points         int       `json:"points"`
	RunningBalance int       `json:"running_balance"`
	Type           string    `json:"type"`
	ReferenceID    *uint     `json:"reference_id"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type UserNotification struct {
	ID        uint              `gorm:"primaryKey" json:"id"`
	UserID    uint              `gorm:"index;not null" json:"user_id"`
	Title     string            `json:"title"`
	Body      string            `gorm:"type:text" json:"body"`
	Type      string            `json:"type"`
	Data      map[string]string `gorm:"serializer:json" json:"data"`
	IsRead    bool              `gorm:"default:false" json:"is_read"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
	DeletedAt gorm.DeletedAt    `gorm:"index" json:"-"`
}

type CustomerTransactionItemResp struct {
	ID       uint    `json:"id"`
	Name     string  `json:"name"`
	Quantity int     `json:"quantity"`
	Price    float64 `json:"price"`
	Subtotal float64 `json:"subtotal"`
}

type CustomerTransactionResp struct {
	ID              uint                          `json:"id"`
	TransactionCode string                        `json:"transaction_code"`
	TotalAmount     float64                       `json:"total_amount"`
	PointsEarned    int                           `json:"points_earned"`
	Status          string                        `json:"status"`
	PaymentType     string                        `json:"payment_type"`
	PaidAt          *time.Time                    `json:"paid_at"`
	CreatedAt       time.Time                     `json:"created_at"`
	Items           []CustomerTransactionItemResp `json:"items"`
}

type RoleAccess struct {
	Role  string   `gorm:"primaryKey" json:"role"`       // e.g., "admin", "cashier", "customer"
	Menus []string `gorm:"serializer:json" json:"menus"` // List href: ["/dashboard", "/dashboard/transactions"]
}

type Employee struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `json:"name"`
	Phone        string         `json:"phone"`          // Kontak (bukan buat login)
	Position     string         `json:"position"`       // Jabatan
	DeviceUserID string         `json:"device_user_id"` // ID Fingerprint
	HourlyRate   float64        `json:"hourly_rate"`    // Gaji/Jam
	JoinDate     time.Time      `json:"join_date"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// Update relasi tabel lain ke EmployeeID
type Attendance struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	EmployeeID uint       `json:"employee_id"` // <-- Ganti UserID jadi EmployeeID
	Date       time.Time  `gorm:"type:date;index" json:"date"`
	ClockIn    time.Time  `json:"clock_in"`
	ClockOut   *time.Time `json:"clock_out"`
	DurationH  float64    `json:"duration_hours"`
	DailyWage  float64    `json:"daily_wage"`
	Status     string     `json:"status"`
	Notes      string     `json:"notes"`
	Employee   Employee   `gorm:"foreignKey:EmployeeID" json:"employee,omitempty"`
}

type EmployeeLoan struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	EmployeeID      uint      `json:"employee_id"` // <-- Ganti UserID jadi EmployeeID
	Amount          float64   `json:"amount"`
	RemainingAmount float64   `json:"remaining_amount"`
	Reason          string    `json:"reason"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	Employee        Employee  `gorm:"foreignKey:EmployeeID" json:"employee,omitempty"`
}

type Payroll struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	EmployeeID    uint       `json:"employee_id"` // <-- Ganti UserID jadi EmployeeID
	PeriodStart   time.Time  `json:"period_start"`
	PeriodEnd     time.Time  `json:"period_end"`
	TotalHours    float64    `json:"total_hours"`
	BaseSalary    float64    `json:"base_salary"`
	LoanDeduction float64    `json:"loan_deduction"`
	Bonus         float64    `json:"bonus"`
	NetSalary     float64    `json:"net_salary"`
	Status        string     `json:"status"`
	PaymentDate   *time.Time `json:"payment_date"`
	Employee      Employee   `gorm:"foreignKey:EmployeeID" json:"employee,omitempty"`
}

// Reimbursement — pengajuan penggantian biaya oleh employee
type Reimbursement struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"index;not null" json:"user_id"`
	Amount      float64        `json:"amount"`
	Category    string         `json:"category"` // transport, meal, medical, other
	Description string         `gorm:"type:text" json:"description"`
	Evidence    string         `gorm:"type:text" json:"evidence"` // URL foto struk
	ExpenseDate time.Time      `gorm:"type:date" json:"expense_date"`
	Status      string         `gorm:"default:'pending'" json:"status"` // pending, approved, rejected
	AdminNotes  string         `gorm:"type:text" json:"admin_notes"`
	ApprovedBy  *uint          `json:"approved_by"`
	ApprovedAt  *time.Time     `json:"approved_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	User        User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Approver    *User          `gorm:"foreignKey:ApprovedBy" json:"approver,omitempty"`
}

// OvertimeRequest — pengajuan lembur oleh employee
type OvertimeRequest struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	UserID     uint           `gorm:"index;not null" json:"user_id"`
	Date       time.Time      `gorm:"type:date" json:"date"`
	StartTime  time.Time      `json:"start_time"`
	EndTime    time.Time      `json:"end_time"`
	Hours      float64        `json:"hours"`
	Reason     string         `gorm:"type:text" json:"reason"`
	Status     string         `gorm:"default:'pending'" json:"status"` // pending, approved, rejected
	AdminNotes string         `gorm:"type:text" json:"admin_notes"`
	ApprovedBy *uint          `json:"approved_by"`
	ApprovedAt *time.Time     `json:"approved_at"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	User       User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Approver   *User          `gorm:"foreignKey:ApprovedBy" json:"approver,omitempty"`
}
