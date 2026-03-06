#!/usr/bin/env python3
"""
Standalone Helper Utility for Herman Herbarium Database Scripts

This utility provides a convenient interface for writing Python scripts that
interact with the Herman herbarium database with full audit logging support.

Can be used from anywhere on your system - automatically finds and imports
from the backend directory.

Usage Examples:
    # Mode 1: Auto-detect backend via environment variable
    export HERMAN_BACKEND="/home/rree/herman/backend"
    with audited_session(user_email="me@example.com") as db:
        specimens = db.query(Specimen).all()

    # Mode 2: Explicit backend path
    with audited_session(
        user_email="me@example.com",
        backend_path="/home/rree/herman/backend"
    ) as db:
        specimens = db.query(Specimen).all()

    # Mode 3: With query helpers (no need to import models)
    with audited_session(user_email="me@example.com") as db:
        specimens = db.query_specimens(genus="Quercus")
        sequences = db.query_sequences(gene="ITS")
"""

import sys
import os
from pathlib import Path
from contextlib import contextmanager
from typing import Optional, Dict, Any, List
from datetime import datetime
import inspect


class BackendNotFoundError(Exception):
    """Raised when backend directory cannot be located"""
    pass


class UserNotFoundError(Exception):
    """Raised when specified user email is not found in database"""
    pass


def _find_backend_path(explicit_path: Optional[str] = None) -> Path:
    """
    Find the backend directory using multiple strategies.

    Priority:
    1. Explicit path parameter
    2. HERMAN_BACKEND environment variable
    3. Search upward from current directory
    4. Common locations

    Args:
        explicit_path: Explicit path to backend directory

    Returns:
        Path to backend directory

    Raises:
        BackendNotFoundError: If backend cannot be found
    """
    # Strategy 1: Explicit path
    if explicit_path:
        path = Path(explicit_path).resolve()
        if path.exists() and (path / "database.py").exists():
            return path
        raise BackendNotFoundError(f"Backend not found at explicit path: {explicit_path}")

    # Strategy 2: Environment variable
    env_path = os.getenv("HERMAN_BACKEND")
    if env_path:
        path = Path(env_path).resolve()
        if path.exists() and (path / "database.py").exists():
            return path
        raise BackendNotFoundError(f"Backend not found at HERMAN_BACKEND: {env_path}")

    # Strategy 3: Search upward from current directory
    current = Path.cwd()
    for parent in [current] + list(current.parents):
        backend = parent / "backend"
        if backend.exists() and (backend / "database.py").exists():
            return backend
        # Also check if current dir IS the backend
        if (parent / "database.py").exists() and (parent / "models.py").exists():
            return parent

    # Strategy 4: Common locations
    common_paths = [
        Path.home() / "herman" / "backend",
        Path("/home/rree/herman/backend"),
        Path(__file__).parent,  # Same directory as this script
    ]

    for path in common_paths:
        if path.exists() and (path / "database.py").exists():
            return path

    # Give up with helpful error
    raise BackendNotFoundError(
        "Could not locate herman backend directory. Try one of:\n"
        "  1. Set HERMAN_BACKEND environment variable\n"
        "  2. Pass backend_path parameter to audited_session()\n"
        "  3. Run from within the herman project directory\n"
        f"  Current directory: {Path.cwd()}"
    )


def _setup_backend_imports(backend_path: Path):
    """
    Add backend to sys.path and load environment variables.

    Args:
        backend_path: Path to backend directory
    """
    backend_str = str(backend_path)

    # Add to sys.path if not already there
    if backend_str not in sys.path:
        sys.path.insert(0, backend_str)

    # Load .env file from backend directory
    env_file = backend_path / ".env"
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
        except ImportError:
            # python-dotenv not installed, try manual parsing
            _load_env_file(env_file)


def _load_env_file(env_file: Path):
    """
    Manually parse .env file if python-dotenv is not available.

    Args:
        env_file: Path to .env file
    """
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Remove quotes if present
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)


class AuditedSession:
    """
    Context manager for database sessions with audit logging.

    Provides:
    - Automatic audit context setup/cleanup
    - User lookup by email
    - Dry-run mode
    - Change tracking and summary
    - Query helper methods
    """

    def __init__(
        self,
        user_email: Optional[str] = None,
        user_id: Optional[int] = None,
        backend_path: Optional[str] = None,
        dry_run: bool = False,
        system_user: bool = False,
        description: Optional[str] = None,
        verbose: bool = True
    ):
        """
        Initialize audited session.

        Args:
            user_email: Email of user making changes (looked up automatically)
            user_id: User ID (if you know it, otherwise looked up from email)
            backend_path: Explicit path to backend directory (optional)
            dry_run: If True, changes are not committed (preview mode)
            system_user: If True, use a system user for automated operations
            description: Description of operation (used with system_user)
            verbose: If True, print progress and summary information
        """
        self.user_email = user_email
        self.user_id = user_id
        self.backend_path_str = backend_path
        self.dry_run = dry_run
        self.system_user = system_user
        self.description = description
        self.verbose = verbose

        self.db = None
        self.backend_path = None
        self._modules_imported = False
        self._script_name = None

        # Stats tracking
        self._initial_audit_count = 0
        self._changes_summary = {
            'INSERT': {},
            'UPDATE': {},
            'DELETE': {}
        }

    def _import_modules(self):
        """Import required modules from backend."""
        if self._modules_imported:
            return

        # Find and setup backend
        self.backend_path = _find_backend_path(self.backend_path_str)
        _setup_backend_imports(self.backend_path)

        # Import backend modules
        global database, models, audit
        import database
        import models
        import audit

        self._modules_imported = True
        _register_audit_listeners()

        if self.verbose:
            print(f"✓ Connected to herman backend: {self.backend_path}")

    def _get_script_metadata(self) -> str:
        """Get metadata about the calling script."""
        if self._script_name:
            return self._script_name

        # Find the calling script
        frame = inspect.currentframe()
        try:
            # Walk up the stack to find the script file
            while frame:
                filename = frame.f_code.co_filename
                if filename != __file__ and not filename.startswith('<'):
                    script_path = Path(filename)
                    # Include command line args if available
                    args = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else ''
                    self._script_name = f"Script: {script_path.name}"
                    if args:
                        self._script_name += f" {args}"
                    return self._script_name
                frame = frame.f_back
        finally:
            del frame

        return "Python Script"

    def _lookup_user(self) -> tuple[int, str]:
        """
        Look up user ID and email.

        Returns:
            Tuple of (user_id, user_email)

        Raises:
            UserNotFoundError: If user cannot be found
        """
        if self.system_user:
            # For system operations, create or use a system user
            system_user = self.db.query(models.User).filter(
                models.User.email == "system@herman.internal"
            ).first()

            if not system_user:
                if self.verbose:
                    print("Creating system user for automated operations...")
                # System user doesn't exist, we'll use user_id=None
                # and the description will be in user_agent
                return None, "system@herman.internal"

            return system_user.id, system_user.email

        # Look up user by email
        if self.user_email:
            user = self.db.query(models.User).filter(
                models.User.email == self.user_email
            ).first()

            if not user:
                raise UserNotFoundError(
                    f"User not found: {self.user_email}\n"
                    f"Available users: {[u.email for u in self.db.query(models.User).all()]}"
                )

            return user.id, user.email

        # Look up user by ID
        if self.user_id:
            user = self.db.query(models.User).filter(
                models.User.id == self.user_id
            ).first()

            if not user:
                raise UserNotFoundError(f"User ID not found: {self.user_id}")

            return user.id, user.email

        raise ValueError("Must provide either user_email or user_id (or system_user=True)")

    def _count_current_audits(self) -> int:
        """Count current audit log entries."""
        return self.db.query(models.AuditLog).count()

    def _collect_changes_summary(self):
        """Collect summary of changes made in this session."""
        current_count = self._count_current_audits()
        new_entries = current_count - self._initial_audit_count

        if new_entries == 0:
            return

        # Get the new audit logs
        new_logs = self.db.query(models.AuditLog).order_by(
            models.AuditLog.id.desc()
        ).limit(new_entries).all()

        # Summarize by operation and table
        for log in new_logs:
            operation = log.operation
            table = log.table_name

            if table not in self._changes_summary[operation]:
                self._changes_summary[operation][table] = 0
            self._changes_summary[operation][table] += 1

    def _print_summary(self):
        """Print summary of changes made."""
        if not self.verbose:
            return

        has_changes = any(
            len(tables) > 0
            for tables in self._changes_summary.values()
        )

        if not has_changes:
            print("ℹ️  No changes made")
            return

        print("\n" + "="*60)
        if self.dry_run:
            print("DRY RUN SUMMARY (changes not committed):")
        else:
            print("CHANGES SUMMARY:")
        print("="*60)

        for operation in ['INSERT', 'UPDATE', 'DELETE']:
            tables = self._changes_summary[operation]
            if tables:
                emoji = {'INSERT': '➕', 'UPDATE': '✏️', 'DELETE': '🗑️'}[operation]
                print(f"\n{emoji} {operation}:")
                for table, count in sorted(tables.items()):
                    print(f"   {table}: {count}")

        print("\n" + "="*60)
        if self.dry_run:
            print("⚠️  DRY RUN: No changes were committed to the database")
        else:
            print(f"✓ All changes audited as user: {self.user_email}")
        print("="*60 + "\n")

    def __enter__(self):
        """Enter context manager - set up database session and audit context."""
        # Import modules
        self._import_modules()

        # Create database session
        self.db = database.SessionLocal()

        # Look up user
        user_id, user_email = self._lookup_user()
        self.user_id = user_id
        self.user_email = user_email

        # Set audit context
        script_metadata = self._get_script_metadata()
        user_agent = script_metadata
        if self.description:
            user_agent = f"{script_metadata} - {self.description}"

        audit.set_audit_context(
            user_id=self.user_id,
            user_email=self.user_email,
            ip_address="127.0.0.1",
            user_agent=user_agent
        )

        # Track initial audit count
        self._initial_audit_count = self._count_current_audits()

        if self.verbose:
            if self.dry_run:
                print(f"🔍 DRY RUN mode - changes will not be committed")
            print(f"👤 Running as: {self.user_email}")
            if self.description:
                print(f"📝 Operation: {self.description}")
            print()

        # Add helper methods to session
        self.db.query_specimens = lambda **kwargs: self._query_helper(models.Specimen, **kwargs)
        self.db.query_sequences = lambda **kwargs: self._query_helper(models.Sequence, **kwargs)
        self.db.query_images = lambda **kwargs: self._query_helper(models.Image, **kwargs)
        self.db.query_piles = lambda **kwargs: self._query_helper(models.Pile, **kwargs)
        self.db.query_users = lambda **kwargs: self._query_helper(models.User, **kwargs)

        return self.db

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager - clean up and print summary."""
        try:
            if exc_type is not None:
                # An exception occurred, rollback
                self.db.rollback()
                if self.verbose:
                    print(f"\n❌ Error occurred, changes rolled back: {exc_val}")
            else:
                # Collect changes before commit/rollback
                self._collect_changes_summary()

                if self.dry_run:
                    # Rollback in dry-run mode
                    self.db.rollback()
                else:
                    # Commit changes
                    self.db.commit()

                # Print summary
                self._print_summary()
        finally:
            # Clean up
            audit.clear_audit_context()
            self.db.close()

        # Don't suppress exceptions
        return False

    def _query_helper(self, model_class, **filters):
        """
        Helper method to query models with filters.

        Args:
            model_class: SQLAlchemy model class
            **filters: Column name = value filters

        Returns:
            SQLAlchemy query object

        Example:
            db.query_specimens(genus="Quercus", family="Fagaceae")
        """
        query = self.db.query(model_class)

        for key, value in filters.items():
            if hasattr(model_class, key):
                column = getattr(model_class, key)
                if value is None:
                    query = query.filter(column.is_(None))
                else:
                    query = query.filter(column == value)

        return query


@contextmanager
def audited_session(
    user_email: Optional[str] = None,
    user_id: Optional[int] = None,
    backend_path: Optional[str] = None,
    dry_run: bool = False,
    system_user: bool = False,
    description: Optional[str] = None,
    verbose: bool = True
):
    """
    Context manager for database sessions with audit logging.

    This is the main entry point for the herman_utils module.

    Args:
        user_email: Email of user making changes (looked up automatically)
        user_id: User ID (if you know it, otherwise looked up from email)
        backend_path: Explicit path to backend directory (optional)
        dry_run: If True, changes are not committed (preview mode)
        system_user: If True, use a system user for automated operations
        description: Description of operation (useful for audit logs)
        verbose: If True, print progress and summary information

    Yields:
        SQLAlchemy database session with audit logging enabled

    Example:
        with audited_session(user_email="curator@museum.org") as db:
            specimens = db.query(Specimen).filter(Specimen.genus == "Quercus").all()
            for specimen in specimens:
                specimen.family = "Fagaceae"
            db.commit()
    """
    session = AuditedSession(
        user_email=user_email,
        user_id=user_id,
        backend_path=backend_path,
        dry_run=dry_run,
        system_user=system_user,
        description=description,
        verbose=verbose
    )

    with session as db:
        yield db


# Convenience function for bulk operations
class BulkAuditedOperation:
    """
    Helper for bulk operations with batched commits.

    Useful for importing large datasets where you want to commit in batches
    for performance while maintaining audit logging.
    """

    def __init__(
        self,
        user_email: Optional[str] = None,
        user_id: Optional[int] = None,
        backend_path: Optional[str] = None,
        operation_name: str = "Bulk operation",
        batch_size: int = 100,
        verbose: bool = True
    ):
        """
        Initialize bulk operation.

        Args:
            user_email: Email of user making changes
            user_id: User ID (alternative to email)
            backend_path: Explicit path to backend directory
            operation_name: Name of this operation (for audit logs)
            batch_size: Number of records to commit at once
            verbose: If True, show progress
        """
        self.session_manager = AuditedSession(
            user_email=user_email,
            user_id=user_id,
            backend_path=backend_path,
            description=operation_name,
            verbose=verbose
        )
        self.batch_size = batch_size
        self.verbose = verbose
        self.operation_name = operation_name

        self.db = None
        self._batch = []
        self._total_added = 0

    def __enter__(self):
        """Enter context manager."""
        self.db = self.session_manager.__enter__()
        if self.verbose:
            print(f"📦 Bulk operation: {self.operation_name}")
            print(f"   Batch size: {self.batch_size}")
            print()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager."""
        # Commit any remaining items
        if self._batch and exc_type is None:
            self._commit_batch()

        return self.session_manager.__exit__(exc_type, exc_val, exc_tb)

    def add(self, obj):
        """
        Add an object to the bulk operation.

        Objects are batched and committed in groups of batch_size.

        Args:
            obj: SQLAlchemy model instance to add
        """
        self.db.add(obj)
        self._batch.append(obj)

        if len(self._batch) >= self.batch_size:
            self._commit_batch()

    def _commit_batch(self):
        """Commit current batch."""
        if not self._batch:
            return

        self.db.commit()
        self._total_added += len(self._batch)

        if self.verbose:
            print(f"   ✓ Committed batch: {self._total_added} records total")

        self._batch = []

    def commit(self):
        """Manually commit remaining items."""
        self._commit_batch()


_audit_listeners_registered = False


def _register_audit_listeners():
    """Register audit listeners for all tracked models. Safe to call multiple times."""
    global _audit_listeners_registered
    if _audit_listeners_registered:
        return
    audit.register_audit_listeners(models.Specimen)
    audit.register_audit_listeners(models.Sequence)
    audit.register_audit_listeners(models.Image)
    audit.register_audit_listeners(models.Pile)
    audit.register_audit_listeners(models.Annotation)
    audit.register_audit_listeners(models.User)
    _audit_listeners_registered = True


# Export main interface
__all__ = [
    'audited_session',
    'BulkAuditedOperation',
    'BackendNotFoundError',
    'UserNotFoundError'
]


if __name__ == "__main__":
    # Self-test
    print("Herman Utils - Standalone Helper Utility")
    print("=" * 60)

    try:
        backend_path = _find_backend_path()
        print(f"✓ Backend found: {backend_path}")

        env_file = backend_path / ".env"
        if env_file.exists():
            print(f"✓ Environment file found: {env_file}")

        print("\nExample usage:")
        print("""
from herman_utils import audited_session
from models import Specimen

with audited_session(user_email="your@email.com") as db:
    specimens = db.query(Specimen).filter(Specimen.genus == "Quercus").all()
    print(f"Found {len(specimens)} Quercus specimens")
        """)

    except BackendNotFoundError as e:
        print(f"❌ {e}")
        sys.exit(1)
