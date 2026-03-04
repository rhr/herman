#!/usr/bin/env python3
"""
Example: Using explicit backend path

This demonstrates using audited_session with an explicit backend path,
useful when you haven't set the HERMAN_BACKEND environment variable
or when the backend can't be auto-detected.

This script can live anywhere on your system and doesn't need any
environment setup.
"""

import sys
from pathlib import Path

# Import herman_utils - adjust path as needed
herman_utils_path = Path.home() / "herman" / "backend"
sys.path.insert(0, str(herman_utils_path))

from herman_utils import audited_session
from models import Specimen


def main():
    """Query specimens using explicit backend path."""

    # Specify backend path explicitly - no environment setup needed
    backend_path = "/home/rree/herman/backend"

    with audited_session(
        user_email="researcher@university.edu",  # Replace with your email
        backend_path=backend_path,  # Explicitly tell it where backend is
        verbose=True
    ) as db:

        # Query specimens
        specimens = db.query(Specimen).limit(10).all()

        print(f"\nFirst 10 specimens:")
        for s in specimens:
            print(f"  {s.id}: {s.code} - {s.scientific_name}")


if __name__ == "__main__":
    main()
