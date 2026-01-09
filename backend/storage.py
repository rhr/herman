"""
Local file storage handler for images
"""
import os
import uuid
import shutil
from pathlib import Path
from typing import List, Tuple
from fastapi import UploadFile, HTTPException
import aiofiles
from dotenv import load_dotenv

load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 104857600))  # 100MB default
ALLOWED_EXTENSIONS = os.getenv("ALLOWED_EXTENSIONS", "jpg,jpeg,png,gif,webp").split(",")


class FileStorage:
    def __init__(self):
        self.upload_dir = Path(UPLOAD_DIR)
        self.specimens_dir = self.upload_dir / "specimens"
        self._ensure_directories()

    def _ensure_directories(self):
        """Create upload directories if they don't exist"""
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.specimens_dir.mkdir(parents=True, exist_ok=True)

    def _get_file_extension(self, filename: str) -> str:
        """Extract file extension"""
        return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    def _is_allowed_file(self, filename: str) -> bool:
        """Check if file extension is allowed"""
        ext = self._get_file_extension(filename)
        return ext in ALLOWED_EXTENSIONS

    def _generate_unique_filename(self, original_filename: str) -> str:
        """Generate a unique filename"""
        ext = self._get_file_extension(original_filename)
        unique_id = str(uuid.uuid4())
        return f"{unique_id}.{ext}"

    async def save_specimen_image(
        self,
        file: UploadFile,
        specimen_id: int,
        position: int = 0
    ) -> Tuple[str, str, str, int]:
        """
        Save a specimen image to disk

        Returns:
            Tuple of (storage_path, original_filename, storage_filename, file_size)
        """
        # Validate file extension
        if not self._is_allowed_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Create specimen-specific directory (convert int ID to string for path)
        specimen_dir = self.specimens_dir / str(specimen_id)
        specimen_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        unique_filename = self._generate_unique_filename(file.filename)
        file_path = specimen_dir / unique_filename

        # Save file
        file_size = 0
        async with aiofiles.open(file_path, 'wb') as out_file:
            while content := await file.read(8192):  # Read in chunks
                file_size += len(content)
                if file_size > MAX_FILE_SIZE:
                    # Clean up partial file
                    await out_file.close()
                    file_path.unlink()
                    raise HTTPException(
                        status_code=400,
                        detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
                    )
                await out_file.write(content)

        # Return relative storage path and both filenames
        storage_path = f"specimens/{specimen_id}/{unique_filename}"
        original_filename = file.filename or "unknown.jpg"
        return storage_path, original_filename, unique_filename, file_size

    def delete_specimen_images(self, specimen_id: int):
        """Delete all images for a specimen"""
        specimen_dir = self.specimens_dir / str(specimen_id)
        if specimen_dir.exists():
            shutil.rmtree(specimen_dir)

    def delete_image(self, storage_path: str):
        """Delete a single image"""
        file_path = self.upload_dir / storage_path
        if file_path.exists():
            file_path.unlink()

    def get_image_url(self, storage_path: str, base_url: str) -> str:
        """Generate public URL for an image"""
        # return f"{base_url}/uploads/{storage_path}"
        return f"{base_url}/{storage_path}"


# Global instance
file_storage = FileStorage()
