#!/usr/bin/env python3
"""
Import script for labnotes specimen data

This script imports specimen data from the labnotes CSV export format
into Herbarium Pro, mapping fields appropriately and parsing DMS coordinates.
"""

import os, time
import sys
import csv
import json
from typing import Optional, Tuple, Dict, Union
from datetime import datetime

# Import dotenv if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Import the migration framework
from migrate_specimens import HerbariumAPIClient, SpecimenMigrator, SpecimenData


def parse_dms_coordinate(dms_str: str) -> Tuple[Optional[str], Optional[float]]:
    """
    Parse DMS (Degrees Minutes Seconds) coordinate string to verbatim and decimal degrees

    Examples:
        "29 23 09 N" -> ("29°23'09\"N", 29.385833)
        "100 08 58 E" -> ("100°08'58\"E", 100.149444)
        "29 23 09 S" -> ("29°23'09\"S", -29.385833)
        "100 08 58 W" -> ("100°08'58\"W", -100.149444)
    """
    if not dms_str or not dms_str.strip():
        return None, None

    try:
        parts = dms_str.strip().split()

        if len(parts) < 3:
            # Not in DMS format, might be decimal already
            return dms_str.strip(), None

        # Parse DMS components
        degrees = float(parts[0])
        minutes = float(parts[1])
        seconds = float(parts[2])

        # Get direction (N, S, E, W)
        direction = parts[3].upper() if len(parts) > 3 else ''

        # Convert to decimal degrees
        decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)

        # Apply negative for South and West
        if direction in ['S', 'W']:
            decimal = -decimal

        # Create verbatim string with degree symbols
        verbatim = f"{int(degrees):02d}°{int(minutes):02d}'{int(seconds):02d}\"{direction}"

        return verbatim, decimal

    except (ValueError, IndexError) as e:
        print(f"  ⚠ Warning: Could not parse coordinate '{dms_str}': {e}")
        return dms_str.strip(), None


def construct_scientific_name(row: dict) -> str:
    """
    Construct full scientific name from CSV components

    Format: Genus species author [infra_rank infra_epithet infra_author]
    Example: Pedicularis przewalskii Maxim.
             Pedicularis rupicola Franch. ex Maxim. subsp. rupicola
    """
    parts = []

    genus = row.get('genus', '').strip()
    species = row.get('species', '').strip()

    # if not genus or not species:
    #     raise ValueError(f"Missing genus or species in row: {row.get('id')}")

    parts.append(genus)
    parts.append(species)

    # # Add species author if present
    # species_author = row.get('species_author', '').strip()
    # if species_author:
    #     parts.append(species_author)

    # Add infraspecific information if present
    infra_rank = row.get('infra_rank', '').strip()
    infra_epithet = row.get('infra_epithet', '').strip()
    infra_author = row.get('infra_author', '').strip()

    if infra_rank and infra_epithet:
        parts.append(infra_rank)
        parts.append(infra_epithet)
        # if infra_author:
        #     parts.append(infra_author)

    return ' '.join(parts).strip() or None


def map_csv_row_to_specimen(row: dict) -> Tuple[SpecimenData, str]:
    """Map a CSV row to a SpecimenData object and return old database ID"""

    # Extract old database ID
    old_id = row.get('id', '').strip()

    # Construct scientific name
    scientific_name = construct_scientific_name(row)

    # Parse coordinates
    lat_verbatim, latdd = parse_dms_coordinate(row.get('latitude', ''))
    lon_verbatim, londd = parse_dms_coordinate(row.get('longitude', ''))

    # Get collector number (will be stored in dedicated field)
    collector_number = row.get('collector_number', '').strip() or None

    # Construct full description (combine description with flower details)
    description_parts = []
    if row.get('description'):
        description_parts.append(row['description'].strip())

    # # Add herbarium information if present
    # herbarium = row.get('herbarium', '').strip()
    # herbarium_number = row.get('herbarium_number', '').strip()
    # if herbarium and herbarium_number:
    #     description_parts.append(f"Herbarium: {herbarium} {herbarium_number}")

    # # Add any comments
    # comments = row.get('comments', '').strip()
    # if comments:
    #     description_parts.append(f"Notes: {comments}")

    description = ' | '.join(description_parts) if description_parts else None

    # Get elevation (will be stored in dedicated field)
    elevation = row.get('elevation', '').strip() or None

    # Get habitat (no longer includes elevation since we have a dedicated field)
    habitat = row.get('habitat', '').strip() or None

    # Create specimen
    specimen = SpecimenData(
        scientific_name=scientific_name,
        code=row.get('code', '').strip() or None,
        family=row.get('family', '').strip() or None,
        genus=row.get('genus', '').strip() or None,
        collector=row.get('collectors', '').strip() or None,
        collector_number=collector_number,  # Collector's number for this specimen
        collection_date=row.get('collection_date', '').strip() or None,
        description=description,
        microhabitat=None,  # Could use 'habitat' field
        country=row.get('country', '').strip() or None,
        state_province=row.get('state', '').strip() or None,
        county_city=None,
        locality_description=row.get('place', '').strip() or None,
        latitude=lat_verbatim,    # Verbatim DMS string
        longitude=lon_verbatim,   # Verbatim DMS string
        latdd=latdd,              # Decimal degrees
        londd=londd,              # Decimal degrees
        elevation=elevation,      # Elevation
        habitat=habitat,
        image_paths=[]  # No images in CSV
    )

    return specimen, old_id


def migrate_specimens_with_mapping(api: HerbariumAPIClient, specimens: list, old_ids: list) -> Dict[str, Union[int, str]]:
    """
    Migrate specimens and track the mapping of old IDs to new IDs

    Returns a dictionary mapping old_id (string) -> new_id (integer) or error message
    """
    id_mapping = {}
    total = len(specimens)
    success = 0
    failed = 0
    failed_log = {}

    print(f"\n🚀 Starting migration of {total} specimens...")
    print("=" * 60)

    for i, (specimen, old_id) in enumerate(zip(specimens, old_ids), 1):
        try:
            print(f"\n[{i}/{total}] Migrating: {specimen.scientific_name}")
            if old_id:
                print(f"  Old ID: {old_id}")

            # Create the specimen
            result = api.create_specimen(specimen)

            # Extract new ID from response
            new_id = result.get('id')
            if new_id and old_id:
                id_mapping[old_id] = new_id
                print(f"  ✓ Created with new ID: {new_id}")

            success += 1

            # Rate limiting (be nice to the server)
            time.sleep(0.1)

        except Exception as e:
            failed += 1
            print(f"  ❌ Error: {str(e)}")
            if old_id:
                failed_log[old_id] = str(e)

    # Print summary
    print("\n" + "=" * 60)
    print("📊 MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Total specimens:    {total}")
    print(f"✓ Successfully migrated: {success}")
    print(f"✗ Failed:           {failed}")
    # print(f"📋 ID mappings:     {len([v for v in id_mapping.values() if not v.startswith('FAILED')])}")
    print("=" * 60)

    return id_mapping


def save_id_mapping(csv_path: str, id_mapping: Dict[str, Union[int, str]]) -> str:
    """
    Save the ID mapping to a JSON file

    Returns the path to the saved file
    """
    # Generate output filename based on input CSV
    base_name = os.path.splitext(csv_path)[0]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    mapping_file = f"{base_name}_id_mapping_{timestamp}.json"

    # Prepare mapping data with metadata
    mapping_data = {
        'metadata': {
            'source_file': csv_path,
            'import_date': datetime.now().isoformat(),
            'total_mappings': len(id_mapping),
            # 'successful_mappings': len([v for v in id_mapping.values() if not v.startswith('FAILED')]),
            # 'failed_mappings': len([v for v in id_mapping.values() if v.startswith('FAILED')])
        },
        'mappings': id_mapping
    }

    # Save to JSON file
    with open(mapping_file, 'w', encoding='utf-8') as f:
        json.dump(mapping_data, f, indent=2, ensure_ascii=False)

    return mapping_file


def import_labnotes_csv(csv_path: str, api_base_url: str, email: str, password: str, name: str):
    """Import specimens from labnotes CSV file"""

    print("=" * 70)
    print("🌿 LABNOTES SPECIMEN IMPORT")
    print("=" * 70)
    print(f"\nCSV file: {csv_path}")
    print(f"API URL: {api_base_url}")
    print(f"User: {email}")

    # Initialize API client
    print("\n🔐 Authenticating...")
    api = HerbariumAPIClient(base_url=api_base_url)

    try:
        api.register(email=email, password=password, name=name)
    except Exception as e:
        if "already registered" in str(e).lower():
            api.login(email=email, password=password)
        else:
            raise

    # Read CSV file
    print(f"\n📂 Reading CSV file...")
    specimens = []
    old_ids = []
    skipped = 0

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader, 1):
            try:
                specimen, old_id = map_csv_row_to_specimen(row)
                specimens.append(specimen)
                old_ids.append(old_id)

                # Print progress every 10 rows
                if i % 10 == 0:
                    print(f"  Processed {i} rows...")

            except Exception as e:
                print(f"  ⚠ Row {i}: Skipped due to error: {e}")
                skipped += 1

    print(f"\n📊 CSV Import Summary:")
    print(f"  Total rows: {i}")
    print(f"  Successfully parsed: {len(specimens)}")
    print(f"  Skipped: {skipped}")

    # Migrate specimens and track ID mappings

    id_mapping = {}
    total = len(specimens)
    success = 0
    failed = 0
    failed_log = {}

    print(f"\n🚀 Starting migration of {total} specimens...")
    print("=" * 60)

    for i, (specimen, old_id) in enumerate(zip(specimens, old_ids), 1):
        try:
            print(f"\n[{i}/{total}] Migrating: {specimen.scientific_name}")
            if old_id:
                print(f"  Old ID: {old_id}")

            # Create the specimen
            result = api.create_specimen(specimen)

            # Extract new ID from response
            new_id = result.get('id')
            if new_id and old_id:
                id_mapping[old_id] = new_id
                print(f"  ✓ Created with new ID: {new_id}")

            success += 1

            # Rate limiting (be nice to the server)
            time.sleep(0.1)

        except Exception as e:
            failed += 1
            print(f"  ❌ Error: {str(e)}")
            if old_id:
                failed_log[old_id] = str(e)

    # Print summary
    print("\n" + "=" * 60)
    print("📊 MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Total specimens:    {total}")
    print(f"✓ Successfully migrated: {success}")
    print(f"✗ Failed:           {failed}")
    # print(f"📋 ID mappings:     {len([v for v in id_mapping.values() if not v.startswith('FAILED')])}")
    print("=" * 60)
    
    # if specimens:
    #     print(f"\n🚀 Starting migration to Herbarium Pro...")
    #     id_mapping = migrate_specimens_with_mapping(api, specimens, old_ids)

    #     # Save ID mapping to file
    #     mapping_file = save_id_mapping(csv_path, id_mapping)
    #     print(f"\n💾 ID mapping saved to: {mapping_file}")
    # else:
    #     print("\n⚠️  No specimens to migrate!")

if __name__ == "__main__":
    # Configuration from environment or defaults
    CSV_FILE = os.getenv("IMPORT_CSV", "imports/labnotes_specimen.csv")
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
    USER_EMAIL = os.getenv("USER_EMAIL", "admin@example.com")
    USER_PASSWORD = os.getenv("USER_PASSWORD", "change_this_password")
    USER_NAME = os.getenv("USER_NAME", "Lab Notes Import")

    # Check if CSV file exists
    if not os.path.exists(CSV_FILE):
        print(f"❌ Error: CSV file not found: {CSV_FILE}")
        print("\nUsage:")
        print("  Set IMPORT_CSV environment variable, or")
        print("  python import_labnotes.py")
        print("\nOr provide path as argument:")
        print("  python import_labnotes.py path/to/file.csv")
        sys.exit(1)

    # Allow CSV path as command line argument
    csv_path = sys.argv[1] if len(sys.argv) > 1 else CSV_FILE

    print("=" * 70)
    print("🌿 LABNOTES SPECIMEN IMPORT")
    print("=" * 70)
    print(f"\nCSV file: {csv_path}")
    print(f"API URL: {API_BASE_URL}")
    print(f"User: {USER_EMAIL}")

    # Initialize API client
    print("\n🔐 Authenticating...")
    api = HerbariumAPIClient(base_url=API_BASE_URL)
    api.login(email=USER_EMAIL, password=USER_PASSWORD)

    # Read CSV file
    print(f"\n📂 Reading CSV file...")
    specimens = []
    old_ids = []
    skipped = {}

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader, 1):
            try:
                specimen, old_id = map_csv_row_to_specimen(row)
                specimens.append(specimen)
                old_ids.append(old_id)

                # Print progress every 10 rows
                if i % 10 == 0:
                    print(f"  Processed {i} rows...")

            except Exception as e:
                print(f"  ⚠ Row {i}: Skipped due to error: {e}")
                skipped[i] = str(e)

    print(f"\n📊 CSV Import Summary:")
    print(f"  Total rows: {i}")
    print(f"  Successfully parsed: {len(specimens)}")
    print(f"  Skipped: {skipped}")

    # # Migrate specimens and track ID mappings

    id_mapping = {}
    total = len(specimens)
    success = 0
    failed = 0
    failed_log = {}

    print(f"\n🚀 Starting migration of {total} specimens...")
    print("=" * 60)

    for i, (specimen, old_id) in enumerate(zip(specimens, old_ids), 1):
        try:
            print(f"\n[{i}/{total}] Migrating: {specimen.scientific_name}")
            if old_id:
                print(f"  Old ID: {old_id}")

            # Create the specimen
            result = api.create_specimen(specimen)

            # Extract new ID from response
            new_id = result.get('id')
            if new_id and old_id:
                id_mapping[int(old_id)] = new_id
                print(f"  ✓ Created with new ID: {new_id}")

            success += 1

            # Rate limiting (be nice to the server)
            time.sleep(0.1)

        except Exception as e:
            failed += 1
            print(f"  ❌ Error: {str(e)}")
            if old_id:
                failed_log[old_id] = str(e)

    with open('imports/labnotes_id_mapping.csv', 'w') as outf:
        for k, v in sorted(id_mapping.items()):
            outf.write(f'{k},{v}\n')

    # Print summary
    print("\n" + "=" * 60)
    print("📊 MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Total specimens:    {total}")
    print(f"✓ Successfully migrated: {success}")
    print(f"✗ Failed:           {failed}")
    print("=" * 60)

    # if specimens:
    #     print(f"\n🚀 Starting migration to Herbarium Pro...")
    #     id_mapping = migrate_specimens_with_mapping(api, specimens, old_ids)

    #     # Save ID mapping to file
    #     mapping_file = save_id_mapping(csv_path, id_mapping)
    #     print(f"\n💾 ID mapping saved to: {mapping_file}")
    # else:
    #     print("\n⚠️  No specimens to migrate!")


    # try:
    #     import_labnotes_csv(
    #         csv_path=csv_path,
    #         api_base_url=API_BASE_URL,
    #         email=USER_EMAIL,
    #         password=USER_PASSWORD,
    #         name=USER_NAME
    #     )
    # except Exception as e:
    #     print(f"\n❌ Import failed: {e}")
    #     import traceback
    #     traceback.print_exc()
    #     sys.exit(1)

