
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ProfileUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=2, max_length=150)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value):
        if value is None:
            return value

        value = value.strip()
        if len(value) < 2:
            raise ValueError("Full name must contain at least 2 characters.")

        return value


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class NotificationPreferencesUpdate(BaseModel):
    email_notifications: bool = True
    in_app_notifications: bool = True


class NotificationPreferencesResponse(BaseModel):
    email_notifications: bool
    in_app_notifications: bool

    model_config = ConfigDict(from_attributes=True)
