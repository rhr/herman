# Shared Access Changes

All authenticated users can now view, edit, and manage all specimens, images, annotations, piles, and sequences in the system.

## What Changed

### Backend (`backend/main.py`)

Removed user ownership restrictions (`Specimen.user_id == current_user.id`) from all endpoints. Now any authenticated user can:

#### Specimen Operations
- ✅ **View all specimens** - `GET /api/specimens`
- ✅ **View specimen details** - `GET /api/specimens/{id}`
- ✅ **View by code** - `GET /api/specimens/code/{code}`
- ✅ **Create specimens** - `POST /api/specimens` (already worked)
- ✅ **Update any specimen** - `PUT /api/specimens/{id}`
- ✅ **Delete any specimen** - `DELETE /api/specimens/{id}`

#### Image Operations
- ✅ **Set primary image** - `PUT /api/images/{id}/set-primary`
- ✅ **Update caption** - `PUT /api/images/{id}/caption`
- ✅ **Delete images** - `DELETE /api/images/{id}`

#### Annotation Operations
- ✅ **Add annotations to any specimen** - `POST /api/specimens/{id}/annotations`
- ✅ **Delete any annotation** - `DELETE /api/annotations/{id}`

#### Pile Operations
- ✅ **View all piles** - `GET /api/piles`
- ✅ **Create piles** - `POST /api/piles` (already worked)
- ✅ **Update any pile** - `PUT /api/piles/{id}`
- ✅ **Delete any pile** - `DELETE /api/piles/{id}`
- ✅ **Add specimens to any pile** - `POST /api/piles/{pile_id}/specimens/{specimen_id}`
- ✅ **Remove specimens from any pile** - `DELETE /api/piles/{pile_id}/specimens/{specimen_id}`

#### Sequence Operations
- ✅ **View sequences** - `GET /api/specimens/{id}/sequences`
- ✅ **Get sequence details** - `GET /api/sequences/{id}`
- ✅ **Create sequences** - `POST /api/specimens/{id}/sequences`
- ✅ **Update sequences** - `PUT /api/sequences/{id}`
- ✅ **Delete sequences** - `DELETE /api/sequences/{id}`

## What Stayed the Same

### Still Tracked for Audit
User IDs are still recorded when creating/modifying data for audit trail purposes:
- `Specimen.user_id` - Who created the specimen
- `Annotation.user_id` - Who created the annotation
- `Pile.user_id` - Who created the pile
- Audit logs track all modifications with user context

### Admin-Only Operations
These operations still require admin privileges:
- ❌ Create invitations - `POST /api/invitations`
- ❌ List invitations - `GET /api/invitations`
- ❌ Revoke invitations - `DELETE /api/invitations/{id}`
- ❌ Resend invitations - `POST /api/invitations/{id}/resend`
- ❌ View audit logs - `GET /api/audit-logs` (check if admin-only)

## Security Model

### Before (Multi-Tenancy)
- Each user could only see/edit their own data
- Strong data isolation between users
- Good for independent research groups

### After (Shared Collaboration)
- All authenticated users can see/edit all data
- Collaborative environment
- Better for single team/lab environment
- Audit logs track who did what

## Benefits

✅ **Better Collaboration** - Team members can help each other with data entry and corrections

✅ **No Barriers** - Users don't need to request access or ownership transfers

✅ **Audit Trail Maintained** - All changes still tracked with user info

✅ **Flexible Workflow** - Any team member can pick up where another left off

## Use Cases Now Enabled

1. **Peer Review** - Team members can review and correct each other's specimen records

2. **Shared Curation** - Multiple curators can work on the same collection

3. **Quality Control** - Senior staff can edit entries made by junior staff

4. **Data Cleanup** - Anyone can fix typos or add missing information

5. **Collaborative Annotations** - Multiple researchers can annotate the same specimens

## Migration Notes

### No Database Changes Required
- User IDs still exist in database
- No data migration needed
- Only API logic changed

### Backward Compatible
- Existing data unchanged
- Frontend already supports this model
- Just restart the backend API

## Testing

After deploying, verify:

1. **Non-admin users can view all specimens**
   ```bash
   # Login as non-admin user
   # Navigate to main page
   # Should see all specimens from all users
   ```

2. **Non-admin users can edit any specimen**
   ```bash
   # Login as non-admin user
   # Click on any specimen
   # Click Edit
   # Make changes and save
   # Should succeed
   ```

3. **Non-admin users can add annotations**
   ```bash
   # Login as non-admin user
   # View any specimen
   # Add an annotation
   # Should succeed
   ```

4. **Audit logs track changes**
   ```bash
   # Login as admin
   # View audit logs
   # Should see all user actions with correct user_id
   ```

5. **Admin-only features still restricted**
   ```bash
   # Login as non-admin user
   # Try to access invitation management
   # Should get 403 Forbidden
   ```

## Deployment

```bash
# On the server
cd /var/www/labnotes/backend

# Restart the API service
sudo systemctl restart labnotes-api

# Check status
sudo systemctl status labnotes-api

# View logs
sudo journalctl -u labnotes-api -f
```

## Reverting (If Needed)

If you need to revert to the multi-tenancy model:

1. Restore `backend/main.py` from git:
   ```bash
   git diff backend/main.py  # Review changes
   git checkout HEAD -- backend/main.py
   ```

2. Restart backend:
   ```bash
   sudo systemctl restart labnotes-api
   ```

## Summary

The application now operates as a fully collaborative system where all authenticated users have equal access to view and modify all data. User attribution is maintained through audit logs, but there are no access restrictions between users.

This is ideal for:
- Small to medium research labs
- Collaborative herbarium projects
- Single-institution collections
- Teams where trust and collaboration are paramount

**Important:** Only admin users can create invitations, so you still control who has access to the system overall.
