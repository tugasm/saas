package main

import (
	"log"
	"math"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// recordPointActivity menyimpan aktivitas poin ke DB.
// Dipanggil SETELAH users.points diupdate agar running_balance mencerminkan saldo terkini.
// points: positif untuk earned/bonus, negatif untuk redeemed/expired.
func recordPointActivity(userID uint, title, description, activityType string, points int, referenceID *uint) {
	var user User
	if err := DB.Select("points").First(&user, userID).Error; err != nil {
		log.Printf("[POINTS] failed to load user %d for balance snapshot: %v", userID, err)
		return
	}

	activity := PointActivity{
		UserID:         userID,
		Title:          title,
		Description:    description,
		Type:           activityType,
		Points:         points,
		RunningBalance: user.Points,
		ReferenceID:    referenceID,
	}
	if err := DB.Create(&activity).Error; err != nil {
		log.Printf("[POINTS] failed to save activity user=%d: %v", userID, err)
	}
}

// GET /api/customer/points/activity
func getPointActivity(c *gin.Context) {
	userID := c.GetUint("user_id")

	// --- parse query params ---
	limit := 20
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			if v > 50 {
				v = 50
			}
			limit = v
		}
	}

	page := 1
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}

	activityType := c.Query("type") // "" | "earned" | "redeemed" | "expired" | "bonus"

	// --- query aktivitas ---
	q := DB.Model(&PointActivity{}).Where("user_id = ?", userID)
	if activityType != "" {
		q = q.Where("type = ?", activityType)
	}

	var total int64
	q.Count(&total)

	var activities []PointActivity
	q.Order("created_at DESC, id DESC").
		Limit(limit).Offset((page - 1) * limit).
		Find(&activities)

	// --- summary (selalu all-time, tidak dipengaruhi filter type) ---
	var totalEarned int
	DB.Model(&PointActivity{}).
		Where("user_id = ? AND type IN ('earned','bonus') AND points > 0", userID).
		Select("COALESCE(SUM(points), 0)").Scan(&totalEarned)

	var totalRedeemedRaw int
	DB.Model(&PointActivity{}).
		Where("user_id = ? AND type = 'redeemed'", userID).
		Select("COALESCE(SUM(points), 0)").Scan(&totalRedeemedRaw)
	totalRedeemed := int(math.Abs(float64(totalRedeemedRaw))) // tampilkan sebagai positif

	var user User
	DB.Select("points").First(&user, userID)

	totalPages := int((total + int64(limit) - 1) / int64(limit))
	if totalPages == 0 {
		totalPages = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"activities":      activities,
		"total_earned":    totalEarned,
		"total_redeemed":  totalRedeemed,
		"current_balance": user.Points,
		"page":            page,
		"total_pages":     totalPages,
	})
}
