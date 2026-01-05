#!/usr/bin/env python3
"""
Database Migration: Add collector_number field to specimens table

This script adds the collector_number VARCHAR(100) column to the specimens table.

BEFORE RUNNING:
1. Backup your database: mysqldump herman_db > backup_before_collector_number.sql
2. Stop the backend server
3. Run this script
4. Restart the backend server

Usage:
    python migrate_add_collector_number.py
"""

import os
import sys
from datetime import datetime

# Import dotenv if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Database connection settings
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "herman_db")
DB_USER = os.getenv("DB_USER", "herman_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")


def run_migration():
    """Run the migration"""
    try:
        import mysql.connector
    except ImportError:
        print("❌ Error: mysql-connector-python not installed")
        print("Install with: pip install mysql-connector-python")
        sys.exit(1)

    print("=" * 70)
    print("🔄 DATABASE MIGRATION: Add collector_number field")
    print("=" * 70)
    print(f"\nDatabase: {DB_NAME}@{DB_HOST}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Confirm migration
    print("\n⚠️  WARNING: This will modify your database schema!")
    print("   - Adds collector_number VARCHAR(100) column to specimens table")
    print("\nMake sure you have backed up your database before proceeding.")

    response = input("\nContinue with migration? (yes/no): ")
    if response.lower() != 'yes':
        print("\n❌ Migration cancelled")
        sys.exit(0)

    # Connect to database
    print(f"\n📡 Connecting to database...")
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor(dictionary=True)
        print("✓ Connected successfully")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        sys.exit(1)

    try:
        # Check if column already exists
        print("\n🔍 Checking current schema...")
        cursor.execute("DESCRIBE specimens")
        columns = [row['Field'] for row in cursor.fetchall()]

        if 'collector_number' in columns:
            print("\n⚠️  collector_number column already exists - migration not needed")
            conn.close()
            return

        # Add collector_number column
        print("\n🔧 Adding collector_number column...")
        cursor.execute("""
            ALTER TABLE specimens
            ADD COLUMN collector_number VARCHAR(100) AFTER collector
        """)
        conn.commit()
        print("✓ Column added successfully")

        # Verify column was added
        print("\n✓ Verifying migration...")
        cursor.execute("DESCRIBE specimens")
        columns = [row['Field'] for row in cursor.fetchall()]

        if 'collector_number' in columns:
            print("✓ Migration verified successfully")
        else:
            raise Exception("Column was not added properly")

        # Final summary
        print("\n" + "=" * 70)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 70)
        print("\nNext steps:")
        print("1. Restart your backend server")
        print("2. Test the application thoroughly")
        print("3. The collector_number field is now available for specimens")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("\n🔄 Rolling back changes...")
        conn.rollback()
        print("⚠️  Database rolled back to previous state")
        print("\nTo restore from backup:")
        print(f"   mysql -u {DB_USER} -p {DB_NAME} < backup_before_collector_number.sql")
        sys.exit(1)

    finally:
        cursor.close()
        conn.close()


def create_rollback_script():
    """Create a rollback script in case migration needs to be reversed"""
    rollback_script = """#!/usr/bin/env python3
'''
Rollback script for collector_number migration

This script removes the collector_number column from the specimens table.

WARNING: This will delete the collector_number data!
'''

import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import mysql.connector

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_NAME = os.getenv("DB_NAME", "herman_db")
    DB_USER = os.getenv("DB_USER", "herman_user")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "gizmo")

    print("🔄 ROLLBACK: Removing collector_number column...")

    conn = mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cursor = conn.cursor()

    # Remove collector_number column
    cursor.execute("ALTER TABLE specimens DROP COLUMN collector_number")
    print("✓ Removed collector_number column")

    conn.commit()
    cursor.close()
    conn.close()

    print("✅ Rollback completed")

except Exception as e:
    print(f"❌ Rollback failed: {e}")
    sys.exit(1)
"""

    with open("rollback_collector_number.py", "w") as f:
        f.write(rollback_script)

    os.chmod("rollback_collector_number.py", 0o755)
    print("\n📝 Created rollback_collector_number.py script (in case you need it)")


if __name__ == "__main__":
    create_rollback_script()
    run_migration()
