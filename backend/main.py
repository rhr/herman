"""
FastAPI main application for Herbarium Pro
"""
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import List, Optional
import os
from dotenv import load_dotenv

# Local imports
from database import get_db, create_tables
from models import User, Specimen, Image, Pile, Annotation, pile_specimens
from schemas import (
    UserRegister, UserLogin, TokenResponse, UserResponse,
    SpecimenCreate, SpecimenUpdate, SpecimenResponse, SpecimenListResponse,
    ImageResponse,
    PileCreate, PileUpdate, PileResponse,
    AnnotationCreate, AnnotationResponse,
    MessageResponse
)
from auth import hash_password, verify_password, create_access_token, get_current_user
from storage import file_storage

load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Herbarium Pro API",
    description="Backend API for digital herbarium management",
    version="1.0.0"
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
    """Create database tables on startup"""
    create_tables()
    print("🚀 Herbarium Pro API started successfully")


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
# Authentication Routes
# ========================================

@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user - DISABLED"""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Registration is disabled. Please contact the administrator for access."
    )

    # Registration code disabled below
    # # Check if email already exists
    # existing_user = db.query(User).filter(User.email == user_data.email).first()
    # if existing_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Email already registered"
    #     )
    #
    # # Create new user
    # hashed_password = hash_password(user_data.password)
    # new_user = User(
    #     email=user_data.email,
    #     password_hash=hashed_password,
    #     name=user_data.name,
    #     institution=user_data.institution
    # )
    #
    # db.add(new_user)
    # db.commit()
    # db.refresh(new_user)
    #
    # # Generate token (convert ID to string for JWT)
    # access_token = create_access_token(data={"sub": str(new_user.id)})
    #
    # return TokenResponse(
    #     access_token=access_token,
    #     user=UserResponse.from_orm(new_user)
    # )


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
# Specimen Routes
# ========================================

@app.get("/api/specimens")
async def get_all_specimens(
    page: int = Query(1, ge=1, description="Page number (starts at 1)"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page (max 200)"),
    search: Optional[str] = Query(None, description="Search query for scientific name, family, or collector"),
    sort_by: Optional[str] = Query(None, description="Field to sort by (id, family, genus, collector, collector_number, collection_date, created_at, updated_at)"),
    sort_direction: Optional[str] = Query("asc", description="Sort direction (asc or desc)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get paginated specimens for the authenticated user with optional search and sorting"""
    # Calculate offset
    offset = (page - 1) * page_size

    # Build base query
    base_query = db.query(Specimen).filter(Specimen.user_id == current_user.id)

    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        base_query = base_query.filter(
            or_(
                Specimen.scientific_name.ilike(search_pattern),
                Specimen.family.ilike(search_pattern),
                Specimen.genus.ilike(search_pattern),
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
        joinedload(Specimen.annotations).joinedload(Annotation.user)
    ).filter(
        Specimen.id == specimen_id,
        Specimen.user_id == current_user.id
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

    return spec_dict


@app.post("/api/specimens", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_specimen(
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
    current_user: User = Depends(get_current_user),
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
    base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a specimen and optionally add new images"""
    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id,
        Specimen.user_id == current_user.id
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
        base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
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


@app.put("/api/images/{image_id}/set-primary", response_model=MessageResponse)
async def set_primary_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
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

    # Verify the user owns the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == image.specimen_id,
        Specimen.user_id == current_user.id
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
    image_id: int,
    caption: str = Form(...),
    current_user: User = Depends(get_current_user),
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

    # Verify the user owns the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == image.specimen_id,
        Specimen.user_id == current_user.id
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
    image_id: int,
    current_user: User = Depends(get_current_user),
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

    # Verify the user owns the specimen
    specimen = db.query(Specimen).filter(
        Specimen.id == image.specimen_id,
        Specimen.user_id == current_user.id
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
    specimen_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specimen"""
    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id,
        Specimen.user_id == current_user.id
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
    """Get all piles for the authenticated user"""
    piles = db.query(Pile).filter(
        Pile.user_id == current_user.id
    ).order_by(Pile.created_at.desc()).all()

    result = []
    for pile in piles:
        pile_dict = PileResponse.from_orm(pile).dict()
        pile_dict['specimen_ids'] = [s.id for s in pile.specimens]
        pile_dict['specimenIds'] = pile_dict['specimen_ids']  # For frontend compatibility
        result.append(pile_dict)

    return result


@app.post("/api/piles", response_model=PileResponse, status_code=status.HTTP_201_CREATED)
async def create_pile(
    pile_data: PileCreate,
    current_user: User = Depends(get_current_user),
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
    pile_id: int,
    pile_data: PileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a pile"""
    pile = db.query(Pile).filter(
        Pile.id == pile_id,
        Pile.user_id == current_user.id
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
    pile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a pile"""
    pile = db.query(Pile).filter(
        Pile.id == pile_id,
        Pile.user_id == current_user.id
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
    pile_id: int,
    specimen_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a specimen to a pile"""
    pile = db.query(Pile).filter(
        Pile.id == pile_id,
        Pile.user_id == current_user.id
    ).first()

    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id,
        Specimen.user_id == current_user.id
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
    pile_id: int,
    specimen_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a specimen from a pile"""
    pile = db.query(Pile).filter(
        Pile.id == pile_id,
        Pile.user_id == current_user.id
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
    specimen_id: int,
    annotation_data: AnnotationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add an annotation to a specimen"""
    specimen = db.query(Specimen).filter(
        Specimen.id == specimen_id,
        Specimen.user_id == current_user.id
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
    annotation_id: int,
    current_user: User = Depends(get_current_user),
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

    # Verify the user owns the specimen (and thus can delete annotations)
    specimen = db.query(Specimen).filter(
        Specimen.id == annotation.specimen_id,
        Specimen.user_id == current_user.id
    ).first()

    if not specimen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specimen not found or you don't have permission to delete this annotation"
        )

    # Delete the annotation
    db.delete(annotation)
    db.commit()

    return MessageResponse(message="Annotation deleted successfully")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
