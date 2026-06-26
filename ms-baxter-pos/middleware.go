package main

import (
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func authMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "No authorization header"})
			c.Abort()
			return
		}

		tokenString := strings.Replace(authHeader, "Bearer ", "", 1)
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			c.JSON(401, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims := token.Claims.(jwt.MapClaims)
		userID := uint(claims["user_id"].(float64))
		role := claims["role"].(string)

		if len(allowedRoles) > 0 {
			allowed := false
			for _, r := range allowedRoles {
				if role == r {
					allowed = true
					break
				}
			}
			if !allowed {
				c.JSON(403, gin.H{"error": "Insufficient permissions"})
				c.Abort()
				return
			}
		}

		c.Set("user_id", userID)
		c.Set("role", role)
		c.Next()
	}
}

func xenditWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Verify webhook signature
	xenditSignature := c.GetHeader("X-Callback-Token")
	if xenditSignature != os.Getenv("XENDIT_WEBHOOK_TOKEN") {
		c.JSON(401, gin.H{"error": "Invalid signature"})
		return
	}

	// Get transaction by external_id
	externalID := payload["external_id"].(string)
	status := payload["status"].(string)

	var transaction Transaction
	if err := DB.Where("transaction_code = ?", externalID).First(&transaction).Error; err != nil {
		c.JSON(404, gin.H{"error": "Transaction not found"})
		return
	}

	// Update transaction status based on Xendit status
	if status == "PAID" || status == "SETTLED" {
		now := time.Now()
		updates := map[string]interface{}{
			"status":  "paid",
			"paid_at": &now,
		}
		DB.Model(&transaction).Updates(updates)

		// Award points to user
		DB.Model(&User{}).Where("id = ?", transaction.UserID).Update("points", DB.Raw("points + ?", transaction.PointsEarned))

		// Check if this is a membership transaction
		var membership Membership
		if err := DB.Where("transaction_id = ?", transaction.ID).First(&membership).Error; err == nil {
			startDate := time.Now()
			endDate := startDate.AddDate(0, 1, 0)
			DB.Model(&membership).Updates(map[string]interface{}{
				"status":     "active",
				"start_date": &startDate,
				"end_date":   &endDate,
			})
		}
		var creatorID uint = 0
		if transaction.UserID != nil {
			creatorID = *transaction.UserID
		}

		// Create ledger entry
		DB.Create(&Ledger{
			Date:        time.Now(),
			Type:        "income",
			Category:    "service",
			Amount:      transaction.TotalAmount,
			Description: "Payment via Xendit: " + externalID,
			Reference:   externalID,
			CreatedBy:   creatorID,
		})

		// Fire invoice email + mobile push after successful online payment
		go sendInvoiceEmail(transaction.ID)
		go sendTransactionPaidNotification(transaction.ID)
	} else if status == "EXPIRED" || status == "FAILED" {
		DB.Model(&transaction).Update("status", "failed")
	}

	c.JSON(200, gin.H{"message": "Webhook processed"})
}

// Background job to check expiring memberships
func checkExpiringMemberships() {
	// Run daily at midnight
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		sevenDaysFromNow := time.Now().AddDate(0, 0, 7)

		var memberships []Membership
		DB.Where("status = ? AND end_date <= ? AND reminder_sent = ?", "active", sevenDaysFromNow, false).
			Preload("User").Preload("Vehicle").
			Find(&memberships)

		for _, m := range memberships {
			// Send reminder notification (implement your notification service)
			// For now, just mark as sent
			DB.Model(&m).Update("reminder_sent", true)
		}
	}
}
