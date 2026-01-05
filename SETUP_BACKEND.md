# Setting Up Herbarium Pro with Python Backend

Complete guide to set up the full-stack Herbarium Pro application with Python FastAPI backend, MySQL database, and React frontend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Herbarium Pro Stack                     │
├─────────────────────────────────────────────────────────────┤
│  Frontend: React + TypeScript + Vite (Port 3000)           │
│  Backend:  Python + FastAPI (Port 8000)                    │
│  Database: MySQL 8.0                                        │
│  Storage:  Local filesystem (./backend/uploads)            │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher
- **MySQL**: 8.0 or higher
- **OS**: Linux, macOS, or Windows

### Installation

**Ubuntu/Debian:**
```bash
# Python
sudo apt install python3.10 python3-pip python3-venv

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs

# MySQL
sudo apt install mysql-server
```

**macOS:**
```bash
# Using Homebrew
brew install python@3.10
brew install node
brew install mysql
```

**Windows:**
- Download Python from https://www.python.org/downloads/
- Download Node.js from https://nodejs.org/
- Download MySQL from https://dev.mysql.com/downloads/installer/

## Step-by-Step Setup

### 1. Clone or Navigate to Project

```bash
cd /home/rree/src/herb-pro
```

### 2. Set Up MySQL Database

**Start MySQL service:**
```bash
# Linux
sudo systemctl start mysql
sudo systemctl enable mysql

# macOS
brew services start mysql

# Windows
net start MySQL80
```

**Create database and user:**
```bash
cd backend
mysql -u root -p < setup_database.sql
```

Or manually:
```sql
CREATE DATABASE herbarium_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'herbarium_user'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON herbarium_db.* TO 'herbarium_user'@'localhost';
FLUSH PRIVILEGES;
```

**Verify connection:**
```bash
mysql -u herbarium_user -p herbarium_db
```

### 3. Set Up Backend

**Navigate to backend directory:**
```bash
cd backend
```

**Create virtual environment:**
```bash
python3 -m venv venv
```

**Activate virtual environment:**
```bash
# Linux/macOS
source venv/bin/activate

# Windows
venv\Scripts\activate
```

**Install Python dependencies:**
```bash
pip install -r requirements.txt
```

**Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=herbarium_db
DB_USER=herbarium_user
DB_PASSWORD=secure_password_here

# Generate this with: python3 -c "import secrets; print(secrets.token_urlsafe(32))"
JWT_SECRET=your_generated_secret_here

API_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

**Create uploads directory:**
```bash
mkdir -p uploads/specimens
```

**Initialize database tables:**
```bash
python3 -c "from database import create_tables; create_tables()"
```

**Start the backend server:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
✓ Database tables created successfully
🚀 Herbarium Pro API started successfully
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Test the API:**
Open http://localhost:8000/docs in your browser to see the interactive API documentation.

### 4. Set Up Frontend

**Open a new terminal and navigate to project root:**
```bash
cd /home/rree/src/herb-pro
```

**Install Node dependencies:**
```bash
npm install
```

**Configure environment:**
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:8000/api
GEMINI_API_KEY=your_gemini_key_if_using_ai_features
```

**Start the development server:**
```bash
npm run dev
```

You should see:
```
VITE v6.4.1  ready in 185 ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.x.x:3000/
```

### 5. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## First Time Usage

### 1. Register a User

In the application (or via API docs):
```json
POST http://localhost:8000/api/auth/register
{
  "email": "curator@herbarium.org",
  "password": "secure_password",
  "name": "Herbarium Curator"
}
```

### 2. Login

The app should automatically log you in after registration. If not:
```json
POST http://localhost:8000/api/auth/login
{
  "email": "curator@herbarium.org",
  "password": "secure_password"
}
```

### 3. Add Your First Specimen

Click "Add Specimen" and fill in the form:
- Upload specimen images (JPG, PNG, etc.)
- Enter scientific name
- Add collection details
- Click "Save Specimen"

## Switching from LocalStorage to Backend

If you have existing data in localStorage, you'll need to manually migrate it:

### Option 1: Start Fresh
Simply start using the new backend. Old localStorage data will remain but won't interfere.

### Option 2: Manual Migration
1. Open browser console (F12)
2. Run: `console.log(localStorage.getItem('db_specimens'))`
3. Copy the data
4. Use the API to create specimens with that data

### Option 3: Update DatabaseService
Keep both systems and add a migration flag:

```typescript
// src/services/databaseService.ts
const USE_API = import.meta.env.VITE_USE_API === 'true';

static async getAllSpecimens(): Promise<Specimen[]> {
  if (USE_API) {
    return apiClient.getAllSpecimens();
  } else {
    // Existing localStorage code
    return this.getLocalSpecimens();
  }
}
```

## Development Workflow

### Backend Development

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
uvicorn main:app --reload
```

**Watch logs:**
Backend logs appear in the terminal. Add debugging:
```python
print(f"Debug: {variable}")
```

**Database queries:**
```bash
mysql -u herbarium_user -p herbarium_db
```

```sql
-- View all tables
SHOW TABLES;

-- View specimens
SELECT id, scientific_name, family FROM specimens;

-- View users
SELECT id, email, name FROM users;
```

### Frontend Development

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**View in browser:**
- Open http://localhost:3000
- DevTools (F12) for debugging
- Network tab to see API calls

## Common Issues and Solutions

### Backend Issues

**Problem: "ModuleNotFoundError: No module named 'fastapi'"**
```bash
# Ensure virtual environment is activated
source venv/bin/activate
pip install -r requirements.txt
```

**Problem: "Access denied for user 'herbarium_user'"**
```bash
# Reset MySQL user
mysql -u root -p
DROP USER 'herbarium_user'@'localhost';
CREATE USER 'herbarium_user'@'localhost' IDENTIFIED BY 'new_password';
GRANT ALL PRIVILEGES ON herbarium_db.* TO 'herbarium_user'@'localhost';
FLUSH PRIVILEGES;

# Update .env with new password
```

**Problem: "Can't connect to MySQL server"**
```bash
# Check if MySQL is running
sudo systemctl status mysql  # Linux
brew services list  # macOS

# Start if not running
sudo systemctl start mysql  # Linux
brew services start mysql  # macOS
```

**Problem: "Port 8000 is already in use"**
```bash
# Find process using port 8000
lsof -ti:8000  # Linux/macOS
netstat -ano | findstr :8000  # Windows

# Kill the process
kill -9 <PID>  # Linux/macOS
taskkill /PID <PID> /F  # Windows

# Or change port in .env
API_PORT=8001
```

### Frontend Issues

**Problem: "Failed to fetch specimens"**
- Check backend is running on port 8000
- Verify VITE_API_URL in frontend .env
- Check browser console for CORS errors
- Ensure you're logged in (check localStorage for 'authToken')

**Problem: "Network Error"**
- Backend might not be running
- Check firewall settings
- Verify CORS_ORIGINS in backend .env includes your frontend URL

**Problem: "401 Unauthorized"**
- Token might be expired (default: 24 hours)
- Login again to get new token
- Check JWT_SECRET is consistent between restarts

## Testing

### Backend API Testing

**Using cURL:**
```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Login
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' | jq -r '.access_token')

# Get specimens
curl http://localhost:8000/api/specimens \
  -H "Authorization: Bearer $TOKEN"
```

**Using API Docs:**
1. Open http://localhost:8000/docs
2. Click "Authorize"
3. Register/login to get token
4. Enter token: `Bearer YOUR_TOKEN_HERE`
5. Test endpoints interactively

### Frontend Testing

```bash
# Run tests (if configured)
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## Production Deployment

See individual README files:
- Backend: `backend/README.md`
- Frontend: Standard Vite deployment (Vercel, Netlify, etc.)

### Quick Production Checklist

- [ ] Change all default passwords
- [ ] Generate secure JWT_SECRET
- [ ] Use HTTPS (not HTTP)
- [ ] Set up MySQL backups
- [ ] Configure firewall rules
- [ ] Set up file storage backups
- [ ] Use environment variables (not .env files)
- [ ] Enable MySQL SSL connections
- [ ] Set up monitoring and logging
- [ ] Use a reverse proxy (Nginx)

## Project Structure

```
herb-pro/
├── backend/                 # Python FastAPI backend
│   ├── main.py             # FastAPI app and routes
│   ├── models.py           # SQLAlchemy models
│   ├── schemas.py          # Pydantic schemas
│   ├── database.py         # DB configuration
│   ├── auth.py             # Authentication
│   ├── storage.py          # File storage
│   ├── requirements.txt    # Python deps
│   ├── .env                # Backend config
│   ├── uploads/            # Image storage
│   └── README.md           # Backend docs
│
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── services/
│   │   ├── apiClient.ts   # API communication
│   │   └── databaseService.ts
│   ├── types.ts           # TypeScript types
│   └── App.tsx            # Main app
│
├── .env                   # Frontend config
├── package.json           # Node dependencies
├── vite.config.ts         # Vite configuration
└── SETUP_BACKEND.md       # This file
```

## Support

For issues:
1. Check this guide's troubleshooting section
2. Check individual README files
3. Review API documentation at http://localhost:8000/docs
4. Check backend logs in terminal
5. Check browser console for frontend errors

## Next Steps

After successful setup:
1. Add more specimen records
2. Create piles to organize specimens
3. Try the AI annotation feature (requires Gemini API key)
4. Explore the map view
5. Test collaborative features by creating multiple users
6. Back up your database regularly

Enjoy using Herbarium Pro!
