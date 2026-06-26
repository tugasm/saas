package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// MembershipPackageResp adalah DTO untuk response GET /api/membership/packages.
// Memetakan kolom dari tabel services (category='membership') ke format yang diharapkan FE.
type MembershipPackageResp struct {
	ID             uint     `json:"id"`
	Name           string   `json:"name"`
	Subtitle       string   `json:"subtitle"`        // dari services.description
	VehicleType    string   `json:"vehicle_type"`    // "car" | "motorcycle"
	DurationMonths int      `json:"duration_months"` // dari services.duration_months
	Price          float64  `json:"price"`
	Features       []string `json:"features"`
	IsPopular      bool     `json:"is_popular"`
}

func serviceToPackageResp(s Service) MembershipPackageResp {
	features := s.Features
	if features == nil {
		features = []string{}
	}
	return MembershipPackageResp{
		ID:             s.ID,
		Name:           s.Name,
		Subtitle:       s.Description,
		VehicleType:    s.VehicleType,
		DurationMonths: s.DurationMonths,
		Price:          s.Price,
		Features:       features,
		IsPopular:      s.IsPopular,
	}
}

// seedMembershipPackages menyemai 6 paket membership ke tabel services.
// Dilewati bila paket dengan vehicle_type sudah ada.
func seedMembershipPackages() {
	var count int64
	DB.Model(&Service{}).Where("category = 'membership' AND vehicle_type != ''").Count(&count)
	if count > 0 {
		return
	}

	services := []Service{
		{
			Category: "membership", VehicleType: "car", DurationMonths: 1, Price: 150000, IsActive: true,
			Name: "Member Mobil 1 Bulan", Description: "Cuci unlimited untuk mobil, 1 bulan",
			Features: []string{"Cuci body unlimited", "Diskon 10% layanan lain", "Poin reward"},
		},
		{
			Category: "membership", VehicleType: "car", DurationMonths: 3, Price: 400000, IsPopular: true, IsActive: true,
			Name: "Member Mobil 3 Bulan", Description: "Hemat untuk 3 bulan",
			Features: []string{"Cuci body unlimited", "Diskon 15% layanan lain", "Poin reward 2x"},
		},
		{
			Category: "membership", VehicleType: "car", DurationMonths: 12, Price: 1500000, IsActive: true,
			Name: "Member Mobil 12 Bulan", Description: "Paling hemat",
			Features: []string{"Cuci body unlimited", "Diskon 20% layanan lain", "Poin reward 2x", "Prioritas antrian"},
		},
		{
			Category: "membership", VehicleType: "motorcycle", DurationMonths: 1, Price: 75000, IsActive: true,
			Name: "Member Motor 1 Bulan", Description: "Cuci unlimited untuk motor, 1 bulan",
			Features: []string{"Cuci unlimited", "Diskon 10% layanan lain", "Poin reward"},
		},
		{
			Category: "membership", VehicleType: "motorcycle", DurationMonths: 3, Price: 200000, IsActive: true,
			Name: "Member Motor 3 Bulan", Description: "Hemat untuk 3 bulan",
			Features: []string{"Cuci unlimited", "Diskon 15% layanan lain", "Poin reward 2x"},
		},
		{
			Category: "membership", VehicleType: "motorcycle", DurationMonths: 12, Price: 750000, IsActive: true,
			Name: "Member Motor 12 Bulan", Description: "Paling hemat",
			Features: []string{"Cuci unlimited", "Diskon 20% layanan lain", "Poin reward 2x"},
		},
	}
	DB.Create(&services)
}

// --- repository ---

func listMembershipPackagesFromDB(vehicleType string) ([]Service, error) {
	var services []Service
	q := DB.Where("category = 'membership' AND is_active = true").Order("id ASC")
	if vehicleType != "" {
		q = q.Where("vehicle_type = ?", vehicleType)
	}
	if err := q.Find(&services).Error; err != nil {
		return nil, err
	}
	return services, nil
}

// --- handler ---

func getMembershipPackages(c *gin.Context) {
	vehicleType := c.Query("vehicle_type")
	services, err := listMembershipPackagesFromDB(vehicleType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch membership packages",
			"code":  "ERR_DB",
		})
		return
	}

	resp := make([]MembershipPackageResp, 0, len(services))
	for _, s := range services {
		resp = append(resp, serviceToPackageResp(s))
	}
	c.JSON(http.StatusOK, gin.H{"packages": resp})
}
