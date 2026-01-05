#!/usr/bin/env python3
"""
Database Migration: Add Decimal Degrees Fields

This script adds latdd and londd fields to store parsed decimal degrees,
while keeping latitude and longitude as string fields for verbatim values.

BEFORE RUNNING:
1. Backup your database: mysqldump herman_db > backup_before_dd_migration.sql
2. Stop the backend server
3. Run this script
4. Restart the backend server

Usage:
    python migrate_add_decimal_degrees.py
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


def parse_coordinate(coord_str):
    """
    Parse a coordinate string to decimal degrees.
    Handles various formats:
    - Decimal degrees: "42.5", "-83.5"
    - With direction: "42.5 N", "83.5 W"
    """
    if not coord_str:
        return None

    try:
        # Remove whitespace and convert to uppercase
        coord_str = str(coord_str).strip().upper()

        # Check for direction indicators
        is_negative = False
        if 'S' in coord_str or 'W' in coord_str:
            is_negative = True

        # Remove direction letters
        coord_str = coord_str.replace('N', '').replace('S', '').replace('E', '').replace('W', '').strip()

        # Try to convert to float
        value = float(coord_str)

        # Apply direction
        if is_negative:
            value = -abs(value)

        return value

    except (ValueError, AttributeError):
        # Can't parse - return None
        return None


def run_migration():
    """Run the migration"""
    try:
        import mysql.connector
    except ImportError:
        print("❌ Error: mysql-connector-python not installed")
        print("Install with: pip install mysql-connector-python")
        sys.exit(1)

    print("=" * 70)
    print("🔄 DATABASE MIGRATION: Add Decimal Degrees Fields")
    print("=" * 70)
    print(f"\nDatabase: {DB_NAME}@{DB_HOST}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Confirm migration
    print("\n⚠️  WARNING: This will modify your database schema!")
    print("   - Changes latitude/longitude from FLOAT to VARCHAR(50)")
    print("   - Adds latdd and londd FLOAT fields")
    print("   - Copies and parses existing coordinate data")
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
        # Step 1: Count records and check current schema
        print("\n📊 Analyzing existing data...")
        cursor.execute("SELECT COUNT(*) as count FROM specimens")
        specimen_count = cursor.fetchone()['count']
        print(f"   Total specimens: {specimen_count}")

        # Check if latitude is already a string
        cursor.execute("DESCRIBE specimens latitude")
        lat_type = cursor.fetchone()['Type']
        print(f"   Current latitude type: {lat_type}")

        # Step 2: Create temporary columns for decimal degrees
        print("\n🔧 Step 1: Adding new decimal degree fields...")

        try:
            cursor.execute("ALTER TABLE specimens ADD COLUMN latdd FLOAT")
            print("   ✓ Added column: latdd")
        except mysql.connector.Error as e:
            if "Duplicate column name" in str(e):
                print("   ⚠️  Column latdd already exists")
            else:
                raise

        try:
            cursor.execute("ALTER TABLE specimens ADD COLUMN londd FLOAT")
            print("   ✓ Added column: londd")
        except mysql.connector.Error as e:
            if "Duplicate column name" in str(e):
                print("   ⚠️  Column londd already exists")
            else:
                raise

        conn.commit()

        # Step 3: Copy existing coordinate data to new fields
        print("\n🔄 Step 2: Copying coordinate data to decimal degree fields...")

        if 'float' in lat_type.lower() or 'double' in lat_type.lower():
            # Latitude is currently numeric - copy directly
            cursor.execute("""
                UPDATE specimens
                SET latdd = latitude, londd = longitude
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """)
            rows_updated = cursor.rowcount
            conn.commit()
            print(f"   ✓ Copied {rows_updated} coordinate pairs to decimal degree fields")
        else:
            # Latitude is already string - parse values
            print("   Latitude is already a string, parsing existing values...")
            cursor.execute("""
                SELECT id, latitude, longitude
                FROM specimens
                WHERE latitude IS NOT NULL OR longitude IS NOT NULL
            """)
            specimens = cursor.fetchall()

            parsed_count = 0
            failed_count = 0

            for specimen in specimens:
                lat_parsed = parse_coordinate(specimen['latitude'])
                lon_parsed = parse_coordinate(specimen['longitude'])

                if lat_parsed is not None or lon_parsed is not None:
                    cursor.execute("""
                        UPDATE specimens
                        SET latdd = %s, londd = %s
                        WHERE id = %s
                    """, (lat_parsed, lon_parsed, specimen['id']))
                    parsed_count += 1
                else:
                    failed_count += 1

            conn.commit()
            print(f"   ✓ Parsed {parsed_count} coordinate pairs")
            if failed_count > 0:
                print(f"   ⚠️  Failed to parse {failed_count} coordinate pairs")

        # Step 4: Convert latitude/longitude to VARCHAR if they're currently FLOAT
        if 'float' in lat_type.lower() or 'double' in lat_type.lower():
            print("\n🔄 Step 3: Converting latitude/longitude to VARCHAR...")

            try:
                # First, convert values to strings
                cursor.execute("""
                    UPDATE specimens
                    SET latitude = CAST(latitude AS CHAR),
                        longitude = CAST(longitude AS CHAR)
                    WHERE latitude IS NOT NULL
                """)
                conn.commit()
                print("   ✓ Converted coordinate values to strings")

                # Change column types
                cursor.execute("ALTER TABLE specimens MODIFY COLUMN latitude VARCHAR(50)")
                cursor.execute("ALTER TABLE specimens MODIFY COLUMN longitude VARCHAR(50)")
                conn.commit()
                print("   ✓ Changed latitude/longitude to VARCHAR(50)")

            except mysql.connector.Error as e:
                print(f"   ⚠️  Column type conversion issue: {e}")
                print("   You may need to handle this manually")
        else:
            print("\n   Latitude/longitude are already VARCHAR - skipping conversion")

        # Step 5: Add indexes
        print("\n📇 Step 4: Adding indexes for map queries...")

        # Drop old indexes if they exist
        try:
            cursor.execute("DROP INDEX idx_specimens_latitude ON specimens")
            print("   ✓ Dropped old index on latitude")
        except mysql.connector.Error:
            pass

        try:
            cursor.execute("DROP INDEX idx_specimens_longitude ON specimens")
            print("   ✓ Dropped old index on longitude")
        except mysql.connector.Error:
            pass

        try:
            cursor.execute("DROP INDEX idx_specimens_coordinates ON specimens")
            print("   ⚠️  Dropped old composite coordinate index")
        except mysql.connector.Error:
            pass

        # Add new indexes
        try:
            cursor.execute("CREATE INDEX idx_specimens_latdd ON specimens(latdd)")
            print("   ✓ Added index on latdd")
        except mysql.connector.Error as e:
            if "Duplicate key name" in str(e):
                print("   ⚠️  Index on latdd already exists")
            else:
                print(f"   ⚠️  Could not add index on latdd: {e}")

        try:
            cursor.execute("CREATE INDEX idx_specimens_londd ON specimens(londd)")
            print("   ✓ Added index on londd")
        except mysql.connector.Error as e:
            if "Duplicate key name" in str(e):
                print("   ⚠️  Index on londd already exists")
            else:
                print(f"   ⚠️  Could not add index on londd: {e}")

        try:
            cursor.execute("CREATE INDEX idx_specimens_coordinates ON specimens(latdd, londd)")
            print("   ✓ Added composite index on decimal degrees")
        except mysql.connector.Error as e:
            if "Duplicate key name" in str(e):
                print("   ⚠️  Composite index already exists")
            else:
                print(f"   ⚠️  Could not add composite index: {e}")

        conn.commit()

        # Step 6: Verify migration
        print("\n🔍 Step 5: Verifying migration...")

        cursor.execute("""
            SELECT COUNT(*) as count
            FROM specimens
            WHERE latdd IS NOT NULL AND londd IS NOT NULL
        """)
        specimens_with_dd = cursor.fetchone()['count']

        print(f"   Specimens with decimal degree coordinates: {specimens_with_dd}/{specimen_count}")

        # Final summary
        print("\n" + "=" * 70)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 70)
        print(f"Specimens processed: {specimen_count}")
        print(f"Specimens with coordinates: {specimens_with_dd}")
        print("\nSchema changes:")
        print("  • latitude: FLOAT → VARCHAR(50) (verbatim)")
        print("  • longitude: FLOAT → VARCHAR(50) (verbatim)")
        print("  • latdd: NEW FLOAT field (decimal degrees)")
        print("  • londd: NEW FLOAT field (decimal degrees)")
        print("\nNext steps:")
        print("1. Restart your backend server")
        print("2. Test coordinate display and map functionality")
        print("3. Update any import scripts to provide both formats")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("\n🔄 Rolling back changes...")
        conn.rollback()
        print("⚠️  Database rolled back to previous state")
        print("\nTo restore from backup:")
        print(f"   mysql -u {DB_USER} -p {DB_NAME} < backup_before_dd_migration.sql")
        sys.exit(1)

    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    run_migration()
