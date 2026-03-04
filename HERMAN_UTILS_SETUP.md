# Herman Utils - Setup Guide

This guide shows you how to set up `herman_utils.py` for writing Python scripts that interact with your herbarium database with full audit logging, from anywhere on your system.

## What is Herman Utils?

`herman_utils.py` is a standalone helper utility that makes it easy to:

- ✅ Query and update database records from Python scripts
- ✅ Maintain full audit logging (all changes tracked with user attribution)
- ✅ Work from any directory on your system
- ✅ Preview changes with dry-run mode
- ✅ Handle bulk operations efficiently

## Setup Options

Choose the option that best fits your workflow:

### Option 1: Environment Variable (Recommended)

**Best for:** Regular scripting work, most convenient for day-to-day use

**Setup (one time):**

```bash
# Add to ~/.bashrc or ~/.zshrc (permanent)
echo 'export HERMAN_BACKEND="/home/rree/herman/backend"' >> ~/.bashrc
source ~/.bashrc

# Or set for current session only
export HERMAN_BACKEND="/home/rree/herman/backend"
```

**Usage:**

```python
#!/usr/bin/env python3
import sys
sys.path.insert(0, "/home/rree/herman/backend")

from herman_utils import audited_session
from models import Specimen

with audited_session(user_email="your@email.com") as db:
    specimens = db.query(Specimen).all()
```

✅ Clean imports
✅ Works from any directory
⚠️ Requires one-time shell configuration

---

### Option 2: Install as Package (Most Convenient)

**Best for:** Cleanest imports, professional setup

**Setup (one time):**

```bash
cd /home/rree/herman/backend
pip install -e .
```

**Usage:**

```python
#!/usr/bin/env python3
# No sys.path manipulation needed!

from backend.herman_utils import audited_session
from backend.models import Specimen

with audited_session(user_email="your@email.com") as db:
    specimens = db.query(Specimen).all()
```

✅ Cleanest imports
✅ Works from anywhere
✅ No environment variables needed
⚠️ Requires pip installation (editable mode)

---

### Option 3: Explicit Path (No Setup Required)

**Best for:** Ad-hoc scripts, sharing with others, minimal setup

**Setup:** None required!

**Usage:**

```python
#!/usr/bin/env python3
import sys
sys.path.insert(0, "/home/rree/herman/backend")

from herman_utils import audited_session

# Specify backend path explicitly
with audited_session(
    user_email="your@email.com",
    backend_path="/home/rree/herman/backend"
) as db:
    # Your code here
    pass
```

✅ No setup needed
✅ Self-contained scripts
✅ Easy to share
⚠️ Must specify path in every script

---

### Option 4: Standalone Copy

**Best for:** System-wide availability, copying to other machines

**Setup:**

```bash
# Copy herman_utils.py to a system location or personal scripts folder
cp /home/rree/herman/backend/herman_utils.py ~/bin/herman_utils.py

# Or make it available system-wide
sudo cp /home/rree/herman/backend/herman_utils.py /usr/local/lib/python3.*/site-packages/
```

**Usage:**

```python
#!/usr/bin/env python3
from herman_utils import audited_session

with audited_session(
    user_email="your@email.com",
    backend_path="/home/rree/herman/backend"
) as db:
    pass
```

✅ Available everywhere
✅ Can copy to other machines
⚠️ Need to update manually if herman_utils changes

---

## Quick Test

After setup, verify it works:

```bash
cd /home/rree/herman/scripts
python example_basic_usage.py
```

You should see:
```
✓ Connected to herman backend: /home/rree/herman/backend
👤 Running as: curator@museum.org
🔍 DRY RUN mode - changes will not be committed
...
```

## Find Your User Email

If you don't know your email in the database:

```python
import sys
sys.path.insert(0, "/home/rree/herman/backend")

from herman_utils import audited_session

# Use any existing user email to look up all users
with audited_session(user_email="admin@example.com") as db:
    users = db.query_users().all()
    print("Available users:")
    for u in users:
        print(f"  {u.id}: {u.email}")
```

Or check the database directly:

```bash
cd /home/rree/herman/backend
mysql -u ${DB_USER} -p ${DB_NAME} -e "SELECT id, email FROM users;"
```

## Basic Usage Examples

### Query Specimens

```python
with audited_session(user_email="your@email.com") as db:
    # Using query helpers (no imports needed)
    quercus = db.query_specimens(genus="Quercus").all()
    print(f"Found {len(quercus)} Quercus specimens")

    # Or use full SQLAlchemy query
    from models import Specimen
    specimens = db.query(Specimen).filter(
        Specimen.country == "United States"
    ).all()
```

### Update Data (with Audit Logging)

```python
with audited_session(
    user_email="your@email.com",
    description="Fix family names",
    dry_run=True  # Preview first!
) as db:
    specimens = db.query_specimens(genus="Quercus").all()

    for s in specimens:
        s.family = "Fagaceae"

    db.commit()
    # Automatically shows summary of changes
```

### Bulk Import

```python
from herman_utils import BulkAuditedOperation
import csv

with BulkAuditedOperation(
    user_email="your@email.com",
    operation_name="Import sequences",
    batch_size=100
) as op:
    with open("sequences.csv") as f:
        for row in csv.DictReader(f):
            from models import Sequence
            seq = Sequence(gene=row['gene'], seq=row['seq'], ...)
            op.add(seq)  # Batched commits for performance
```

## Example Scripts

See `/home/rree/herman/scripts/` for complete examples:

| Script | Description |
|--------|-------------|
| `example_basic_usage.py` | Basic query and update with audit logging |
| `example_query_helpers.py` | Using convenience query methods |
| `example_bulk_import.py` | Efficient bulk operations |
| `example_explicit_path.py` | Using explicit backend path |
| `example_system_user.py` | Automated scripts (cron jobs) |

## Key Features

### 1. Automatic Audit Logging

All changes are logged with:
- Who made the change (your email)
- When it happened
- What changed (old → new values)
- Which script made the change

```python
with audited_session(user_email="me@example.com") as db:
    specimen.genus = "Quercus"  # Logged to audit_logs table
    db.commit()
```

### 2. Dry-Run Mode

Preview changes before committing:

```python
with audited_session(user_email="me@example.com", dry_run=True) as db:
    # Make changes...
    db.commit()  # Actually rolls back
    # Shows what WOULD have changed
```

### 3. Change Summary

Automatically shows what was changed:

```
============================================================
CHANGES SUMMARY:
============================================================

➕ INSERT:
   specimens: 5

✏️ UPDATE:
   specimens: 12
   sequences: 3

============================================================
✓ All changes audited as user: curator@museum.org
============================================================
```

### 4. Query Helpers

No need to import models for simple queries:

```python
with audited_session(user_email="me@example.com") as db:
    specimens = db.query_specimens(genus="Quercus").all()
    sequences = db.query_sequences(gene="ITS").all()
    images = db.query_images().all()
```

### 5. Error Handling

Automatically cleans up on error:

```python
with audited_session(user_email="me@example.com") as db:
    specimen.genus = "Quercus"
    raise Exception("Oops!")  # Automatically rolls back
```

## Comparison: FastAPI vs SQLAlchemy + Herman Utils

| Feature | FastAPI HTTP Calls | Herman Utils (SQLAlchemy) |
|---------|-------------------|---------------------------|
| **Audit Logging** | ✅ Automatic | ✅ Automatic |
| **Performance** | 🐌 HTTP overhead | ⚡ Direct DB access |
| **Bulk Operations** | ❌ Slow | ✅ Efficient batching |
| **Complex Queries** | ⚠️ Limited | ✅ Full SQLAlchemy power |
| **Convenience** | ⚠️ API calls | ✅ Native Python |
| **Network Required** | ⚠️ Yes | ✅ No (local DB) |
| **Best For** | Remote access, web tools | Scripts, bulk operations |

## My Recommendation

**For most scripting work:** Use Option 1 (Environment Variable) or Option 2 (Install as Package)

This gives you:
- Clean imports
- Full audit logging
- Maximum convenience
- Works from any directory

**For sharing scripts or ad-hoc work:** Use Option 3 (Explicit Path)

This gives you:
- No setup required
- Self-contained scripts
- Easy to share with colleagues

## Next Steps

1. **Choose a setup option** and complete the one-time setup
2. **Find your user email** (see section above)
3. **Try the examples** in `/home/rree/herman/scripts/`
4. **Write your first script** (copy and modify an example)
5. **Review audit logs** to verify changes are being tracked

## Getting Help

- **Examples:** See `/home/rree/herman/scripts/README.md`
- **Full Documentation:** See `herman_utils.py` docstrings
- **Audit Logging:** See `backend/AUDIT_LOGGING.md`

## Summary

Herman Utils provides the best of both worlds:

✅ **Direct database access** (fast, efficient)
✅ **Full audit logging** (all changes tracked)
✅ **Work from anywhere** (any directory on your system)
✅ **Easy to use** (context managers, query helpers)
✅ **Safe** (dry-run mode, automatic rollback on errors)

You get the convenience and power of direct SQLAlchemy access while maintaining the audit trail that your FastAPI app provides.
