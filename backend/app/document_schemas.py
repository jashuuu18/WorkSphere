
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentResponse(BaseModel):
    id: int
    employee_id: int
    file_name: str = Field(max_length=255)
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    message: str
    document: DocumentResponse
