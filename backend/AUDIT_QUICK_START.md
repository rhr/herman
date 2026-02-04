# Audit Logging Quick Start Guide

## ✅ What Was Implemented

The audit logging system is now active and tracking all changes to:
- **Specimens** - create, update, delete
- **Users** - create, update, delete
- **Piles** - create, update, delete
- **Images** - create, update, delete
- **Annotations** - create, update, delete
- **Sequences** - create, update, delete

Every change captures:
- 👤 **Who** made the change (user ID and email)
- 📅 **When** it happened (timestamp)
- 🔄 **What** changed (operation type, old/new values)
- 🌐 **Where** it came from (IP address, user agent)

## 🚀 Quick Test

### 1. Start your API server
```bash
cd /home/rree/herman/backend
python main.py
# or
uvicorn main:app --reload
```

You should see:
```
🚀 Herbarium Pro API started successfully
📝 Audit logging enabled for: Specimen, User, Pile, Image, Annotation, Sequence
```

### 2. Make a test change

Create or update a specimen through your frontend or API, then query the audit logs:

```bash
# Get all recent audit logs
curl "http://localhost:8000/herman/api/audit-logs?page=1&page_size=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. View specific record history

```bash
# Replace 123 with an actual specimen ID
curl "http://localhost:8000/herman/api/audit-logs/record/specimens/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📊 Example Queries

### Get all changes today
```bash
curl "http://localhost:8000/herman/api/audit-logs?start_date=2026-02-04T00:00:00" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get all deletions
```bash
curl "http://localhost:8000/herman/api/audit-logs?operation=DELETE" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get changes by a specific user
```bash
# Replace 5 with actual user ID
curl "http://localhost:8000/herman/api/audit-logs?user_id=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get statistics
```bash
curl "http://localhost:8000/herman/api/audit-logs/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📝 Example Audit Log Entry

When you update a specimen, you'll see an entry like this:

```json
{
  "id": 1,
  "table_name": "specimens",
  "record_id": 123,
  "operation": "UPDATE",
  "user_id": 5,
  "user_email": "researcher@university.edu",
  "timestamp": "2026-02-04T15:30:45.123456",
  "old_values": {
    "id": 123,
    "scientific_name": "Quercus rubra",
    "family": "Fagaceae",
    "genus": "Quercus",
    "collector": "J. Smith",
    "updated_at": "2026-02-03T10:00:00"
  },
  "new_values": {
    "id": 123,
    "scientific_name": "Quercus alba",
    "family": "Fagaceae",
    "genus": "Quercus",
    "collector": "J. Smith",
    "updated_at": "2026-02-04T15:30:45"
  },
  "changed_fields": ["scientific_name", "updated_at"],
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0 (X11; Linux x86_64)..."
}
```

## 🔍 Common Use Cases

### 1. "What happened to specimen #456?"
```bash
curl "http://localhost:8000/herman/api/audit-logs/record/specimens/456" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. "Who deleted specimens yesterday?"
```bash
curl "http://localhost:8000/herman/api/audit-logs?operation=DELETE&table_name=specimens&start_date=2026-02-03T00:00:00&end_date=2026-02-03T23:59:59" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. "Show me everything user #7 changed this week"
```bash
curl "http://localhost:8000/herman/api/audit-logs?user_id=7&start_date=2026-01-29" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. "Recover deleted data"
The `old_values` field in DELETE operations contains the complete record before deletion:

```json
{
  "operation": "DELETE",
  "old_values": {
    "id": 789,
    "scientific_name": "Acer saccharum",
    "family": "Sapindaceae",
    "collector": "M. Johnson",
    "collection_date": "2025-06-15",
    // ... all other fields
  },
  "new_values": null
}
```

You can use these values to recreate the record if needed.

## 📁 Files Created/Modified

### New Files
- ✨ `backend/audit.py` - Audit logging utilities
- ✨ `backend/add_audit_logs_table.py` - Migration script
- ✨ `backend/AUDIT_LOGGING.md` - Complete documentation
- ✨ `backend/AUDIT_QUICK_START.md` - This file

### Modified Files
- 🔧 `backend/models.py` - Added AuditLog model
- 🔧 `backend/schemas.py` - Added AuditLogResponse and AuditLogListResponse
- 🔧 `backend/main.py` - Added audit endpoints and enabled tracking

## 🎯 Next Steps

### Optional: Add Frontend UI

You could create a React component to view audit logs in your frontend:

```jsx
// Example component structure
function AuditLogViewer({ specimenId }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch(`/herman/api/audit-logs/record/specimens/${specimenId}`)
      .then(res => res.json())
      .then(data => setLogs(data.history));
  }, [specimenId]);

  return (
    <div>
      <h3>Change History</h3>
      <Timeline>
        {logs.map(log => (
          <TimelineItem key={log.id}>
            <strong>{log.operation}</strong> by {log.user_email}
            <br/>
            <small>{new Date(log.timestamp).toLocaleString()}</small>
            {log.changed_fields && (
              <div>Changed: {log.changed_fields.join(', ')}</div>
            )}
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
}
```

### Optional: Data Retention

Set up automated cleanup of old audit logs:

```bash
# Add to crontab to run monthly
0 0 1 * * cd /home/rree/herman/backend && python cleanup_old_audit_logs.py
```

## ✅ Verification Checklist

- [x] Migration script run successfully
- [x] Python files compile without errors
- [ ] API server starts without errors
- [ ] Create/update/delete operations generate audit logs
- [ ] Can query audit logs via API endpoints
- [ ] Audit logs contain user information

## 🆘 Troubleshooting

**API won't start:**
- Check `main.py` for import errors
- Verify database connection is working

**No audit logs created:**
- Ensure you're using authenticated endpoints (requires JWT token)
- Check that operations are going through the ORM (not raw SQL)
- Verify the route uses `get_current_user_with_audit` dependency

**Missing user info in logs:**
- Make sure route has `request: Request` parameter
- Verify `get_current_user_with_audit` is being used

## 📚 Full Documentation

See `AUDIT_LOGGING.md` for complete documentation including:
- Architecture details
- All API endpoints with examples
- Performance considerations
- Data retention strategies
- Advanced use cases
