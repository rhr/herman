# User Registration Configuration

This document explains how to enable or disable new user registration in Herbarium Pro.

## Current Status

**Registration is currently: DISABLED**

New users cannot create accounts through the UI or API. Only existing users with valid credentials can log in.

---

## Disabling User Registration

If registration is currently enabled and you want to disable it:

### 1. Backend Changes

**File:** `backend/main.py` (lines ~79-115)

Find the registration endpoint and modify it to immediately return a 403 error:

```python
@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user - DISABLED"""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Registration is disabled. Please contact the administrator for access."
    )

    # Registration code disabled below
    # # Check if email already exists
    # existing_user = db.query(User).filter(User.email == user_data.email).first()
    # ...
```

**Important:** Keep the original code commented out below the error so you can easily re-enable it later.

### 2. Frontend Changes

**File:** `components/AuthModal.tsx` (lines ~141-161)

Comment out the toggle button that allows switching between login and registration modes:

```tsx
{/* Toggle mode - DISABLED: Registration is disabled */}
{/* <div className="mt-6 text-center">
  <button
    type="button"
    onClick={() => {
      setMode(mode === 'login' ? 'register' : 'login');
      setError('');
    }}
    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
  >
    {mode === 'login' ? (
      <>
        Don't have an account? <span className="underline">Sign up</span>
      </>
    ) : (
      <>
        Already have an account? <span className="underline">Sign in</span>
      </>
    )}
  </button>
</div> */}
```

### 3. Apply Changes

The backend will automatically reload if running with `--reload` flag:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The frontend will hot-reload automatically if the dev server is running:
```bash
npm run dev
```

---

## Enabling User Registration

If registration is currently disabled and you want to enable it:

### 1. Backend Changes

**File:** `backend/main.py` (lines ~79-115)

Remove or comment out the `raise HTTPException` line, and uncomment the original registration code:

```python
@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        name=user_data.name,
        institution=user_data.institution
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate token (convert ID to string for JWT)
    access_token = create_access_token(data={"sub": str(new_user.id)})

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.from_orm(new_user)
    )
```

### 2. Frontend Changes

**File:** `components/AuthModal.tsx` (lines ~141-161)

Uncomment the toggle button:

```tsx
{/* Toggle mode */}
<div className="mt-6 text-center">
  <button
    type="button"
    onClick={() => {
      setMode(mode === 'login' ? 'register' : 'login');
      setError('');
    }}
    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
  >
    {mode === 'login' ? (
      <>
        Don't have an account? <span className="underline">Sign up</span>
      </>
    ) : (
      <>
        Already have an account? <span className="underline">Sign in</span>
      </>
    )}
  </button>
</div>
```

### 3. Apply Changes

Both backend and frontend will reload automatically if running in development mode with hot reload enabled.

---

## Creating Users Manually (When Registration is Disabled)

If registration is disabled but you need to create a new user account, use the Python interactive shell:

```bash
# Activate the conda environment
source ~/miniconda3/etc/profile.d/conda.sh
conda activate herman

# Navigate to backend directory
cd /home/rree/src/herb-pro/backend

# Run Python shell
python
```

Then execute:

```python
from database import get_db
from models import User
from auth import hash_password

# Get database session
db = next(get_db())

# Create new user
new_user = User(
    email="user@example.com",
    password_hash=hash_password("securepassword123"),
    name="User Name",
    institution="Institution Name"  # Optional
)

db.add(new_user)
db.commit()

print(f"User created successfully! ID: {new_user.id}")
db.close()
exit()
```

**Important:** Replace the email, password, name, and institution with actual values.

---

## Alternative: Script for Creating Users

Create a file `backend/create_user.py`:

```python
#!/usr/bin/env python3
"""
Create a new user manually (when registration is disabled)

Usage:
    python create_user.py --email user@example.com --password secure123 --name "User Name"
"""
import argparse
from database import get_db
from models import User
from auth import hash_password

def create_user(email: str, password: str, name: str = None, institution: str = None):
    """Create a new user"""
    db = next(get_db())

    # Check if user already exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"ERROR: User with email {email} already exists")
        db.close()
        return False

    # Create user
    new_user = User(
        email=email,
        password_hash=hash_password(password),
        name=name,
        institution=institution
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    print(f"✅ User created successfully!")
    print(f"   ID: {new_user.id}")
    print(f"   Email: {new_user.email}")
    print(f"   Name: {new_user.name}")

    db.close()
    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create a new user')
    parser.add_argument('--email', required=True, help='User email address')
    parser.add_argument('--password', required=True, help='User password')
    parser.add_argument('--name', help='User full name')
    parser.add_argument('--institution', help='User institution')

    args = parser.parse_args()

    create_user(
        email=args.email,
        password=args.password,
        name=args.name,
        institution=args.institution
    )
```

Make it executable and use it:

```bash
chmod +x create_user.py
python create_user.py --email user@example.com --password secure123 --name "John Doe" --institution "Example University"
```

---

## Security Recommendations

### When Registration is Enabled

1. **Use strong password requirements** - Consider adding password strength validation
2. **Email verification** - Implement email verification before activation (not currently implemented)
3. **Rate limiting** - Add rate limiting to prevent spam registrations
4. **CAPTCHA** - Consider adding CAPTCHA to the registration form

### When Registration is Disabled

1. **Document the process** - Make sure administrators know how to create accounts
2. **Secure password sharing** - Use secure channels to share initial passwords with new users
3. **Force password change** - Consider requiring users to change their password on first login

### General Best Practices

1. **Use HTTPS** - Always use HTTPS in production
2. **Strong JWT secret** - Use a strong secret key for JWT tokens (set in `.env`)
3. **Token expiration** - Configure appropriate token expiration times
4. **Audit logs** - Consider logging authentication attempts
5. **Backup authentication** - Maintain a backup method to access the system if locked out

---

## Environment Variables

Related authentication settings in `backend/.env`:

```bash
# JWT Secret (use a strong random string in production)
JWT_SECRET=your-secret-key-here

# JWT Token expiration (in minutes)
JWT_EXPIRATION=10080  # 7 days

# API Base URL (for generating image URLs)
API_BASE_URL=http://localhost:8000
```

---

## Troubleshooting

### "Registration is disabled" error when trying to register

This is expected behavior when registration is disabled. Either:
- Enable registration following the steps above, or
- Create the user account manually using the Python shell or script

### Users can't log in after disabling registration

Disabling registration doesn't affect existing users. If users can't log in:
1. Verify the user exists in the database
2. Check that the JWT_SECRET hasn't changed
3. Ensure the backend is running and accessible
4. Check the browser console for API errors

### Changes not taking effect

1. **Backend:** Restart the server if not running with `--reload`
2. **Frontend:** Clear browser cache and hard refresh (Ctrl+Shift+R)
3. Check that you edited the correct files
4. Look for syntax errors in the console/logs

---

## Related Files

- `backend/main.py` - Registration endpoint
- `backend/auth.py` - Authentication functions (password hashing, JWT)
- `backend/models.py` - User model
- `components/AuthModal.tsx` - Frontend login/registration UI
- `services/apiClient.ts` - API client with registration method

---

## Questions?

For issues or questions, check:
- Backend logs: `backend/backend.log`
- Browser console: F12 → Console tab
- Database users: `SELECT * FROM users;`
