#!/usr/bin/env python3
"""
Create a new user manually (when registration is disabled)

Usage:
    python create_user.py --email user@example.com --password secure123 --name "User Name"
    python create_user.py --email admin@example.com --password admin123 --name "Admin" --institution "Example Org"
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
        print(f"❌ ERROR: User with email '{email}' already exists")
        print(f"   User ID: {existing.id}")
        print(f"   Name: {existing.name}")
        print(f"   Created: {existing.created_at}")
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
    print(f"   Name: {new_user.name or '(not set)'}")
    print(f"   Institution: {new_user.institution or '(not set)'}")
    print(f"   Created: {new_user.created_at}")
    print()
    print("The user can now log in with their email and password.")

    db.close()
    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Create a new user account',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_user.py --email john@example.com --password secret123 --name "John Doe"
  python create_user.py --email admin@lab.edu --password admin --name "Lab Admin" --institution "Lab University"
        """
    )
    parser.add_argument('--email', required=True, help='User email address (must be unique)')
    parser.add_argument('--password', required=True, help='User password')
    parser.add_argument('--name', help='User full name (optional)')
    parser.add_argument('--institution', help='User institution or affiliation (optional)')

    args = parser.parse_args()

    # Validate email
    if '@' not in args.email:
        print("❌ ERROR: Invalid email address")
        exit(1)

    # Warn about weak passwords
    if len(args.password) < 6:
        print("⚠️  WARNING: Password is shorter than 6 characters")
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            exit(0)

    print(f"\nCreating user:")
    print(f"  Email: {args.email}")
    print(f"  Name: {args.name or '(not set)'}")
    print(f"  Institution: {args.institution or '(not set)'}")
    print()

    success = create_user(
        email=args.email,
        password=args.password,
        name=args.name,
        institution=args.institution
    )

    exit(0 if success else 1)
