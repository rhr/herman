#!/usr/bin/env python3
"""
Example: Using query helpers

This demonstrates the convenience query helper methods that let you
query common models without importing them.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from herman_utils import audited_session


def main():
    """Query specimens and sequences using helper methods."""

    with audited_session(
        user_email="researcher@university.edu",  # Replace with your email
        verbose=True
    ) as db:

        # Query helpers - no need to import Specimen, Sequence, etc.

        # Find all Quercus specimens
        quercus = db.query_specimens(genus="Quercus").all()
        print(f"\nFound {len(quercus)} Quercus specimens")

        # Find specimens with missing family
        no_family = db.query_specimens(family=None).all()
        print(f"Found {len(no_family)} specimens with no family")

        # Find ITS sequences
        its_sequences = db.query_sequences(gene="ITS").all()
        print(f"Found {len(its_sequences)} ITS sequences")

        # You can also use regular SQLAlchemy queries
        from models import Specimen

        # Complex query with multiple conditions
        specimens = db.query(Specimen).filter(
            Specimen.genus == "Quercus",
            Specimen.country == "United States"
        ).order_by(Specimen.collection_date.desc()).limit(10).all()

        print(f"\nMost recent Quercus from USA:")
        for s in specimens:
            print(f"  {s.code}: {s.scientific_name} - {s.collection_date}")

        # No commit needed - just querying


if __name__ == "__main__":
    main()
