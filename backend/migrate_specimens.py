#!/usr/bin/env python3
"""
Specimen Migration Script for Herbarium Pro

This script demonstrates how to migrate specimens and images from an existing
database to the Herbarium Pro backend API.

SCHEMA NOTE: As of the consolidated schema, locality data is stored directly
in the specimens table (not in a separate localities table). All locality fields
are flattened into the specimen record.

COORDINATE FIELDS:
- latitude/longitude: Verbatim coordinates as entered (stored as VARCHAR)
- latdd/londd: Parsed decimal degrees for mapping (stored as FLOAT)

Usage:
    python migrate_specimens.py --source <source_type> --config <config_file>

Requirements:
    pip install requests python-dotenv
"""

import requests
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import time
from datetime import datetime

# Import dotenv if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

@dataclass
class SpecimenData:
    """Data structure for specimen information (matches consolidated schema)"""
    # Required field
    code: str

    # Specimen fields
    scientific_name: Optional[str] = None
    family: Optional[str] = None
    genus: Optional[str] = None
    collector: Optional[str] = None
    collector_number: Optional[str] = None
    collection_date: Optional[str] = None
    description: Optional[str] = None
    microhabitat: Optional[str] = None

    # Locality fields (flattened - no longer in separate table)
    country: Optional[str] = None
    state_province: Optional[str] = None
    county_city: Optional[str] = None
    locality_description: Optional[str] = None
    latitude: Optional[str] = None      # Verbatim latitude (as entered)
    longitude: Optional[str] = None     # Verbatim longitude (as entered)
    latdd: Optional[float] = None       # Decimal degrees latitude (for mapping)
    londd: Optional[float] = None       # Decimal degrees longitude (for mapping)
    elevation: Optional[str] = None     # Elevation
    habitat: Optional[str] = None

    # Image file paths (local paths to images)
    image_paths: List[str] = None

    def __post_init__(self):
        if self.image_paths is None:
            self.image_paths = []


class HerbariumAPIClient:
    """Client for interacting with Herbarium Pro API"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.token: Optional[str] = None
        self.session = requests.Session()

    def register(self, email: str, password: str, name: str, institution: Optional[str] = None) -> Dict:
        """Register a new user"""
        url = f"{self.base_url}/api/auth/register"
        data = {
            "email": email,
            "password": password,
            "name": name,
            "institution": institution
        }

        response = self.session.post(url, json=data)
        if response.status_code == 201:
            result = response.json()
            self.token = result['access_token']
            print(f"✓ Registered user: {email}")
            return result
        elif response.status_code == 400 and "already registered" in response.text:
            print(f"! User {email} already exists, attempting login...")
            return self.login(email, password)
        else:
            raise Exception(f"Registration failed: {response.status_code} - {response.text}")

    def login(self, email: str, password: str) -> Dict:
        """Login an existing user"""
        url = f"{self.base_url}/api/auth/login"
        data = {
            "email": email,
            "password": password
        }

        response = self.session.post(url, json=data)
        if response.status_code == 200:
            result = response.json()
            self.token = result['access_token']
            print(f"✓ Logged in as: {email}")
            return result
        else:
            raise Exception(f"Login failed: {response.status_code} - {response.text}")

    def get_auth_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        if not self.token:
            raise Exception("Not authenticated. Please login first.")
        return {"Authorization": f"Bearer {self.token}"}

    def create_specimen(self, specimen: SpecimenData) -> Dict:
        """Create a specimen with images"""
        url = f"{self.base_url}/api/specimens"

        # Prepare form data
        data = {
            'code': specimen.code,
        }

        # Add optional fields
        if specimen.scientific_name:
            data['scientific_name'] = specimen.scientific_name
        if specimen.family:
            data['family'] = specimen.family
        if specimen.genus:
            data['genus'] = specimen.genus
        if specimen.collector:
            data['collector'] = specimen.collector
        if specimen.collector_number:
            data['collector_number'] = specimen.collector_number
        if specimen.collection_date:
            data['collection_date'] = specimen.collection_date
        if specimen.description:
            data['description'] = specimen.description
        if specimen.microhabitat:
            data['microhabitat'] = specimen.microhabitat

        # Locality fields
        if specimen.country:
            data['country'] = specimen.country
        if specimen.state_province:
            data['state_province'] = specimen.state_province
        if specimen.county_city:
            data['county_city'] = specimen.county_city
        if specimen.locality_description:
            data['locality_description'] = specimen.locality_description
        if specimen.latitude is not None:
            data['latitude'] = specimen.latitude  # Verbatim string
        if specimen.longitude is not None:
            data['longitude'] = specimen.longitude  # Verbatim string
        if specimen.latdd is not None:
            data['latdd'] = str(specimen.latdd)  # Decimal degrees
        if specimen.londd is not None:
            data['londd'] = str(specimen.londd)  # Decimal degrees
        if specimen.elevation:
            data['elevation'] = specimen.elevation
        if specimen.habitat:
            data['habitat'] = specimen.habitat

        # Prepare image files
        files = []
        for img_path in specimen.image_paths:
            if os.path.exists(img_path):
                files.append(
                    ('images', (os.path.basename(img_path), open(img_path, 'rb'), 'image/jpeg'))
                )
            else:
                print(f"  ⚠ Image not found: {img_path}")

        try:
            response = self.session.post(
                url,
                data=data,
                files=files,
                headers=self.get_auth_headers()
            )

            if response.status_code == 201:
                print(f"  ✓ Created specimen: {specimen.scientific_name}")
                return response.json()
            else:
                raise Exception(f"Failed to create specimen: {response.status_code} - {response.text}")
        finally:
            # Close file handles
            for _, file_tuple in files:
                file_tuple[1].close()

    def get_specimens(self) -> List[Dict]:
        """Get all specimens for the current user"""
        url = f"{self.base_url}/api/specimens"
        response = self.session.get(url, headers=self.get_auth_headers())

        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get specimens: {response.status_code} - {response.text}")


class SpecimenMigrator:
    """Migrator for specimen data"""

    def __init__(self, api_client: HerbariumAPIClient):
        self.api = api_client
        self.stats = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'start_time': None,
            'end_time': None
        }

    @staticmethod
    def parse_coordinate(coord_str: str) -> Optional[float]:
        """Parse coordinate string to decimal degrees"""
        if not coord_str:
            return None

        try:
            coord_str = str(coord_str).strip().upper()
            is_negative = False

            # Check for direction indicators
            if 'S' in coord_str or 'W' in coord_str:
                is_negative = True

            # Remove direction letters
            coord_str = coord_str.replace('N', '').replace('S', '').replace('E', '').replace('W', '').strip()

            # Parse the number
            value = float(coord_str)

            # Apply negative if needed
            if is_negative:
                value = -abs(value)

            return value
        except (ValueError, AttributeError):
            return None

    def migrate_from_csv(self, csv_path: str, image_base_dir: Optional[str] = None):
        """
        Migrate specimens from a CSV file

        CSV format should have columns matching SpecimenData fields:
        scientific_name, family, genus, collector, collection_date, description,
        microhabitat, country, state_province, county_city, locality_description,
        latitude, longitude, habitat, image_filenames (comma-separated)

        Note: latitude and longitude are stored as verbatim strings and will be
        automatically parsed to decimal degrees (latdd/londd) for mapping.
        """
        import csv

        print(f"\n📂 Reading specimens from CSV: {csv_path}")

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            specimens = []

            for row in reader:
                # Parse image paths
                image_paths = []
                if row.get('image_filenames') and image_base_dir:
                    filenames = [fn.strip() for fn in row['image_filenames'].split(',')]
                    image_paths = [os.path.join(image_base_dir, fn) for fn in filenames if fn]

                # Parse coordinates
                lat_str = row.get('latitude') or None
                lon_str = row.get('longitude') or None
                latdd = self.parse_coordinate(lat_str) if lat_str else None
                londd = self.parse_coordinate(lon_str) if lon_str else None

                specimen = SpecimenData(
                    code=row['code'],
                    scientific_name=row.get('scientific_name') or None,
                    family=row.get('family') or None,
                    genus=row.get('genus') or None,
                    collector=row.get('collector') or None,
                    collection_date=row.get('collection_date') or None,
                    description=row.get('description') or None,
                    microhabitat=row.get('microhabitat') or None,
                    country=row.get('country') or None,
                    state_province=row.get('state_province') or None,
                    county_city=row.get('county_city') or None,
                    locality_description=row.get('locality_description') or None,
                    latitude=lat_str,      # Verbatim string
                    longitude=lon_str,     # Verbatim string
                    latdd=latdd,          # Parsed decimal degrees
                    londd=londd,          # Parsed decimal degrees
                    habitat=row.get('habitat') or None,
                    image_paths=image_paths
                )
                specimens.append(specimen)

        print(f"📊 Found {len(specimens)} specimens to migrate")
        self.migrate_specimens(specimens)

    def migrate_from_json(self, json_path: str):
        """
        Migrate specimens from a JSON file

        JSON format should be an array of objects matching SpecimenData fields
        """
        print(f"\n📂 Reading specimens from JSON: {json_path}")

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        specimens = []
        for item in data:
            specimen = SpecimenData(**item)
            specimens.append(specimen)

        print(f"📊 Found {len(specimens)} specimens to migrate")
        self.migrate_specimens(specimens)

    def migrate_from_mysql(self, host: str, database: str, user: str, password: str,
                           table: str = 'specimens', image_table: Optional[str] = None):
        """
        Migrate specimens from a MySQL database

        Requires: pip install mysql-connector-python
        """
        try:
            import mysql.connector
        except ImportError:
            print("❌ Error: mysql-connector-python not installed")
            print("Install with: pip install mysql-connector-python")
            return

        print(f"\n📂 Connecting to MySQL database: {database}")

        conn = mysql.connector.connect(
            host=host,
            database=database,
            user=user,
            password=password
        )
        cursor = conn.cursor(dictionary=True)

        # Fetch specimens
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()

        specimens = []
        for row in rows:
            # Fetch associated images if image_table is provided
            image_paths = []
            if image_table:
                cursor.execute(
                    f"SELECT file_path FROM {image_table} WHERE specimen_id = %s",
                    (row.get('id'),)
                )
                image_rows = cursor.fetchall()
                image_paths = [img['file_path'] for img in image_rows]

            # Handle coordinates (may be FLOAT in old schema or VARCHAR in new schema)
            lat_raw = row.get('latitude')
            lon_raw = row.get('longitude')
            latdd_raw = row.get('latdd')
            londd_raw = row.get('londd')

            # Convert to appropriate types
            lat_str = str(lat_raw) if lat_raw is not None else None
            lon_str = str(lon_raw) if lon_raw is not None else None

            # Use latdd/londd if available, otherwise parse from lat/lon
            if latdd_raw is not None:
                latdd = float(latdd_raw)
            elif lat_raw is not None:
                latdd = self.parse_coordinate(lat_str)
            else:
                latdd = None

            if londd_raw is not None:
                londd = float(londd_raw)
            elif lon_raw is not None:
                londd = self.parse_coordinate(lon_str)
            else:
                londd = None

            specimen = SpecimenData(
                code=row['code'],
                scientific_name=row.get('scientific_name'),
                family=row.get('family'),
                genus=row.get('genus'),
                collector=row.get('collector'),
                collection_date=str(row.get('collection_date')) if row.get('collection_date') else None,
                description=row.get('description'),
                microhabitat=row.get('microhabitat'),
                country=row.get('country'),
                state_province=row.get('state_province'),
                county_city=row.get('county_city'),
                locality_description=row.get('locality_description'),
                latitude=lat_str,      # Verbatim string
                longitude=lon_str,     # Verbatim string
                latdd=latdd,          # Decimal degrees
                londd=londd,          # Decimal degrees
                habitat=row.get('habitat'),
                image_paths=image_paths
            )
            specimens.append(specimen)

        cursor.close()
        conn.close()

        print(f"📊 Found {len(specimens)} specimens to migrate")
        self.migrate_specimens(specimens)

    def migrate_specimens(self, specimens: List[SpecimenData]):
        """Migrate a list of specimens"""
        self.stats['total'] = len(specimens)
        self.stats['start_time'] = time.time()

        print(f"\n🚀 Starting migration of {len(specimens)} specimens...")
        print("=" * 60)

        for i, specimen in enumerate(specimens, 1):
            try:
                print(f"\n[{i}/{len(specimens)}] Migrating: {specimen.scientific_name}")
                if specimen.image_paths:
                    print(f"  📸 Images: {len(specimen.image_paths)}")

                self.api.create_specimen(specimen)
                self.stats['success'] += 1

                # Rate limiting (be nice to the server)
                time.sleep(0.1)

            except Exception as e:
                self.stats['failed'] += 1
                print(f"  ❌ Error: {str(e)}")

        self.stats['end_time'] = time.time()
        self.print_summary()

    def print_summary(self):
        """Print migration summary"""
        duration = self.stats['end_time'] - self.stats['start_time']

        print("\n" + "=" * 60)
        print("📊 MIGRATION SUMMARY")
        print("=" * 60)
        print(f"Total specimens:    {self.stats['total']}")
        print(f"✓ Successfully migrated: {self.stats['success']}")
        print(f"✗ Failed:           {self.stats['failed']}")
        print(f"⏱ Duration:         {duration:.2f} seconds")
        print(f"⚡ Rate:            {self.stats['success']/duration:.2f} specimens/sec")
        print("=" * 60)


# ========================================
# Example Usage Functions
# ========================================

def example_csv_migration():
    """Example: Migrate from CSV file"""
    # Initialize API client
    api = HerbariumAPIClient(base_url="http://localhost:8000")

    # Login or register
    api.register(
        email="migration@example.com",
        password="secure_password_123",
        name="Migration User"
    )

    # Create migrator
    migrator = SpecimenMigrator(api)

    # Migrate from CSV
    migrator.migrate_from_csv(
        csv_path="specimens_export.csv",
        image_base_dir="/path/to/specimen/images"
    )


def example_json_migration():
    """Example: Migrate from JSON file"""
    api = HerbariumAPIClient(base_url="http://localhost:8000")
    api.login(email="migration@example.com", password="secure_password_123")

    migrator = SpecimenMigrator(api)
    migrator.migrate_from_json(json_path="specimens_export.json")


def example_mysql_migration():
    """Example: Migrate from MySQL database"""
    api = HerbariumAPIClient(base_url="http://localhost:8000")
    api.login(email="migration@example.com", password="secure_password_123")

    migrator = SpecimenMigrator(api)
    migrator.migrate_from_mysql(
        host="localhost",
        database="old_herbarium_db",
        user="root",
        password="password",
        table="specimens",
        image_table="specimen_images"
    )


def example_manual_migration():
    """Example: Manually create specimens"""
    # Initialize API client
    api = HerbariumAPIClient(base_url="http://localhost:8000")

    # Login
    api.login(email="migration@example.com", password="secure_password_123")

    # Create specimen data manually
    specimens = [
        SpecimenData(
            code='xyz',
            scientific_name="Quercus alba",
            family="Fagaceae",
            genus="Quercus",
            collector="John Smith",
            collection_date="2024-06-15",
            description="White oak specimen collected from forest edge",
            microhabitat="Forest edge near stream",
            country="USA",
            state_province="Michigan",
            county_city="Washtenaw County",
            locality_description="University of Michigan Biological Station",
            latitude="45.5591 N",       # Verbatim as entered
            longitude="84.6747 W",      # Verbatim as entered
            latdd=45.5591,              # Decimal degrees
            londd=-84.6747,             # Decimal degrees (W is negative)
            habitat="Deciduous forest",
            image_paths=[
                "/path/to/images/quercus_alba_001.jpg",
                "/path/to/images/quercus_alba_002.jpg"
            ]
        ),
        SpecimenData(
            code='zzyz',
            scientific_name="Acer saccharum",
            family="Sapindaceae",
            genus="Acer",
            collector="Jane Doe",
            collection_date="2024-07-20",
            description="Sugar maple from mature forest",
            microhabitat="Understory of mature forest",
            country="USA",
            state_province="Michigan",
            county_city="Oakland County",
            latitude="42.5803°N",       # Verbatim as entered
            longitude="83.4729°W",      # Verbatim as entered
            latdd=42.5803,              # Decimal degrees
            londd=-83.4729,             # Decimal degrees (W is negative)
            habitat="Mixed deciduous forest",
            image_paths=[
                "/path/to/images/acer_saccharum_001.jpg"
            ]
        ),
        # Add more specimens...
    ]

    # Migrate
    migrator = SpecimenMigrator(api)
    migrator.migrate_specimens(specimens)


# ========================================
# Main Entry Point
# ========================================

def main():
    """Main function - customize for your migration needs"""
    print("=" * 60)
    print("🌿 HERBARIUM PRO - SPECIMEN MIGRATION TOOL")
    print("=" * 60)

    # CUSTOMIZE THESE SETTINGS FOR YOUR MIGRATION
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
    USER_EMAIL = os.getenv("USER_EMAIL", "admin@example.com")
    USER_PASSWORD = os.getenv("USER_PASSWORD", "change_this_password")
    USER_NAME = os.getenv("USER_NAME", "Migration Admin")

    try:
        # Initialize API client
        api = HerbariumAPIClient(base_url=API_BASE_URL)

        # Register or login
        print(f"\n🔐 Authenticating...")
        api.register(
            email=USER_EMAIL,
            password=USER_PASSWORD,
            name=USER_NAME
        )

        # Create migrator
        migrator = SpecimenMigrator(api)

        # CHOOSE YOUR MIGRATION METHOD:

        # Option 1: CSV Migration
        # migrator.migrate_from_csv(
        #     csv_path="specimens.csv",
        #     image_base_dir="/path/to/images"
        # )

        # Option 2: JSON Migration
        # migrator.migrate_from_json(json_path="specimens.json")

        # Option 3: MySQL Migration
        # migrator.migrate_from_mysql(
        #     host="localhost",
        #     database="old_db",
        #     user="root",
        #     password="password"
        # )

        # Option 4: Manual Migration (for testing)
        # print("\n⚠️  No migration method selected!")
        # print("Edit the main() function to choose a migration method.")
        # print("\nExample specimens for testing:")

        # # Create a few test specimens
        # test_specimens = [
        #     SpecimenData(
        #         scientific_name="Rosa californica",
        #         family="Rosaceae",
        #         genus="Rosa",
        #         collector="Test Collector",
        #         collection_date="2024-01-15",
        #         description="California wild rose",
        #         country="USA",
        #         state_province="California",
        #         latitude="37.7749°N",      # Verbatim as entered
        #         longitude="122.4194°W",    # Verbatim as entered
        #         latdd=37.7749,             # Decimal degrees
        #         londd=-122.4194,           # Decimal degrees (W is negative)
        #         habitat="Coastal scrub"
        #     )
        # ]

        # print(f"\nMigrating {len(test_specimens)} test specimens...")
        # migrator.migrate_specimens(test_specimens)

    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
