#!/usr/bin/env python3
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

    # Copy data back
    cursor.execute('''
        INSERT INTO localities (id, specimen_id, country, state_province, county_city, description, latitude, longitude, habitat)
        SELECT
            UUID() as id,
            id as specimen_id,
            country,
            state_province,
            county_city,
            locality_description,
            latitude,
            longitude,
            habitat
        FROM specimens
        WHERE latitude IS NOT NULL OR locality_description IS NOT NULL
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
