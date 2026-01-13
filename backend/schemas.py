"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ========================================
# Auth Schemas
# ========================================

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: Optional[str] = None
    institution: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    institution: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ========================================
# Image Schemas
# ========================================

class ImageResponse(BaseModel):
    id: int
    filename: str
    storage_filename: str
    url: str
    caption: Optional[str]
    mime_type: Optional[str]
    size_bytes: Optional[int]
    position: int
    created_at: datetime

    class Config:
        from_attributes = True


# ========================================
# Annotation Schemas
# ========================================

class AnnotationCreate(BaseModel):
    text: str


class AnnotationResponse(BaseModel):
    id: int
    specimen_id: int
    text: str
    author: Optional[str] = None  # User name
    timestamp: datetime

    @classmethod
    def from_orm(cls, obj):
        """Custom from_orm to map created_at to timestamp and populate author"""
        data = {
            'id': obj.id,
            'specimen_id': obj.specimen_id,
            'text': obj.text,
            'timestamp': obj.created_at,
            'author': obj.user.name if obj.user and obj.user.name else (obj.user.email if obj.user else None)
        }
        return cls(**data)

    class Config:
        from_attributes = True


# ========================================
# Specimen Schemas
# ========================================

class SpecimenCreate(BaseModel):
    code: str
    scientific_name: Optional[str] = None
    family: Optional[str] = None
    genus: Optional[str] = None
    wcvp_id: Optional[str] = None
    collector: Optional[str] = None
    collector_number: Optional[str] = None
    collection_date: Optional[str] = None
    description: Optional[str] = None
    microhabitat: Optional[str] = None
    # Locality data
    country: Optional[str] = None
    state_province: Optional[str] = None
    county_city: Optional[str] = None
    locality_description: Optional[str] = None
    latitude: Optional[str] = None   # Verbatim latitude
    longitude: Optional[str] = None  # Verbatim longitude
    latdd: Optional[float] = None    # Decimal degrees latitude
    londd: Optional[float] = None    # Decimal degrees longitude
    elevation: Optional[str] = None  # Elevation
    habitat: Optional[str] = None

class SpecimenUpdate(BaseModel):
    code: str
    scientific_name: Optional[str] = None
    family: Optional[str] = None
    genus: Optional[str] = None
    wcvp_id: Optional[str] = None
    collector: Optional[str] = None
    collector_number: Optional[str] = None
    collection_date: Optional[str] = None
    description: Optional[str] = None
    microhabitat: Optional[str] = None
    # Locality data
    country: Optional[str] = None
    state_province: Optional[str] = None
    county_city: Optional[str] = None
    locality_description: Optional[str] = None
    latitude: Optional[str] = None   # Verbatim latitude
    longitude: Optional[str] = None  # Verbatim longitude
    latdd: Optional[float] = None    # Decimal degrees latitude
    londd: Optional[float] = None    # Decimal degrees longitude
    elevation: Optional[str] = None  # Elevation
    habitat: Optional[str] = None


class SpecimenResponse(BaseModel):
    id: int
    user_id: int
    code: str
    scientific_name: Optional[str]
    family: Optional[str]
    genus: Optional[str]
    wcvp_id: Optional[str]
    collector: Optional[str]
    collector_number: Optional[str]
    collection_date: Optional[str]
    description: Optional[str]
    microhabitat: Optional[str]
    # Locality fields (flattened)
    country: Optional[str]
    state_province: Optional[str]
    county_city: Optional[str]
    locality_description: Optional[str]
    latitude: Optional[str]    # Verbatim latitude
    longitude: Optional[str]   # Verbatim longitude
    latdd: Optional[float]     # Decimal degrees latitude
    londd: Optional[float]     # Decimal degrees longitude
    elevation: Optional[str]   # Elevation
    habitat: Optional[str]
    created_at: datetime
    updated_at: datetime
    # Relationships
    images: List[ImageResponse] = []
    annotations: List[AnnotationResponse] = []
    sequences: List[SequenceResponse] = []
    tags: List[str] = []  # For compatibility with frontend

    class Config:
        from_attributes = True


class SpecimenListResponse(BaseModel):
    id: int
    code: str
    scientific_name: Optional[str]
    family: Optional[str]
    collector: Optional[str]
    collection_date: Optional[str]
    image_url: Optional[str]  # Primary image URL
    created_at: datetime

    class Config:
        from_attributes = True


# ========================================
# Pile Schemas
# ========================================

class PileCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class PileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    created_at: datetime
    specimen_ids: List[int] = []

    class Config:
        from_attributes = True


# ========================================
# Sequence Schemas
# ========================================

class SequenceCreate(BaseModel):
    gene: Optional[str] = Field(None, max_length=100)
    genbank_id: Optional[str] = Field(None, max_length=50)
    genbank_accession: Optional[str] = Field(None, max_length=50)
    taxon: Optional[str] = Field(None, max_length=255)
    sequence: str = Field(..., description="DNA sequence string")
    suspect: Optional[bool] = False
    comments: Optional[str] = None


class SequenceUpdate(BaseModel):
    gene: Optional[str] = Field(None, max_length=100)
    genbank_id: Optional[str] = Field(None, max_length=50)
    genbank_accession: Optional[str] = Field(None, max_length=50)
    taxon: Optional[str] = Field(None, max_length=255)
    sequence: Optional[str] = None
    suspect: Optional[bool] = None
    comments: Optional[str] = None


class SequenceResponse(BaseModel):
    id: int
    specimen_id: int
    gene: Optional[str]
    genbank_id: Optional[str]
    genbank_accession: Optional[str]
    taxon: Optional[str]
    sequence: str
    suspect: bool
    comments: Optional[str]
    created_at: datetime
    mtime: datetime  # Modification time

    class Config:
        from_attributes = True


# ========================================
# Message Responses
# ========================================

class MessageResponse(BaseModel):
    message: str
    id: Optional[int] = None
