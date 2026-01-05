#!/usr/bin/env python3
"""
Preview labnotes import to verify field mapping

This script shows how the first N records will be mapped without
actually importing them to the database.
"""

import csv
import sys
from import_labnotes import map_csv_row_to_specimen, parse_dms_coordinate


def preview_import(csv_path: str, num_records: int = 5):
    """Preview the first N records from the CSV"""

    print("=" * 80)
    print("📋 LABNOTES IMPORT PREVIEW")
    print("=" * 80)
    print(f"\nShowing first {num_records} records from: {csv_path}\n")

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader, 1):
            if i > num_records:
                break

            print(f"\n{'=' * 80}")
            print(f"RECORD {i}")
            print('=' * 80)

            # Show original CSV fields
            print("\n📥 SOURCE DATA:")
            print(f"  ID: {row.get('id')}")
            print(f"  Family: {row.get('family')}")
            print(f"  Genus: {row.get('genus')}")
            print(f"  Species: {row.get('species')}")
            print(f"  Species Author: {row.get('species_author')}")
            if row.get('infra_rank'):
                print(f"  Infra Rank: {row.get('infra_rank')}")
                print(f"  Infra Epithet: {row.get('infra_epithet')}")
                print(f"  Infra Author: {row.get('infra_author')}")
            print(f"  Collectors: {row.get('collectors')}")
            print(f"  Collector Number: {row.get('collector_number')}")
            print(f"  Collection Date: {row.get('collection_date')}")
            print(f"  Country: {row.get('country')}")
            print(f"  State: {row.get('state')}")
            print(f"  Place: {row.get('place')}")
            print(f"  Habitat: {row.get('habitat')}")
            print(f"  Latitude (DMS): {row.get('latitude')}")
            print(f"  Longitude (DMS): {row.get('longitude')}")
            print(f"  Elevation: {row.get('elevation')}")
            print(f"  Description: {row.get('description')}")
            print(f"  Herbarium: {row.get('herbarium')} {row.get('herbarium_number')}")

            # Show coordinate parsing
            print("\n🗺️  COORDINATE PARSING:")
            lat_verbatim, latdd = parse_dms_coordinate(row.get('latitude', ''))
            lon_verbatim, londd = parse_dms_coordinate(row.get('longitude', ''))
            print(f"  Latitude (verbatim): {lat_verbatim}")
            print(f"  Latitude (decimal): {latdd}")
            print(f"  Longitude (verbatim): {lon_verbatim}")
            print(f"  Longitude (decimal): {londd}")

            # Map to specimen
            try:
                specimen, old_id = map_csv_row_to_specimen(row)

                print("\n📤 MAPPED TO HERBARIUM PRO:")
                print(f"  Old Database ID: {old_id}")
                print(f"  Scientific Name: {specimen.scientific_name}")
                print(f"  Family: {specimen.family}")
                print(f"  Genus: {specimen.genus}")
                print(f"  Collector: {specimen.collector}")
                print(f"  Collector Number: {specimen.collector_number}")
                print(f"  Collection Date: {specimen.collection_date}")
                print(f"  Country: {specimen.country}")
                print(f"  State/Province: {specimen.state_province}")
                print(f"  Locality Description: {specimen.locality_description}")
                print(f"  Habitat: {specimen.habitat}")
                print(f"  Latitude (verbatim): {specimen.latitude}")
                print(f"  Longitude (verbatim): {specimen.longitude}")
                print(f"  Latitude (decimal): {specimen.latdd}")
                print(f"  Longitude (decimal): {specimen.londd}")
                print(f"  Description: {specimen.description[:100]}..." if specimen.description and len(specimen.description) > 100 else f"  Description: {specimen.description}")

                print("\n✅ Successfully mapped")

            except Exception as e:
                print(f"\n❌ Error mapping record: {e}")

    print(f"\n{'=' * 80}\n")


def main():
    csv_path = "imports/labnotes_specimen.csv"
    num_records = 50

    if len(sys.argv) > 1:
        csv_path = sys.argv[1]

    if len(sys.argv) > 2:
        num_records = int(sys.argv[2])

    preview_import(csv_path, num_records)


if __name__ == "__main__":
    main()
