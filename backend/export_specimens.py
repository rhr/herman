#!/usr/bin/env python3
"""
Export Specimens from Herbarium Pro Backend

This script exports specimens from the Herbarium Pro API to CSV or JSON format.
Useful for backups, data analysis, or testing the migration script.

Usage:
    python export_specimens.py --format csv --output specimens_backup.csv
    python export_specimens.py --format json --output specimens_backup.json
"""

import requests
import json
import csv
import argparse
from typing import List, Dict
from datetime import datetime


class HerbariumExporter:
    """Export specimens from Herbarium Pro API"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.token = None

    def login(self, email: str, password: str):
        """Login to the API"""
        url = f"{self.base_url}/api/auth/login"
        response = requests.post(url, json={
            "email": email,
            "password": password
        })

        if response.status_code == 200:
            self.token = response.json()['access_token']
            print(f"✓ Logged in as: {email}")
        else:
            raise Exception(f"Login failed: {response.status_code} - {response.text}")

    def get_specimens(self) -> List[Dict]:
        """Fetch all specimens"""
        if not self.token:
            raise Exception("Not authenticated. Please login first.")

        url = f"{self.base_url}/api/specimens"
        headers = {"Authorization": f"Bearer {self.token}"}

        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            specimens = response.json()
            print(f"✓ Retrieved {len(specimens)} specimens")
            return specimens
        else:
            raise Exception(f"Failed to fetch specimens: {response.status_code} - {response.text}")

    def export_to_csv(self, specimens: List[Dict], output_path: str):
        """Export specimens to CSV format"""
        if not specimens:
            print("⚠ No specimens to export")
            return

        print(f"\n📝 Exporting to CSV: {output_path}")

        # Define CSV columns
        columns = [
            'id', 'scientific_name', 'family', 'genus', 'collector',
            'collection_date', 'description', 'microhabitat',
            'country', 'state_province', 'county_city',
            'locality_description', 'latitude', 'longitude', 'habitat',
            'image_count', 'image_urls', 'created_at'
        ]

        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()

            for specimen in specimens:
                locality = specimen.get('locality', {})

                # Prepare row data
                row = {
                    'id': specimen.get('id'),
                    'scientific_name': specimen.get('scientificName') or specimen.get('scientific_name'),
                    'family': specimen.get('family'),
                    'genus': specimen.get('genus'),
                    'collector': specimen.get('collector'),
                    'collection_date': specimen.get('collectionDate') or specimen.get('collection_date'),
                    'description': specimen.get('description'),
                    'microhabitat': specimen.get('microhabitat'),
                    'country': locality.get('country'),
                    'state_province': locality.get('stateProvince') or locality.get('state_province'),
                    'county_city': locality.get('countyCity') or locality.get('county_city'),
                    'locality_description': locality.get('description'),
                    'latitude': locality.get('latitude'),
                    'longitude': locality.get('longitude'),
                    'habitat': locality.get('habitat'),
                    'image_count': len(specimen.get('imageUrls', [])),
                    'image_urls': '|'.join(specimen.get('imageUrls', [])),
                    'created_at': specimen.get('createdAt') or specimen.get('created_at')
                }

                writer.writerow(row)

        print(f"✓ Exported {len(specimens)} specimens to {output_path}")

    def export_to_json(self, specimens: List[Dict], output_path: str):
        """Export specimens to JSON format"""
        if not specimens:
            print("⚠ No specimens to export")
            return

        print(f"\n📝 Exporting to JSON: {output_path}")

        # Transform to migration-compatible format
        export_data = []
        for specimen in specimens:
            locality = specimen.get('locality', {})

            # Convert image URLs to image paths (for migration reference)
            image_urls = specimen.get('imageUrls', [])

            export_data.append({
                'id': specimen.get('id'),
                'scientific_name': specimen.get('scientificName') or specimen.get('scientific_name'),
                'family': specimen.get('family'),
                'genus': specimen.get('genus'),
                'collector': specimen.get('collector'),
                'collection_date': specimen.get('collectionDate') or specimen.get('collection_date'),
                'description': specimen.get('description'),
                'microhabitat': specimen.get('microhabitat'),
                'country': locality.get('country'),
                'state_province': locality.get('stateProvince') or locality.get('state_province'),
                'county_city': locality.get('countyCity') or locality.get('county_city'),
                'locality_description': locality.get('description'),
                'latitude': locality.get('latitude'),
                'longitude': locality.get('longitude'),
                'habitat': locality.get('habitat'),
                'image_urls': image_urls,
                'image_paths': [],  # Placeholder for migration script
                'created_at': specimen.get('createdAt') or specimen.get('created_at'),
                'annotations': specimen.get('annotations', [])
            })

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)

        print(f"✓ Exported {len(specimens)} specimens to {output_path}")

    def print_summary(self, specimens: List[Dict]):
        """Print export summary"""
        if not specimens:
            return

        print("\n" + "=" * 60)
        print("📊 EXPORT SUMMARY")
        print("=" * 60)
        print(f"Total specimens:     {len(specimens)}")

        # Count specimens with various attributes
        with_images = sum(1 for s in specimens if s.get('imageUrls'))
        with_coords = sum(1 for s in specimens if s.get('locality', {}).get('latitude'))
        with_dates = sum(1 for s in specimens if s.get('collectionDate') or s.get('collection_date'))

        print(f"With images:         {with_images}")
        print(f"With coordinates:    {with_coords}")
        print(f"With collection dates: {with_dates}")

        # Count total images
        total_images = sum(len(s.get('imageUrls', [])) for s in specimens)
        print(f"Total images:        {total_images}")

        # Family distribution
        families = {}
        for s in specimens:
            family = s.get('family', 'Unknown')
            families[family] = families.get(family, 0) + 1

        print(f"\nTop 5 families:")
        for family, count in sorted(families.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"  {family}: {count}")

        print("=" * 60)


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description='Export specimens from Herbarium Pro backend'
    )
    parser.add_argument(
        '--format',
        choices=['csv', 'json'],
        default='json',
        help='Export format (default: json)'
    )
    parser.add_argument(
        '--output',
        '-o',
        help='Output file path (default: auto-generated)'
    )
    parser.add_argument(
        '--url',
        default='http://localhost:8000',
        help='Backend API URL (default: http://localhost:8000)'
    )
    parser.add_argument(
        '--email',
        help='User email for authentication'
    )
    parser.add_argument(
        '--password',
        help='User password for authentication'
    )

    args = parser.parse_args()

    print("=" * 60)
    print("🌿 HERBARIUM PRO - SPECIMEN EXPORT TOOL")
    print("=" * 60)

    try:
        # Initialize exporter
        exporter = HerbariumExporter(base_url=args.url)

        # Get credentials
        email = args.email or input("Email: ")
        password = args.password or input("Password: ")

        # Login
        print(f"\n🔐 Authenticating...")
        exporter.login(email, password)

        # Fetch specimens
        print(f"\n📥 Fetching specimens...")
        specimens = exporter.get_specimens()

        if not specimens:
            print("⚠ No specimens found")
            return

        # Print summary
        exporter.print_summary(specimens)

        # Generate output filename if not provided
        if not args.output:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            args.output = f"specimens_export_{timestamp}.{args.format}"

        # Export
        if args.format == 'csv':
            exporter.export_to_csv(specimens, args.output)
        else:
            exporter.export_to_json(specimens, args.output)

        print(f"\n✅ Export complete!")

    except KeyboardInterrupt:
        print("\n\n⚠ Export cancelled by user")
    except Exception as e:
        print(f"\n❌ Export failed: {str(e)}")
        raise


if __name__ == "__main__":
    main()
