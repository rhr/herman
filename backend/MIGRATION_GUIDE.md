# Specimen Migration Guide

This guide explains how to migrate specimen data and images from an existing database to the Herbarium Pro backend.

## Schema Structure

**Important:** Herbarium Pro uses a consolidated schema where locality data is stored directly in the `specimens` table as flattened fields (not in a separate `localities` table). When migrating:

- All locality fields (country, state_province, latitude, longitude, etc.) are part of the specimen record
- If your source database has a separate localities table, the data will be flattened during migration
- If multiple specimens share a locality in your source database, that locality data will be duplicated for each specimen

This design simplifies queries and improves performance for most herbarium collections.

## Prerequisites

1. **Python 3.8+** installed
2. **Backend server running** at `http://localhost:8000`
3. **Install dependencies**:
   ```bash
   pip install requests python-dotenv
   ```

4. **For MySQL migration** (optional):
   ```bash
   pip install mysql-connector-python
   ```

## Quick Start

### 1. Basic Test Migration

Run the script as-is to test with sample data:

```bash
cd backend
python migrate_specimens.py
```

This will:
- Register/login a test user
- Create one test specimen
- Display migration statistics

### 2. Edit Configuration

Open `migrate_specimens.py` and edit the main() function:

```python
# Customize these settings
API_BASE_URL = "http://localhost:8000"
USER_EMAIL = "your-email@example.com"
USER_PASSWORD = "your-secure-password"
USER_NAME = "Your Name"
```

## Migration Methods

### Method 1: CSV Migration

**Best for:** Excel exports, simple data dumps

1. **Prepare your CSV file** with these columns:
   - `scientific_name` (required)
   - `family`, `genus`, `collector`, `collection_date`
   - `description`, `microhabitat`
   - `country`, `state_province`, `county_city`
   - `locality_description`, `latitude`, `longitude`, `habitat`
   - `image_filenames` (comma-separated list of filenames)

2. **Example CSV** (see `example_specimens.csv`):
   ```csv
   scientific_name,family,genus,collector,collection_date,latitude,longitude,image_filenames
   Quercus alba,Fagaceae,Quercus,John Smith,2024-06-15,45.5591,-84.6747,oak1.jpg,oak2.jpg
   ```

3. **Run migration**:
   ```python
   # In main() function, uncomment and customize:
   migrator.migrate_from_csv(
       csv_path="specimens.csv",
       image_base_dir="/path/to/specimen/images"
   )
   ```

4. **Execute**:
   ```bash
   python migrate_specimens.py
   ```

### Method 2: JSON Migration

**Best for:** API exports, programmatic data

1. **Prepare your JSON file** as an array of objects (see `example_specimens.json`):
   ```json
   [
     {
       "scientific_name": "Quercus alba",
       "family": "Fagaceae",
       "genus": "Quercus",
       "collector": "John Smith",
       "collection_date": "2024-06-15",
       "latitude": 45.5591,
       "longitude": -84.6747,
       "image_paths": [
         "/full/path/to/image1.jpg",
         "/full/path/to/image2.jpg"
       ]
     }
   ]
   ```

2. **Run migration**:
   ```python
   # In main() function:
   migrator.migrate_from_json(json_path="specimens.json")
   ```

### Method 3: MySQL Database Migration

**Best for:** Direct database-to-database transfer

1. **Ensure MySQL connector is installed**:
   ```bash
   pip install mysql-connector-python
   ```

2. **Run migration**:
   ```python
   # In main() function:
   migrator.migrate_from_mysql(
       host="localhost",
       database="old_herbarium_db",
       user="db_user",
       password="db_password",
       table="specimens",           # Your specimens table name
       image_table="specimen_images" # Optional: table with image paths
   )
   ```

3. **Expected table structure**:
   ```sql
   -- Specimens table should have columns matching SpecimenData fields
   CREATE TABLE specimens (
       id INT PRIMARY KEY,
       scientific_name VARCHAR(255),
       family VARCHAR(255),
       genus VARCHAR(255),
       ...
   );

   -- Optional images table
   CREATE TABLE specimen_images (
       id INT PRIMARY KEY,
       specimen_id INT,
       file_path VARCHAR(500)
   );
   ```

### Method 4: Custom Python Migration

**Best for:** Complex data transformations, API integrations

Create your own specimens programmatically:

```python
from migrate_specimens import HerbariumAPIClient, SpecimenMigrator, SpecimenData

# Setup
api = HerbariumAPIClient(base_url="http://localhost:8000")
api.login(email="user@example.com", password="password")
migrator = SpecimenMigrator(api)

# Create specimens
specimens = [
    SpecimenData(
        scientific_name="Rosa californica",
        family="Rosaceae",
        genus="Rosa",
        collector="John Doe",
        collection_date="2024-03-15",
        description="California wild rose",
        latitude=37.7749,
        longitude=-122.4194,
        image_paths=[
            "/path/to/rosa1.jpg",
            "/path/to/rosa2.jpg"
        ]
    ),
    # Add more specimens...
]

# Migrate
migrator.migrate_specimens(specimens)
```

## Data Format Reference

### Required Fields
- `scientific_name`: Scientific name of the specimen

### Optional Fields
- `family`: Taxonomic family
- `genus`: Taxonomic genus
- `collector`: Name of person who collected the specimen
- `collection_date`: Date collected (YYYY-MM-DD format)
- `description`: Detailed description
- `microhabitat`: Specific microhabitat description

### Locality Fields
- `country`: Country name
- `state_province`: State or province
- `county_city`: County or city
- `locality_description`: Detailed locality description
- `latitude`: Decimal degrees (e.g., 42.3601)
- `longitude`: Decimal degrees (e.g., -71.0589)
- `habitat`: General habitat description

### Images
- `image_paths`: List of full file paths to images
- Supported formats: JPG, JPEG, PNG, GIF
- Recommended max size: 10MB per image (configurable in backend)

## Advanced Usage

### Migrate from Multiple Sources

```python
def main():
    api = HerbariumAPIClient(base_url="http://localhost:8000")
    api.login(email="admin@example.com", password="password")
    migrator = SpecimenMigrator(api)

    # First, migrate from CSV
    migrator.migrate_from_csv("batch1.csv", "/images/batch1")

    # Then, migrate from JSON
    migrator.migrate_from_json("batch2.json")

    # Finally, migrate from MySQL
    migrator.migrate_from_mysql(
        host="localhost",
        database="legacy_db",
        user="root",
        password="password"
    )
```

### Custom Data Transformation

```python
import pandas as pd

# Read from Excel with custom processing
df = pd.read_excel("specimens.xlsx")

specimens = []
for _, row in df.iterrows():
    # Transform data as needed
    specimen = SpecimenData(
        scientific_name=row['Species Name'],
        collector=row['Collected By'].upper(),
        collection_date=row['Date'].strftime('%Y-%m-%d'),
        latitude=parse_coordinates(row['GPS']),
        # ... custom transformations
    )
    specimens.append(specimen)

migrator.migrate_specimens(specimens)
```

### Batch Processing for Large Datasets

```python
def migrate_in_batches(csv_path, batch_size=100):
    import pandas as pd

    api = HerbariumAPIClient(base_url="http://localhost:8000")
    api.login(email="admin@example.com", password="password")
    migrator = SpecimenMigrator(api)

    # Read CSV in chunks
    for chunk in pd.read_csv(csv_path, chunksize=batch_size):
        specimens = []
        for _, row in chunk.iterrows():
            specimen = SpecimenData(
                scientific_name=row['scientific_name'],
                # ... other fields
            )
            specimens.append(specimen)

        migrator.migrate_specimens(specimens)
        print(f"Completed batch of {len(specimens)} specimens")
```

## Troubleshooting

### Authentication Errors

**Problem**: `401 Unauthorized` errors

**Solution**:
- Verify backend is running at `http://localhost:8000`
- Check user credentials are correct
- Ensure JWT_SECRET in backend `.env` hasn't changed

### Image Upload Errors

**Problem**: Images not uploading

**Solution**:
- Verify image file paths are absolute and correct
- Check image files exist and are readable
- Verify image formats (JPG/PNG/GIF)
- Check file sizes (max 50MB by default)

### Database Connection Errors

**Problem**: Can't connect to source MySQL database

**Solution**:
- Verify MySQL server is running
- Check host, database name, user, password
- Ensure firewall allows connections
- Install mysql-connector-python: `pip install mysql-connector-python`

### Performance Issues

**Problem**: Migration is slow

**Solution**:
- Reduce image sizes before migration
- Increase `time.sleep()` delay in code for rate limiting
- Process in smaller batches
- Compress images before upload

## Migration Statistics

The script provides detailed statistics after completion:

```
📊 MIGRATION SUMMARY
============================================================
Total specimens:    150
✓ Successfully migrated: 148
✗ Failed:           2
⏱ Duration:         45.32 seconds
⚡ Rate:            3.27 specimens/sec
============================================================
```

## Security Notes

1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data:
   ```python
   import os
   USER_EMAIL = os.getenv("MIGRATION_USER_EMAIL")
   USER_PASSWORD = os.getenv("MIGRATION_PASSWORD")
   ```

3. **Use a dedicated migration user** with appropriate permissions
4. **Test with a small dataset first** before full migration

## Support

If you encounter issues:
1. Check backend logs: `cd backend && tail -f logs/app.log`
2. Verify API is accessible: `curl http://localhost:8000/health`
3. Test with example data first
4. Review error messages in migration output

## Example Workflows

### Workflow 1: Migrate from Legacy System

```bash
# 1. Export data from legacy system to CSV
# (use your legacy system's export feature)

# 2. Organize images in a directory
mkdir specimen_images
# Copy all images to this directory

# 3. Update CSV with image filenames column
# Use Excel or text editor to add image_filenames column

# 4. Edit migrate_specimens.py
# Set credentials and CSV path

# 5. Run migration
python migrate_specimens.py
```

### Workflow 2: API-to-API Migration

```python
import requests
from migrate_specimens import HerbariumAPIClient, SpecimenMigrator, SpecimenData

# Fetch from old API
old_api_response = requests.get("https://old-system.com/api/specimens")
old_specimens = old_api_response.json()

# Transform and migrate
api = HerbariumAPIClient(base_url="http://localhost:8000")
api.login(email="admin@example.com", password="password")
migrator = SpecimenMigrator(api)

specimens = []
for item in old_specimens:
    specimen = SpecimenData(
        scientific_name=item['name'],
        # ... map fields from old API to new format
    )
    specimens.append(specimen)

migrator.migrate_specimens(specimens)
```

## License

This migration script is provided as part of Herbarium Pro and follows the same license terms.
