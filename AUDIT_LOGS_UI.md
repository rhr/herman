# Audit Logs Frontend UI

## 🎨 Implementation Summary

A complete frontend interface has been added to view and filter audit logs from the Herbarium Pro application.

## 📁 Files Created/Modified

### New Files
- ✨ `components/views/AuditLogsView.tsx` - Main audit logs view component

### Modified Files
- 🔧 `types.ts` - Added AuditLog, AuditLogListResponse, and AuditLogStats interfaces
- 🔧 `services/apiClient.ts` - Added getAuditLogs(), getRecordAuditHistory(), and getAuditStats() methods
- 🔧 `App.tsx` - Added /audit-logs route and navigation button in header

## 🚀 Features

### 1. **Filtering Controls**
- **Table Filter**: Dropdown to filter by table name (specimens, users, piles, images, annotations, sequences)
- **Operation Filter**: Filter by operation type (INSERT, UPDATE, DELETE)
- **User Email Filter**: Text input to filter by user email (case-insensitive search)
- **Date Range**: Start and end date/time pickers
- **Reset Button**: Clear all filters with one click

### 2. **Sorting**
- Click the "Timestamp" column header to toggle between ascending/descending sort
- Arrow indicator (↑/↓) shows current sort direction
- Defaults to newest first (descending)

### 3. **Data Display**
The table shows:
- **Table Name**: Which database table was affected
- **Record ID**: The ID of the affected record
- **Operation**: Color-coded badges (green=INSERT, blue=UPDATE, red=DELETE)
- **User**: Email and IP address of who made the change
- **Timestamp**: Formatted date/time of the change
- **Details**: Expandable row to see before/after values

### 4. **Expandable Details**
Click "Show" to expand a row and see:
- **INSERT**: Complete new record data
- **UPDATE**: Side-by-side comparison of before/after values for changed fields
- **DELETE**: Complete record data before deletion
- User agent information

### 5. **Pagination**
- 50 items per page
- Previous/Next buttons
- Page counter showing current page / total pages
- Result counter showing filtered count vs total

## 🎯 Access

**URL**: `/audit-logs`

**Navigation**: Click the document icon (📄) in the header next to the history button

## 📸 UI Components

### Filter Bar
```
┌─────────────────────────────────────────────────────────┐
│ Table: [All Tables ▼]  Operation: [All Operations ▼]   │
│ User Email: [Filter by email...]  Start: [datetime]    │
│ End: [datetime]                                         │
│ [Reset Filters] Showing 25 of 150 total logs           │
└─────────────────────────────────────────────────────────┘
```

### Table View
```
┌──────────┬──────────┬───────────┬───────────────┬──────────────┬─────────┐
│ Table    │ Record ID│ Operation │ User          │ Timestamp ↓  │ Details │
├──────────┼──────────┼───────────┼───────────────┼──────────────┼─────────┤
│ specimens│ 123      │ [UPDATE]  │ user@email.com│ Feb 4, 15:30 │ [Show]  │
│          │          │           │ 192.168.1.100 │              │         │
├──────────┼──────────┼───────────┼───────────────┼──────────────┼─────────┤
│ piles    │ 45       │ [INSERT]  │ admin@site.com│ Feb 4, 14:22 │ [Show]  │
└──────────┴──────────┴───────────┴───────────────┴──────────────┴─────────┘
```

### Expanded Row (UPDATE)
```
┌─────────────────────────────────────────────────────────────────┐
│ Changed Fields: scientific_name, family                         │
│ ┌──────────────────────┬──────────────────────┐               │
│ │ Before:              │ After:               │               │
│ │ {                    │ {                    │               │
│ │   "scientific_name": │   "scientific_name": │               │
│ │     "Quercus rubra", │     "Quercus alba",  │               │
│ │   "family":          │   "family":          │               │
│ │     "Fagaceae"       │     "Fagaceae"       │               │
│ │ }                    │ }                    │               │
│ └──────────────────────┴──────────────────────┘               │
│ User Agent: Mozilla/5.0...                                     │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Common Use Cases

### 1. View Recent Activity
- Load the audit logs page (defaults to newest first)
- No filters needed - see all recent changes across all tables

### 2. Track Changes to a Specific Specimen
- Set Table filter to "Specimens"
- Enter the specimen ID in the search or scroll to find it
- Click "Show" to see detailed change history

### 3. Investigate Deletions
- Set Operation filter to "Delete (DELETE)"
- Optionally set date range to narrow down
- Click "Show" on any row to see what was deleted

### 4. Monitor User Activity
- Enter user's email in the "User Email" filter
- See all changes made by that user
- Can combine with date range to see activity in a specific period

### 5. Review Recent Changes
- Set Start Date to "today" or "yesterday"
- Leave other filters empty
- See all activity in that timeframe

## 🎨 Color Coding

- **Green** (INSERT): New records created
- **Blue** (UPDATE): Existing records modified
- **Red** (DELETE): Records deleted
- **Gray**: Table header and secondary text

## ⚡ Performance

- **Client-side filtering** for user email (fast, no API calls)
- **Server-side filtering** for table, operation, and date range (efficient)
- **Pagination** limits data transfer to 50 records per page
- **Expandable rows** avoid loading large JSON payloads upfront

## 🔧 Technical Details

### State Management
- React hooks (useState, useEffect)
- URL parameters not used (different from main gallery view)
- Local component state for filters and pagination

### API Integration
- Uses `apiClient.getAuditLogs()` with query parameters
- Automatic retry on error
- Loading states for better UX

### TypeScript Types
All data structures are fully typed:
```typescript
interface AuditLog {
  id: number;
  table_name: string;
  record_id: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id: number | null;
  user_email: string | null;
  timestamp: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
}
```

## 🚀 Next Steps (Optional Enhancements)

### 1. Export to CSV
Add a button to export filtered audit logs to CSV file:
```typescript
const exportToCSV = () => {
  const csv = logs.map(log => ({
    table: log.table_name,
    record_id: log.record_id,
    operation: log.operation,
    user: log.user_email,
    timestamp: log.timestamp,
    changed_fields: log.changed_fields?.join(', '),
  }));
  // Download CSV...
};
```

### 2. Direct Links to Records
Add clickable links on Record ID to navigate to the actual record:
```typescript
<Link to={`/specimen/${log.record_id}`}>
  {log.record_id}
</Link>
```

### 3. Real-time Updates
Use WebSocket or polling to show new audit logs in real-time:
```typescript
useEffect(() => {
  const interval = setInterval(loadAuditLogs, 10000); // Refresh every 10s
  return () => clearInterval(interval);
}, []);
```

### 4. Statistics Dashboard
Add a stats panel showing:
- Total operations today
- Most active users
- Most modified tables
- Operation breakdown (pie chart)

### 5. Advanced Search
Add full-text search across old_values and new_values JSON fields.

## ✅ Testing Checklist

- [ ] Navigate to /audit-logs and page loads without errors
- [ ] Table shows audit log entries
- [ ] Filters work correctly (table, operation, user, date range)
- [ ] Sorting toggles between asc/desc
- [ ] Pagination works (previous/next buttons)
- [ ] Expandable rows show/hide details correctly
- [ ] Color coding is correct for each operation type
- [ ] Reset filters button clears all filters
- [ ] No TypeScript errors in console
- [ ] Responsive on mobile devices

## 📚 Related Documentation

- Backend API: `/home/rree/herman/backend/AUDIT_LOGGING.md`
- Quick Start: `/home/rree/herman/backend/AUDIT_QUICK_START.md`
- API Client: `/home/rree/herman/services/apiClient.ts`
- Types: `/home/rree/herman/types.ts`
