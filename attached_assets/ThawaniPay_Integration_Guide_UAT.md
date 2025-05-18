# 🧾 Thawani Pay Integration Guide (UAT)

This document outlines the process for integrating **Thawani Pay** into your web or mobile application using their E-Commerce API.

## 🔑 UAT Credentials

- **Secret Key:** `rRQ26GcsZzoEhbrP2HZvLYDbn9C9etW`
- **Publishable Key:** `HGvTMLDssJghr9tlN9gr4DVYt0qyBy`

---

## 1️⃣ Create a Checkout Session

**Endpoint:**
```
POST https://uatcheckout.thawani.om/api/v1/checkout/session
```

**Headers:**
```http
Content-Type: application/json
thawani-api-key: test_sec_kIQ6cgRKHZ4xgXUv4Kr6vHGk1WEIynCW
```

**Request Body:**
```json
{
  "client_reference_id": "order_00123",
  "mode": "payment",
  "products": [
    {
      "name": "Premium Subscription",
      "quantity": 1,
      "unit_amount": 2500
    }
  ],
  "success_url": "https://yourdomain.com/payment-success",
  "cancel_url": "https://yourdomain.com/payment-failed"
}
```

**Success Response:**
```json
{
  "success": true,
  "code": 200,
  "message": "Session created successfully.",
  "data": {
    "session_id": "SESSION_ID"
  }
}
```

### 🔁 Redirect User to Payment Page

```text
https://uatcheckout.thawani.om/pay/SESSION_ID?key=test_pub_7zTz7tMNF0hC2VebQHeToNfT3K7cVK5D
```

---

## 2️⃣ Verify Session After Payment

After the user completes payment, use the session ID to verify the transaction status.

**Endpoint:**
```
GET https://uatcheckout.thawani.om/api/v1/checkout/session/SESSION_ID
```

**Headers:**
```http
Content-Type: application/json
thawani-api-key: test_sec_kIQ6cgRKHZ4xgXUv4Kr6vHGk1WEIynCW
```

**Response Example:**
```json
{
  "success": true,
  "code": 200,
  "message": "Session fetched successfully.",
  "data": {
    "client_reference_id": "order_00123",
    "payment_status": "paid"
  }
}
```

> ✅ `payment_status: paid` means the transaction was successful.

---

## 3️⃣ Handle Redirect Pages

Define the following pages in your app:

### ✅ Success Page

- **URL:** `https://yourdomain.com/payment-success`
- **Action:** Thank the user and confirm their payment.

### ❌ Cancel/Failure Page

- **URL:** `https://yourdomain.com/payment-failed`
- **Action:** Inform the user that the payment failed or was cancelled, and provide a retry option.

---

## 📌 Notes

- Always verify the session status via the API after redirect to ensure payment integrity.
- Keep your secret key confidential and use the publishable key on the client side only.

---

## 📚 Reference

Full API documentation: [Thawani E-Commerce API](https://thawani-technologies.stoplight.io/docs/thawani-ecommerce-api/5534c91789a48-thawani-e-commerce-api)
