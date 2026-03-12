"""
Audit logging utilities for tracking database changes
Uses SQLAlchemy event listeners to automatically log CREATE, UPDATE, DELETE operations
"""
from sqlalchemy import event, inspect, insert
from sqlalchemy.orm import Session
from contextvars import ContextVar
from datetime import datetime
from typing import Optional, Dict, Any

# Context variable to store current user info and request metadata across async requests
# This allows us to capture user context from FastAPI requests in SQLAlchemy event handlers
audit_context: ContextVar[Optional[Dict[str, Any]]] = ContextVar('audit_context', default=None)


def set_audit_context(
    user_id: int,
    user_email: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """
    Set the audit context for the current request.
    Call this in your FastAPI dependency to populate user and request metadata.

    Args:
        user_id: The authenticated user's ID
        user_email: The authenticated user's email
        ip_address: The request's IP address (optional)
        user_agent: The request's User-Agent header (optional)
    """
    audit_context.set({
        'user_id': user_id,
        'user_email': user_email,
        'ip_address': ip_address,
        'user_agent': user_agent
    })


def clear_audit_context():
    """Clear the audit context (useful for cleanup after request processing)"""
    audit_context.set(None)


def get_object_state(obj) -> Dict[str, Any]:
    """
    Serialize an ORM object's state to a JSON-compatible dictionary.
    Handles datetime serialization and extracts all column values.

    Args:
        obj: SQLAlchemy model instance

    Returns:
        Dictionary of column_name: value pairs
    """
    state = {}
    mapper = inspect(obj).mapper

    for column in mapper.columns:
        value = getattr(obj, column.name)

        # Handle datetime serialization
        if isinstance(value, datetime):
            value = value.isoformat()

        state[column.name] = value

    return state


def create_audit_log(connection, obj, operation: str, old_values: Optional[Dict] = None):
    """
    Create an audit log entry for a database operation.

    Args:
        connection: SQLAlchemy connection (from event listener)
        obj: The model instance being tracked
        operation: One of 'INSERT', 'UPDATE', or 'DELETE'
        old_values: Previous state of the object (for UPDATE and DELETE operations)
    """
    # Avoid circular import by importing here
    from models import AuditLog

    # Get audit context (user info and request metadata)
    context = audit_context.get() or {}

    # Serialize new state (unless it's a DELETE)
    new_values = get_object_state(obj) if operation != 'DELETE' else None

    # Calculate changed fields for UPDATE operations
    changed_fields = None
    if operation == 'UPDATE' and old_values and new_values:
        changed_fields = [
            key for key in old_values.keys()
            if old_values.get(key) != new_values.get(key)
        ]
        new_values = {k: new_values[k] for k in changed_fields if k in new_values}

    # Use connection-level INSERT to avoid session.add() during flush
    connection.execute(insert(AuditLog).values(
        table_name=obj.__tablename__,
        record_id=obj.id,
        operation=operation,
        user_id=context.get('user_id'),
        user_email=context.get('user_email'),
        old_values=old_values,
        new_values=new_values,
        changed_fields=changed_fields,
        ip_address=context.get('ip_address'),
        user_agent=context.get('user_agent')
    ))


def register_audit_listeners(model_class):
    """
    Register SQLAlchemy event listeners for a model to enable automatic audit logging.
    Call this for each model you want to track.

    Args:
        model_class: SQLAlchemy model class to track

    Example:
        register_audit_listeners(Specimen)
        register_audit_listeners(User)
    """

    @event.listens_for(model_class, 'after_insert')
    def after_insert_listener(mapper, connection, target):
        """Triggered after INSERT - logs the new record"""
        from models import AuditLog
        if not isinstance(target, AuditLog):
            create_audit_log(connection, target, 'INSERT')

    @event.listens_for(model_class, 'after_update')
    def after_update_listener(mapper, connection, target):
        """Triggered after UPDATE - logs old and new values"""
        from models import AuditLog
        if not isinstance(target, AuditLog):
            # Extract old values from SQLAlchemy history
            old_values = {}
            insp = inspect(target)

            for attr in insp.attrs:
                hist = attr.load_history()
                if hist.has_changes():
                    # Get the old value (before update)
                    old_val = hist.deleted[0] if hist.deleted else None

                    # Handle datetime serialization
                    if isinstance(old_val, datetime):
                        old_val = old_val.isoformat()

                    old_values[attr.key] = old_val

            # Only create audit log if there were actual changes
            if old_values:
                create_audit_log(connection, target, 'UPDATE', old_values)

    @event.listens_for(model_class, 'after_delete')
    def after_delete_listener(mapper, connection, target):
        """Triggered after DELETE - logs the deleted record's state"""
        from models import AuditLog
        if not isinstance(target, AuditLog):
            # Capture the state before deletion
            old_values = get_object_state(target)
            create_audit_log(connection, target, 'DELETE', old_values)
