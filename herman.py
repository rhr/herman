#!/usr/bin/env python3
"""
python client for herman API at https://oneil.fieldmuseum.org/herman/api
"""

import os, sys, requests, json, time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

@dataclass
class SpecimenData:
    """Data structure for specimen information (matches consolidated schema)"""
    # Required field
    code: str

    scientific_name: Optional[str] = None
    family: Optional[str] = None
    genus: Optional[str] = None
    collector: Optional[str] = None
    collector_number: Optional[str] = None
    collection_date: Optional[str] = None
    description: Optional[str] = None
    microhabitat: Optional[str] = None
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

class APIClient:
    """Client for interacting with the Herman backend API"""

    def __init__(self, base_url: str = "https://oneil.fieldmuseum.org/herman/api"):
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

    def login(self, username: str, password: str) -> bool:
        """
        Authenticate with the API and store the access token.

        Args:
            username: User's email or username
            password: User's password

        Returns:
            True if login successful, False otherwise
        """
        url = f"{self.base_url}/auth/login"

        # The login endpoint expects form data (x-www-form-urlencoded)
        data = {
            "email": username,
            "password": password
        }

        try:
            response = self.session.post(url, json=data)

            # Extract the access token from response
            result = response.json()
            if response.status_code == 200:
                self.token = result.get("access_token")
                # if self.token:
                #     print(f"✓ Successfully logged in as {username}")
                #     return True
            else:
                response.raise_for_status()
                # print("✗ Login failed: No access token received")
                return False

        except requests.exceptions.RequestException as e:
            print(f"✗ Login failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"  Response: {e.response.text}")
            return False

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

    def get_specimen_by_code(self, code: str) -> Optional[Dict]:
        """
        Get a single specimen by its unique code identifier.

        Args:
            code: The unique code identifier for the specimen

        Returns:
            Specimen data including images, annotations, and sequences if found, None otherwise
        """
        url = f"{self.base_url}/specimens/by-code/{code}"

        try:
            response = self.session.get(url, headers=self.get_auth_headers())

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                print(f"✗ Specimen with code '{code}' not found or you don't have access to it")
                return None
            else:
                raise Exception(f"Failed to get specimen: {response.status_code} - {response.text}")

        except requests.exceptions.RequestException as e:
            print(f"✗ Request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"  Response: {e.response.text}")
            return None

    def create_annotation(self, specimen_id: int, text: str) -> Optional[dict]:
        """
        Create an annotation for a specimen.

        Args:
            specimen_id: The ID of the specimen to annotate
            text: The annotation text content

        Returns:
            The created annotation data if successful, None otherwise
        """
        if not self.token:
            print("✗ Not authenticated. Please login first.")
            return None

        url = f"{self.base_url}/specimens/{specimen_id}/annotations"

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

        payload = {
            "text": text
        }

        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()

            annotation = response.json()
            print(f"✓ Successfully created annotation #{annotation['id']}")
            return annotation

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                print(f"✗ Specimen #{specimen_id} not found or you don't have access to it")
            elif e.response.status_code == 401:
                print("✗ Authentication failed. Token may be expired.")
            else:
                print(f"✗ Failed to create annotation: {e}")
                print(f"  Response: {e.response.text}")
            return None

        except requests.exceptions.RequestException as e:
            print(f"✗ Request failed: {e}")
            return None


# def main():
#     """Example usage of the Herman API client"""

#     # Initialize the API client
#     client = HermanAPIClient()

#     # Step 1: Login
#     # Replace with your actual credentials
#     USERNAME = "your_email@example.com"
#     PASSWORD = "your_password"

#     if not client.login(USERNAME, PASSWORD):
#         print("\nFailed to authenticate. Exiting.")
#         return

#     # Step 2: Create an annotation
#     # Replace with an actual specimen ID that you own
#     SPECIMEN_ID = 123
#     ANNOTATION_TEXT = "This specimen shows interesting morphological features."

#     print(f"\nCreating annotation for specimen #{SPECIMEN_ID}...")
#     annotation = client.create_annotation(SPECIMEN_ID, ANNOTATION_TEXT)

#     if annotation:
#         print("\nCreated annotation details:")
#         print(f"  ID: {annotation['id']}")
#         print(f"  Specimen ID: {annotation['specimen_id']}")
#         print(f"  Text: {annotation['text']}")
#         print(f"  Author: {annotation.get('author', 'N/A')}")
#         print(f"  Timestamp: {annotation.get('timestamp', 'N/A')}")
#     else:
#         print("\nFailed to create annotation.")


# if __name__ == "__main__":
#     main()
