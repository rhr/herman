# Registration Page - User Guide

The registration page has been successfully implemented with full invitation token support!

## What Was Implemented

1. **RegisterView Component** (`components/views/RegisterView.tsx`)
   - Full-page registration form with professional UI
   - Automatic token validation on page load
   - Pre-filled email from invitation
   - Password strength indicator
   - Form validation with helpful error messages

2. **API Client Updates** (`services/apiClient.ts`)
   - `validateInvitationToken()` - Validates tokens before registration
   - `registerWithInvitation()` - Registers users with invitation tokens

3. **Routing** (`App.tsx`)
   - `/register` route added
   - Renders without header/footer for clean UX
   - Accessible without authentication

## How It Works

### Step 1: Admin Creates Invitation

```bash
cd backend
python create_invite.py
```

This generates an invitation URL like:
```
https://oneil.fieldmuseum.org/labnotes/register?token=abc123xyz789...
```

### Step 2: User Opens Link

When the invitation link is opened:

1. **Token Validation** (automatic)
   - Frontend calls `GET /api/invitations/validate/{token}`
   - Shows loading spinner during validation
   - Displays error if token is invalid/expired/used

2. **Registration Form** (if valid)
   - Email is pre-filled and read-only
   - User enters:
     - Full Name (required)
     - Institution (optional)
     - Password (minimum 6 chars)
     - Confirm Password
   - Password strength indicator shows weak/medium/strong
   - Real-time validation for password match

3. **Account Creation**
   - Submits to `POST /api/auth/register` with:
     - Email
     - Password
     - Name
     - Institution
     - invitation_token
   - On success:
     - User is automatically logged in
     - JWT token stored in localStorage
     - Redirected to main app
   - On error:
     - Clear error message displayed
     - User can retry

### Step 3: Automatic Login

After successful registration, the user is:
- ✅ Automatically logged in (JWT token saved)
- ✅ Redirected to the main app (`/`)
- ✅ Ready to use the application immediately

## UI Features

### Token Validation States

**Loading:**
```
┌────────────────────────────────┐
│  [Spinner]                     │
│  Validating invitation...      │
└────────────────────────────────┘
```

**Invalid Token:**
```
┌────────────────────────────────┐
│  [Warning Icon]                │
│  Invalid Invitation            │
│                                │
│  This invitation may have      │
│  expired, been revoked, or     │
│  already used.                 │
│                                │
│  [Go to Login]                 │
└────────────────────────────────┘
```

**Valid Token:**
```
┌────────────────────────────────┐
│  [Herbarium Icon]              │
│  Welcome to Herbarium Pro      │
│  Create your account           │
│  ✓ Valid invitation            │
│                                │
│  Full Name: [          ]       │
│  Institution: [          ]     │
│  Email: user@example.com (RO)  │
│  Password: [          ]        │
│  [Strength Indicator]          │
│  Confirm: [          ]         │
│                                │
│  [Create Account]              │
│                                │
│  Already have an account?      │
│  Sign in                       │
└────────────────────────────────┘
```

## Testing

### 1. Build Frontend

```bash
cd /home/rree/herman
npm run build
```

### 2. Deploy to Production

```bash
# Copy build to server
scp -r dist/* oneil.fieldmuseum.org:/var/www/labnotes/frontend/

# Restart backend (if needed)
ssh oneil.fieldmuseum.org
sudo systemctl restart labnotes-api
```

### 3. Create Test Invitation

```bash
cd backend
python create_invite.py
```

Enter test details:
```
Email address: test@example.com
Expires in days (default: 7): 1
Notes (optional): Testing registration page
```

Copy the invitation URL from the output.

### 4. Test Registration Flow

1. Open the invitation URL in a browser
2. Verify token validation shows "✓ Valid invitation"
3. Fill out the form:
   - Name: Test User
   - Institution: Field Museum
   - Password: test123456
   - Confirm: test123456
4. Click "Create Account"
5. Verify you're redirected to main app and logged in

### 5. Test Error Cases

**Already Used Token:**
- Use the same invitation link again
- Should show: "This invitation has already been used"

**Invalid Token:**
- Modify the token in URL
- Should show: "Invalid invitation token"

**Expired Token:**
- Create invitation with `expires_in_days: 0`
- Wait a bit or modify database
- Should show: "This invitation has expired"

**Wrong Email:**
- Backend validates email matches invitation
- This is enforced at API level

## Troubleshooting

### "No invitation token provided"
**Cause:** Missing `?token=...` in URL
**Fix:** Ensure full invitation URL is used

### "Invalid invitation token"
**Cause:** Token doesn't exist in database
**Fix:** Create new invitation or check for typos in URL

### "This invitation has expired"
**Cause:** Invitation past expiration date
**Fix:** Use resend endpoint or create new invitation:
```bash
curl -X POST http://oneil.fieldmuseum.org/labnotes/api/invitations/1/resend \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### "Email does not match invitation"
**Cause:** User trying to register with different email
**Fix:** User must use the exact email from invitation

### "Passwords do not match"
**Cause:** Password and confirmation don't match
**Fix:** Re-enter matching passwords

### Registration succeeds but not logged in
**Cause:** JWT token not saved properly
**Check:** Browser console for errors
**Fix:** Check CORS settings and API_BASE_URL

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/invitations/validate/{token}` | GET | Validate invitation token |
| `/api/auth/register` | POST | Register new user with invitation |

## Security Features

✅ **Server-side validation** - All checks done on backend
✅ **Single-use tokens** - Invitations marked as used after registration
✅ **Email verification** - Email must match invitation
✅ **Expiration** - Optional time-based expiration
✅ **Revocation** - Admins can revoke invitations
✅ **Password requirements** - Minimum 6 characters enforced
✅ **Token in URL** - Not visible in form, only in URL parameter

## Next Steps

### Optional Enhancements

1. **Email Integration**
   - Automatically send invitation emails
   - Add "Resend Email" button in admin UI

2. **Admin UI**
   - Build invitation management interface
   - List/create/revoke invitations in web UI

3. **User Management**
   - Admin page to view all users
   - Ability to promote users to admin
   - User activity tracking

4. **Analytics**
   - Track invitation acceptance rate
   - Monitor registration completion time
   - Alert on unused invitations

## Files Modified

- ✅ `components/views/RegisterView.tsx` - New registration page
- ✅ `services/apiClient.ts` - Added validation and registration methods
- ✅ `App.tsx` - Added `/register` route
- ✅ `backend/schemas.py` - Added `is_admin` to UserResponse
- ✅ `backend/create_invite.py` - Interactive invitation creator

## Complete! 🎉

The invitation-based registration system is fully functional. Users can now register using secure, single-use invitation tokens with a beautiful, user-friendly interface.
