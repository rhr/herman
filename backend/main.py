"""
FastAPI main application for Herbarium Pro
"""
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime
import os
from dotenv import load_dotenv

# Local imports
from database import get_db, create_tables
from models import User, Specimen, Image, Pile, Annotation, Taxon, Sequence, pile_specimens, AuditLog, Invitation
from schemas import (
    UserRegister, UserLogin, TokenResponse, UserResponse,
    SpecimenCreate, SpecimenUpdate, SpecimenResponse, SpecimenListResponse,
    ImageResponse,
    PileCreate, PileUpdate, PileResponse,
    AnnotationCreate, AnnotationResponse,
    SequenceCreate, SequenceUpdate, SequenceResponse,
    AuditLogResponse, AuditLogListResponse,
    InvitationCreate, InvitationResponse, InvitationListResponse, ValidateInvitationResponse,
    MessageResponse
)
from auth import hash_password, verify_password, create_access_token, get_current_user
from storage import file_storage
from audit import register_audit_listeners, set_audit_context

load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Herbarium Pro API",
    description="Backend API for digital herbarium management",
    version="1.0.0",
    root_path="/herman"
)

# CORS middleware
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for static file serving
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ========================================
# Startup Event
# ========================================

@app.on_event("startup")
async def startup_event():
    """Create database tables and register audit listeners on startup"""
    create_tables()

    # Register audit listeners for models to track
    register_audit_listeners(Specimen)
    register_audit_listeners(User)
    register_audit_listeners(Pile)
    register_audit_listeners(Image)
    register_audit_listeners(Annotation)
    register_audit_listeners(Sequence)

    print("🚀 Herbarium Pro API started successfully")
    print("📝 Audit logging enabled for: Specimen, User, Pile, Image, Annotation, Sequence")


# ========================================
# Health Check
# ========================================

@app.get("/")
async def root():
    return {"message": "Herbarium Pro API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ========================================
# Dependencies
# ========================================

async def get_current_user_with_audit(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency that gets the current user and sets audit context.
    Use this instead of get_current_user for routes that modify data.
    """
    # Set audit context with user info and request metadata
    set_audit_context(
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent')
    )

    return current_user


def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to ensure current user is an admin.
    Raises 403 if user is not an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ========================================
# Authentication Routes
# ========================================

@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    email: str = Form(...),
    password: str = Form(...),
    name: Optional[str] = Form(None),
    institution: Optional[str] = Form(None),
    invitation_token: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Register a new user with a valid invitation token.
    Invitation-only registration ensures controlled access.
    """
    # Validate invitation
    invitation = db.query(Invitation).filter(
        Invitation.token == invitation_token
    ).first()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invitation token"
        )

    if not invitation.is_valid():
        if invitation.used_at:
            detail = "This invitation has already been used"
        elif invitation.revoked:
            detail = "This invitation has been revoked"
        else:
            detail = "This invitation has expired"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

    # Verify email matches invitation
    if email.lower() != invitation.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email does not match invitation"
        )

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Validate password length
    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )

    # Create new user
    hashed_password = hash_password(password)
    new_user = User(
        email=email,
        password_hash=hashed_password,
        name=name,
        institution=institution,
        is_admin=False  # New users are not admins by default
    )

    db.add(new_user)
    db.flush()  # Get user ID before marking invitation as used

    # Mark invitation as used
    invitation.used_at = datetime.utcnow()
    invitation.used_by_user_id = new_user.id

    db.commit()
    db.refresh(new_user)

    # Generate token (convert ID to string for JWT)
    access_token = create_access_token(data={"sub": str(new_user.id)})

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.from_orm(new_user)
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    # Find user
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Generate token (convert ID to string for JWT)
    access_token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.from_orm(user)
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse.from_orm(current_user)


# ========================================
# Invitation Routes (Admin Only)
# ========================================

@app.post("/api/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    invitation_data: InvitationCreate,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Create a new invitation for a user to register.
    Admin-only endpoint.
    """
    # Check if user is already registered
    existing_user = db.query(User).filter(User.email == invitation_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    # Check for existing pending invitation
    existing_invitation = db.query(Invitation).filter(
        Invitation.email == invitation_data.email,
        Invitation.used_at.is_(None),
        Invitation.revoked == False
    ).first()

    if existing_invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active invitation already exists for this email"
        )

    # Calculate expiration date
    expires_at = None
    if invitation_data.expires_in_days:
        from datetime import timedelta
        expires_at = datetime.utcnow() + timedelta(days=invitation_data.expires_in_days)

    # Create invitation
    new_invitation = Invitation(
        email=invitation_data.email,
        token=Invitation.generate_token(),
        created_by_user_id=admin_user.id,
        expires_at=expires_at,
        notes=invitation_data.notes
    )

    db.add(new_invitation)
    db.commit()
    db.refresh(new_invitation)

    # Generate invitation URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    invitation_url = f"{frontend_url}/register?token={new_invitation.token}"

    response = InvitationResponse.from_orm(new_invitation)
    response.invitation_url = invitation_url

    return response


@app.get("/api/invitations", response_model=InvitationListResponse)
async def list_invitations(
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, used, revoked, expired"),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    List all invitations with optional status filtering.
    Admin-only endpoint.
    """
    query = db.query(Invitation)

    # Apply status filter
    if status_filter == 'pending':
        query = query.filter(
            Invitation.used_at.is_(None),
            Invitation.revoked == False
        )
        # Also filter out expired
        query = query.filter(
            or_(
                Invitation.expires_at.is_(None),
                Invitation.expires_at > datetime.utcnow()
            )
        )
    elif status_filter == 'used':
        query = query.filter(Invitation.used_at.isnot(None))
    elif status_filter == 'revoked':
        query = query.filter(Invitation.revoked == True)
    elif status_filter == 'expired':
        query = query.filter(
            Invitation.expires_at.isnot(None),
            Invitation.expires_at <= datetime.utcnow(),
            Invitation.used_at.is_(None)
        )

    invitations = query.order_by(Invitation.created_at.desc()).all()

    # Generate invitation URLs for pending invitations
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    invitation_responses = []
    for inv in invitations:
        inv_response = InvitationResponse.from_orm(inv)
        if inv.is_valid():
            inv_response.invitation_url = f"{frontend_url}/register?token={inv.token}"
        invitation_responses.append(inv_response)

    return InvitationListResponse(
        invitations=invitation_responses,
        total=len(invitation_responses)
    )


@app.delete("/api/invitations/{invitation_id}", response_model=MessageResponse)
async def revoke_invitation(
    invitation_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Revoke an invitation (prevent it from being used).
    Admin-only endpoint.
    """
    invitation = db.query(Invitation).filter(Invitation.id == invitation_id).first()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.used_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke an invitation that has already been used"
        )

    invitation.revoked = True
    invitation.revoked_at = datetime.utcnow()

    db.commit()

    return MessageResponse(message="Invitation revoked successfully")


@app.post("/api/invitations/{invitation_id}/resend", response_model=InvitationResponse)
async def resend_invitation(
    invitation_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Resend/refresh an invitation by generating a new token and extending expiration.
    Admin-only endpoint.
    """
    invitation = db.query(Invitation).filter(Invitation.id == invitation_id).first()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.used_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot resend an invitation that has already been used"
        )

    # Generate new token and extend expiration
    invitation.token = Invitation.generate_token()
    invitation.revoked = False
    invitation.revoked_at = None

    # Extend expiration by 7 days from now
    from datetime import timedelta
    invitation.expires_at = datetime.utcnow() + timedelta(days=7)

    db.commit()
    db.refresh(invitation)

    # Generate new invitation URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    invitation_url = f"{frontend_url}/register?token={invitation.token}"

    response = InvitationResponse.from_orm(invitation)
    response.invitation_url = invitation_url

    return response


@app.get("/api/invitations/validate/{token}", response_model=ValidateInvitationResponse)
async def validate_invitation_token(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Validate an invitation token (public endpoint, no auth required).
    Returns whether the token is valid and the associated email.
    """
    invitation = db.query(Invitation).filter(Invitation.token == token).first()

    if not invitation:
        return ValidateInvitationResponse(
            valid=False,
            message="Invalid invitation token"
        )

    if not invitation.is_valid():
        if invitation.used_at:
            message = "This invitation has already been used"
        elif invitation.revoked:
            message = "This invitation has been revoked"
        else:
            message = "This invitation has expired"

        return ValidateInvitationResponse(
            valid=False,
            email=invitation.email,
            message=message
        )

    return ValidateInvitationResponse(
        valid=True,
        email=invitation.email,
        message="Valid invitation"
    )


# ========================================
# Specimen Routes
# ========================================

@app.get("/api/specimens")
async def get_all_specimens(
    page: int = Query(1, ge=1, description="Page number (starts at 1)"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page (max 200)"),
    search: Optional[str] = Query(None, description="Search query for scientific name, family, or collector"),
    sort_by: Optional[str] = Query(None, description="Field to sort by (id, family, genus, collector, collector_number, collection_date, created_at, updated_at)"),
    sort_direction: Optional[str] = Query("asc", description="Sort direction (asc or desc)"),
    pile_id: Optional[int] = Query(None, description="Filter specimens by pile ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get paginated specimens with optional search, sorting, and pile filtering"""
    # Calculate offset
    offset = (page - 1) * page_size

    # Build base query - all authenticated users can see all specimens
    base_query = db.query(Specimen)

    # Apply pile filter if provided
    if pile_id is not None:
        # Get the pile (any authenticated user can access any pile)
        pile = db.query(Pile).filter(Pile.id == pile_id).first()

        if not pile:
            raise HTTPException(status_code=404, detail="Pile not found")

        # Join with pile_specimens to filter by pile membership
        base_query = base_query.join(
            pile_specimens,
            Specimen.id == pile_specimens.c.specimen_id
        ).filter(pile_specimens.c.pile_id == pile_id)

    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        base_query = base_query.filter(
            or_(
                Specimen.scientific_name.ilike(search_pattern),
                Specimen.family.ilike(search_pattern),
                Specimen.code.ilike(search_pattern),
                Specimen.collector.ilike(search_pattern),
                Specimen.collector_number.ilike(search_pattern)
            )
        )

    # Get total count (after search filter)
    total = base_query.count()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    # Apply sorting
    sort_field_map = {
        'id': Specimen.id,
        'family': Specimen.family,
        'genus': Specimen.genus,
        'collector': Specimen.collector,
        'collector_number': Specimen.collector_number,
        'collection_date': Specimen.collection_date,
        'date': Specimen.collection_date,  # Alias for collection_date
        'created_at': Specimen.created_at,
        'createdAt': Specimen.created_at,  # CamelCase alias
        'updated_at': Specimen.updated_at,
        'updatedAt': Specimen.updated_at,  # CamelCase alias
    }

    if sort_by and sort_by in sort_field_map:
        sort_field = sort_field_map[sort_by]
        if sort_direction and sort_direction.lower() == 'desc':
            base_query = base_query.order_by(sort_field.desc())
        else:
            base_query = base_query.order_by(sort_field.asc())
    else:
        # Default sort: newest first
        base_query = base_query.order_by(Specimen.created_at.desc())

    # Get paginated specimens
    specimens = base_query.options(
        joinedload(Specimen.annotations).joinedload(Annotation.user)
    ).offset(offset).limit(page_size).all()

    # Format response
    result = []
    for specimen in specimens:
        # Manually transform annotations using the custom from_orm method
        annotations = [AnnotationResponse.from_orm(anno) for anno in specimen.annotations]

        # Create specimen dict without using from_orm to avoid validation issues
        spec_dict = {
            'id': specimen.id,
            'user_id': specimen.user_id,
            'code': specimen.code,
            'scientific_name': specimen.scientific_name,
            'family': specimen.family,
            'genus': specimen.genus,
            'collector': specimen.collector,
            'collector_number': specimen.collector_number,
            'collection_date': specimen.collection_date,
            'description': specimen.description,
            'microhabitat': specimen.microhabitat,
            'country': specimen.country,
            'state_province': specimen.state_province,
            'county_city': specimen.county_city,
            'locality_description': specimen.locality_description,
            'latitude': specimen.latitude,
            'longitude': specimen.longitude,
            'latdd': specimen.latdd,
            'londd': specimen.londd,
            'elevation': specimen.elevation,
            'habitat': specimen.habitat,
            'created_at': specimen.created_at,
            'updated_at': specimen.updated_at,
            'images': [ImageResponse.from_orm(img).dict() for img in specimen.images],
            'annotations': [anno.dict() for anno in annotations],
            'tags': []
        }
        result.append(spec_dict)

    return {
        'specimens': result,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total': total,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }


@app.get("/api/specimens/{specimen_id}", response_model=SpecimenResponse)
async def get_specimen(
    specimen_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single specimen by ID"""
    specimen = db.query(Specimen).options(
        joinedload(Specimen.annotations).joinedload(Annotation.user),
        joinedload(Specimen.sequences)
    ).filter(
        Specimen.id == specimen_id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    # Manually transform annotations using the custom from_orm method
    annotations = [AnnotationResponse.from_orm(anno) for anno in specimen.annotations]

    # Create specimen dict without using from_orm to avoid validation issues
    spec_dict = {
        'id': specimen.id,
        'user_id': specimen.user_id,
        'code': specimen.code,
        'scientific_name': specimen.scientific_name,
        'family': specimen.family,
        'genus': specimen.genus,
        'wcvp_id': specimen.wcvp_id,
        'collector': specimen.collector,
        'collector_number': specimen.collector_number,
        'collection_date': specimen.collection_date,
        'description': specimen.description,
        'microhabitat': specimen.microhabitat,
        'country': specimen.country,
        'state_province': specimen.state_province,
        'county_city': specimen.county_city,
        'locality_description': specimen.locality_description,
        'latitude': specimen.latitude,
        'longitude': specimen.longitude,
        'latdd': specimen.latdd,
        'londd': specimen.londd,
        'elevation': specimen.elevation,
        'habitat': specimen.habitat,
        'created_at': specimen.created_at,
        'updated_at': specimen.updated_at,
        'images': [ImageResponse.from_orm(img).dict() for img in specimen.images],
        'annotations': [anno.dict() for anno in annotations],
        'sequences': [SequenceResponse.from_orm(seq).dict() for seq in specimen.sequences],
        'tags': []
    }

    return spec_dict


@app.get("/api/specimens/by-code/{code}", response_model=SpecimenResponse)
async def get_specimen_by_code(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single specimen by its unique code identifier"""
    specimen = db.query(Specimen).options(
        joinedload(Specimen.annotations).joinedload(Annotation.user),
        joinedload(Specimen.sequences)
    ).filter(
        Specimen.code == code
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    # Manually transform annotations using the custom from_orm method
    annotations = [AnnotationResponse.from_orm(anno) for anno in specimen.annotations]

    # Create specimen dict without using from_orm to avoid validation issues
    spec_dict = {
        'id': specimen.id,
        'user_id': specimen.user_id,
        'code': specimen.code,
        'scientific_name': specimen.scientific_name,
        'family': specimen.family,
        'genus': specimen.genus,
        'wcvp_id': specimen.wcvp_id,
        'collector': specimen.collector,
        'collector_number': specimen.collector_number,
        'collection_date': specimen.collection_date,
        'description': specimen.description,
        'microhabitat': specimen.microhabitat,
        'country': specimen.country,
        'state_province': specimen.state_province,
        'county_city': specimen.county_city,
        'locality_description': specimen.locality_description,
        'latitude': specimen.latitude,
        'longitude': specimen.longitude,
        'latdd': specimen.latdd,
        'londd': specimen.londd,
        'elevation': specimen.elevation,
        'habitat': specimen.habitat,
        'created_at': specimen.created_at,
        'updated_at': specimen.updated_at,
        'images': [ImageResponse.from_orm(img).dict() for img in specimen.images],
        'annotations': [anno.dict() for anno in annotations],
        'sequences': [SequenceResponse.from_orm(seq).dict() for seq in specimen.sequences],
        'tags': []
    }

    return spec_dict


@app.post("/api/specimens", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_specimen(
    request: Request,
    # Form fields
    code: Optional[str] = Form(None),
    scientific_name: str = Form(...),
    family: Optional[str] = Form(None),
    genus: Optional[str] = Form(None),
    collector: Optional[str] = Form(None),
    collector_number: Optional[str] = Form(None),
    collection_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    microhabitat: Optional[str] = Form(None),
    # Locality fields
    country: Optional[str] = Form(None),
    state_province: Optional[str] = Form(None),
    county_city: Optional[str] = Form(None),
    locality_description: Optional[str] = Form(None),
    latitude: Optional[str] = Form(None),    # Verbatim latitude
    longitude: Optional[str] = Form(None),   # Verbatim longitude
    latdd: Optional[float] = Form(None),     # Decimal degrees latitude
    londd: Optional[float] = Form(None),     # Decimal degrees longitude
    elevation: Optional[str] = Form(None),   # Elevation
    habitat: Optional[str] = Form(None),
    # Image files
    images: List[UploadFile] = File(default=[]),
    # Dependencies
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Create a new specimen with images"""
    # Helper function to convert empty strings to None for optional fields
    def empty_to_none(value):
        return None if value == "" else value

    # Create specimen with locality fields
    new_specimen = Specimen(
        user_id=current_user.id,
        code=empty_to_none(code),
        scientific_name=scientific_name,
        family=empty_to_none(family),
        genus=empty_to_none(genus),
        collector=empty_to_none(collector),
        collector_number=empty_to_none(collector_number),
        collection_date=empty_to_none(collection_date),
        description=empty_to_none(description),
        microhabitat=empty_to_none(microhabitat),
        # Locality fields
        country=empty_to_none(country),
        state_province=empty_to_none(state_province),
        county_city=empty_to_none(county_city),
        locality_description=empty_to_none(locality_description),
        latitude=empty_to_none(latitude),      # Verbatim string
        longitude=empty_to_none(longitude),    # Verbatim string
        latdd=latdd,           # Decimal degrees
        londd=londd,           # Decimal degrees
        elevation=empty_to_none(elevation),   # Elevation
        habitat=empty_to_none(habitat)
    )

    db.add(new_specimen)
    db.flush()  # Get the specimen ID

    # Upload and save images
    base_url = os.getenv("API_IMAGE_URL", "http://localhost:8000")
    for position, image_file in enumerate(images):
        # Save image to disk
        storage_path, original_filename, storage_filename, file_size = await file_storage.save_specimen_image(
            image_file,
            new_specimen.id,
            position
        )

        # Create image record
        image_url = file_storage.get_image_url(storage_path, base_url)
        image_record = Image(
            specimen_id=new_specimen.id,
            filename=original_filename,
            storage_filename=storage_filename,
            storage_path=storage_path,
            url=image_url,
            mime_type=image_file.content_type,
            size_bytes=file_size,
            position=position
        )
        db.add(image_record)

    db.commit()

    return MessageResponse(
        message="Specimen created successfully",
        id=new_specimen.id
    )


@app.put("/api/specimens/{specimen_id}", response_model=MessageResponse)
async def update_specimen(
    request: Request,
    specimen_id: int,
    # Form fields (same as create, all optional for updates)
    code: Optional[str] = Form(None),
    scientific_name: Optional[str] = Form(None),
    family: Optional[str] = Form(None),
    genus: Optional[str] = Form(None),
    collector: Optional[str] = Form(None),
    collector_number: Optional[str] = Form(None),
    collection_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    microhabitat: Optional[str] = Form(None),
    # Locality fields
    country: Optional[str] = Form(None),
    state_province: Optional[str] = Form(None),
    county_city: Optional[str] = Form(None),
    locality_description: Optional[str] = Form(None),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    latdd: Optional[float] = Form(None),
    londd: Optional[float] = Form(None),
    elevation: Optional[str] = Form(None),
    habitat: Optional[str] = Form(None),
    # Image files (optional - for adding new images)
    images: List[UploadFile] = File(default=[]),
    # Dependencies
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Update a specimen and optionally add new images"""
    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    # Update all fields (frontend sends all fields, so we update everything)
    # Note: FastAPI Form() converts empty strings to None, so None means "clear this field"
    specimen.code = code
    specimen.scientific_name = scientific_name
    specimen.family = family
    specimen.genus = genus
    specimen.collector = collector
    specimen.collector_number = collector_number
    specimen.collection_date = collection_date
    specimen.description = description
    specimen.microhabitat = microhabitat
    specimen.country = country
    specimen.state_province = state_province
    specimen.county_city = county_city
    specimen.locality_description = locality_description
    specimen.latitude = latitude
    specimen.longitude = longitude
    specimen.latdd = latdd
    specimen.londd = londd
    specimen.elevation = elevation
    specimen.habitat = habitat

    # Add new images if provided
    if images and len(images) > 0:
        base_url = os.getenv("API_IMAGE_URL", "http://localhost:8000")
        # Get current max position
        max_position = db.query(func.max(Image.position)).filter(
            Image.specimen_id == specimen_id
        ).scalar() or -1

        for i, image_file in enumerate(images):
            position = max_position + 1 + i
            # Save image to disk
            storage_path, original_filename, storage_filename, file_size = await file_storage.save_specimen_image(
                image_file,
                specimen_id,
                position
            )

            # Create image record
            image_url = file_storage.get_image_url(storage_path, base_url)
            image_record = Image(
                specimen_id=specimen_id,
                filename=original_filename,
                storage_filename=storage_filename,
                storage_path=storage_path,
                url=image_url,
                mime_type=image_file.content_type,
                size_bytes=file_size,
                position=position
            )
            db.add(image_record)

    db.commit()

    return MessageResponse(message="Specimen updated successfully")


@app.post("/api/specimens/{specimen_id}/images", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def add_specimen_image(
    request: Request,
    specimen_id: int,
    image: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Add a single image to an existing specimen"""
    specimen = db.query(Specimen).filter(Specimen.id == specimen_id).first()
    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    base_url = os.getenv("API_IMAGE_URL", "http://localhost:8000")
    max_position = db.query(func.max(Image.position)).filter(
        Image.specimen_id == specimen_id
    ).scalar()
    position = 0 if max_position is None else max_position + 1

    storage_path, original_filename, storage_filename, file_size = await file_storage.save_specimen_image(
        image, specimen_id, position
    )

    image_record = Image(
        specimen_id=specimen_id,
        filename=original_filename,
        storage_filename=storage_filename,
        storage_path=storage_path,
        url=file_storage.get_image_url(storage_path, base_url),
        caption=caption.strip() if caption and caption.strip() else None,
        mime_type=image.content_type,
        size_bytes=file_size,
        position=position,
    )
    db.add(image_record)
    db.commit()
    db.refresh(image_record)

    return image_record


@app.put("/api/images/{image_id}/set-primary", response_model=MessageResponse)
async def set_primary_image(
    request: Request,
    image_id: int,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Set an image as the primary image (position 0) for its specimen"""
    # Get the image and verify ownership
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == image.specimen_id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    # Get all images for this specimen, ordered by current position
    all_images = db.query(Image).filter(
        Image.specimen_id == image.specimen_id
    ).order_by(Image.position, Image.id).all()

    # Reorder: selected image at position 0, others sequentially after
    position_counter = 1
    for img in all_images:
        if img.id == image.id:
            img.position = 0
        else:
            img.position = position_counter
            position_counter += 1

    db.commit()

    return MessageResponse(message="Primary image updated")


@app.put("/api/images/{image_id}/caption", response_model=MessageResponse)
async def update_image_caption(
    request: Request,
    image_id: int,
    caption: str = Form(...),
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Update the caption for an image"""
    # Get the image and verify ownership
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == image.specimen_id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    # Update the caption
    image.caption = caption if caption.strip() else None
    db.commit()

    return MessageResponse(message="Caption updated successfully")


@app.delete("/api/images/{image_id}", response_model=MessageResponse)
async def delete_image(
    request: Request,
    image_id: int,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Delete an image from a specimen"""
    # Get the image and verify ownership
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == image.specimen_id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    # Delete the image file from disk
    try:
        file_storage.delete_image(image.storage_path)
    except Exception as e:
        # Log the error but continue with database deletion
        print(f"Warning: Failed to delete image file {image.storage_path}: {e}")

    # Delete from database
    db.delete(image)
    db.commit()

    # Reorder remaining images to ensure sequential positions
    remaining_images = db.query(Image).filter(
        Image.specimen_id == image.specimen_id
    ).order_by(Image.position).all()

    for idx, img in enumerate(remaining_images):
        img.position = idx

    db.commit()

    return MessageResponse(message="Image deleted successfully")


@app.delete("/api/specimens/{specimen_id}", response_model=MessageResponse)
async def delete_specimen(
    request: Request,
    specimen_id: int,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Delete a specimen"""
    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    # Delete associated images from disk
    file_storage.delete_specimen_images(specimen_id)

    # Delete from database (cascade will handle related records)
    db.delete(specimen)
    db.commit()

    return MessageResponse(message="Specimen deleted successfully")


# ========================================
# Pile Routes
# ========================================

@app.get("/api/piles", response_model=List[PileResponse])
async def get_all_piles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all piles"""
    piles = db.query(Pile).order_by(Pile.created_at.desc()).all()

    result = []
    for pile in piles:
        pile_dict = PileResponse.from_orm(pile).dict()
        pile_dict['specimen_ids'] = [s.id for s in pile.specimens]
        pile_dict['specimenIds'] = pile_dict['specimen_ids']  # For frontend compatibility
        result.append(pile_dict)

    return result


@app.post("/api/piles", response_model=PileResponse, status_code=status.HTTP_201_CREATED)
async def create_pile(
    request: Request,
    pile_data: PileCreate,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Create a new pile"""
    new_pile = Pile(
        user_id=current_user.id,
        name=pile_data.name,
        description=pile_data.description
    )

    db.add(new_pile)
    db.commit()
    db.refresh(new_pile)

    response = PileResponse.from_orm(new_pile).dict()
    response['specimen_ids'] = []
    response['specimenIds'] = []
    return response


@app.put("/api/piles/{pile_id}", response_model=MessageResponse)
async def update_pile(
    request: Request,
    pile_id: int,
    pile_data: PileUpdate,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Update a pile"""
    pile = db.query(Pile).filter(
        Pile.id == pile_id
    ).first()

    if not pile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pile not found"
        )

    update_data = pile_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pile, field, value)

    db.commit()

    return MessageResponse(message="Pile updated successfully")


@app.delete("/api/piles/{pile_id}", response_model=MessageResponse)
async def delete_pile(
    request: Request,
    pile_id: int,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Delete a pile"""
    pile = db.query(Pile).filter(
        Pile.id == pile_id
    ).first()

    if not pile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pile not found"
        )

    db.delete(pile)
    db.commit()

    return MessageResponse(message="Pile deleted successfully")


@app.post("/api/piles/{pile_id}/specimens/{specimen_id}", response_model=MessageResponse)
async def add_specimen_to_pile(
    request: Request,
    pile_id: int,
    specimen_id: int,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Add a specimen to a pile"""
    pile = db.query(Pile).filter(
        Pile.id == pile_id
    ).first()

    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id
    ).first()

    if not pile or not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pile or specimen not found"
        )

    # Check if already in pile
    if specimen not in pile.specimens:
        pile.specimens.append(specimen)
        db.commit()

    return MessageResponse(message="Specimen added to pile")


@app.delete("/api/piles/{pile_id}/specimens/{specimen_id}", response_model=MessageResponse)
async def remove_specimen_from_pile(
    request: Request,
    pile_id: int,
    specimen_id: int,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Remove a specimen from a pile"""
    pile = db.query(Pile).filter(
        Pile.id == pile_id
    ).first()

    if not pile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pile not found"
        )

    # Remove specimen from pile
    pile.specimens = [s for s in pile.specimens if s.id != specimen_id]
    db.commit()

    return MessageResponse(message="Specimen removed from pile")


# ========================================
# Annotation Routes
# ========================================

@app.post("/api/specimens/{specimen_id}/annotations", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    request: Request,
    specimen_id: int,
    annotation_data: AnnotationCreate,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Add an annotation to a specimen"""
    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    annotation = Annotation(
        specimen_id=specimen_id,
        user_id=current_user.id,
        text=annotation_data.text
    )

    db.add(annotation)
    db.commit()
    db.refresh(annotation)

    return AnnotationResponse.from_orm(annotation)


@app.delete("/api/annotations/{annotation_id}", response_model=MessageResponse)
async def delete_annotation(
    request: Request,
    annotation_id: int,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Delete an annotation"""
    # Get the annotation
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found"
        )

    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == annotation.specimen_id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found"
        )

    # Delete the annotation
    db.delete(annotation)
    db.commit()

    return MessageResponse(message="Annotation deleted successfully")


# ========================================
# Autocomplete Routes (WCVP Taxonomy)
# ========================================

@app.get("/api/autocomplete/scientific-name")
async def autocomplete_scientific_name(
    q: str = Query(..., min_length=2, description="Search query (minimum 2 characters)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Autocomplete scientific names from WCVP taxonomy database
    Optimized with separate prefix and fuzzy queries for better performance
    """
    prefix_pattern = f"{q}%"
    fuzzy_pattern = f"%{q}%"

    # Split limit between prefix and fuzzy matches
    prefix_limit = min(limit, 10)
    fuzzy_limit = max(limit - prefix_limit, 5)

    # Query 1: Prefix matches (fast, uses index)
    prefix_results = (
        db.query(Taxon)
        .filter(Taxon.scientific_name.ilike(prefix_pattern))
        .order_by(
            Taxon.status != "Accepted",
            Taxon.rank != "Species",
            Taxon.scientific_name
        )
        .limit(prefix_limit)
        .all()
    )

    # Query 2: Fuzzy matches (exclude prefix matches)
    fuzzy_results = []
    if len(prefix_results) < limit:
        fuzzy_results = (
            db.query(Taxon)
            .filter(
                Taxon.scientific_name.ilike(fuzzy_pattern),
                ~Taxon.scientific_name.ilike(prefix_pattern)
            )
            .order_by(
                Taxon.status != "Accepted",
                Taxon.rank != "Species",
                Taxon.scientific_name
            )
            .limit(fuzzy_limit)
            .all()
        )

    # Combine results: prefix first, then fuzzy
    results = prefix_results + fuzzy_results
    results = results[:limit]

    return [{
        "value": r.scientific_name,
        "label": f"{r.scientific_name} {r.author}" if r.author else r.scientific_name,
        "family": r.family,
        "genus": r.genus,
        "rank": r.rank,
        "status": r.status,
        "taxon_id": r.taxon_id,
    } for r in results]


@app.get("/api/autocomplete/family")
async def autocomplete_family(
    q: str = Query(..., min_length=2, description="Search query (minimum 2 characters)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Autocomplete family names from WCVP taxonomy database
    Optimized with separate prefix and fuzzy queries for better performance
    """
    prefix_pattern = f"{q}%"
    fuzzy_pattern = f"%{q}%"

    # Split limit between prefix and fuzzy matches
    prefix_limit = min(limit, 10)
    fuzzy_limit = max(limit - prefix_limit, 5)

    # Query 1: Prefix matches (fast, uses index)
    prefix_results = (
        db.query(Taxon.family)
        .filter(
            Taxon.family.isnot(None),
            Taxon.family.ilike(prefix_pattern)
        )
        .distinct()
        .order_by(Taxon.family)
        .limit(prefix_limit)
        .all()
    )

    # Query 2: Fuzzy matches (exclude prefix matches)
    fuzzy_results = []
    if len(prefix_results) < limit:
        fuzzy_results = (
            db.query(Taxon.family)
            .filter(
                Taxon.family.isnot(None),
                Taxon.family.ilike(fuzzy_pattern),
                ~Taxon.family.ilike(prefix_pattern)
            )
            .distinct()
            .order_by(Taxon.family)
            .limit(fuzzy_limit)
            .all()
        )

    # Combine results
    results = prefix_results + fuzzy_results
    results = results[:limit]

    return [{
        "value": r[0],
        "label": r[0],
    } for r in results]


@app.get("/api/autocomplete/genus")
async def autocomplete_genus(
    q: str = Query(..., min_length=2, description="Search query (minimum 2 characters)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results"),
    family: Optional[str] = Query(None, description="Filter by family"),
    db: Session = Depends(get_db)
):
    """
    Autocomplete genus names from WCVP taxonomy database
    Optimized with separate prefix and fuzzy queries for better performance
    Returns only distinct genus names (not full species names)
    Optionally filter by family for more relevant results
    """
    prefix_pattern = f"{q}%"
    fuzzy_pattern = f"%{q}%"

    # Split limit between prefix and fuzzy matches
    prefix_limit = min(limit, 10)
    fuzzy_limit = max(limit - prefix_limit, 5)

    # Build base filters
    base_filters = [
        Taxon.genus.isnot(None),
        Taxon.rank == "Genus"  # Only genus-rank records
    ]
    if family:
        base_filters.append(Taxon.family == family)

    # Query 1: Prefix matches (fast, uses index)
    prefix_results = (
        db.query(Taxon.genus, Taxon.family)
        .filter(*base_filters, Taxon.genus.ilike(prefix_pattern))
        .distinct()
        .order_by(Taxon.genus)
        .limit(prefix_limit)
        .all()
    )

    # Query 2: Fuzzy matches (exclude prefix matches)
    fuzzy_results = []
    if len(prefix_results) < limit:
        fuzzy_results = (
            db.query(Taxon.genus, Taxon.family)
            .filter(
                *base_filters,
                Taxon.genus.ilike(fuzzy_pattern),
                ~Taxon.genus.ilike(prefix_pattern)
            )
            .distinct()
            .order_by(Taxon.genus)
            .limit(fuzzy_limit)
            .all()
        )

    # Combine results
    results = prefix_results + fuzzy_results
    results = results[:limit]

    return [{
        "value": r[0],
        "label": f"{r[0]} ({r[1]})" if r[1] else r[0],
        "family": r[1],
    } for r in results]


# ========================================
# Sequence Routes
# ========================================

@app.get("/api/specimens/{specimen_id}/sequences")
async def get_specimen_sequences(
    specimen_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all sequences for a specific specimen"""
    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id
    ).first()

    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")

    sequences = db.query(Sequence).filter(
        Sequence.specimen_id == specimen_id
    ).all()

    return {"sequences": sequences, "count": len(sequences)}


@app.get("/api/sequences/{sequence_id}", response_model=SequenceResponse)
async def get_sequence(
    sequence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific sequence by ID"""
    sequence = db.query(Sequence).filter(Sequence.id == sequence_id).first()

    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")

    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == sequence.specimen_id
    ).first()

    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")

    return sequence


@app.post("/api/specimens/{specimen_id}/sequences", status_code=201)
async def create_sequence(
    request: Request,
    specimen_id: int,
    gene: Optional[str] = Form(None),
    genbank_id: Optional[str] = Form(None),
    genbank_accession: Optional[str] = Form(None),
    taxon: Optional[str] = Form(None),
    sequence: str = Form(...),
    suspect: bool = Form(False),
    comments: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Create a new sequence for a specimen"""
    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id
    ).first()

    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")

    # Create sequence
    new_sequence = Sequence(
        specimen_id=specimen_id,
        gene=gene,
        genbank_id=genbank_id,
        genbank_accession=genbank_accession,
        taxon=taxon,
        sequence=sequence,
        suspect=suspect,
        comments=comments
    )

    db.add(new_sequence)
    db.commit()
    db.refresh(new_sequence)

    return {"message": "Sequence created successfully", "sequence_id": new_sequence.id}


@app.put("/api/sequences/{sequence_id}", response_model=MessageResponse)
async def update_sequence(
    request: Request,
    sequence_id: int,
    gene: Optional[str] = Form(None),
    genbank_id: Optional[str] = Form(None),
    genbank_accession: Optional[str] = Form(None),
    taxon: Optional[str] = Form(None),
    sequence: Optional[str] = Form(None),
    suspect: Optional[bool] = Form(None),
    comments: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Update an existing sequence"""
    # Get sequence
    seq = db.query(Sequence).filter(Sequence.id == sequence_id).first()

    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")

    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == seq.specimen_id
    ).first()

    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")

    # Update fields if provided
    if gene is not None:
        seq.gene = gene
    if genbank_id is not None:
        seq.genbank_id = genbank_id
    if genbank_accession is not None:
        seq.genbank_accession = genbank_accession
    if taxon is not None:
        seq.taxon = taxon
    if sequence is not None:
        seq.sequence = sequence
    if suspect is not None:
        seq.suspect = suspect
    if comments is not None:
        seq.comments = comments

    # Explicitly update mtime (onupdate should handle this, but being explicit)
    seq.mtime = datetime.utcnow()

    db.commit()

    return {"message": "Sequence updated successfully"}


@app.delete("/api/sequences/{sequence_id}", response_model=MessageResponse)
async def delete_sequence(
    request: Request,
    sequence_id: int,
    current_user: User = Depends(get_current_user_with_audit),
    db: Session = Depends(get_db)
):
    """Delete a sequence"""
    # Get sequence
    seq = db.query(Sequence).filter(Sequence.id == sequence_id).first()

    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")

    # Get the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == seq.specimen_id
    ).first()

    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")

    db.delete(seq)
    db.commit()

    return {"message": "Sequence deleted successfully"}


# ========================================
# Audit Log Routes
# ========================================

@app.get("/api/audit-logs", response_model=AuditLogListResponse)
async def get_audit_logs(
    table_name: Optional[str] = Query(None, description="Filter by table name (specimens, users, piles, etc.)"),
    record_id: Optional[int] = Query(None, description="Filter by specific record ID"),
    operation: Optional[str] = Query(None, description="Filter by operation type (INSERT, UPDATE, DELETE)"),
    user_id: Optional[int] = Query(None, description="Filter by user who made the change"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    page: int = Query(1, ge=1, description="Page number (starts at 1)"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page (max 200)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Query audit logs with flexible filtering options.
    Returns paginated list of audit log entries showing all database changes.

    Use this endpoint to:
    - View change history for a specific record (table_name + record_id)
    - Track user activity (user_id)
    - Investigate deletions (operation=DELETE)
    - Review changes in a date range (start_date + end_date)
    """
    # Build query
    query = db.query(AuditLog)

    # Apply filters
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)

    if record_id is not None:
        query = query.filter(AuditLog.record_id == record_id)

    if operation:
        # Validate operation value
        if operation.upper() not in ['INSERT', 'UPDATE', 'DELETE']:
            raise HTTPException(
                status_code=400,
                detail="Invalid operation. Must be INSERT, UPDATE, or DELETE"
            )
        query = query.filter(AuditLog.operation == operation.upper())

    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)

    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)

    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)

    # Get total count (before pagination)
    total = query.count()

    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total + page_size - 1) // page_size

    # Apply pagination and ordering (newest first)
    logs = query.order_by(AuditLog.timestamp.desc())\
               .offset(offset)\
               .limit(page_size)\
               .all()

    # Format response
    log_responses = [AuditLogResponse.from_orm(log) for log in logs]

    return AuditLogListResponse(
        logs=log_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_next=page < total_pages,
        has_prev=page > 1
    )


@app.get("/api/audit-logs/record/{table_name}/{record_id}")
async def get_record_audit_history(
    table_name: str,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get complete change history for a specific record.
    Returns all audit log entries for the given table and record ID, ordered chronologically.

    Useful for viewing the full lifecycle of a record (creation, updates, deletion).
    """
    # Validate table name (prevent SQL injection)
    valid_tables = ['specimens', 'users', 'piles', 'images', 'annotations', 'sequences']
    if table_name not in valid_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid table name. Must be one of: {', '.join(valid_tables)}"
        )

    # Query audit logs for this specific record
    logs = db.query(AuditLog)\
             .filter(
                 AuditLog.table_name == table_name,
                 AuditLog.record_id == record_id
             )\
             .order_by(AuditLog.timestamp.asc())\
             .all()

    # Format response
    log_responses = [AuditLogResponse.from_orm(log) for log in logs]

    return {
        "table_name": table_name,
        "record_id": record_id,
        "total_changes": len(log_responses),
        "history": log_responses
    }


@app.get("/api/audit-logs/stats")
async def get_audit_stats(
    start_date: Optional[datetime] = Query(None, description="Start date for stats"),
    end_date: Optional[datetime] = Query(None, description="End date for stats"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get audit log statistics and summary.
    Returns counts by operation type, table, and user.

    Useful for monitoring overall system activity and user behavior.
    """
    # Build base query
    query = db.query(AuditLog)

    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)

    # Total count
    total_logs = query.count()

    # Count by operation
    operations = db.query(
        AuditLog.operation,
        func.count(AuditLog.id).label('count')
    )
    if start_date:
        operations = operations.filter(AuditLog.timestamp >= start_date)
    if end_date:
        operations = operations.filter(AuditLog.timestamp <= end_date)
    operations = operations.group_by(AuditLog.operation).all()

    # Count by table
    tables = db.query(
        AuditLog.table_name,
        func.count(AuditLog.id).label('count')
    )
    if start_date:
        tables = tables.filter(AuditLog.timestamp >= start_date)
    if end_date:
        tables = tables.filter(AuditLog.timestamp <= end_date)
    tables = tables.group_by(AuditLog.table_name)\
                   .order_by(func.count(AuditLog.id).desc())\
                   .all()

    # Count by user (top 10)
    users = db.query(
        AuditLog.user_email,
        func.count(AuditLog.id).label('count')
    )
    if start_date:
        users = users.filter(AuditLog.timestamp >= start_date)
    if end_date:
        users = users.filter(AuditLog.timestamp <= end_date)
    users = users.filter(AuditLog.user_email.isnot(None))\
                 .group_by(AuditLog.user_email)\
                 .order_by(func.count(AuditLog.id).desc())\
                 .limit(10)\
                 .all()

    return {
        "total_logs": total_logs,
        "by_operation": {op: count for op, count in operations},
        "by_table": {table: count for table, count in tables},
        "top_users": [{"email": email, "count": count} for email, count in users],
        "date_range": {
            "start": start_date.isoformat() if start_date else None,
            "end": end_date.isoformat() if end_date else None
        }
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
