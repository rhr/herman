#!/usr/bin/env python3
"""
Enhanced Specimen Migration Script with Locality Analysis

This script handles migration from databases where multiple specimens
share the same locality record. It analyzes locality sharing patterns
and provides statistics about deduplication.

IMPORTANT: The target Herbarium Pro database uses a consolidated schema
where locality data is stored directly in the specimens table (not in a
separate localities table). Even if your source database shares localities,
the migrated data will have locality fields duplicated for each specimen.

This script provides visibility into how much locality data will be duplicated.

Usage:
    python migrate_with_shared_localities.py
"""

import requests
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import time
from collections import defaultdict


@dataclass
class LocalityData:
    """Locality information"""
    country: Optional[str] = None
    state_province: Optional[str] = None
    county_city: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    habitat: Optional[str] = None

    def get_key(self) -> str:
        """Generate a unique key for deduplication"""
        # If we have coordinates, use them (rounded to 4 decimal places)
        if self.latitude is not None and self.longitude is not None:
            return f"coords:{round(self.latitude, 4)},{round(self.longitude, 4)}"
        # Otherwise, use description
        if self.description:
            return f"desc:{self.description.lower().strip()}"
        # Fallback to location text
        location = f"{self.country or ''}-{self.state_province or ''}-{self.county_city or ''}".lower()
        return f"loc:{location}"


@dataclass
class SpecimenWithLocalityRef:
    """Specimen with a reference to a shared locality"""
    scientific_name: str
    family: Optional[str] = None
    genus: Optional[str] = None
    collector: Optional[str] = None
    collection_date: Optional[str] = None
    description: Optional[str] = None
    microhabitat: Optional[str] = None
    locality_id: Optional[int] = None  # Reference to original locality ID
    locality: Optional[LocalityData] = None  # Locality data
    image_paths: List[str] = None

    def __post_init__(self):
        if self.image_paths is None:
            self.image_paths = []


class HerbariumAPIClient:
    """Client for Herbarium Pro API"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.token: Optional[str] = None
        self.session = requests.Session()

    def register(self, email: str, password: str, name: str, institution: Optional[str] = None) -> Dict:
        """Register a new user"""
        url = f"{self.base_url}/api/auth/register"
        data = {"email": email, "password": password, "name": name, "institution": institution}
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
        """Login user"""
        url = f"{self.base_url}/api/auth/login"
        response = self.session.post(url, json={"email": email, "password": password})

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

    def create_specimen(self, specimen: SpecimenWithLocalityRef) -> Dict:
        """Create a specimen with locality data"""
        url = f"{self.base_url}/api/specimens"

        # Prepare form data
        data = {'scientific_name': specimen.scientific_name}

        # Add optional specimen fields
        if specimen.family:
            data['family'] = specimen.family
        if specimen.genus:
            data['genus'] = specimen.genus
        if specimen.collector:
            data['collector'] = specimen.collector
        if specimen.collection_date:
            data['collection_date'] = specimen.collection_date
        if specimen.description:
            data['description'] = specimen.description
        if specimen.microhabitat:
            data['microhabitat'] = specimen.microhabitat

        # Add locality fields
        if specimen.locality:
            loc = specimen.locality
            if loc.country:
                data['country'] = loc.country
            if loc.state_province:
                data['state_province'] = loc.state_province
            if loc.county_city:
                data['county_city'] = loc.county_city
            if loc.description:
                data['locality_description'] = loc.description
            if loc.latitude is not None:
                data['latitude'] = str(loc.latitude)
            if loc.longitude is not None:
                data['longitude'] = str(loc.longitude)
            if loc.habitat:
                data['habitat'] = loc.habitat

        # Prepare image files
        files = []
        for img_path in specimen.image_paths:
            if Path(img_path).exists():
                files.append(
                    ('images', (Path(img_path).name, open(img_path, 'rb'), 'image/jpeg'))
                )

        try:
            response = self.session.post(url, data=data, files=files, headers=self.get_auth_headers())

            if response.status_code == 201:
                return response.json()
            else:
                raise Exception(f"Failed: {response.status_code} - {response.text}")
        finally:
            for _, file_tuple in files:
                file_tuple[1].close()


class LocalityDeduplicator:
    """Handles locality deduplication logic"""

    def __init__(self):
        self.locality_map: Dict[str, LocalityData] = {}
        self.locality_stats = defaultdict(int)

    def register_locality(self, locality: LocalityData) -> str:
        """Register a locality and get its key"""
        key = locality.get_key()

        if key not in self.locality_map:
            self.locality_map[key] = locality

        self.locality_stats[key] += 1
        return key

    def get_locality(self, key: str) -> Optional[LocalityData]:
        """Get locality by key"""
        return self.locality_map.get(key)

    def print_summary(self):
        """Print deduplication summary"""
        print("\n📊 LOCALITY DEDUPLICATION SUMMARY")
        print("=" * 60)
        print(f"Unique localities:  {len(self.locality_map)}")
        print(f"Total specimens:    {sum(self.locality_stats.values())}")

        # Show localities with most specimens
        sorted_locs = sorted(self.locality_stats.items(), key=lambda x: x[1], reverse=True)
        print(f"\nTop 5 most common localities:")
        for key, count in sorted_locs[:5]:
            locality = self.locality_map[key]
            if locality.description:
                desc = locality.description[:50]
            elif locality.latitude and locality.longitude:
                desc = f"{locality.latitude}, {locality.longitude}"
            else:
                desc = f"{locality.country or ''}, {locality.state_province or ''}"
            print(f"  {count:3d} specimens - {desc}")
        print("=" * 60)


class EnhancedMigrator:
    """Migrator with locality deduplication"""

    def __init__(self, api_client: HerbariumAPIClient):
        self.api = api_client
        self.deduplicator = LocalityDeduplicator()
        self.stats = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'start_time': None,
            'end_time': None
        }

    def migrate_from_mysql_with_localities(
        self,
        host: str,
        database: str,
        user: str,
        password: str,
        specimen_table: str = 'specimens',
        locality_table: str = 'localities',
        image_table: Optional[str] = None,
        locality_id_column: str = 'locality_id',
        specimen_id_column: str = 'id'
    ):
        """
        Migrate from MySQL with separate locality table

        Args:
            locality_id_column: Column in specimens table that references locality
            specimen_id_column: Primary key column in specimens table
        """
        try:
            import mysql.connector
        except ImportError:
            print("❌ Error: mysql-connector-python not installed")
            return

        print(f"\n📂 Connecting to MySQL database: {database}")

        conn = mysql.connector.connect(host=host, database=database, user=user, password=password)
        cursor = conn.cursor(dictionary=True)

        # First, load all localities
        print(f"📥 Loading localities from {locality_table}...")
        cursor.execute(f"SELECT * FROM {locality_table}")
        locality_rows = cursor.fetchall()

        # Build locality lookup
        localities = {}
        for row in locality_rows:
            locality_id = row['id']
            locality = LocalityData(
                country=row.get('country'),
                state_province=row.get('state_province') or row.get('state'),
                county_city=row.get('county_city') or row.get('county') or row.get('city'),
                description=row.get('description') or row.get('locality_description'),
                latitude=row.get('latitude'),
                longitude=row.get('longitude'),
                habitat=row.get('habitat')
            )
            localities[locality_id] = locality
            self.deduplicator.register_locality(locality)

        print(f"✓ Loaded {len(localities)} localities")

        # Now load specimens
        print(f"📥 Loading specimens from {specimen_table}...")
        cursor.execute(f"SELECT * FROM {specimen_table}")
        specimen_rows = cursor.fetchall()

        specimens = []
        for row in specimen_rows:
            # Get locality for this specimen
            locality_id = row.get(locality_id_column)
            locality = localities.get(locality_id) if locality_id else None

            # Get images if image_table provided
            image_paths = []
            if image_table:
                cursor.execute(
                    f"SELECT file_path FROM {image_table} WHERE specimen_id = %s",
                    (row.get(specimen_id_column),)
                )
                image_rows = cursor.fetchall()
                image_paths = [img['file_path'] for img in image_rows]

            specimen = SpecimenWithLocalityRef(
                scientific_name=row['scientific_name'],
                family=row.get('family'),
                genus=row.get('genus'),
                collector=row.get('collector'),
                collection_date=str(row.get('collection_date')) if row.get('collection_date') else None,
                description=row.get('description'),
                microhabitat=row.get('microhabitat'),
                locality_id=locality_id,
                locality=locality,
                image_paths=image_paths
            )
            specimens.append(specimen)

        cursor.close()
        conn.close()

        print(f"✓ Loaded {len(specimens)} specimens")

        # Show deduplication info
        self.deduplicator.print_summary()

        # Migrate specimens
        self.migrate_specimens(specimens)

    def migrate_specimens(self, specimens: List[SpecimenWithLocalityRef]):
        """Migrate specimens"""
        self.stats['total'] = len(specimens)
        self.stats['start_time'] = time.time()

        print(f"\n🚀 Starting migration of {len(specimens)} specimens...")
        print("=" * 60)

        for i, specimen in enumerate(specimens, 1):
            try:
                loc_info = ""
                if specimen.locality:
                    key = specimen.locality.get_key()
                    count = self.deduplicator.locality_stats.get(key, 0)
                    loc_info = f" [Locality shared by {count} specimens]"

                print(f"\n[{i}/{len(specimens)}] {specimen.scientific_name}{loc_info}")
                if specimen.image_paths:
                    print(f"  📸 Images: {len(specimen.image_paths)}")

                self.api.create_specimen(specimen)
                self.stats['success'] += 1
                print(f"  ✓ Created")

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
        print(f"Total specimens:         {self.stats['total']}")
        print(f"✓ Successfully migrated: {self.stats['success']}")
        print(f"✗ Failed:                {self.stats['failed']}")
        print(f"⏱ Duration:              {duration:.2f} seconds")
        print(f"⚡ Rate:                 {self.stats['success']/duration:.2f} specimens/sec")
        print("=" * 60)
        print("\n⚠️  NOTE: Due to the backend's consolidated schema design,")
        print("locality fields are stored directly in the specimens table (not in a")
        print("separate table). Each specimen has its own locality data, even if your")
        print("original database had shared localities. Locality data has been duplicated.")
        print("=" * 60)


def main():
    """Main function"""
    print("=" * 60)
    print("🌿 HERBARIUM PRO - ENHANCED MIGRATION WITH SHARED LOCALITIES")
    print("=" * 60)

    # CUSTOMIZE THESE SETTINGS
    API_BASE_URL = "http://localhost:8000"
    USER_EMAIL = "admin@example.com"
    USER_PASSWORD = "change_this_password"
    USER_NAME = "Migration Admin"

    # SOURCE DATABASE SETTINGS
    SOURCE_HOST = "localhost"
    SOURCE_DATABASE = "old_herbarium_db"
    SOURCE_USER = "root"
    SOURCE_PASSWORD = "password"
    SOURCE_SPECIMEN_TABLE = "specimens"
    SOURCE_LOCALITY_TABLE = "localities"
    SOURCE_IMAGE_TABLE = "specimen_images"  # Optional
    LOCALITY_FK_COLUMN = "locality_id"  # Column in specimens table

    try:
        # Initialize API client
        api = HerbariumAPIClient(base_url=API_BASE_URL)

        # Register or login
        print(f"\n🔐 Authenticating...")
        api.register(email=USER_EMAIL, password=USER_PASSWORD, name=USER_NAME)

        # Create enhanced migrator
        migrator = EnhancedMigrator(api)

        # Migrate from MySQL with locality table
        migrator.migrate_from_mysql_with_localities(
            host=SOURCE_HOST,
            database=SOURCE_DATABASE,
            user=SOURCE_USER,
            password=SOURCE_PASSWORD,
            specimen_table=SOURCE_SPECIMEN_TABLE,
            locality_table=SOURCE_LOCALITY_TABLE,
            image_table=SOURCE_IMAGE_TABLE,
            locality_id_column=LOCALITY_FK_COLUMN
        )

    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        raise


if __name__ == "__main__":
    main()
