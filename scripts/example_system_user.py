#!/usr/bin/env python3
"""
Example: System user for automated operations

This demonstrates using system_user=True for automated scripts
where you don't want to attribute changes to a specific person.

Useful for:
- Cron jobs
- Automated imports
- System maintenance scripts
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from herman_utils import audited_session
from models import Specimen


def automated_data_cleanup():
    """Automated cleanup script that runs as system user."""

    with audited_session(
        system_user=True,
        description="Automated cleanup: normalize empty strings to NULL",
        dry_run=True,  # Set to False to actually run
        verbose=True
    ) as db:

        # Find specimens with empty string descriptions
        specimens = db.query(Specimen).filter(
            Specimen.description == ""
        ).all()

        print(f"Found {len(specimens)} specimens with empty descriptions\n")

        # Normalize empty strings to NULL
        for specimen in specimens:
            print(f"  {specimen.code}: '' → NULL")
            specimen.description = None

        db.commit()

    # Audit logs will show user_email="system@herman.internal"
    # and user_agent will include the script name and description


def main():
    """Run automated cleanup."""
    print("Running automated cleanup as system user...\n")
    automated_data_cleanup()


if __name__ == "__main__":
    main()
