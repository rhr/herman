"""
Add wcvp_id column to specimens table

This migration adds a wcvp_id field to store the WCVP taxon ID
for each specimen, linking it to the authoritative taxonomy database.

Usage:
    python add_wcvp_id_column.py
"""

from database import engine
from sqlalchemy import text

def add_wcvp_id_column():
    """Add wcvp_id column to specimens table"""
    print("Adding wcvp_id column to specimens table...")

    with engine.connect() as conn:
        try:
            # Add the column
            conn.execute(text("""
                ALTER TABLE specimens
                ADD COLUMN wcvp_id VARCHAR(50)
            """))
            conn.commit()
            print("✅ Column added successfully")

            # Add index for performance
            print("Adding index on wcvp_id...")
            conn.execute(text("""
                CREATE INDEX idx_specimens_wcvp_id ON specimens(wcvp_id)
            """))
            conn.commit()
            print("✅ Index created successfully")

        except Exception as e:
            print(f"❌ Error: {e}")
            print("Note: Column may already exist")
            conn.rollback()

if __name__ == "__main__":
    add_wcvp_id_column()
