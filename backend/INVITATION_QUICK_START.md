# Invitation System Quick Start

## ✅ What Was Implemented

An invitation-only registration system that:
- ✅ Requires valid invitation tokens for registration
- ✅ Admin-only invitation management
- ✅ Secure token generation (64-char URL-safe)
- ✅ Optional expiration dates
- ✅ Revocation capability
- ✅ Single-use tokens
- ✅ Email verification

## 🚀 Quick Setup

### 1. Run Migration

```bash
cd /home/rree/herman/backend
python add_invitations_system.py
```

Expected output:
```
Adding invitation system to database...
1. Creating invitations table...
   ✅ invitations table created
2. Adding is_admin column to users table...
   ✅ is_admin column added to users table
3. Checking for existing users...
   ✅ Made first user (ID: 1, Email: admin@example.com) an admin
```

### 2. Verify Admin Access

Check if you have an admin user:

```python
# Python check
from database import SessionLocal
from models import User

db = SessionLocal()
admins = db.query(User).filter(User.is_admin == True).all()
print(f"Admins: {[u.email for u in admins]}")
db.close()
```

Or via SQL:
```sql
SELECT id, email, is_admin FROM users WHERE is_admin = TRUE;
```

### 3. Make Yourself an Admin (if needed)

```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

Or via Python:
```python
from database import SessionLocal
from models import User

db = SessionLocal()
user = db.query(User).filter(User.email == 'your@email.com').first()
user.is_admin = True
db.commit()
db.close()
```

## 📋 Basic Workflow

### Step 1: Admin Creates Invitation

```bash
curl -X POST http://localhost:8000/api/invitations \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "expires_in_days": 7,
    "notes": "New lab member"
  }'
```

Response:
```json
{
  "id": 1,
  "email": "newuser@example.com",
  "token": "veryLongSecureRandomToken123...",
  "invitation_url": "http://localhost:3000/register?token=veryLongSecureRandomToken123...",
  "expires_at": "2026-02-11T10:00:00",
  "created_at": "2026-02-04T10:00:00"
}
```

### Step 2: Send Invitation Link

Send the `invitation_url` to the new user via:
- Email
- Slack/Teams message
- Text message
- Any secure channel

### Step 3: User Registers

New user visits the invitation link and registers:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -F "email=newuser@example.com" \
  -F "password=securepass123" \
  -F "name=John Doe" \
  -F "invitation_token=veryLongSecureRandomToken123..."
```

## 🎯 Common Tasks

### List Pending Invitations

```bash
curl http://localhost:8000/api/invitations?status_filter=pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### List All Invitations

```bash
curl http://localhost:8000/api/invitations \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Check if Token is Valid

```bash
curl http://localhost:8000/api/invitations/validate/TOKEN_HERE
```

Response:
```json
{
  "valid": true,
  "email": "newuser@example.com",
  "message": "Valid invitation"
}
```

### Revoke an Invitation

```bash
curl -X DELETE http://localhost:8000/api/invitations/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Resend/Refresh Invitation

Generates new token and extends expiration:

```bash
curl -X POST http://localhost:8000/api/invitations/1/resend \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 📝 Example Python Scripts

### Create Multiple Invitations

```python
import requests

admin_token = "your_admin_jwt_token"
api_url = "http://localhost:8000"

new_users = [
    {"email": "user1@lab.edu", "notes": "PhD student"},
    {"email": "user2@lab.edu", "notes": "Postdoc"},
    {"email": "user3@lab.edu", "notes": "Research assistant"},
]

for user in new_users:
    response = requests.post(
        f"{api_url}/api/invitations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "email": user["email"],
            "expires_in_days": 14,
            "notes": user["notes"]
        }
    )

    if response.status_code == 201:
        inv = response.json()
        print(f"✅ {user['email']}: {inv['invitation_url']}")
    else:
        print(f"❌ {user['email']}: {response.json()['detail']}")
```

### Check Invitation Status

```python
import requests

admin_token = "your_admin_jwt_token"
api_url = "http://localhost:8000"

response = requests.get(
    f"{api_url}/api/invitations",
    headers={"Authorization": f"Bearer {admin_token}"}
)

invitations = response.json()
print(f"Total invitations: {invitations['total']}\n")

for inv in invitations['invitations']:
    status = "✅ Used" if inv['used_at'] else \
             "❌ Revoked" if inv['revoked'] else \
             "⏳ Pending"

    print(f"{status} - {inv['email']}")
    if inv.get('invitation_url'):
        print(f"   Link: {inv['invitation_url']}")
    print(f"   Created: {inv['created_at']}")
    if inv['expires_at']:
        print(f"   Expires: {inv['expires_at']}")
    print()
```

### Cleanup Expired Invitations

```python
from database import SessionLocal
from models import Invitation
from datetime import datetime

db = SessionLocal()

expired = db.query(Invitation).filter(
    Invitation.expires_at < datetime.utcnow(),
    Invitation.used_at.is_(None),
    Invitation.revoked == False
).all()

print(f"Found {len(expired)} expired invitations")

for inv in expired:
    inv.revoked = True
    inv.revoked_at = datetime.utcnow()
    print(f"Revoked: {inv.email}")

db.commit()
db.close()
```

## 🔧 Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Frontend URL for invitation links
FRONTEND_URL=http://localhost:3000

# Or for production
FRONTEND_URL=https://yourdomain.com
```

If not set, defaults to `http://localhost:3000`.

## ✅ Testing Checklist

- [ ] Migration script runs successfully
- [ ] At least one user has `is_admin = TRUE`
- [ ] Admin can create invitations
- [ ] Invitation URLs are generated correctly
- [ ] Non-admin users cannot create invitations (403 error)
- [ ] Token validation endpoint works
- [ ] Registration requires valid token
- [ ] Registration fails with invalid token
- [ ] Registration fails if email doesn't match
- [ ] Invitation marked as used after registration
- [ ] Used invitations cannot be used again
- [ ] Expired invitations are rejected
- [ ] Revoked invitations are rejected
- [ ] Admin can list all invitations
- [ ] Admin can revoke invitations
- [ ] Admin can resend invitations

## 🚨 Common Issues

### "Admin access required"
**Problem:** User is not an admin
**Solution:** Set `is_admin = TRUE` in database

```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

### "Invalid invitation token"
**Problem:** Token doesn't exist, is expired, revoked, or used
**Solution:** Create new invitation or resend existing one

```bash
curl -X POST http://localhost:8000/api/invitations/1/resend \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### "Email does not match invitation"
**Problem:** User trying to register with different email than invited
**Solution:** User must use exact email from invitation (case-insensitive)

### "Email already registered"
**Problem:** User account already exists
**Solution:** User should login instead, or admin can delete/rename old account

## 📊 Monitoring

### Check System Status

```sql
-- Total invitations
SELECT COUNT(*) as total FROM invitations;

-- Pending invitations
SELECT COUNT(*) as pending FROM invitations
WHERE used_at IS NULL AND revoked = FALSE
AND (expires_at IS NULL OR expires_at > NOW());

-- Acceptance rate
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) as used,
    ROUND(100.0 * SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as acceptance_rate
FROM invitations;

-- Recent activity
SELECT email, created_at, used_at, revoked
FROM invitations
ORDER BY created_at DESC
LIMIT 10;
```

## 🎓 Best Practices

1. **Track invitations**: Add notes explaining why each person was invited
2. **Set expiration**: Default 7 days is good for most cases
3. **Follow up**: Check if invitations are being used
4. **Clean up**: Periodically revoke old unused invitations
5. **Limit admins**: Only make trusted users admins
6. **Use HTTPS**: Always use HTTPS in production to protect tokens
7. **Secure delivery**: Send invitation links via secure channels
8. **Document**: Keep records of who invited whom

## 📚 Full Documentation

See `INVITATION_SYSTEM.md` for:
- Complete API reference
- Security considerations
- Email integration
- Monitoring queries
- Troubleshooting guide
- Migration strategies

## 🎉 You're Ready!

The invitation system is now active. Registration is invitation-only, and only admins can invite new users.

**Next steps:**
1. Login as an admin user
2. Create your first invitation
3. Test the registration flow
4. (Optional) Build admin UI for invitation management
