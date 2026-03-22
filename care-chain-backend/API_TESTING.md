# 🧪 API Testing Guide - After Render Deployment

Replace `YOUR_RENDER_URL` with your actual Render URL (e.g., `https://care-chain-backend.onrender.com`)

## 1. Health Check (No Auth Required)

**Test if API is running:**
```bash
curl https://YOUR_RENDER_URL/api/v1/health
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-29T06:30:00.000Z",
    "uptime": 123,
    "environment": "production"
  }
}
```

---

## 2. Test User Registration

**Create a new account:**
```bash
curl -X POST https://YOUR_RENDER_URL/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456",
    "fullName": "Test User",
    "role": "doctor"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": "...",
      "email": "test@example.com",
      "fullName": "Test User",
      "role": "pending"
    },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
}
```

---

## 3. Test Login

**Login with credentials:**
```bash
curl -X POST https://YOUR_RENDER_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456"
  }'
```

---

## 4. Test Protected Endpoint

**Get profile (requires authentication):**
```bash
curl -X GET https://YOUR_RENDER_URL/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🌐 Browser Testing

### Simple Health Check:
Open in browser:
```
https://YOUR_RENDER_URL/api/v1/health
```

### Using Browser DevTools Console:
```javascript
// Test health endpoint
fetch('https://YOUR_RENDER_URL/api/v1/health')
  .then(r => r.json())
  .then(console.log);

// Test registration
fetch('https://YOUR_RENDER_URL/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test@123456',
    fullName: 'Test User',
    role: 'doctor'
  })
})
  .then(r => r.json())
  .then(console.log);
```

---

## 📱 Test from React Native App

Update your frontend config first:
```typescript
// care-chain-app/config/env.ts
const PRODUCTION_API_BASE_URL = 'https://YOUR_RENDER_URL';
```

Then test from your app!

---

## 🔧 Testing Tools

### PowerShell (Windows):
```powershell
Invoke-RestMethod -Uri "https://YOUR_RENDER_URL/api/v1/health" -Method GET
```

### Postman:
1. Import this collection
2. Set base URL: `https://YOUR_RENDER_URL`
3. Test all endpoints

### Thunder Client (VS Code Extension):
1. Install Thunder Client
2. Create new request
3. URL: `https://YOUR_RENDER_URL/api/v1/health`

---

## ✅ Deployment Checklist

- [ ] Backend deployed successfully on Render
- [ ] Database connected (check logs)
- [ ] Health endpoint responds
- [ ] Can create new user
- [ ] Can login
- [ ] Frontend updated with production URL
- [ ] CORS allows all origins (`*`)
- [ ] JWT secrets generated and set
- [ ] SMTP configured for emails

---

## 🐛 Common Issues

**Issue:** API returns 404
- Check the URL includes `/api/v1`
- Verify deployment succeeded

**Issue:** CORS error
- Ensure `CORS_ORIGIN=*` in Render env vars
- Check `CORS_CREDENTIALS=false`

**Issue:** Database errors
- Verify `DATABASE_URL` is correct
- Check database is running

**Issue:** Slow first request
- Render free tier "spins down" after 15 mins
- First request takes ~30 seconds to wake up
