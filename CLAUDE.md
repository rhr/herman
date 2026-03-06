# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Herman** is a digital herbarium management system for botanical specimen collections. It consists of:
- A **React/TypeScript frontend** (Vite, port 3000)
- A **Python FastAPI backend** (port 8000) with MySQL database

## Development Commands

### Frontend
```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
```

### Backend
```bash
# Activate the conda environment first:
conda activate herman

# Run dev server with auto-reload:
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or:
python3 main.py
```

### Environment Setup
- Frontend: copy `.env.example` to `.env.local`, set `VITE_API_URL` and `GEMINI_API_KEY`
- Backend: create `backend/.env` with DB credentials and JWT secret (see `backend/README.md`)
- Backend conda env defined in `backend/environment.yml`

### Database
```bash
# Initialize tables:
python3 -c "from database import create_tables; create_tables()"

# MySQL setup:
mysql -u root -p < backend/setup_database.sql
```

## Architecture

### Backend (`backend/`)
- `main.py` — FastAPI app, all route handlers. The app is mounted at `root_path="/herman"` for reverse proxy compatibility.
- `models.py` — SQLAlchemy ORM models: `User`, `Specimen`, `Image`, `Pile`, `Annotation`, `Taxon`, `Sequence`, `AuditLog`, `Invitation`
- `schemas.py` — Pydantic request/response schemas
- `database.py` — MySQL engine/session via `mysql+mysqlconnector`
- `auth.py` — JWT authentication using `python-jose`, bcrypt password hashing. `get_current_user` is a FastAPI dependency.
- `storage.py` — Local file storage for specimen images; stored under `uploads/specimens/{specimen_id}/`
- `audit.py` — SQLAlchemy event listeners that automatically log INSERT/UPDATE/DELETE to `audit_logs` table using a `ContextVar` for per-request user context
- `herman_utils.py` — Standalone helper for writing database scripts with audit logging; use `audited_session(user_email=...)` context manager

**Registration is invite-only**: users need an invitation token from an admin to register.

**WCVP taxonomy**: the `taxa` table stores World Checklist of Vascular Plants data for autocomplete when entering specimen scientific names, families, and genera.

### Frontend (root)
- `App.tsx` — Main app with React Router, URL-driven state (search, sort, pagination, pile filter, layout)
- `index.tsx` — Entry point, wraps with `BrowserRouter`
- `services/apiClient.ts` — Single `ApiClient` class wrapping all backend API calls. Handles snake_case→camelCase transformation.
- `services/databaseService.ts` — Higher-level service layer over apiClient
- `services/geminiService.ts` — Google Gemini AI integration
- `components/views/` — Page-level views (AddSpecimenView, EditSpecimenView, SpecimenDetailView, GalleryView, AuditLogsView, RegisterView)
- `components/` — Reusable components (SpecimenForm, SpecimenTable, MapView, PileSidebar, Autocomplete, etc.)
- `types.ts` — Shared TypeScript type definitions

### Key Data Model Notes
- Specimens have a `code` field (short unique identifier, legacy) and a BigInt `id` (primary key)
- Locality data is stored flat on the `Specimen` model (country, state_province, county_city, locality_description, latitude/longitude as verbatim strings, `latdd`/`londd` as parsed decimal degrees)
- **Piles** are user-defined groupings of specimens (many-to-many via `pile_specimens`)
- The API performs server-side pagination, search, and sorting for specimens

### API Base URL
Frontend reads `VITE_API_URL` env var (default: `http://localhost:8000/api`). Auth token stored in `localStorage` as `authToken`.

## Utility Scripts

The `backend/` directory contains many utility scripts for data management:
- `import_wcvp.py` — Import WCVP taxonomy data
- `import_labnotes.py` / `import_labnotes_images.py` — Import from lab notebooks
- `export_specimens.py` — Export specimen data
- `migrate_*.py` — Database schema migrations (run these to update existing DBs)
- `create_user.py` / `create_invite.py` — Admin user management

Use `herman_utils.audited_session()` in new scripts to get database access with audit logging.
