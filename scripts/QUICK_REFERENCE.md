# Herman Utils - Quick Reference

## Basic Template

```python
#!/usr/bin/env python3
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
# Or if HERMAN_BACKEND is set: sys.path.insert(0, os.getenv("HERMAN_BACKEND"))

from herman_utils import audited_session
from models import Specimen, Sequence

with audited_session(
    user_email="your@email.com",
    description="What this script does",
    dry_run=True  # Set False to commit
) as db:
    # Your code here
    pass
```

## Common Patterns

### Query Data

```python
# Query helpers (no import needed)
specimens = db.query_specimens(genus="Quercus").all()
sequences = db.query_sequences(gene="ITS").all()

# Full SQLAlchemy
from models import Specimen
specimens = db.query(Specimen).filter(
    Specimen.genus == "Quercus",
    Specimen.family == "Fagaceae"
).order_by(Specimen.code).all()
```

### Update Records

```python
specimens = db.query_specimens(genus="Quercus").all()
for s in specimens:
    s.family = "Fagaceae"
db.commit()  # Auto-audited
```

### Create Records

```python
from models import Specimen

specimen = Specimen(
    code="ABC123",
    scientific_name="Quercus alba",
    family="Fagaceae"
)
db.add(specimen)
db.commit()  # Auto-audited
```

### Delete Records

```python
specimen = db.query_specimens(code="ABC123").first()
db.delete(specimen)
db.commit()  # Auto-audited with old values
```

### Bulk Import

```python
from herman_utils import BulkAuditedOperation

with BulkAuditedOperation(
    user_email="me@example.com",
    operation_name="Import CSV",
    batch_size=100
) as op:
    for row in csv_data:
        record = Model(...)
        op.add(record)
```

## Parameters

### audited_session()

```python
with audited_session(
    user_email="me@example.com",      # Required (or user_id)
    backend_path="/path/to/backend",   # Optional (auto-detected)
    dry_run=True,                      # Optional (default: False)
    description="What you're doing",   # Optional (recommended)
    system_user=True,                  # Optional (for cron jobs)
    verbose=True                       # Optional (default: True)
) as db:
    pass
```

## Query Helpers

```python
db.query_specimens(genus="Quercus", family=None)
db.query_sequences(gene="ITS", specimen_id=123)
db.query_images(specimen_id=456)
db.query_piles(name="Unidentified")
db.query_users(email="me@example.com")
```

## Setup Options

### Option 1: Environment Variable
```bash
export HERMAN_BACKEND="/home/rree/herman/backend"
```

### Option 2: Install Package
```bash
cd /home/rree/herman/backend
pip install -e .
```

### Option 3: Explicit Path
```python
with audited_session(
    backend_path="/home/rree/herman/backend",
    ...
) as db:
    pass
```

## Common Tasks

### Find Your User Email
```python
with audited_session(user_email="admin@example.com") as db:
    users = db.query_users().all()
    for u in users:
        print(f"{u.id}: {u.email}")
```

### Preview Changes (Dry Run)
```python
with audited_session(user_email="me@example.com", dry_run=True) as db:
    # Make changes...
    db.commit()  # Won't actually commit
```

### Complex Query
```python
from models import Specimen
from sqlalchemy import and_, or_

specimens = db.query(Specimen).filter(
    and_(
        Specimen.genus == "Quercus",
        or_(
            Specimen.country == "USA",
            Specimen.country == "Canada"
        )
    )
).all()
```

### Join Query
```python
from models import Specimen, Sequence

results = db.query(Specimen, Sequence).join(
    Sequence, Specimen.id == Sequence.specimen_id
).filter(
    Sequence.gene == "ITS"
).all()

for specimen, sequence in results:
    print(f"{specimen.code}: {sequence.seq}")
```

## Troubleshooting

### "Backend not found"
```python
# Solution: Set HERMAN_BACKEND or use explicit path
with audited_session(backend_path="/full/path/to/backend") as db:
    pass
```

### "User not found"
```python
# Solution: Check available users first
with audited_session(user_email="any_existing_user@example.com") as db:
    print([u.email for u in db.query_users().all()])
```

### "Module not found"
```python
# Solution: Add backend to sys.path
import sys
sys.path.insert(0, "/home/rree/herman/backend")
```

## Tips

1. **Always dry-run first**: `dry_run=True`
2. **Use descriptions**: `description="Fix typos in family names"`
3. **Query helpers for simple queries**: `db.query_specimens()`
4. **Bulk ops for large imports**: `BulkAuditedOperation`
5. **System user for cron**: `system_user=True`

## Output Example

```
✓ Connected to herman backend: /home/rree/herman/backend
👤 Running as: curator@museum.org
📝 Operation: Fix family names

Found 42 specimens to update

============================================================
CHANGES SUMMARY:
============================================================

✏️ UPDATE:
   specimens: 42

============================================================
✓ All changes audited as user: curator@museum.org
============================================================
```

## More Info

- Full setup guide: `/home/rree/herman/HERMAN_UTILS_SETUP.md`
- Example scripts: `/home/rree/herman/scripts/`
- Audit logging docs: `/home/rree/herman/backend/AUDIT_LOGGING.md`
