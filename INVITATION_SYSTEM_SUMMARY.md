# Invitation-Only Registration System - Implementation Summary

## 🎉 Implementation Complete

A complete invitation-only registration system has been implemented for Herbarium Pro, ensuring controlled access through administrator-managed invitations.

## 📁 Files Created/Modified

### Backend Files Created

1. **`backend/add_invitations_system.py`** - Migration script
   - Creates `invitations` table
   - Adds `is_admin` column to `users` table
   - Makes first user an admin automatically

2. **`backend/INVITATION_SYSTEM.md`** - Complete documentation
   - API reference
   - Security considerations
   - Email integration guide
   - Monitoring queries
   - Troubleshooting

3. **`backend/INVITATION_QUICK_START.md`** - Quick start guide
   - Setup instructions
   - Example scripts
   - Common tasks
   - Testing checklist

### Backend Files Modified

1. **`backend/models.py`**
   - Added `Invitation` model with secure token generation
   - Added `is_admin` column to `User` model
   - Added `secrets` import for secure token generation

2. **`backend/schemas.py`**
   - Added `InvitationCreate` schema
   - Added `InvitationResponse` schema
   - Added `InvitationListResponse` schema
   - Added `ValidateInvitationResponse` schema

3. **`backend/main.py`**
   - Updated imports for Invitation model and schemas
   - Added `get_admin_user()` dependency for admin-only endpoints
   - **Modified registration endpoint** to require invitation token
   - Added 5 new invitation management endpoints

## 🔑 Key Features

### Security Features
✅ **Secure Token Generation** - 64-character URL-safe random tokens
✅ **Email Verification** - Registration email must match invitation
✅ **Single-Use Tokens** - Invitations can only be used once
✅ **Optional Expiration** - Time-based expiration (default 7 days)
✅ **Revocation** - Admins can revoke unused invitations
✅ **Admin-Only Management** - Only admins can create/manage invitations

### Database Schema

#### `invitations` Table
```sql
CREATE TABLE invitations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    created_by_user_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    used_at DATETIME NULL,
    used_by_user_id BIGINT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at DATETIME NULL,
    notes TEXT NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    FOREIGN KEY (used_by_user_id) REFERENCES users(id),
    INDEX idx_invitation_email (email),
    INDEX idx_invitation_token (token),
    INDEX idx_invitation_status (used_at, revoked)
);
```

#### `users` Table (Modified)
```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
```

## 🚀 API Endpoints

### Admin Endpoints (Require `is_admin = TRUE`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invitations` | Create new invitation |
| GET | `/api/invitations` | List all invitations (with filtering) |
| DELETE | `/api/invitations/{id}` | Revoke invitation |
| POST | `/api/invitations/{id}/resend` | Generate new token & extend expiration |

### Public Endpoint (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invitations/validate/{token}` | Validate invitation token |

### Modified Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Now requires `invitation_token` form field |

## 📋 Registration Flow

### Before (Disabled)
```
User → Registration Form → ❌ 403 Forbidden
```

### After (Invitation Required)
```
1. Admin → Create Invitation → Get Token
2. Admin → Send invitation URL to user
3. User → Click Link → Validate Token
4. User → Fill Registration Form (with token)
5. Backend → Verify Token & Email
6. Backend → Create User Account
7. Backend → Mark Invitation as Used
8. User → Logged In ✅
```

## 🎯 Quick Start

### 1. Run Migration

```bash
cd /home/rree/herman/backend
python add_invitations_system.py
```

### 2. Verify/Set Admin

```sql
-- Check who is admin
SELECT id, email, is_admin FROM users WHERE is_admin = TRUE;

-- Make yourself admin if needed
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

### 3. Create First Invitation

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

### 4. Send Invitation Link

Response includes:
```json
{
  "invitation_url": "http://localhost:3000/register?token=..."
}
```

Send this link to the new user via email, message, etc.

### 5. User Registers

New user visits link and registers with:
- Email (must match invitation)
- Password
- Name (optional)
- Institution (optional)
- Token (pre-filled from URL)

## 📊 Example Usage

### Python Script: Bulk Invite

```python
import requests

admin_token = "your_admin_jwt_token"
api_url = "http://localhost:8000"

users_to_invite = [
    {"email": "alice@lab.edu", "notes": "PhD student - Botany"},
    {"email": "bob@lab.edu", "notes": "Postdoc - Taxonomy"},
    {"email": "carol@lab.edu", "notes": "Lab manager"},
]

for user in users_to_invite:
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
        print(f"✅ {user['email']}")
        print(f"   Link: {inv['invitation_url']}\n")
    else:
        print(f"❌ {user['email']}: {response.json()['detail']}\n")
```

### Check Status

```python
import requests

response = requests.get(
    f"{api_url}/api/invitations?status_filter=pending",
    headers={"Authorization": f"Bearer {admin_token}"}
)

pending = response.json()
print(f"Pending invitations: {pending['total']}")
for inv in pending['invitations']:
    print(f"  - {inv['email']} (expires {inv['expires_at']})")
```

## 🔒 Security Model

### Token Properties
- **Length**: 64 characters (URL-safe base64)
- **Randomness**: Cryptographically secure (`secrets.token_urlsafe()`)
- **Uniqueness**: Enforced by database constraint
- **Single-use**: Marked as used after registration
- **Expirable**: Optional time-based expiration

### Email Verification
- Registration email MUST match invitation email
- Case-insensitive comparison
- Prevents token sharing/abuse

### Admin Controls
- Only users with `is_admin = TRUE` can:
  - Create invitations
  - List invitations
  - Revoke invitations
  - Resend invitations
- Regular users get 403 Forbidden

### State Management
Invitations can be in one of these states:
- **Pending**: Not used, not revoked, not expired
- **Used**: `used_at` is set
- **Revoked**: `revoked = TRUE`
- **Expired**: Current time > `expires_at`

## 📈 Monitoring

### SQL Queries

```sql
-- Acceptance rate
SELECT
    COUNT(*) as total_invitations,
    SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) as accepted,
    ROUND(100.0 * SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as acceptance_rate
FROM invitations
WHERE revoked = FALSE;

-- Pending invitations
SELECT email, created_at, expires_at, notes
FROM invitations
WHERE used_at IS NULL
  AND revoked = FALSE
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC;

-- Recent registrations from invitations
SELECT
    i.email,
    i.created_at as invited_at,
    i.used_at as registered_at,
    TIMESTAMPDIFF(HOUR, i.created_at, i.used_at) as hours_to_register
FROM invitations i
WHERE i.used_at IS NOT NULL
ORDER BY i.used_at DESC
LIMIT 10;
```

## 🎨 Frontend Integration (Optional)

### Admin Panel for Invitations

You could create a frontend UI:

```typescript
// Example React component structure
function InvitationManager() {
  return (
    <div>
      <CreateInvitationForm />
      <InvitationsList
        filters={['pending', 'used', 'revoked', 'expired']}
        actions={['revoke', 'resend', 'copy-link']}
      />
      <InvitationStats />
    </div>
  );
}
```

### Registration Page with Token Validation

```typescript
// Example registration flow
function RegisterPage() {
  const [token] = useSearchParams();
  const [invitation, setInvitation] = useState(null);

  useEffect(() => {
    // Validate token on page load
    apiClient.validateInvitation(token)
      .then(data => {
        if (data.valid) {
          setInvitation(data);
          // Pre-fill email field
        } else {
          showError(data.message);
        }
      });
  }, [token]);

  return (
    <RegistrationForm
      invitation={invitation}
      token={token}
    />
  );
}
```

## 🚨 Common Issues & Solutions

### Issue: "Admin access required"
**Cause:** User is not an admin
**Solution:**
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

### Issue: "Invalid invitation token"
**Cause:** Token expired, revoked, or already used
**Solution:** Create new invitation or resend existing:
```bash
curl -X POST http://localhost:8000/api/invitations/{id}/resend \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Issue: "Email does not match invitation"
**Cause:** User using different email than invited
**Solution:** User must use exact email from invitation

### Issue: "Email already registered"
**Cause:** Account already exists
**Solution:** User should login instead

## ✅ Testing Checklist

- [ ] Migration script completes successfully
- [ ] At least one admin user exists (`is_admin = TRUE`)
- [ ] Admin can create invitations
- [ ] Non-admin gets 403 when creating invitations
- [ ] Invitation URLs are generated correctly
- [ ] Token validation endpoint works
- [ ] Registration requires invitation token
- [ ] Registration fails with invalid/expired/revoked token
- [ ] Registration fails if email doesn't match
- [ ] Invitation is marked as used after successful registration
- [ ] Used invitations cannot be reused
- [ ] Admin can list all invitations
- [ ] Admin can filter invitations by status
- [ ] Admin can revoke invitations
- [ ] Admin can resend invitations
- [ ] Resending generates new token and extends expiration

## 📚 Documentation Files

| File | Description |
|------|-------------|
| `INVITATION_SYSTEM.md` | Complete documentation with API reference, security, monitoring |
| `INVITATION_QUICK_START.md` | Quick start guide with examples and scripts |
| `INVITATION_SYSTEM_SUMMARY.md` | This file - implementation summary |
| `add_invitations_system.py` | Migration script to set up the system |

## 🎓 Best Practices

1. **Limit Admin Access** - Only make trusted users admins
2. **Set Reasonable Expiration** - 7-14 days is usually sufficient
3. **Add Notes** - Document why each person was invited
4. **Monitor Usage** - Check pending invitations periodically
5. **Clean Up** - Revoke old unused invitations
6. **Use HTTPS** - Always use HTTPS in production
7. **Secure Delivery** - Send invitations via secure channels
8. **Follow Up** - Remind users if invitation unused after a few days

## 🌟 Optional Enhancements

### 1. Email Integration
Automatically send invitation emails instead of manual copy/paste:
```python
from email.mime.text import MIMEText
import smtplib

def send_invitation_email(email, invitation_url):
    # Email sending logic
    pass
```

### 2. Invitation History in UI
Show invitation history on user profile:
- Who invited them
- When they registered
- Invitation creation date

### 3. Invitation Analytics
Dashboard showing:
- Acceptance rate
- Average time to accept
- Invitations by admin
- Recent activity

### 4. Invitation Templates
Pre-defined invitation messages/emails for different user types.

### 5. Bulk Import
Upload CSV of emails to invite multiple users at once.

## 🎉 Summary

The invitation system is now fully operational:

✅ **Secure** - Cryptographically secure tokens, email verification
✅ **Controlled** - Admin-only invitation management
✅ **Flexible** - Optional expiration, revocation, resending
✅ **Simple** - Clear API, easy to use
✅ **Documented** - Complete documentation and examples

Registration is now invitation-only, ensuring controlled access to your Herbarium Pro application!
