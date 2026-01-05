#!/usr/bin/env python3
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
