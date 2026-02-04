"""
Migration script to add audit_logs table to existing database
Run this once to enable audit logging functionality
"""
from sqlalchemy import create_engine, text
from database import engine
from models import Base, AuditLog


def add_audit_logs_table():
    """Add the audit_logs table to the database"""
    print("Adding audit_logs table to database...")

    # Create only the audit_logs table
    AuditLog.__table__.create(engine, checkfirst=True)

    print("✅ audit_logs table created successfully!")
    print("\nAudit logging is now enabled. The system will track:")
    print("  - INSERT operations (new records)")
    print("  - UPDATE operations (field changes)")
    print("  - DELETE operations (record deletions)")
    print("\nTracked tables:")
    print("  - specimens")
    print("  - users")
    print("  - piles")
    print("  - images")
    print("  - annotations")
    print("  - sequences")
    print("\nQuery audit logs via:")
    print("  GET /api/audit-logs")
    print("  GET /api/audit-logs/record/{table_name}/{record_id}")
    print("  GET /api/audit-logs/stats")


if __name__ == "__main__":
    add_audit_logs_table()
