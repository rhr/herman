# Running Frontend Locally with Remote Backend

This guide explains how to run the Herbarium Pro frontend locally on your development machine while connecting to a backend running on a remote server.

---

## Overview

**Local Frontend** → **Remote Backend**

```
┌─────────────────────┐         ┌─────────────────────┐
│  Your Computer      │         │  Remote Server      │
│  localhost:3000     │ ──────→ │  example.com:8000   │
│  (React/Vite)       │         │  (FastAPI)          │
└─────────────────────┘         └─────────────────────┘
```

---

## Prerequisites

- Remote backend is running and accessible via HTTP/HTTPS
- You have the remote server's URL (e.g., `http://192.168.1.100:8000` or `https://api.example.com`)
- Remote backend has CORS configured to allow your local frontend

---

## Step 1: Configure Frontend Environment Variables

The frontend uses the `VITE_API_URL` environment variable to determine which backend to connect to.

### Option A: Using .env file (Recommended)

Create or edit `.env` in the **frontend root directory** (where `package.json` is):

```bash
# .env
VITE_API_URL=http://192.168.1.100:8000/api
```

**Examples:**

```bash
# Local network server
VITE_API_URL=http://192.168.1.100:8000/api

# Remote server with domain
VITE_API_URL=https://api.herbarium.example.com/api

# Remote server with IP and custom port
VITE_API_URL=http://203.0.113.50:8000/api
```

**Important:**
- Include `/api` at the end if your backend has routes under `/api`
- Use `https://` if the remote backend has SSL/TLS configured
- Do NOT include a trailing slash

### Option B: Environment Variable on Command Line

```bash
VITE_API_URL=http://192.168.1.100:8000/api npm run dev
```

---

## Step 2: Configure Backend CORS Settings

The backend must allow requests from your local frontend URL (`http://localhost:3000`).

### Edit Backend .env

**File:** `backend/.env`

```bash
# Allow requests from local development frontend
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# If using a different port, add it:
# CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:4173
```

**Multiple origins (comma-separated):**

```bash
# Allow both local dev and production frontend
CORS_ORIGINS=http://localhost:3000,https://herbarium.example.com
```

### Restart Backend

After changing CORS settings, restart the backend:

```bash
# SSH into remote server
ssh user@remote-server

# Navigate to backend
cd /path/to/herb-pro/backend

# Activate environment
source ~/miniconda3/etc/profile.d/conda.sh
conda activate herman

# Restart (kill existing process first if needed)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## Step 3: Start Local Frontend

```bash
# Navigate to frontend directory
cd /home/rree/src/herb-pro

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:3000` (or `http://localhost:5173` depending on your Vite config).

---

## Step 4: Verify Connection

1. Open browser to `http://localhost:3000`
2. Open browser DevTools (F12) → Network tab
3. Try to log in
4. Check that API requests go to your remote backend URL
5. Verify no CORS errors in the Console tab

### Expected Network Requests

You should see requests like:
```
POST http://192.168.1.100:8000/api/auth/login
GET  http://192.168.1.100:8000/api/specimens?page=1&page_size=50
```

### Common Issues

#### CORS Error

**Error in console:**
```
Access to fetch at 'http://remote:8000/api/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Solution:**
- Verify `CORS_ORIGINS` in backend `.env` includes `http://localhost:3000`
- Restart the backend after changing `.env`
- Clear browser cache

#### Connection Refused

**Error:**
```
Failed to fetch
net::ERR_CONNECTION_REFUSED
```

**Solutions:**
- Check remote backend is running: `curl http://remote:8000/api/specimens`
- Verify firewall rules allow connections on port 8000
- Check if backend is bound to `0.0.0.0` (not `127.0.0.1`)
- Verify the IP address/domain is correct

#### Network Unreachable

**Solutions:**
- Check VPN connection if remote server requires VPN
- Verify network connectivity: `ping remote-server`
- Check if port forwarding is configured correctly
- Ensure no firewall blocking the connection

---

## Advanced Configuration

### Using SSH Tunnel

If the remote backend is not directly accessible, create an SSH tunnel:

```bash
# Forward remote port 8000 to local port 8000
ssh -L 8000:localhost:8000 user@remote-server

# Keep this terminal open
```

Then configure frontend to use:
```bash
VITE_API_URL=http://localhost:8000/api
```

### Using HTTPS with Self-Signed Certificate

If remote backend uses self-signed SSL certificate:

1. **Accept certificate in browser:**
   - Navigate to `https://remote:8000/api/specimens`
   - Accept the security warning
   - Return to your local frontend

2. **Or use HTTP for development:**
   ```bash
   VITE_API_URL=http://remote:8000/api
   ```

### Environment-Specific Configuration

Create multiple `.env` files:

**`.env.local`** (ignored by git):
```bash
VITE_API_URL=http://192.168.1.100:8000/api
```

**`.env.development`**:
```bash
VITE_API_URL=http://localhost:8000/api
```

**`.env.production`**:
```bash
VITE_API_URL=https://api.herbarium.example.com/api
```

Vite automatically loads `.env.local` in development.

---

## Backend Configuration for Remote Access

### Binding to All Interfaces

The backend must bind to `0.0.0.0` (not `127.0.0.1`) to accept remote connections:

```bash
# Correct - accepts connections from any interface
uvicorn main:app --host 0.0.0.0 --port 8000

# Wrong - only accepts local connections
uvicorn main:app --host 127.0.0.1 --port 8000
```

### Firewall Configuration

Allow incoming connections on port 8000:

**Ubuntu/Debian:**
```bash
sudo ufw allow 8000/tcp
sudo ufw status
```

**CentOS/RHEL:**
```bash
sudo firewall-cmd --add-port=8000/tcp --permanent
sudo firewall-cmd --reload
```

### API Base URL Configuration

Set the correct base URL in backend `.env` so image URLs are generated correctly:

```bash
# backend/.env
API_BASE_URL=http://192.168.1.100:8000

# Or with domain
API_BASE_URL=https://api.herbarium.example.com
```

This ensures image URLs are correct when accessed from remote clients.

---

## Testing the Configuration

### 1. Test Backend API Directly

```bash
# From your local machine
curl http://remote-server:8000/api/specimens

# Should return JSON response (or 401 if auth required)
```

### 2. Test CORS Headers

```bash
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     http://remote-server:8000/api/specimens -v

# Look for Access-Control-Allow-Origin header in response
```

### 3. Test from Browser Console

Open browser console (F12) and run:

```javascript
// Test API connection
fetch('http://remote-server:8000/api/specimens')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

---

## Security Considerations

### Development

- ✅ HTTP is acceptable for development on local networks
- ✅ Relaxed CORS is fine for development
- ⚠️ Don't expose backend directly to internet without authentication

### Production

- ✅ Always use HTTPS in production
- ✅ Restrict CORS to specific origins (no wildcards)
- ✅ Use environment variables for secrets
- ✅ Implement rate limiting
- ✅ Use a reverse proxy (nginx, Caddy)
- ✅ Keep backend behind firewall, expose only through proxy

---

## Troubleshooting Checklist

- [ ] Backend is running (`ps aux | grep uvicorn`)
- [ ] Backend is bound to `0.0.0.0` (not `127.0.0.1`)
- [ ] Firewall allows port 8000
- [ ] `VITE_API_URL` is set correctly in frontend `.env`
- [ ] `CORS_ORIGINS` includes `http://localhost:3000` in backend `.env`
- [ ] Backend was restarted after changing `.env`
- [ ] Browser cache was cleared
- [ ] Network connectivity exists (ping works)
- [ ] No VPN/proxy interfering with connection

---

## Example: Complete Setup

### Remote Server (192.168.1.100)

**backend/.env:**
```bash
DATABASE_URL=mysql://user:pass@localhost/herbarium
JWT_SECRET=your-secret-key-here
CORS_ORIGINS=http://localhost:3000,http://192.168.1.50:3000
API_BASE_URL=http://192.168.1.100:8000
```

**Start backend:**
```bash
source ~/miniconda3/etc/profile.d/conda.sh
conda activate herman
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Local Machine

**.env:**
```bash
VITE_API_URL=http://192.168.1.100:8000/api
```

**Start frontend:**
```bash
cd /home/rree/src/herb-pro
npm run dev
```

**Access:**
- Open `http://localhost:3000` in browser
- Log in with existing credentials
- Verify images load from remote server

---

## Alternative: Running Both Locally

If you want both frontend and backend local:

```bash
# Terminal 1 - Backend
cd backend
source ~/miniconda3/etc/profile.d/conda.sh
conda activate herman
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend
cd frontend
VITE_API_URL=http://localhost:8000/api npm run dev
```

Or create `.env`:
```bash
VITE_API_URL=http://localhost:8000/api
```

---

## Related Files

- **Frontend config:** `.env`, `vite.config.ts`
- **Backend config:** `backend/.env`, `backend/main.py` (CORS)
- **API client:** `services/apiClient.ts` (reads `VITE_API_URL`)

---

## Questions?

Common scenarios:
- **Remote server on VPS:** Use public IP or domain with HTTPS
- **Remote server on local network:** Use private IP (192.168.x.x)
- **Multiple developers:** Each developer sets their own `.env.local`
- **SSH-only access:** Use SSH tunnel to forward port

For production deployment, see `DEPLOYMENT.md` (to be created).
