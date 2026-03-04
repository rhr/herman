# Herman Utils - Script Examples

This directory contains example scripts showing how to use `herman_utils.py` to interact with the Herman herbarium database from anywhere on your system with full audit logging.

## Quick Start

### Option 1: Environment Variable (Recommended)

Set the `HERMAN_BACKEND` environment variable once:

```bash
# Add to ~/.bashrc or ~/.zshrc
export HERMAN_BACKEND="/home/rree/herman/backend"

# Or set for current session only
export HERMAN_BACKEND="/home/rree/herman/backend"
```

Then use from any directory:

```python
from herman_utils import audited_session
from models import Specimen

with audited_session(user_email="your@email.com") as db:
    specimens = db.query(Specimen).all()
```

### Option 2: Explicit Path

Specify backend path in your script:

```python
from herman_utils import audited_session

with audited_session(
    user_email="your@email.com",
    backend_path="/home/rree/herman/backend"
) as db:
    # Your code here
    pass
```

### Option 3: Install as Package

Install backend as a Python package (one-time setup):

```bash
cd /home/rree/herman/backend
pip install -e .
```

Then import from anywhere:

```python
from backend.herman_utils import audited_session
from backend.models import Specimen
```

## Example Scripts

### 1. `example_basic_usage.py`
Basic example showing how to query and update specimens with audit logging.

```bash
cd /home/rree/herman/scripts
python example_basic_usage.py
```

**Features:**
- User lookup by email
- Dry-run mode
- Automatic change summary
- Audit logging

### 2. `example_query_helpers.py`
Shows convenience query methods that don't require importing models.

```bash
python example_query_helpers.py
```

**Query helpers:**
- `db.query_specimens(genus="Quercus")`
- `db.query_sequences(gene="ITS")`
- `db.query_images(...)`
- `db.query_piles(...)`
- `db.query_users(...)`

### 3. `example_bulk_import.py`
Demonstrates bulk operations with batched commits for performance.

```bash
python example_bulk_import.py
```

**Features:**
- Automatic batching (commit every N records)
- Progress tracking
- Efficient for large datasets

### 4. `example_explicit_path.py`
Shows how to use an explicit backend path (no environment setup needed).

```bash
python example_explicit_path.py
```

### 5. `example_system_user.py`
For automated scripts (cron jobs, system maintenance).

```bash
python example_system_user.py
```

**Features:**
- System user attribution
- Useful for automated/scheduled tasks

## Common Patterns

### Query Data

```python
with audited_session(user_email="your@email.com") as db:
    # Simple query
    specimens = db.query_specimens(genus="Quercus").all()

    # Complex query
    from models import Specimen
    specimens = db.query(Specimen).filter(
        Specimen.genus == "Quercus",
        Specimen.country == "United States"
    ).all()
```

### Update Data

```python
with audited_session(
    user_email="your@email.com",
    description="Update family names"
) as db:
    specimens = db.query_specimens(genus="Quercus").all()

    for specimen in specimens:
        specimen.family = "Fagaceae"

    db.commit()  # Automatically audited
```

### Dry Run (Preview Changes)

```python
with audited_session(
    user_email="your@email.com",
    dry_run=True  # Changes won't be committed
) as db:
    # Make changes...
    db.commit()  # Will rollback instead
```

### Bulk Import

```python
from herman_utils import BulkAuditedOperation

with BulkAuditedOperation(
    user_email="your@email.com",
    operation_name="Import sequences",
    batch_size=100
) as op:
    for record in data:
        sequence = Sequence(...)
        op.add(sequence)  # Automatically batches commits
```

### System User (Automated Scripts)

```python
with audited_session(
    system_user=True,
    description="Nightly cleanup job"
) as db:
    # Automated operations
    db.commit()
```

## Parameters

### `audited_session()`

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_email` | str | Your email (looked up in users table) |
| `user_id` | int | Alternative to email (if you know your user ID) |
| `backend_path` | str | Explicit path to backend directory |
| `dry_run` | bool | If True, changes are not committed |
| `system_user` | bool | If True, use system user for automated ops |
| `description` | str | Description of operation (shown in audit logs) |
| `verbose` | bool | If True, print progress and summary |

### `BulkAuditedOperation()`

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_email` | str | Your email |
| `user_id` | int | Alternative to email |
| `backend_path` | str | Explicit path to backend directory |
| `operation_name` | str | Name of bulk operation |
| `batch_size` | int | Records to commit per batch (default: 100) |
| `verbose` | bool | Show progress |

## Tips

1. **Always use dry_run first** when updating data:
   ```python
   dry_run=True  # Preview changes
   dry_run=False  # Actually commit
   ```

2. **Provide meaningful descriptions**:
   ```python
   description="Fix typo in family name for Quercus specimens"
   ```

3. **Use query helpers for simple queries**:
   ```python
   # Instead of importing models
   db.query_specimens(genus="Quercus")
   ```

4. **Use BulkAuditedOperation for large imports**:
   ```python
   # More efficient than committing each record
   with BulkAuditedOperation(..., batch_size=100) as op:
       for record in many_records:
           op.add(record)
   ```

5. **Check your user email first**:
   ```python
   with audited_session(user_email="check@email.com") as db:
       users = db.query_users().all()
       print([u.email for u in users])
   ```

## Troubleshooting

### "Backend not found"

**Solution:** Set `HERMAN_BACKEND` environment variable or use `backend_path` parameter:

```python
with audited_session(
    user_email="your@email.com",
    backend_path="/home/rree/herman/backend"
) as db:
    pass
```

### "User not found"

**Solution:** Check your email is in the database:

```python
with audited_session(user_email="admin@example.com") as db:
    users = db.query_users().all()
    print("Available users:", [u.email for u in users])
```

Then update your script with the correct email.

### "Module not found"

**Solution:** Make sure herman_utils is in your Python path:

```python
import sys
from pathlib import Path

sys.path.insert(0, "/home/rree/herman/backend")
from herman_utils import audited_session
```

## How It Works

The `herman_utils` module:

1. **Finds backend directory** using:
   - `HERMAN_BACKEND` environment variable
   - Explicit `backend_path` parameter
   - Searching upward from current directory
   - Common locations

2. **Loads environment** from backend's `.env` file

3. **Sets up audit context** with your user info

4. **Captures metadata** about the script and operation

5. **Tracks changes** made during the session

6. **Prints summary** when done

All changes are automatically logged to the `audit_logs` table with:
- Who made the change (your email)
- When it happened (timestamp)
- What changed (old and new values)
- Which script made the change (user_agent)

## Next Steps

1. **Try the examples**: Run the example scripts to see how they work

2. **Create your own scripts**: Copy an example and modify it for your needs

3. **Set up environment**: Add `HERMAN_BACKEND` to your shell profile for convenience

4. **Review audit logs**: Check `/api/audit-logs` to see your changes being tracked

## Questions?

See `herman_utils.py` for full documentation and implementation details.
