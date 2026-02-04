"""
Migration script to add invitation system tables and admin functionality
Run this once to enable invitation-only registration
"""
from sqlalchemy import text
from database import engine, SessionLocal
from models import Base, Invitation, User


def add_invitations_system():
    """Add invitations table and is_admin column to users table"""
    print("Adding invitation system to database...")

    # Create invitations table
    print("1. Creating invitations table...")
    Invitation.__table__.create(engine, checkfirst=True)
    print("   ✅ invitations table created")

    # Add is_admin column to users table if it doesn't exist
    print("2. Adding is_admin column to users table...")
    try:
        with engine.connect() as conn:
            # Check if column exists
            result = conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'is_admin'
            """))
            exists = result.scalar() > 0

            if not exists:
                conn.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN is_admin BOOLEAN DEFAULT FALSE
                """))
                conn.commit()
                print("   ✅ is_admin column added to users table")
            else:
                print("   ℹ️  is_admin column already exists")
    except Exception as e:
        print(f"   ⚠️  Error adding is_admin column: {e}")
        print("   This may be normal if the column already exists")

    # Make first user an admin if exists
    print("3. Checking for existing users...")
    db = SessionLocal()
    try:
        first_user = db.query(User).order_by(User.id).first()
        if first_user:
            if not first_user.is_admin:
                first_user.is_admin = True
                db.commit()
                print(f"   ✅ Made first user (ID: {first_user.id}, Email: {first_user.email}) an admin")
            else:
                print(f"   ℹ️  First user (ID: {first_user.id}, Email: {first_user.email}) is already an admin")
        else:
            print("   ℹ️  No users exist yet")
            print("   💡 The first user to register will need to be manually made an admin")
    finally:
        db.close()

    print("\n✅ Invitation system setup complete!")
    print("\n📝 Next steps:")
    print("   1. Ensure at least one user has is_admin=True")
    print("   2. Admin users can create invitations via POST /api/invitations")
    print("   3. New users must register with a valid invitation token")
    print("   4. Registration is now invitation-only")
    print("\n🔑 To manually make a user an admin, run:")
    print("   UPDATE users SET is_admin = TRUE WHERE id = <user_id>;")


if __name__ == "__main__":
    add_invitations_system()
