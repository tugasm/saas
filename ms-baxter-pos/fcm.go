package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

var (
	fcmClient     *messaging.Client
	fcmInitOnce   sync.Once
	fcmInitErr    error
	fcmConfigured bool
)

// extractFirebaseProjectID reads the project_id field from the service account
// credentials so it can be passed explicitly to firebase.NewApp. The Firebase
// Go Admin SDK v4 does not auto-populate ProjectID from the credential file
// when initialising the Messaging client, causing the
// "project ID is required" error if the config is nil.
func extractFirebaseProjectID(jsonContent, path string) string {
	var raw []byte
	if jsonContent != "" {
		raw = []byte(jsonContent)
	} else if path != "" {
		var err error
		raw, err = os.ReadFile(path)
		if err != nil {
			log.Printf("[FCM] could not read credentials file to extract project ID: %v", err)
			return ""
		}
	}
	var cred struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.Unmarshal(raw, &cred); err != nil {
		log.Printf("[FCM] could not parse credentials JSON: %v", err)
		return ""
	}
	return cred.ProjectID
}

// initFCM lazily initializes the Firebase Messaging client.
// Credentials are loaded from either:
//   - FIREBASE_CREDENTIALS_JSON (raw JSON content — preferred for deploy)
//   - FIREBASE_CREDENTIALS_PATH (file path — convenient for dev)
//
// If neither is set, FCM is treated as "not configured" and sends are skipped.
func initFCM() {
	fcmInitOnce.Do(func() {
		jsonContent := strings.TrimSpace(os.Getenv("FIREBASE_CREDENTIALS_JSON"))
		path := strings.TrimSpace(os.Getenv("FIREBASE_CREDENTIALS_PATH"))

		// If FIREBASE_CREDENTIALS_PATH was set to the raw JSON content instead of
		// a file path (common deploy mistake), normalise it into jsonContent.
		if jsonContent == "" && strings.HasPrefix(path, "{") {
			jsonContent = path
			path = ""
		}

		if jsonContent == "" && path == "" {
			log.Printf("[FCM] not configured (FIREBASE_CREDENTIALS_JSON / FIREBASE_CREDENTIALS_PATH unset) — push disabled")
			return
		}

		var opt option.ClientOption
		if jsonContent != "" {
			opt = option.WithCredentialsJSON([]byte(jsonContent))
		} else {
			opt = option.WithCredentialsFile(path)
		}

		projectID := extractFirebaseProjectID(jsonContent, path)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: projectID}, opt)
		if err != nil {
			fcmInitErr = fmt.Errorf("firebase NewApp: %w", err)
			log.Printf("[FCM] init failed: %v", fcmInitErr)
			return
		}

		client, err := app.Messaging(ctx)
		if err != nil {
			fcmInitErr = fmt.Errorf("firebase Messaging: %w", err)
			log.Printf("[FCM] messaging client failed: %v", fcmInitErr)
			return
		}

		fcmClient = client
		fcmConfigured = true
		log.Printf("[FCM] initialized successfully")
	})
}

// sendTransactionPaidNotification sends a "payment paid" push to the user
// who owns the transaction. Fire-and-forget — errors are logged.
func sendTransactionPaidNotification(transactionID uint) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[FCM] panic in send: %v", r)
		}
	}()

	log.Printf("[FCM] ── start trx_id=%d", transactionID)

	initFCM()
	if !fcmConfigured {
		log.Printf("[FCM] ✗ skipped: FCM not configured")
		return
	}

	var t Transaction
	if err := DB.First(&t, transactionID).Error; err != nil {
		log.Printf("[FCM] ✗ trx %d not found: %v", transactionID, err)
		return
	}
	log.Printf("[FCM] trx=%s status=%s user_id=%v", t.TransactionCode, t.Status, t.UserID)

	if t.UserID == nil {
		log.Printf("[FCM] ✗ skipped: no linked user (guest checkout — link a customer in POS)")
		return
	}

	var user User
	if err := DB.Select("id", "fcm_token", "name").First(&user, *t.UserID).Error; err != nil {
		log.Printf("[FCM] ✗ user %d not found: %v", *t.UserID, err)
		return
	}
	token := strings.TrimSpace(user.FCMToken)
	if token == "" {
		log.Printf("[FCM] ✗ skipped: user %d (%s) has no FCM token — mobile app must call PUT /api/customer/fcm-token after login", user.ID, user.Name)
		return
	}
	txTitle := "Pembayaran Berhasil ✓"
	txBody := fmt.Sprintf("Transaksi #%s sebesar %s telah dibayar.", t.TransactionCode, formatRupiah(t.TotalAmount))
	txData := map[string]string{
		"type":             "transaction_paid",
		"transaction_id":   fmt.Sprintf("%d", t.ID),
		"transaction_code": t.TransactionCode,
		"total_amount":     fmt.Sprintf("%.0f", t.TotalAmount),
	}
	createUserNotification(user.ID, txTitle, txBody, "transaction_paid", txData)

	log.Printf("[FCM] sending to user %d (%s) token=...%s", user.ID, user.Name, token[max(0, len(token)-8):])

	msg := &messaging.Message{
		Token:        token,
		Notification: &messaging.Notification{Title: txTitle, Body: txBody},
		Data:         txData,
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				ChannelID: "baxter_transactions",
			},
		},
		APNS: &messaging.APNSConfig{
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{Sound: "default"},
			},
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := fcmClient.Send(ctx, msg); err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "registration-token-not-registered") ||
			strings.Contains(errStr, "invalid-argument") ||
			strings.Contains(errStr, "Requested entity was not found") {
			DB.Model(&User{}).Where("id = ?", user.ID).Update("fcm_token", "")
			log.Printf("[FCM] ✗ invalid token cleared for user %d — mobile app must re-register", user.ID)
		} else {
			log.Printf("[FCM] ✗ send failed for user %d trx=%s: %v", user.ID, t.TransactionCode, err)
		}
		return
	}
	log.Printf("[FCM] ✓ push sent → user %d (%s) trx=%s", user.ID, user.Name, t.TransactionCode)
}

// sendMembershipPendingNotification dikirim sesaat setelah order dibuat, sebelum user bayar.
// snap_token disertakan di data agar Flutter bisa langsung buka Snap UI kalau notif diklik.
func sendMembershipPendingNotification(userID uint, packageName, licensePlate, orderID, snapToken string) {
	title := "Selesaikan Pembayaran"
	body := fmt.Sprintf("Pembayaran %s untuk %s menunggu. Tap untuk melanjutkan.", packageName, licensePlate)
	data := map[string]string{
		"type":       "membership_pending",
		"order_id":   orderID,
		"snap_token": snapToken,
	}

	createUserNotification(userID, title, body, "membership_pending", data)

	initFCM()
	if !fcmConfigured {
		return
	}

	var user User
	if err := DB.Select("id", "fcm_token").First(&user, userID).Error; err != nil {
		return
	}
	token := strings.TrimSpace(user.FCMToken)
	if token == "" {
		return
	}

	msg := &messaging.Message{
		Token:        token,
		Notification: &messaging.Notification{Title: title, Body: body},
		Data:         data,
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				ChannelID: "baxter_transactions",
				Sound:     "default",
			},
		},
		APNS: &messaging.APNSConfig{
			Payload: &messaging.APNSPayload{Aps: &messaging.Aps{Sound: "default"}},
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := fcmClient.Send(ctx, msg); err != nil {
		log.Printf("[FCM pending] send failed user=%d: %v", userID, err)
		return
	}
	log.Printf("[FCM pending] ✓ push sent → user=%d order=%s", userID, orderID)
}

// sendMembershipPaidNotification mengirim push notification setelah membership aktif via Midtrans.
func sendMembershipPaidNotification(transactionID uint) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[FCM membership] panic: %v", r)
		}
	}()

	var tx Transaction
	if err := DB.First(&tx, transactionID).Error; err != nil {
		log.Printf("[FCM membership] tx %d not found: %v", transactionID, err)
		return
	}
	if tx.UserID == nil {
		return
	}

	var user User
	if err := DB.Select("id", "fcm_token", "name").First(&user, *tx.UserID).Error; err != nil {
		log.Printf("[FCM membership] user %d not found: %v", *tx.UserID, err)
		return
	}

	licensePlate := "kendaraan Anda"
	if tx.ReferenceID != nil {
		var v Vehicle
		if DB.Select("license_plate").First(&v, *tx.ReferenceID).Error == nil && v.LicensePlate != "" {
			licensePlate = v.LicensePlate
		}
	}

	packageName := ""
	var mem Membership
	if DB.Where("transaction_id = ?", tx.ID).First(&mem).Error == nil && mem.PackageID != nil {
		var svc Service
		if DB.Select("name").First(&svc, *mem.PackageID).Error == nil {
			packageName = svc.Name
		}
	}

	title := "Membership Aktif! 🎉"
	body := fmt.Sprintf("Pembayaran berhasil. %s siap digunakan.", licensePlate)
	if packageName != "" {
		body = fmt.Sprintf("Pembayaran %s berhasil. %s siap digunakan.", packageName, licensePlate)
	}
	data := map[string]string{
		"type":     "payment_success",
		"order_id": tx.TransactionCode,
	}

	createUserNotification(user.ID, title, body, "payment_success", data)

	token := strings.TrimSpace(user.FCMToken)
	if token == "" {
		log.Printf("[FCM membership] user %d tidak punya FCM token — notif disimpan di DB saja", user.ID)
		return
	}

	initFCM()
	if !fcmConfigured {
		return
	}

	tail := token
	if len(tail) > 8 {
		tail = "..." + token[len(token)-8:]
	}
	log.Printf("[FCM membership] user=%d token=%s", user.ID, tail)

	msg := &messaging.Message{
		Token:        token,
		Notification: &messaging.Notification{Title: title, Body: body},
		Data:         data,
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				ChannelID: "baxter_transactions",
				Sound:     "default",
			},
		},
		APNS: &messaging.APNSConfig{
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{Sound: "default"},
			},
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := fcmClient.Send(ctx, msg); err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "registration-token-not-registered") ||
			strings.Contains(errStr, "invalid-argument") ||
			strings.Contains(errStr, "Requested entity was not found") {
			DB.Model(&User{}).Where("id = ?", user.ID).Update("fcm_token", "")
			log.Printf("[FCM membership] invalid token cleared for user %d", user.ID)
		} else {
			log.Printf("[FCM membership] send failed user=%d trx=%s: %v", user.ID, tx.TransactionCode, err)
		}
		return
	}
	log.Printf("[FCM membership] ✓ push sent → user %d trx=%s", user.ID, tx.TransactionCode)
}
