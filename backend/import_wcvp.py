"""
Import WCVP (World Checklist of Vascular Plants) data into the database

This script reads the WCVP taxon CSV file and imports taxonomic data
for autocomplete functionality in specimen data entry.

Usage:
    python import_wcvp.py [--dry-run]

Options:
    --dry-run    Preview import without making database changes
"""

import sys
import csv
from pathlib import Path
from sqlalchemy.orm import Session
from database import engine, get_db
from models import Base, Taxon

# WCVP CSV path
WCVP_CSV_PATH = Path(__file__).parent / "assets" / "wcvp_dwca" / "wcvp_taxon.csv"

# Ranks to include
INCLUDE_RANKS = {"Species", "Genus", "Variety", "Form", "Subspecies"}

# Status to include
INCLUDE_STATUS = {"Accepted", "Synonym"}

# Batch size for database inserts
BATCH_SIZE = 1000


def parse_wcvp_row(row: dict) -> dict | None:
    """
    Parse a row from WCVP CSV and extract relevant fields

    Returns dict with parsed data or None if row should be skipped
    """
    # Get taxonomic rank and status
    # Note: WCVP CSV uses lowercase column names
    rank = row.get("taxonrank", "").strip()
    status = row.get("taxonomicstatus", "").strip()

    # Filter by rank and status
    if rank not in INCLUDE_RANKS or status not in INCLUDE_STATUS:
        return None

    # Extract fields
    taxon_id = row.get("taxonid", "").strip()
    family = row.get("family", "").strip() or None
    genus = row.get("genus", "").strip() or None
    scientific_name = row.get("scientificname", "").strip() or None
    author = row.get("scientificnameauthorship", "").strip() or None

    # Skip if missing critical fields
    if not taxon_id or not scientific_name:
        return None

    return {
        "taxon_id": taxon_id,
        "family": family,
        "genus": genus,
        "scientific_name": scientific_name,
        "author": author,
        "rank": rank,
        "status": status,
    }


def import_wcvp(dry_run: bool = False):
    """
    Import WCVP data from CSV file

    Args:
        dry_run: If True, preview import without making database changes
    """
    print(f"🌿 WCVP Import Script")
    print(f"{'=' * 60}")
    print(f"CSV file: {WCVP_CSV_PATH}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE IMPORT'}")
    print(f"Batch size: {BATCH_SIZE:,}")
    print()

    # Check CSV file exists
    if not WCVP_CSV_PATH.exists():
        print(f"❌ ERROR: CSV file not found at {WCVP_CSV_PATH}")
        sys.exit(1)

    # Create tables if not exists
    if not dry_run:
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created")
        print()

    # Statistics
    total_rows = 0
    filtered_rows = 0
    imported_rows = 0
    skipped_rows = 0
    batch = []

    db = next(get_db()) if not dry_run else None

    try:
        # Read and process CSV
        print("Reading CSV file...")
        with open(WCVP_CSV_PATH, 'r', encoding='utf-8') as f:
            # WCVP uses pipe delimiter
            reader = csv.DictReader(f, delimiter='|')

            for row in reader:
                total_rows += 1

                # Parse row
                parsed = parse_wcvp_row(row)

                if parsed is None:
                    filtered_rows += 1
                    continue

                # Preview mode - just show first 10
                if dry_run:
                    if imported_rows < 10:
                        print(f"  [{parsed['rank']}] {parsed['scientific_name']}")
                        if parsed['author']:
                            print(f"    Author: {parsed['author']}")
                        print(f"    Family: {parsed['family'] or 'N/A'}, Genus: {parsed['genus'] or 'N/A'}")
                        print(f"    Status: {parsed['status']}")
                        print()
                    imported_rows += 1
                    continue

                # Add to batch
                batch.append(Taxon(**parsed))

                # Insert batch when full
                if len(batch) >= BATCH_SIZE:
                    try:
                        db.bulk_save_objects(batch)
                        db.commit()
                        imported_rows += len(batch)
                        print(f"  Imported {imported_rows:,} records...", end='\r')
                        batch = []
                    except Exception as e:
                        print(f"\n❌ Error inserting batch: {e}")
                        db.rollback()
                        skipped_rows += len(batch)
                        batch = []

            # Insert remaining batch
            if batch and not dry_run:
                try:
                    db.bulk_save_objects(batch)
                    db.commit()
                    imported_rows += len(batch)
                    print(f"  Imported {imported_rows:,} records...", end='\r')
                except Exception as e:
                    print(f"\n❌ Error inserting final batch: {e}")
                    db.rollback()
                    skipped_rows += len(batch)

        # Print summary
        print()
        print()
        print("=" * 60)
        print("📊 Import Summary")
        print("=" * 60)
        print(f"Total rows read:        {total_rows:,}")
        print(f"Filtered out:           {filtered_rows:,}")
        print(f"{'Would import' if dry_run else 'Imported'}:          {imported_rows:,}")
        if skipped_rows > 0:
            print(f"Skipped (errors):       {skipped_rows:,}")
        print()

        if dry_run:
            print("✅ Dry run complete - no changes made to database")
            print()
            print("Filtering criteria:")
            print(f"  Ranks: {', '.join(sorted(INCLUDE_RANKS))}")
            print(f"  Status: {', '.join(sorted(INCLUDE_STATUS))}")
            print()
            print("Run without --dry-run to perform actual import")
        else:
            print("✅ Import complete!")

            # Show some statistics
            print()
            print("Database statistics:")
            family_count = db.query(Taxon.family).distinct().filter(Taxon.family.isnot(None)).count()
            genus_count = db.query(Taxon.genus).distinct().filter(Taxon.genus.isnot(None)).count()
            species_count = db.query(Taxon).filter(Taxon.rank == "Species").count()
            accepted_count = db.query(Taxon).filter(Taxon.status == "Accepted").count()
            synonym_count = db.query(Taxon).filter(Taxon.status == "Synonym").count()

            print(f"  Unique families: {family_count:,}")
            print(f"  Unique genera: {genus_count:,}")
            print(f"  Species records: {species_count:,}")
            print(f"  Accepted names: {accepted_count:,}")
            print(f"  Synonyms: {synonym_count:,}")

    finally:
        if db:
            db.close()


if __name__ == "__main__":
    # Parse arguments
    dry_run = "--dry-run" in sys.argv

    # Run import
    import_wcvp(dry_run=dry_run)
