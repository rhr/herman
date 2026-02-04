# Audit Logging System

This document describes the audit logging system implemented in Herbarium Pro.

## Overview

The audit logging system automatically tracks all database changes (CREATE, UPDATE, DELETE operations) for key models. Every change is logged with:
- What changed (table name, record ID, operation type)
- Who made the change (user ID and email)
- When it happened (timestamp)
- What the values were before and after
- Request metadata (IP address, user agent)

## Architecture

### Components

1. **AuditLog Model** (`models.py`)
   - Database table that stores all audit entries
   - Fields: id, table_name, record_id, operation, user_id, user_email, timestamp, old_values, new_values, changed_fields, ip_address, user_agent

2. **Audit Utilities** (`audit.py`)
   - `set_audit_context()`: Sets user and request info for current request
   - `register_audit_listeners()`: Registers SQLAlchemy event listeners for a model
   - `create_audit_log()`: Creates audit log entries
   - Event listeners: `after_insert`, `after_update`, `after_delete`

3. **FastAPI Integration** (`main.py`)
   - `get_current_user_with_audit()`: Dependency that sets audit context
   - Audit query endpoints: `/api/audit-logs`, `/api/audit-logs/record/{table}/{id}`, `/api/audit-logs/stats`
   - All modification routes use the audit-enabled dependency

### Tracked Models

- Specimen
- User
- Pile
- Image
- Annotation
- Sequence

## Setup

### Initial Setup (New Database)

If you're starting fresh, the audit_logs table will be created automatically on startup.

### Migration (Existing Database)

If you already have a database, run the migration script:

```bash
cd backend
python add_audit_logs_table.py
```

This creates the `audit_logs` table without affecting existing data.

## API Endpoints

### 1. Query Audit Logs

**GET** `/api/audit-logs`

Query audit logs with flexible filtering.

**Query Parameters:**
- `table_name` (optional): Filter by table (e.g., "specimens", "users")
- `record_id` (optional): Filter by specific record ID
- `operation` (optional): Filter by operation type ("INSERT", "UPDATE", "DELETE")
- `user_id` (optional): Filter by user who made changes
- `start_date` (optional): Filter by start date (ISO format)
- `end_date` (optional): Filter by end date (ISO format)
- `page` (default: 1): Page number
- `page_size` (default: 50, max: 200): Items per page

**Example:**
```bash
# Get all changes to specimen #123
curl "http://localhost:8000/api/audit-logs?table_name=specimens&record_id=123"

# Get all deletions in the past week
curl "http://localhost:8000/api/audit-logs?operation=DELETE&start_date=2026-01-28"

# Get all changes by a specific user
curl "http://localhost:8000/api/audit-logs?user_id=5"
```

**Response:**
```json
{
  "logs": [
    {
      "id": 1523,
      "table_name": "specimens",
      "record_id": 123,
      "operation": "UPDATE",
      "user_id": 5,
      "user_email": "researcher@university.edu",
      "timestamp": "2026-02-04T14:32:15",
      "old_values": {
        "scientific_name": "Quercus rubra",
        "family": "Fagaceae"
      },
      "new_values": {
        "scientific_name": "Quercus alba",
        "family": "Fagaceae"
      },
      "changed_fields": ["scientific_name"],
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0..."
    }
  ],
  "total": 45,
  "page": 1,
  "page_size": 50,
  "has_next": false,
  "has_prev": false
}
```

### 2. Get Record History

**GET** `/api/audit-logs/record/{table_name}/{record_id}`

Get complete change history for a specific record.

**Example:**
```bash
curl "http://localhost:8000/api/audit-logs/record/specimens/123"
```

**Response:**
```json
{
  "table_name": "specimens",
  "record_id": 123,
  "total_changes": 8,
  "history": [
    {
      "id": 892,
      "operation": "INSERT",
      "timestamp": "2026-01-15T09:12:45",
      "user_email": "curator@museum.org",
      "new_values": {...}
    },
    {
      "id": 1203,
      "operation": "UPDATE",
      "timestamp": "2026-01-20T11:30:22",
      "user_email": "researcher@university.edu",
      "changed_fields": ["scientific_name"],
      "old_values": {...},
      "new_values": {...}
    }
  ]
}
```

### 3. Get Audit Statistics

**GET** `/api/audit-logs/stats`

Get audit log statistics and summary.

**Query Parameters:**
- `start_date` (optional): Start date for stats
- `end_date` (optional): End date for stats

**Example:**
```bash
curl "http://localhost:8000/api/audit-logs/stats?start_date=2026-02-01"
```

**Response:**
```json
{
  "total_logs": 1523,
  "by_operation": {
    "INSERT": 450,
    "UPDATE": 892,
    "DELETE": 181
  },
  "by_table": {
    "specimens": 1200,
    "images": 200,
    "annotations": 100,
    "piles": 23
  },
  "top_users": [
    {"email": "researcher@university.edu", "count": 892},
    {"email": "curator@museum.org", "count": 631}
  ],
  "date_range": {
    "start": "2026-02-01T00:00:00",
    "end": null
  }
}
```

## Use Cases

### 1. View Change History for a Specimen

See who created a specimen, what changes were made, and when:

```bash
curl "http://localhost:8000/api/audit-logs/record/specimens/456" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Investigate Accidental Deletions

Find all records deleted by a user in the past day:

```bash
curl "http://localhost:8000/api/audit-logs?operation=DELETE&user_id=7&start_date=2026-02-03" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The `old_values` field contains the complete state before deletion, enabling data recovery.

### 3. Track User Activity

See everything a user has done:

```bash
curl "http://localhost:8000/api/audit-logs?user_id=7&page=1&page_size=100" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Monitor System Activity

Get daily activity summary:

```bash
curl "http://localhost:8000/api/audit-logs/stats?start_date=2026-02-04T00:00:00&end_date=2026-02-04T23:59:59" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Compliance Reporting

Generate audit reports for regulatory compliance by exporting audit logs filtered by date range and operation type.

## Data Retention

The audit_logs table can grow large over time. Consider implementing a retention policy:

### Manual Cleanup

```sql
-- Delete audit logs older than 1 year
DELETE FROM audit_logs
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### Automated Cleanup Script

Create a cron job to run periodic cleanup:

```python
# cleanup_old_audit_logs.py
from datetime import datetime, timedelta
from database import SessionLocal
from models import AuditLog

def cleanup_old_audit_logs(days_to_keep=365):
    db = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        deleted = db.query(AuditLog)\
                   .filter(AuditLog.timestamp < cutoff_date)\
                   .delete()
        db.commit()
        print(f"Deleted {deleted} audit log entries older than {days_to_keep} days")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_old_audit_logs(365)  # Keep 1 year of logs
```

## Performance Considerations

### Storage Overhead

- Each operation generates one audit log entry
- JSON fields (old_values, new_values) can be large for records with many fields
- Estimated storage: ~1-5 KB per audit entry

### Query Performance

The audit_logs table has indexes on:
- `table_name, record_id` (composite)
- `user_id, timestamp` (composite)
- `operation, timestamp` (composite)
- `timestamp` (standalone)

These indexes ensure fast queries for common use cases.

### Write Performance

- Audit logging adds minimal overhead (~5-10ms per operation)
- Runs within the same transaction as the main operation
- Failures in audit logging don't affect the main operation

## Limitations

### What is NOT Audited

- Read operations (SELECT queries)
- Changes made via raw SQL (bypassing SQLAlchemy ORM)
- Bulk operations using `session.bulk_*` methods
- Changes to the pile_specimens association table (many-to-many relationship)

### Association Tables

The `pile_specimens` table (many-to-many between Piles and Specimens) is not directly audited. However, changes are indirectly tracked through the Pile operations that modify specimen associations.

## Troubleshooting

### Audit logs not being created

1. Check that the model is registered in `main.py`:
   ```python
   register_audit_listeners(YourModel)
   ```

2. Verify the route uses the audit-enabled dependency:
   ```python
   current_user: User = Depends(get_current_user_with_audit)
   ```

### Missing user information in audit logs

Ensure routes that modify data include the `Request` parameter:
```python
async def your_route(
    request: Request,
    current_user: User = Depends(get_current_user_with_audit),
    ...
):
```

### Performance issues

If audit logging causes slowdowns:
1. Archive old audit logs to a separate table
2. Consider async logging (requires additional setup)
3. Reduce the number of tracked fields by customizing `get_object_state()`

## Future Enhancements

Potential improvements:
- Archive old audit logs to cold storage
- Export audit logs to external systems (e.g., Elasticsearch)
- Add UI for viewing audit logs
- Implement audit log search/filtering in frontend
- Add webhook notifications for specific events
- Support for custom audit rules per model
