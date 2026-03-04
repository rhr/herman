#!/usr/bin/env python3
"""
Example: Basic usage of herman_utils

This script demonstrates the simplest way to use audited_session
to query and update specimen records with full audit logging.

This script can be run from any directory on your system.
"""

import sys
from pathlib import Path

# Add backend to path - use one of these methods:

# Method 1: Set environment variable (recommended for regular use)
# export HERMAN_BACKEND="/home/rree/herman/backend"

# Method 2: Add herman_utils to path explicitly
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from herman_utils import audited_session
from models import Specimen


def main():
    """Update family name for all Quercus specimens."""

    # Use audited_session - automatically handles:
    # - User lookup
    # - Audit context setup/cleanup
    # - Database session management
    # - Change summary

    with audited_session(
        user_email="curator@museum.org",  # Replace with your email
        description="Correct family name for Quercus specimens",
        dry_run=True  # Set to False to actually commit changes
    ) as db:

        # Query specimens needing updates
        specimens = db.query(Specimen).filter(
            Specimen.genus == "Quercus",
            Specimen.family != "Fagaceae"
        ).all()

        print(f"Found {len(specimens)} specimens to update\n")

        # Update each specimen
        for specimen in specimens:
            old_family = specimen.family
            specimen.family = "Fagaceae"
            print(f"  {specimen.code}: {old_family} → Fagaceae")

        # Commit changes (or rollback if dry_run=True)
        db.commit()

    # Summary is automatically printed on exit


if __name__ == "__main__":
    main()
