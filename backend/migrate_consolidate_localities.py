#!/usr/bin/env python3
"""
Database Migration: Consolidate Localities into Specimens Table

This script migrates from the old schema (separate specimens and localities tables)
to the new schema (single specimens table with locality fields).

COORDINATE FIELDS:
- latitude/longitude: VARCHAR(50) - Stores verbatim coordinates as entered
- latdd/londd: FLOAT - Stores decimal degrees for mapping (converted from old FLOAT columns)

BEFORE RUNNING:
1. Backup your database: mysqldump herman_db > backup_before_migration.sql
2. Stop the backend server
3. Run this script
4. Restart the backend server

Usage:
    python migrate_consolidate_localities.py
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Database connection settings
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "herman_db")
DB_USER = os.getenv("DB_USER", "herman_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "gizmo")


def run_migration():
    """Run the migration"""
    try:
        import mysql.connector
    except ImportError:
        print("❌ Error: mysql-connector-python not installed")
        print("Install with: pip install mysql-connector-python")
        sys.exit(1)

    print("=" * 70)
    print("🔄 DATABASE MIGRATION: Consolidate Localities into Specimens")
    print("=" * 70)
    print(f"\nDatabase: {DB_NAME}@{DB_HOST}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Confirm migration
    print("\n⚠️  WARNING: This will modify your database schema!")
    print("   - Adds locality columns to specimens table")
    print("   - Copies data from localities table")
    print("   - Drops localities table")
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
        # Check if localities table exists
        cursor.execute("SHOW TABLES LIKE 'localities'")
        if not cursor.fetchone():
            print("\n⚠️  Localities table doesn't exist - migration not needed")
            print("   (Schema may already be consolidated)")
            conn.close()
            return

        # Step 1: Count records
        print("\n📊 Analyzing existing data...")
        cursor.execute("SELECT COUNT(*) as count FROM specimens")
        specimen_count = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM localities")
        locality_count = cursor.fetchone()['count']

        print(f"   Specimens: {specimen_count}")
        print(f"   Localities: {locality_count}")

        # Step 2: Add new columns to specimens table
        print("\n🔧 Step 1: Adding locality columns to specimens table...")

        columns_to_add = [
            "ADD COLUMN country VARCHAR(100)",
            "ADD COLUMN state_province VARCHAR(100)",
            "ADD COLUMN county_city VARCHAR(100)",
            "ADD COLUMN locality_description TEXT",
            "ADD COLUMN latitude VARCHAR(50)",    # Verbatim latitude (as entered)
            "ADD COLUMN longitude VARCHAR(50)",   # Verbatim longitude (as entered)
            "ADD COLUMN latdd FLOAT",            # Decimal degrees latitude (for mapping)
            "ADD COLUMN londd FLOAT",            # Decimal degrees longitude (for mapping)
            "ADD COLUMN habitat TEXT"
        ]

        for col_def in columns_to_add:
            try:
                cursor.execute(f"ALTER TABLE specimens {col_def}")
                print(f"   ✓ Added column: {col_def.split()[2]}")
            except mysql.connector.Error as e:
                if "Duplicate column name" in str(e):
                    print(f"   ⚠️  Column already exists: {col_def.split()[2]}")
                else:
                    raise

        conn.commit()
        print("✓ Columns added successfully")

        # Step 3: Copy data from localities to specimens
        print("\n🔄 Step 2: Copying locality data into specimens...")

        cursor.execute("""
            UPDATE specimens s
            INNER JOIN localities l ON s.id = l.specimen_id
            SET
                s.country = l.country,
                s.state_province = l.state_province,
                s.county_city = l.county_city,
                s.locality_description = l.description,
                s.latitude = CAST(l.latitude AS CHAR),    -- Convert FLOAT to string
                s.longitude = CAST(l.longitude AS CHAR),  -- Convert FLOAT to string
                s.latdd = l.latitude,                     -- Copy as decimal degrees
                s.londd = l.longitude,                    -- Copy as decimal degrees
                s.habitat = l.habitat
        """)

        rows_updated = cursor.rowcount
        conn.commit()
        print(f"✓ Updated {rows_updated} specimen records with locality data")

        # Step 4: Verify data migration
        print("\n🔍 Step 3: Verifying data migration...")

        cursor.execute("""
            SELECT COUNT(*) as count
            FROM specimens
            WHERE latdd IS NOT NULL OR locality_description IS NOT NULL
        """)
        specimens_with_locality = cursor.fetchone()['count']

        print(f"   Specimens with locality data: {specimens_with_locality}/{specimen_count}")

        if specimens_with_locality == 0 and locality_count > 0:
            print("   ⚠️  Warning: No locality data was migrated!")
            response = input("   Continue anyway? (yes/no): ")
            if response.lower() != 'yes':
                print("\n❌ Migration cancelled - rolling back...")
                conn.rollback()
                sys.exit(1)

        # Step 5: Add indexes for performance
        print("\n📇 Step 4: Adding indexes for map queries...")

        try:
            cursor.execute("CREATE INDEX idx_specimens_latdd ON specimens(latdd)")
            print("   ✓ Added index on latdd (decimal degrees latitude)")
        except mysql.connector.Error as e:
            if "Duplicate key name" in str(e):
                print("   ⚠️  Index on latdd already exists")
            else:
                print(f"   ⚠️  Could not add index on latdd: {e}")

        try:
            cursor.execute("CREATE INDEX idx_specimens_londd ON specimens(londd)")
            print("   ✓ Added index on londd (decimal degrees longitude)")
        except mysql.connector.Error as e:
            if "Duplicate key name" in str(e):
                print("   ⚠️  Index on londd already exists")
            else:
                print(f"   ⚠️  Could not add index on londd: {e}")

        try:
            cursor.execute("CREATE INDEX idx_specimens_coordinates ON specimens(latdd, londd)")
            print("   ✓ Added composite index on coordinates (for map queries)")
        except mysql.connector.Error as e:
            if "Duplicate key name" in str(e):
                print("   ⚠️  Composite index already exists")
            else:
                print(f"   ⚠️  Could not add composite index: {e}")

        conn.commit()

        # Step 6: Drop localities table
        print("\n🗑️  Step 5: Dropping localities table...")
        response = input("   Drop localities table? (yes/no): ")

        if response.lower() == 'yes':
            cursor.execute("DROP TABLE localities")
            conn.commit()
            print("✓ Localities table dropped")
        else:
            print("⚠️  Localities table kept (you can drop it manually later)")

        # Final summary
        print("\n" + "=" * 70)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 70)
        print(f"Specimens migrated: {rows_updated}")
        print(f"Specimens with locality data: {specimens_with_locality}")
        print("\nNext steps:")
        print("1. Restart your backend server")
        print("2. Test the application thoroughly")
        print("3. If everything works, you can delete this migration script")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("\n🔄 Rolling back changes...")
        conn.rollback()
        print("⚠️  Database rolled back to previous state")
        print("\nTo restore from backup:")
        print(f"   mysql -u {DB_USER} -p {DB_NAME} < backup_before_migration.sql")
        sys.exit(1)

    finally:
        cursor.close()
        conn.close()


def create_rollback_script():
    """Create a rollback script in case migration needs to be reversed"""
    rollback_script = """#!/usr/bin/env python3
'''
Rollback script for locality consolidation migration

This script reverses the migration by:
1. Creating localities table
2. Copying locality data from specimens back to localities
3. Removing locality columns from specimens

WARNING: Only use this if the migration caused issues!
'''

import os
import sys
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "herman_db")
DB_USER = os.getenv("DB_USER", "herman_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "gizmo")

try:
    import mysql.connector

    print("🔄 ROLLBACK: Restoring separate localities table...")

    conn = mysql.connector.connect(host=DB_HOST, port=DB_PORT, database=DB_NAME, user=DB_USER, password=DB_PASSWORD)
    cursor = conn.cursor()

    # Recreate localities table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS localities (
            id VARCHAR(36) PRIMARY KEY,
            specimen_id VARCHAR(36) NOT NULL UNIQUE,
            country VARCHAR(100),
            state_province VARCHAR(100),
            county_city VARCHAR(100),
            description TEXT,
            latitude FLOAT,
            longitude FLOAT,
            habitat TEXT,
            FOREIGN KEY (specimen_id) REFERENCES specimens(id) ON DELETE CASCADE,
            INDEX idx_locality_specimen (specimen_id)
        )
    ''')
    print("✓ Created localities table")

    # Copy data back (use decimal degrees for old localities table FLOAT columns)
    cursor.execute('''
        INSERT INTO localities (id, specimen_id, country, state_province, county_city, description, latitude, longitude, habitat)
        SELECT
            UUID() as id,
            id as specimen_id,
            country,
            state_province,
            county_city,
            locality_description,
            latdd,      -- Use decimal degrees for localities table
            londd,      -- Use decimal degrees for localities table
            habitat
        FROM specimens
        WHERE latdd IS NOT NULL OR locality_description IS NOT NULL
    ''')
    print(f"✓ Copied {cursor.rowcount} locality records")

    # Remove locality columns from specimens (optional)
    # Uncomment if you want to remove the columns:
    # cursor.execute("ALTER TABLE specimens DROP COLUMN country, DROP COLUMN state_province, ...")

    conn.commit()
    cursor.close()
    conn.close()

    print("✅ Rollback completed")

except Exception as e:
    print(f"❌ Rollback failed: {e}")
    sys.exit(1)
"""

    with open("rollback_migration.py", "w") as f:
        f.write(rollback_script)

    os.chmod("rollback_migration.py", 0o755)
    print("\n📝 Created rollback_migration.py script (in case you need it)")


if __name__ == "__main__":
    create_rollback_script()
    run_migration()
