#!/usr/bin/env python3
"""
Test script for create_specimen function in migrate_specimens.py

This script tests the HerbariumAPIClient.create_specimen() method with various
specimen data scenarios including specimens with and without images, coordinates,
and optional fields.

Usage:
    python test_create_specimen.py
"""

import os
import sys
import time
import tempfile
from pathlib import Path

# Import dotenv if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from migrate_specimens import HerbariumAPIClient, SpecimenData


def create_test_image(path: str, width: int = 800, height: int = 600, color: tuple = (100, 150, 100)):
    """Create a simple test image (minimal JPEG)"""
    # Create a minimal valid JPEG file for testing
    # This is a 1x1 pixel red JPEG (smallest possible valid JPEG)
    jpeg_data = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
        0x3F, 0x00, 0x00, 0xFF, 0xD9
    ])

    with open(path, 'wb') as f:
        f.write(jpeg_data)
    print(f"  Created test image: {path}")


def test_create_specimen_minimal():
    """Test creating a specimen with only required fields"""
    print("\n" + "=" * 60)
    print("TEST 1: Minimal Specimen (only scientific name)")
    print("=" * 60)

    specimen = SpecimenData(
        scientific_name="Testus minimalus"
    )

    return specimen


def test_create_specimen_full():
    """Test creating a specimen with all fields populated"""
    print("\n" + "=" * 60)
    print("TEST 2: Full Specimen (all fields)")
    print("=" * 60)

    specimen = SpecimenData(
        scientific_name="Testus completeus",
        family="Testaceae",
        genus="Testus",
        collector="Jane Test",
        collector_number="JT-2024-001",
        collection_date="2024-12-25",
        description="Test specimen with all fields populated for comprehensive testing",
        microhabitat="Test habitat near water",
        country="USA",
        state_province="Michigan",
        county_city="Washtenaw County",
        locality_description="University of Michigan test site",
        latitude="42°16'48\"N",    # Verbatim DMS format
        longitude="83°44'24\"W",   # Verbatim DMS format
        latdd=42.28,               # Decimal degrees
        londd=-83.74,              # Decimal degrees (W is negative)
        elevation="280m",
        habitat="Mixed deciduous forest"
    )

    return specimen


def test_create_specimen_with_images():
    """Test creating a specimen with image files"""
    print("\n" + "=" * 60)
    print("TEST 3: Specimen with Images")
    print("=" * 60)

    # Create temporary directory for test images
    temp_dir = tempfile.mkdtemp()

    # Create test images
    image1_path = os.path.join(temp_dir, "specimen_test_1.jpg")
    image2_path = os.path.join(temp_dir, "specimen_test_2.jpg")

    create_test_image(image1_path, color=(120, 180, 120))
    create_test_image(image2_path, color=(150, 100, 100))

    specimen = SpecimenData(
        scientific_name="Testus imagus",
        family="Testaceae",
        genus="Testus",
        collector="John Photographer",
        collection_date="2024-12-26",
        description="Test specimen with attached images",
        country="USA",
        state_province="California",
        latitude="37.7749°N",
        longitude="122.4194°W",
        latdd=37.7749,
        londd=-122.4194,
        habitat="Urban park",
        image_paths=[image1_path, image2_path]
    )

    return specimen, temp_dir


def test_create_specimen_coordinates_only():
    """Test creating a specimen with decimal degree coordinates only"""
    print("\n" + "=" * 60)
    print("TEST 4: Specimen with Decimal Degrees Only")
    print("=" * 60)

    specimen = SpecimenData(
        scientific_name="Testus coordinatus",
        family="Testaceae",
        collector="GPS Collector",
        collection_date="2024-12-27",
        country="USA",
        state_province="Colorado",
        latdd=39.7392,    # Denver coordinates
        londd=-104.9903,  # Decimal degrees only, no verbatim string
        habitat="Mountain meadow"
    )

    return specimen


def test_create_specimen_verbatim_only():
    """Test creating a specimen with verbatim coordinates only"""
    print("\n" + "=" * 60)
    print("TEST 5: Specimen with Verbatim Coordinates Only")
    print("=" * 60)

    specimen = SpecimenData(
        scientific_name="Testus verbatus",
        collector="Field Collector",
        collection_date="2024-12-28",
        country="USA",
        state_province="Texas",
        latitude="30°16'N",     # Verbatim only
        longitude="97°44'W",    # Verbatim only
        habitat="Grassland"
    )

    return specimen


def test_create_specimen_missing_images():
    """Test creating a specimen with non-existent image paths"""
    print("\n" + "=" * 60)
    print("TEST 6: Specimen with Missing Images (should warn)")
    print("=" * 60)

    specimen = SpecimenData(
        scientific_name="Testus missingus",
        collector="Test Collector",
        image_paths=[
            "/nonexistent/path/image1.jpg",
            "/nonexistent/path/image2.jpg"
        ]
    )

    return specimen


def run_tests():
    """Run all test cases"""
    print("\n" + "=" * 70)
    print("🧪 TESTING create_specimen FUNCTION")
    print("=" * 70)

    # Get API configuration
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
    USER_EMAIL = os.getenv("USER_EMAIL", "test@example.com")
    USER_PASSWORD = os.getenv("USER_PASSWORD", "test_password_123")
    USER_NAME = os.getenv("USER_NAME", "Test User")

    print(f"\nConfiguration:")
    print(f"  API URL: {API_BASE_URL}")
    print(f"  User: {USER_EMAIL}")

    # Initialize API client
    print(f"\n🔐 Authenticating...")
    api = HerbariumAPIClient(base_url=API_BASE_URL)

    try:
        # Try to register, fallback to login if user exists
        api.register(email=USER_EMAIL, password=USER_PASSWORD, name=USER_NAME)
    except Exception as e:
        if "already registered" in str(e).lower():
            print(f"! User already exists, logging in...")
            api.login(email=USER_EMAIL, password=USER_PASSWORD)
        else:
            raise

    print("✓ Authenticated successfully")

    # Track test results
    results = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'tests': []
    }

    temp_dirs = []  # Track temp directories for cleanup

    # Test 1: Minimal specimen
    try:
        results['total'] += 1
        specimen = test_create_specimen_minimal()
        print(f"\n📝 Creating specimen: {specimen.scientific_name}")
        response = api.create_specimen(specimen)
        print(f"✅ PASSED - Created with ID: {response.get('id')}")
        results['passed'] += 1
        results['tests'].append(('Minimal specimen', 'PASSED', response.get('id')))
    except Exception as e:
        print(f"❌ FAILED - Error: {str(e)}")
        results['failed'] += 1
        results['tests'].append(('Minimal specimen', 'FAILED', str(e)))

    # Test 2: Full specimen
    try:
        results['total'] += 1
        specimen = test_create_specimen_full()
        print(f"\n📝 Creating specimen: {specimen.scientific_name}")
        response = api.create_specimen(specimen)
        print(f"✅ PASSED - Created with ID: {response.get('id')}")
        results['passed'] += 1
        results['tests'].append(('Full specimen', 'PASSED', response.get('id')))
    except Exception as e:
        print(f"❌ FAILED - Error: {str(e)}")
        results['failed'] += 1
        results['tests'].append(('Full specimen', 'FAILED', str(e)))

    # Test 3: Specimen with images
    try:
        results['total'] += 1
        specimen, temp_dir = test_create_specimen_with_images()
        temp_dirs.append(temp_dir)
        print(f"\n📝 Creating specimen: {specimen.scientific_name}")
        print(f"  📸 With {len(specimen.image_paths)} images")
        response = api.create_specimen(specimen)
        print(f"✅ PASSED - Created with ID: {response.get('id')}")
        results['passed'] += 1
        results['tests'].append(('Specimen with images', 'PASSED', response.get('id')))
    except Exception as e:
        print(f"❌ FAILED - Error: {str(e)}")
        results['failed'] += 1
        results['tests'].append(('Specimen with images', 'FAILED', str(e)))

    # Test 4: Decimal degrees only
    try:
        results['total'] += 1
        specimen = test_create_specimen_coordinates_only()
        print(f"\n📝 Creating specimen: {specimen.scientific_name}")
        print(f"  📍 Coordinates: {specimen.latdd}, {specimen.londd}")
        response = api.create_specimen(specimen)
        print(f"✅ PASSED - Created with ID: {response.get('id')}")
        results['passed'] += 1
        results['tests'].append(('Decimal degrees only', 'PASSED', response.get('id')))
    except Exception as e:
        print(f"❌ FAILED - Error: {str(e)}")
        results['failed'] += 1
        results['tests'].append(('Decimal degrees only', 'FAILED', str(e)))

    # Test 5: Verbatim coordinates only
    try:
        results['total'] += 1
        specimen = test_create_specimen_verbatim_only()
        print(f"\n📝 Creating specimen: {specimen.scientific_name}")
        print(f"  📍 Verbatim: {specimen.latitude}, {specimen.longitude}")
        response = api.create_specimen(specimen)
        print(f"✅ PASSED - Created with ID: {response.get('id')}")
        results['passed'] += 1
        results['tests'].append(('Verbatim coordinates only', 'PASSED', response.get('id')))
    except Exception as e:
        print(f"❌ FAILED - Error: {str(e)}")
        results['failed'] += 1
        results['tests'].append(('Verbatim coordinates only', 'FAILED', str(e)))

    # Test 6: Missing images (should warn but succeed)
    try:
        results['total'] += 1
        specimen = test_create_specimen_missing_images()
        print(f"\n📝 Creating specimen: {specimen.scientific_name}")
        print(f"  ⚠️  With non-existent image paths (should show warnings)")
        response = api.create_specimen(specimen)
        print(f"✅ PASSED - Created with ID: {response.get('id')}")
        results['passed'] += 1
        results['tests'].append(('Missing images', 'PASSED', response.get('id')))
    except Exception as e:
        print(f"❌ FAILED - Error: {str(e)}")
        results['failed'] += 1
        results['tests'].append(('Missing images', 'FAILED', str(e)))

    # Cleanup temp directories
    print("\n🧹 Cleaning up temporary files...")
    import shutil
    for temp_dir in temp_dirs:
        try:
            shutil.rmtree(temp_dir)
            print(f"  Removed: {temp_dir}")
        except Exception as e:
            print(f"  Warning: Could not remove {temp_dir}: {e}")

    # Print summary
    print("\n" + "=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    print(f"Total tests:    {results['total']}")
    print(f"✅ Passed:      {results['passed']}")
    print(f"❌ Failed:      {results['failed']}")
    print(f"Success rate:   {(results['passed']/results['total']*100):.1f}%")
    print("\n" + "=" * 70)
    print("TEST RESULTS:")
    print("=" * 70)

    for test_name, status, detail in results['tests']:
        status_icon = "✅" if status == "PASSED" else "❌"
        print(f"{status_icon} {test_name:30s} {status:10s} {detail}")

    print("=" * 70)

    # Return exit code
    return 0 if results['failed'] == 0 else 1


def main():
    """Main entry point"""
    try:
        exit_code = run_tests()
        sys.exit(exit_code)
    except Exception as e:
        print(f"\n❌ Test execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
