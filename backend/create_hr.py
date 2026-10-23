
from getpass import getpass

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import SessionLocal
from app.models import User, UserRole


def main():
    db: Session = SessionLocal()

    try:
        print("\n=== Create WorkSphere HR Account ===")

        username = input("Enter HR username: ").strip()
        email = input("Enter HR email: ").strip().lower()
        password = getpass("Enter HR password (minimum 8 characters): ")
        confirm_password = getpass("Confirm HR password: ")

        if len(username) < 3 or len(username) > 50:
            print("Error: Username must contain 3 to 50 characters.")
            return

        if len(password) < 8 or len(password) > 128:
            print("Error: Password must contain 8 to 128 characters.")
            return

        if password != confirm_password:
            print("Error: Passwords do not match.")
            return

        existing_user = db.query(User).filter(
            (User.username == username)
            | (User.email == email)
        ).first()

        if existing_user:
            print("Error: That username or email is already registered.")
            return

        hr_user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.HR,
        )

        db.add(hr_user)
        db.commit()
        db.refresh(hr_user)

        print("\nHR account created successfully!")
        print(f"User ID: {hr_user.id}")
        print(f"Username: {hr_user.username}")
        print(f"Email: {hr_user.email}")
        print(f"Role: {hr_user.role.value}")
        print("\nYou can now log in using this email and password.")

    except Exception as error:
        db.rollback()
        print(f"Error creating HR account: {error}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
