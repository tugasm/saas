package main

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// createUserNotification menyimpan notifikasi ke DB.
// Dipanggil sebelum kirim FCM agar notif tetap tersimpan walau FCM gagal.
func createUserNotification(userID uint, title, body, notifType string, data map[string]string) {
	n := UserNotification{
		UserID: userID,
		Title:  title,
		Body:   body,
		Type:   notifType,
		Data:   data,
	}
	if err := DB.Create(&n).Error; err != nil {
		log.Printf("[NOTIF] failed to save notification user=%d: %v", userID, err)
	}
}

// GET /api/customer/notifications
func getCustomerNotifications(c *gin.Context) {
	userID := c.GetUint("user_id")

	limit := 30
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	offset := 0
	if p := c.Query("page"); p != "" {
		if page, err := strconv.Atoi(p); err == nil && page > 1 {
			offset = (page - 1) * limit
		}
	}

	var notifications []UserNotification
	DB.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&notifications)

	var unreadCount int64
	DB.Model(&UserNotification{}).
		Where("user_id = ? AND is_read = false", userID).
		Count(&unreadCount)

	c.JSON(http.StatusOK, gin.H{
		"notifications": notifications,
		"unread_count":  unreadCount,
	})
}

// PATCH /api/customer/notifications/:id/read
func markNotificationRead(c *gin.Context) {
	userID := c.GetUint("user_id")
	id := c.Param("id")

	result := DB.Model(&UserNotification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true)

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "notifikasi tidak ditemukan", "code": "ERR_NOT_FOUND"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// PATCH /api/customer/notifications/read-all
func markAllNotificationsRead(c *gin.Context) {
	userID := c.GetUint("user_id")
	DB.Model(&UserNotification{}).
		Where("user_id = ? AND is_read = false", userID).
		Update("is_read", true)
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
