
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.document_schemas import DocumentResponse, DocumentUploadResponse
from app.models import Document, Employee, User, UserRole


router = APIRouter(
    prefix="/documents",
    tags=["Document Management"],
)

# Private directory: do not expose this using StaticFiles.
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "private_uploads" / "documents"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".png",
    ".jpg",
    ".jpeg",
}

ALLOWED_CONTENT_TYPES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword", "application/octet-stream"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream",
    },
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
}


def get_employee_for_user(db: Session, user_id: int) -> Employee:
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == user_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your employee profile has not been created yet",
        )

    return employee


def get_document_or_404(db: Session, document_id: int) -> Document:
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document


def check_document_access(
    db: Session,
    document: Document,
    current_user: User,
) -> None:
    """Employees may access their own documents; HR/Admin may access all."""

    if current_user.role in (UserRole.HR, UserRole.ADMIN):
        return

    employee = get_employee_for_user(db, current_user.id)

    if document.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this document",
        )


def validate_file_content(extension: str, content: bytes) -> bool:
    """Basic file-signature validation in addition to extension checks."""

    if extension == ".pdf":
        return content.startswith(b"%PDF-")

    if extension in {".jpg", ".jpeg"}:
        return content.startswith(b"\xff\xd8\xff")

    if extension == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")

    if extension == ".doc":
        return content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")

    if extension == ".docx":
        # DOCX files are ZIP containers.
        return content.startswith(b"PK\x03\x04")

    return False


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    employee_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Employees upload to their own profile.
    HR/Admin may upload on behalf of an employee by supplying employee_id.
    """

    if current_user.role in (UserRole.HR, UserRole.ADMIN):
        if employee_id is None or employee_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="HR/Admin must provide a valid employee_id",
            )

        employee = (
            db.query(Employee)
            .filter(Employee.id == employee_id)
            .first()
        )

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )
    else:
        employee = get_employee_for_user(db, current_user.id)

        if employee_id is not None and employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can upload documents only to your own profile",
            )

    original_name = Path(file.filename or "").name.strip()

    if not original_name or original_name in {".", ".."}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid filename is required",
        )

    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Allowed file types: PDF, DOC, DOCX, PNG, JPG, JPEG",
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES[extension]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The uploaded file content type does not match its extension",
        )

    # Read at most 5 MB + 1 byte to detect oversized uploads.
    content = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Maximum document size is 5 MB",
        )

    if not validate_file_content(extension, content):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The file contents do not match the selected file type",
        )

    # Generate a storage name that cannot contain user-supplied path elements.
    storage_name = f"{uuid4().hex}{extension}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    storage_path = UPLOAD_DIR / storage_name

    document = Document(
        employee_id=employee.id,
        file_name=original_name,
        file_url=storage_name,
    )

    try:
        storage_path.write_bytes(content)
        db.add(document)
        db.commit()
        db.refresh(document)

        return {
            "message": "Document uploaded successfully",
            "document": document,
        }
    except Exception:
        db.rollback()

        if storage_path.exists():
            storage_path.unlink()

        raise


@router.get(
    "/me",
    response_model=list[DocumentResponse],
)
def get_my_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List documents belonging to the logged-in employee."""

    employee = get_employee_for_user(db, current_user.id)

    return (
        db.query(Document)
        .filter(Document.employee_id == employee.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )


@router.get(
    "/",
    response_model=list[DocumentResponse],
)
def list_all_documents(
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """HR/Admin list all documents or filter by employee ID."""

    query = db.query(Document)

    if employee_id is not None:
        query = query.filter(Document.employee_id == employee_id)

    return query.order_by(Document.uploaded_at.desc()).all()


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
)
def get_document_details(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return metadata only after checking document access."""

    document = get_document_or_404(db, document_id)
    check_document_access(db, document, current_user)
    return document


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a document after checking its owner's permissions."""

    document = get_document_or_404(db, document_id)
    check_document_access(db, document, current_user)

    # file_url contains a generated UUID filename, not a user-supplied path.
    storage_name = Path(document.file_url).name

    if storage_name != document.file_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid document storage reference",
        )

    storage_path = UPLOAD_DIR / storage_name

    if not storage_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The stored document file could not be found",
        )

    extension = Path(document.file_name).suffix.lower()
    media_type = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(extension, "application/octet-stream")

    return FileResponse(
        path=str(storage_path),
        media_type=media_type,
        filename=Path(document.file_name).name,
        headers={"Cache-Control": "private, no-store"},
    )
#---------

@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = get_document_or_404(db, document_id)
    check_document_access(db, document, current_user)

    storage_name = Path(document.file_url).name
    if storage_name != document.file_url:
        raise HTTPException(
            status_code=500,
            detail="Invalid document storage reference",
        )

    storage_path = UPLOAD_DIR / storage_name

    # Delete the database record first, then remove the physical file.
    try:
        db.delete(document)
        db.commit()
    except Exception:
        db.rollback()
        raise

    if storage_path.is_file():
        try:
            storage_path.unlink()
        except OSError:
            # The database record is deleted, but the physical file
            # could not be removed. Log this for manual cleanup.
            import logging
            logging.exception(
                "Could not delete stored document: %s",
                storage_path,
            )

    return None
