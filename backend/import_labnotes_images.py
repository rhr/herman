#!/usr/bin/env python3
"""
Import images from labnotes_images.csv

CSV Format: specimen_id, image_path, filename, caption
- specimen_id: Database ID of the specimen
- image_path: Full path to the image file on disk
- filename: Original filename for the image
- caption: Optional caption for the image
"""
import csv
import os
import shutil
import uuid
from pathlib import Path
from sqlalchemy.orm import Session
from database import engine, get_db
from models import Specimen, Image
from storage import file_storage

def import_images(csv_path: str, dry_run: bool = False):
    """
    Import images from CSV file

    Args:
        csv_path: Path to the CSV file
        dry_run: If True, only print what would be done without making changes
    """
    if not os.path.exists(csv_path):
        print(f"ERROR: CSV file not found: {csv_path}")
        return

    db = next(get_db())
    stats = {
        'total': 0,
        'success': 0,
        'skipped': 0,
        'errors': 0,
        'missing_files': 0,
        'missing_specimens': 0
    }

    print(f"Reading images from: {csv_path}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE IMPORT'}")
    print("-" * 80)

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            stats['total'] += 1
            specimen_id = int(row['specimen_id'])
            image_path = row['image_path']
            filename = row['filename'] or Path(image_path).name
            caption = row['caption'].strip() if row['caption'] else None

            print(f"\n[{stats['total']}] Specimen ID {specimen_id}: {filename}")

            # Check if specimen exists
            specimen = db.query(Specimen).filter(Specimen.id == specimen_id).first()
            if not specimen:
                print(f"  ❌ ERROR: Specimen {specimen_id} not found in database")
                stats['missing_specimens'] += 1
                stats['errors'] += 1
                continue

            # Check if image file exists
            if not os.path.exists(image_path):
                print(f"  ❌ ERROR: Image file not found: {image_path}")
                stats['missing_files'] += 1
                stats['errors'] += 1
                continue

            # Check if image already exists for this specimen
            existing_images = db.query(Image).filter(
                Image.specimen_id == specimen_id,
                Image.filename == filename
            ).all()

            if existing_images:
                print(f"  ⏭️  SKIPPED: Image already exists for this specimen")
                stats['skipped'] += 1
                continue

            if dry_run:
                print(f"  ✓ Would import: {filename}")
                if caption:
                    print(f"    Caption: {caption}")
                stats['success'] += 1
                continue

            try:
                # Get current position (number of existing images)
                current_images = db.query(Image).filter(
                    Image.specimen_id == specimen_id
                ).count()
                position = current_images

                # Create specimen directory
                specimen_dir = file_storage.specimens_dir / str(specimen_id)
                specimen_dir.mkdir(parents=True, exist_ok=True)

                # Generate unique storage filename
                ext = Path(image_path).suffix.lower()
                unique_filename = f"{uuid.uuid4()}{ext}"
                storage_path_obj = specimen_dir / unique_filename

                # Copy the image file
                shutil.copy2(image_path, storage_path_obj)
                file_size = os.path.getsize(storage_path_obj)

                # Generate storage path and URL
                storage_path = f"specimens/{specimen_id}/{unique_filename}"
                base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
                image_url = f"{base_url}/uploads/{storage_path}"

                # Detect mime type
                mime_type = None
                if ext in ['.jpg', '.jpeg']:
                    mime_type = 'image/jpeg'
                elif ext == '.png':
                    mime_type = 'image/png'
                elif ext == '.gif':
                    mime_type = 'image/gif'
                elif ext == '.webp':
                    mime_type = 'image/webp'

                # Create image record
                image = Image(
                    specimen_id=specimen_id,
                    filename=filename,
                    storage_filename=unique_filename,
                    storage_path=storage_path,
                    url=image_url,
                    caption=caption,
                    mime_type=mime_type,
                    size_bytes=file_size,
                    position=position
                )

                db.add(image)
                db.commit()

                print(f"  ✅ SUCCESS: Imported {filename} (position {position})")
                if caption:
                    print(f"    Caption: {caption}")
                print(f"    Size: {file_size:,} bytes")
                print(f"    URL: {image_url}")

                stats['success'] += 1

            except Exception as e:
                db.rollback()
                print(f"  ❌ ERROR: Failed to import image: {e}")
                stats['errors'] += 1

    # Print summary
    print("\n" + "=" * 80)
    print("IMPORT SUMMARY")
    print("=" * 80)
    print(f"Total images in CSV:      {stats['total']}")
    print(f"Successfully imported:    {stats['success']}")
    print(f"Skipped (already exist):  {stats['skipped']}")
    print(f"Missing specimens:        {stats['missing_specimens']}")
    print(f"Missing image files:      {stats['missing_files']}")
    print(f"Other errors:             {stats['errors'] - stats['missing_specimens'] - stats['missing_files']}")
    print(f"Total errors:             {stats['errors']}")
    print("=" * 80)

    db.close()


if __name__ == '__main__':
    import sys

    csv_path = 'imports/labnotes_images.csv'

    # Check for command line arguments
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv

    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        print("\nUsage:")
        print("  python import_labnotes_images.py              # Run import")
        print("  python import_labnotes_images.py --dry-run    # Preview without importing")
        print("  python import_labnotes_images.py -n           # Same as --dry-run")
        sys.exit(0)

    import_images(csv_path, dry_run=dry_run)
