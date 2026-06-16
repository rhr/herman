"""
Database models for Herbarium Pro

Note: Refactored to use auto-incrementing integer IDs for better performance
and simpler references. UUIDs were removed in favor of BIGINT primary keys.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, BigInteger, Float, Text, DateTime,
    ForeignKey, Table, Date, Index, Boolean, JSON, Enum
)
from sqlalchemy.orm import relationship, DeclarativeBase
import secrets

class Base(DeclarativeBase):
    def to_dict(self):
            return {field.name: getattr(self, field.name) for field in self.__table__.c}

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255))
    institution = Column(String(255))
    is_admin = Column(Boolean, default=False)  # Admin flag for managing invitations
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    specimens = relationship("Specimen", back_populates="user", cascade="all, delete-orphan")
    piles = relationship("Pile", back_populates="user", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="user")


class Specimen(Base):
    __tablename__ = "specimens"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False, index=True, unique=True)  # Legacy field: user-provided short unique identifier

    # Specimen fields
    scientific_name = Column(String(255))
    family = Column(String(100), index=True)
    genus = Column(String(100), index=True)
    wcvp_id = Column(String(50), index=True)  # WCVP taxon ID for taxonomic verification
    collector = Column(String(255), index=True)
    collector_number = Column(String(100))  # Collector's number for this specimen
    collection_date = Column(String(50))  # Flexible format: YYYY, YYYY-MM, or YYYY-MM-DD
    description = Column(Text)
    microhabitat = Column(Text)

    # Locality fields (consolidated from localities table)
    country = Column(String(100))
    state_province = Column(String(100))
    county_city = Column(String(100))
    locality_description = Column(Text)
    latitude = Column(String(50))   # Verbatim latitude (as entered)
    longitude = Column(String(50))  # Verbatim longitude (as entered)
    latdd = Column(Float, index=True)   # Parsed latitude in decimal degrees (for mapping)
    londd = Column(Float, index=True)   # Parsed longitude in decimal degrees (for mapping)
    elevation = Column(String(100))  # Elevation (e.g., "1200m", "3000-3500m", "4000 ft")
    habitat = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="specimens")
    images = relationship("Image", back_populates="specimen", cascade="all, delete-orphan", order_by="Image.position")
    annotations = relationship("Annotation", back_populates="specimen", cascade="all, delete-orphan")
    sequences = relationship("Sequence", back_populates="specimen", cascade="all, delete-orphan")
    piles = relationship("Pile", secondary="pile_specimens", back_populates="specimens")

    # Indexes
    __table_args__ = (
        Index('idx_specimens_user', 'user_id'),
        Index('idx_specimens_family', 'family'),
        Index('idx_specimens_genus', 'genus'),
        Index('idx_specimens_coordinates', 'latdd', 'londd'),  # Composite index for map queries
    )


class Sequence(Base):
    """DNA sequence data associated with specimens"""
    __tablename__ = "sequences"

    # Primary key - allow manual ID setting for import, but auto-increment for new records
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # Foreign key to specimens with cascade delete
    specimen_id = Column(
        BigInteger,
        ForeignKey("specimens.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Sequence data fields
    gene = Column(String(100), index=True)  # matK, rps16, ITS, etc.
    genbank_id = Column(String(50))
    genbank_accession = Column(String(50), unique=True)
    taxon = Column(String(255))
    sequence = Column(Text, nullable=False)  # The DNA sequence
    suspect = Column(Boolean, default=False)  # Data quality flag
    comments = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    mtime = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # Modification time

    # Relationship back to Specimen
    specimen = relationship("Specimen", back_populates="sequences")

    # Composite index for common queries
    __table_args__ = (
        Index('idx_sequences_specimen_gene', 'specimen_id', 'gene'),
    )


class Image(Base):
    __tablename__ = "images"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    specimen_id = Column(BigInteger, ForeignKey("specimens.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)  # Original filename from upload
    storage_filename = Column(String(255), nullable=False)  # UUID-based filename on disk
    storage_path = Column(String(500), nullable=False)  # Relative path in uploads directory
    url = Column(String(500), nullable=False)  # Public URL
    caption = Column(Text)  # Optional caption for the image
    mime_type = Column(String(50))
    size_bytes = Column(Integer)
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    specimen = relationship("Specimen", back_populates="images")

    __table_args__ = (
        Index('idx_images_specimen', 'specimen_id'),
    )


class Pile(Base):
    __tablename__ = "piles"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="piles")
    specimens = relationship("Specimen", secondary="pile_specimens", back_populates="piles")


# Association table for many-to-many relationship between piles and specimens
pile_specimens = Table(
    "pile_specimens",
    Base.metadata,
    Column("pile_id", BigInteger, ForeignKey("piles.id", ondelete="CASCADE"), primary_key=True),
    Column("specimen_id", BigInteger, ForeignKey("specimens.id", ondelete="CASCADE"), primary_key=True),
    Column("added_at", DateTime, default=datetime.utcnow)
)


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    specimen_id = Column(BigInteger, ForeignKey("specimens.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    specimen = relationship("Specimen", back_populates="annotations")
    user = relationship("User", back_populates="annotations")

    __table_args__ = (
        Index('idx_annotations_specimen', 'specimen_id'),
    )


class Taxon(Base):
    """
    WCVP (World Checklist of Vascular Plants) taxonomic lookup table
    Used for autocomplete functionality when entering specimen data
    """
    __tablename__ = "taxa"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    taxon_id = Column(String(50), unique=True, index=True)  # WCVP taxon ID
    family = Column(String(100), index=True)
    genus = Column(String(100), index=True)
    scientific_name = Column(String(255), index=True)
    author = Column(String(500))  # Scientific name authorship
    rank = Column(String(50), index=True)  # Species, Genus, Variety, Form, etc.
    status = Column(String(50), index=True)  # Accepted, Synonym, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_taxa_family', 'family'),
        Index('idx_taxa_genus', 'genus'),
        Index('idx_taxa_scientific_name', 'scientific_name', mysql_length=100),
        Index('idx_taxa_rank_status', 'rank', 'status'),
    )


class AuditLog(Base):
    """
    Audit log table for tracking all database changes
    Captures CREATE, UPDATE, and DELETE operations on tracked models
    """
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    table_name = Column(String(100), nullable=False, index=True)
    record_id = Column(BigInteger, nullable=False, index=True)
    operation = Column(Enum('INSERT', 'UPDATE', 'DELETE', name='operation_enum'), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)  # Denormalized for convenience
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    old_values = Column(JSON, nullable=True)  # Previous state (for UPDATE and DELETE)
    new_values = Column(JSON, nullable=True)  # New state (for INSERT and UPDATE)
    changed_fields = Column(JSON, nullable=True)  # List of changed field names (for UPDATE)
    ip_address = Column(String(45), nullable=True)  # Track request origin (supports IPv6)
    user_agent = Column(String(500), nullable=True)  # Track client

    # Relationship
    user = relationship("User")

    __table_args__ = (
        Index('idx_audit_table_record', 'table_name', 'record_id'),
        Index('idx_audit_user_timestamp', 'user_id', 'timestamp'),
        Index('idx_audit_operation_timestamp', 'operation', 'timestamp'),
    )


class Invitation(Base):
    """
    Invitation table for managing user registration invitations
    Only users with valid invitation tokens can register
    """
    __tablename__ = "invitations"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    created_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # Optional expiration
    used_at = Column(DateTime, nullable=True)  # When the invitation was accepted
    used_by_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    revoked = Column(Boolean, default=False)  # Admin can revoke invitations
    revoked_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)  # Optional notes about why this user was invited

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    used_by = relationship("User", foreign_keys=[used_by_user_id])

    __table_args__ = (
        Index('idx_invitation_email', 'email'),
        Index('idx_invitation_token', 'token'),
        Index('idx_invitation_status', 'used_at', 'revoked'),
    )

    @staticmethod
    def generate_token():
        """Generate a secure random token for invitations"""
        return secrets.token_urlsafe(48)

    def is_valid(self):
        """Check if invitation is valid (not used, not revoked, not expired)"""
        if self.revoked or self.used_at:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True
