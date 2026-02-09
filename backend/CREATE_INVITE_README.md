# Create Invitation Script

Interactive Python script to easily create user registration invitations.

## Features

- ✅ Reads admin credentials from `.env` file
- ✅ Authenticates with the API
- ✅ Interactive prompts for invitation details
- ✅ Validates admin permissions
- ✅ Color-coded terminal output
- ✅ Error handling and helpful messages

## Prerequisites

Install required Python package:

```bash
pip install python-dotenv requests
```

Or if using the virtual environment:

```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install python-dotenv requests
```

## Setup

1. **Add admin credentials to `.env` file:**

```bash
# In backend/.env
HERMAN_USER=your@email.com
HERMAN_PASSWORD=yourpassword
API_BASE_URL=http://localhost:8000
```

2. **Make sure your user is an admin:**

```sql
-- Check admin status
SELECT id, email, is_admin FROM users WHERE email = 'your@email.com';

-- Set admin status if needed
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

3. **Make sure the backend API is running:**

```bash
cd backend
python main.py
# or
uvicorn main:app --reload
```

## Usage

### Run the script:

```bash
cd backend
python create_invite.py
# or
./create_invite.py
```

### Interactive prompts:

```
============================================================
  🎫 Herbarium Pro - Invitation Generator
============================================================

🔐 Authenticating...
ℹ Logging in as: admin@example.com
✓ Logged in as admin: Admin User

📝 Invitation Details
Email address: newuser@example.com
Expires in days (default: 7): 14
Notes (optional): New lab member

Review:
  Email:      newuser@example.com
  Expires in: 14 days
  Notes:      New lab member

Create this invitation? (y/N): y

🎫 Creating Invitation...
✓ Invitation created successfully!

Invitation Details:
  ID:         42
  Email:      newuser@example.com
  Expires:    2026-02-23T10:00:00
  Created:    2026-02-09T10:00:00
  Notes:      New lab member

📧 Send this link to the user:
http://localhost:3000/register?token=abc123...xyz789

✓ Done!
```

## Environment Variables

The script reads from `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `HERMAN_USER` | Admin email address | **Required** |
| `HERMAN_PASSWORD` | Admin password | **Required** |
| `API_BASE_URL` | Backend API URL | `http://localhost:8000` |

## For Production

Update `API_BASE_URL` in `.env` for your production server:

```bash
# For production deployment
API_BASE_URL=https://oneil.fieldmuseum.org/labnotes
```

Then the invitation URLs will be generated with the correct domain:

```
https://oneil.fieldmuseum.org/labnotes/register?token=...
```

## Troubleshooting

### "HERMAN_USER and HERMAN_PASSWORD must be set in .env"
**Solution:** Add these variables to your `.env` file

### "User is not an admin"
**Solution:** Set admin flag in database:
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

### "Could not connect to API"
**Solution:** Make sure backend is running:
```bash
python main.py
```

### "Invalid credentials"
**Solution:** Check that HERMAN_USER and HERMAN_PASSWORD are correct

### Module not found errors
**Solution:** Install dependencies:
```bash
pip install python-dotenv requests
```

## Alternative: Manual API Calls

If you prefer to use curl instead:

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}' \
  | jq -r '.access_token')

# 2. Create invitation
curl -X POST http://localhost:8000/api/invitations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "expires_in_days": 7,
    "notes": "New team member"
  }'
```

## See Also

- `INVITATION_QUICK_START.md` - Full invitation system documentation
- `INVITATION_SYSTEM.md` - Detailed API reference
- `generate_invite.sh` - Simple bash script version
