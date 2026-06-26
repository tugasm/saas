package main

import (
	"math"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func hrisParseIntDefault(s string, def int) int {
	if v, err := strconv.Atoi(s); err == nil && v > 0 {
		return v
	}
	return def
}

// ── Employee: Reimbursement ──────────────────────────────────────────────────

func submitReimbursement(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Amount      float64 `json:"amount" binding:"required,gt=0"`
		Category    string  `json:"category" binding:"required"`
		Description string  `json:"description" binding:"required"`
		Evidence    string  `json:"evidence"`
		ExpenseDate string  `json:"expense_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	expenseDate, err := time.Parse("2006-01-02", req.ExpenseDate)
	if err != nil {
		c.JSON(400, gin.H{"error": "expense_date format harus YYYY-MM-DD"})
		return
	}

	reimb := Reimbursement{
		UserID:      userID,
		Amount:      req.Amount,
		Category:    req.Category,
		Description: req.Description,
		Evidence:    req.Evidence,
		ExpenseDate: expenseDate,
		Status:      "pending",
	}
	if err := DB.Create(&reimb).Error; err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(201, reimb)
}

func getMyReimbursements(c *gin.Context) {
	userID := c.GetUint("user_id")
	status := c.Query("status")

	var items []Reimbursement
	q := DB.Where("user_id = ?", userID).Order("created_at desc")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Find(&items)

	c.JSON(200, items)
}

// ── Employee: Overtime ───────────────────────────────────────────────────────

func submitOvertime(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Date      string `json:"date" binding:"required"`
		StartTime string `json:"start_time" binding:"required"`
		EndTime   string `json:"end_time" binding:"required"`
		Reason    string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(400, gin.H{"error": "date format harus YYYY-MM-DD"})
		return
	}

	startTime, err := time.Parse("2006-01-02 15:04", req.Date+" "+req.StartTime)
	if err != nil {
		c.JSON(400, gin.H{"error": "start_time format harus HH:MM"})
		return
	}

	endTime, err := time.Parse("2006-01-02 15:04", req.Date+" "+req.EndTime)
	if err != nil {
		c.JSON(400, gin.H{"error": "end_time format harus HH:MM"})
		return
	}

	if !endTime.After(startTime) {
		c.JSON(400, gin.H{"error": "end_time harus setelah start_time"})
		return
	}

	hours := math.Round(endTime.Sub(startTime).Hours()*100) / 100

	ot := OvertimeRequest{
		UserID:    userID,
		Date:      date,
		StartTime: startTime,
		EndTime:   endTime,
		Hours:     hours,
		Reason:    req.Reason,
		Status:    "pending",
	}
	if err := DB.Create(&ot).Error; err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(201, ot)
}

func getMyOvertime(c *gin.Context) {
	userID := c.GetUint("user_id")
	status := c.Query("status")

	var items []OvertimeRequest
	q := DB.Where("user_id = ?", userID).Order("date desc")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Find(&items)

	c.JSON(200, items)
}

// ── Admin: Reimbursement management ─────────────────────────────────────────

func adminGetReimbursements(c *gin.Context) {
	status := c.Query("status")
	page := hrisParseIntDefault(c.DefaultQuery("page", "1"), 1)
	limit := hrisParseIntDefault(c.DefaultQuery("limit", "20"), 20)
	offset := (page - 1) * limit

	var total int64
	var items []Reimbursement

	q := DB.Model(&Reimbursement{}).Preload("User").Preload("Approver")
	if status != "" {
		q = q.Where("status = ?", status)
	}

	q.Count(&total)
	q.Order("created_at desc").Limit(limit).Offset(offset).Find(&items)

	c.JSON(200, gin.H{
		"data":  items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func adminReviewReimbursement(c *gin.Context) {
	adminID := c.GetUint("user_id")
	id := c.Param("id")

	var req struct {
		Status     string `json:"status" binding:"required,oneof=approved rejected"`
		AdminNotes string `json:"admin_notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var reimb Reimbursement
	if err := DB.First(&reimb, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Reimbursement tidak ditemukan"})
		return
	}
	if reimb.Status != "pending" {
		c.JSON(400, gin.H{"error": "Hanya pengajuan dengan status pending yang bisa direview"})
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":      req.Status,
		"admin_notes": req.AdminNotes,
		"approved_by": adminID,
		"approved_at": &now,
	}
	DB.Model(&reimb).Updates(updates)

	c.JSON(200, gin.H{"message": "Reimbursement berhasil di-review", "status": req.Status})
}

// ── Admin: Overtime management ───────────────────────────────────────────────

func adminGetOvertime(c *gin.Context) {
	status := c.Query("status")
	page := hrisParseIntDefault(c.DefaultQuery("page", "1"), 1)
	limit := hrisParseIntDefault(c.DefaultQuery("limit", "20"), 20)
	offset := (page - 1) * limit

	var total int64
	var items []OvertimeRequest

	q := DB.Model(&OvertimeRequest{}).Preload("User").Preload("Approver")
	if status != "" {
		q = q.Where("status = ?", status)
	}

	q.Count(&total)
	q.Order("date desc").Limit(limit).Offset(offset).Find(&items)

	c.JSON(200, gin.H{
		"data":  items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func adminReviewOvertime(c *gin.Context) {
	adminID := c.GetUint("user_id")
	id := c.Param("id")

	var req struct {
		Status     string `json:"status" binding:"required,oneof=approved rejected"`
		AdminNotes string `json:"admin_notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var ot OvertimeRequest
	if err := DB.First(&ot, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Overtime request tidak ditemukan"})
		return
	}
	if ot.Status != "pending" {
		c.JSON(400, gin.H{"error": "Hanya pengajuan dengan status pending yang bisa direview"})
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":      req.Status,
		"admin_notes": req.AdminNotes,
		"approved_by": adminID,
		"approved_at": &now,
	}
	DB.Model(&ot).Updates(updates)

	c.JSON(200, gin.H{"message": "Overtime request berhasil di-review", "status": req.Status})
}

