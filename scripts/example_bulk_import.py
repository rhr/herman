#!/usr/bin/env python3
"""
Example: Bulk import with batched commits

This demonstrates using BulkAuditedOperation for efficiently
importing large datasets with audit logging.
"""

import sys
from pathlib import Path
import csv

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from herman_utils import BulkAuditedOperation
from models import Sequence, Specimen


def import_sequences_from_csv(csv_file: str):
    """
    Import sequences from CSV file with batched commits.

    Args:
        csv_file: Path to CSV file with sequence data
    """

    with BulkAuditedOperation(
        user_email="admin@museum.org",  # Replace with your email
        operation_name=f"Import sequences from {Path(csv_file).name}",
        batch_size=100,  # Commit every 100 records
        verbose=True
    ) as op:

        with open(csv_file, 'r') as f:
            reader = csv.DictReader(f)

            for row in reader:
                # Validate specimen exists
                specimen = op.db.query(Specimen).filter(
                    Specimen.id == int(row['specimen_id'])
                ).first()

                if not specimen:
                    print(f"  ⚠️  Skipping - specimen {row['specimen_id']} not found")
                    continue

                # Create sequence
                sequence = Sequence(
                    gene=row['gene'],
                    seq=row['sequence'],
                    specimen_id=int(row['specimen_id']),
                    gbid=row.get('genbank_id'),
                    comments=row.get('comments')
                )

                # Add to batch (automatically commits when batch_size is reached)
                op.add(sequence)

        # Remaining items are committed automatically on exit
        # Summary is printed automatically


def main():
    """Example bulk import."""

    # Create sample CSV file for demonstration
    sample_csv = "/tmp/sample_sequences.csv"

    with open(sample_csv, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'specimen_id', 'gene', 'sequence', 'genbank_id', 'comments'
        ])
        writer.writeheader()

        # Add some sample rows (you'd replace this with real data)
        writer.writerow({
            'specimen_id': '1',
            'gene': 'ITS',
            'sequence': 'ATCGATCGATCG',
            'genbank_id': 'AB123456',
            'comments': 'Sample sequence'
        })

    print(f"Created sample CSV: {sample_csv}")
    print("\nTo import, uncomment the line below and update with your email:\n")

    # Uncomment to actually run the import:
    # import_sequences_from_csv(sample_csv)

    print("Example: import_sequences_from_csv(sample_csv)")


if __name__ == "__main__":
    main()
