# Locality Handling in Migration

## Current Backend Schema (Consolidated)

The Herbarium Pro backend uses a **consolidated schema** where locality data is stored directly in the specimens table:

```python
# models.py
class Specimen(Base):
    # Specimen fields
    scientific_name = Column(String(255), nullable=False)
    family = Column(String(100))
    # ...

    # Locality fields (flattened - no separate table)
    country = Column(String(100))
    state_province = Column(String(100))
    county_city = Column(String(100))
    locality_description = Column(Text)
    latitude = Column(Float, index=True)
    longitude = Column(Float, index=True)
    habitat = Column(Text)
```

**Key characteristics:**
- Locality data is **flattened** into the specimen record
- No separate `localities` table
- Each specimen has its own locality fields
- Simpler schema, faster queries (no joins)
- Localities **cannot be shared** between specimens (data is duplicated if needed)

## Impact on Migration

### Scenario 1: Your database has 1-to-1 specimen-locality relationship
✅ **No problem!** Use the standard `migrate_specimens.py` script.

### Scenario 2: Your database has shared localities (1-to-many or many-to-many)
⚠️ **Locality data will be duplicated** in the target database.

**Example:**
```
Source Database (separate locality table):
- Locality #1: "University of Michigan Bio Station", lat: 45.5591, long: -84.6747
  - Specimen A: Quercus alba
  - Specimen B: Acer saccharum
  - Specimen C: Trillium grandiflorum

Target Database (after migration - flattened):
- Specimen A: Quercus alba
  └─ locality_description: "University of Michigan Bio Station"
  └─ latitude: 45.5591, longitude: -84.6747

- Specimen B: Acer saccharum
  └─ locality_description: "University of Michigan Bio Station" (DUPLICATE)
  └─ latitude: 45.5591, longitude: -84.6747

- Specimen C: Trillium grandiflorum
  └─ locality_description: "University of Michigan Bio Station" (DUPLICATE)
  └─ latitude: 45.5591, longitude: -84.6747
```

Each specimen gets its own copy of the locality data.

## Migration Scripts

### Option 1: Standard Migration (Simple)
**Use:** `migrate_specimens.py`

**Behavior:**
- Creates one new locality per specimen
- Duplicates locality data if original DB had shared localities
- Simple and straightforward

**When to use:**
- Your source DB already has 1-to-1 specimen-locality
- You don't mind duplicating locality data
- Quick migration without analysis

### Option 2: Enhanced Migration (With Analysis)
**Use:** `migrate_with_shared_localities.py`

**Behavior:**
- Analyzes locality sharing in source database
- Shows deduplication statistics
- Still creates duplicate localities (due to backend schema)
- But provides visibility into the duplication

**When to use:**
- Your source DB has shared localities
- You want to understand the duplication impact
- You want migration statistics showing locality sharing

**Example output:**
```
📊 LOCALITY DEDUPLICATION SUMMARY
============================================================
Unique localities:  15
Total specimens:    150

Top 5 most common localities:
   45 specimens - University of Michigan Biological Station
   23 specimens - Pinckney Recreation Area
   18 specimens - Rouge Park, Detroit
   12 specimens - Columbus Metro Park
    8 specimens - Ithaca State Park
============================================================
```

## Understanding the Duplication

### What gets duplicated?
All locality fields:
- `country`, `state_province`, `county_city`
- `description` (locality description)
- `latitude`, `longitude`
- `habitat`

### Database impact:

**Example calculation:**
- 1,000 specimens from 50 unique localities
- Average locality data: ~200 bytes per specimen (7 fields)
- **Current schema (flattened):** 1,000 × 200 bytes = ~200 KB
- **Theoretical shared design:** 50 × 200 bytes = ~10 KB
- **Duplication overhead:** ~190 KB (95% redundancy)

Note: The overhead is in specimen table rows, not separate records.

For most herbarium collections, this is **acceptable overhead** because:
- Modern databases handle this easily
- Simplifies application logic
- Allows per-specimen locality modifications
- Eliminates complex join queries

## Alternative Approaches

If locality duplication is a significant concern, you have these options:

### Option A: Accept Duplication (Recommended)
**Pros:**
- Simple schema
- Fast queries (no joins needed)
- Each specimen can have unique locality details
- Already implemented

**Cons:**
- Duplicated data
- Updates require touching multiple records

### Option B: Normalize Localities (Not Recommended - Requires Significant Changes)

**NOTE:** This would reverse the current consolidated schema and create a separate `localities` table with **many-to-one** relationship:

```python
# This would require going BACKWARDS from current design
class Locality(Base):
    id = Column(String(36), primary_key=True)
    country = Column(String(100))
    state_province = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    # ... other fields

class Specimen(Base):
    locality_id = Column(String(36), ForeignKey("localities.id"))
    locality = relationship("Locality")
    # Remove individual locality fields
```

**Required changes:**
1. Revert schema consolidation (undo recent changes)
2. Create new `localities` table
3. Migrate data back to separate table
4. Add locality deduplication logic in API
5. Update all API endpoints
6. Update frontend to handle nested locality structure

**Estimated effort:** 8-12 hours of development + testing

**Why this isn't recommended:**
- Adds complexity back after simplification
- Requires application-level deduplication
- Slower queries (requires joins)
- More code to maintain
- Only beneficial for 100,000+ specimen collections

## Recommendation

**For most use cases: Accept locality duplication**

**Reasons:**
1. **Storage is cheap** - Even 10,000 specimens = ~2 MB of locality data (flattened)
2. **Query performance** - No joins needed, faster queries
3. **Flexibility** - Each specimen can have unique locality details
4. **Simplicity** - Consolidated schema is easy to understand and maintain
5. **Data integrity** - No orphaned records or cascade delete complexities
6. **Already implemented** - The current schema uses this approach

**When to normalize:**
- You have 100,000+ specimens
- You frequently update locality information in bulk
- You need strict normalization for data integrity
- Storage is a critical constraint

## Using the Enhanced Migration Script

### 1. Configure the script

Edit `migrate_with_shared_localities.py`:

```python
# SOURCE DATABASE SETTINGS
SOURCE_HOST = "localhost"
SOURCE_DATABASE = "old_herbarium_db"
SOURCE_USER = "root"
SOURCE_PASSWORD = "password"
SOURCE_SPECIMEN_TABLE = "specimens"
SOURCE_LOCALITY_TABLE = "localities"
SOURCE_IMAGE_TABLE = "specimen_images"  # Optional
LOCALITY_FK_COLUMN = "locality_id"  # Column in specimens table that references locality
```

### 2. Run the migration

```bash
cd backend
python migrate_with_shared_localities.py
```

### 3. Review the output

The script will show:
- How many unique localities exist in source
- How many specimens share each locality
- Which localities are most commonly shared
- Migration progress with locality sharing info

### 4. Verify in the database

```sql
-- Check duplicated localities
SELECT
    locality_description,
    latitude,
    longitude,
    COUNT(*) as specimen_count
FROM localities l
JOIN specimens s ON s.id = l.specimen_id
GROUP BY locality_description, latitude, longitude
HAVING COUNT(*) > 1
ORDER BY specimen_count DESC;
```

Wait - this will show 1 per locality because of 1-to-1 constraint. Instead:

```sql
-- Find localities with same coordinates
SELECT
    latitude,
    longitude,
    COUNT(*) as count
FROM localities
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
GROUP BY latitude, longitude
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

This shows how many locality records have the same coordinates (i.e., were duplicated during migration).

## Summary

| Aspect | Current Behavior | Impact |
|--------|-----------------|---------|
| **Schema** | 1-to-1 Specimen:Locality | Each specimen has one locality |
| **Migration** | Creates new locality per specimen | Duplicates locality data from shared localities |
| **Storage** | Slightly higher | Acceptable for most use cases |
| **Query Speed** | Faster | No joins needed |
| **Flexibility** | High | Each specimen can have unique locality |
| **Recommended** | ✅ Yes | Unless you have 100,000+ specimens |

## Questions?

**Q: Will my specimens lose locality information?**
A: No! All locality data is preserved, just duplicated across specimens.

**Q: Can I deduplicate after migration?**
A: Not easily due to the unique constraint on specimen_id. You'd need to modify the schema.

**Q: Should I modify the backend schema?**
A: Only if you have very large collections (100,000+ specimens) or strict normalization requirements.

**Q: Does this affect functionality?**
A: No! The frontend works the same. Users won't notice any difference.
