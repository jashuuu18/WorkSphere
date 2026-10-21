
from getpass import getpass

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import User, UserRole

Base.metadata.create_all(bind=engine)


def main():
    db = SessionLocal()

    try:
        existing_admin = db.query(User).filter(
            User.role == UserRole.ADMIN
        ).first()

        if existing_admin:
            print("An administrator account already exists.")
            return

        username = input("Admin username: ").strip()
        email = input("Admin email: ").strip().lower()
        password = getpass("Admin password (minimum 8 characters): ")

        if len(username) < 3:
            print("Username must contain at least 3 characters.")
            return

        if "@" not in email:
            print("Enter a valid email address.")
            return

        if len(password) < 8 or len(password) > 128:
            print("Password must contain 8 to 128 characters.")
            return

        duplicate = db.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()

        if duplicate:
            print("That username or email is already registered.")
            return

        admin = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
        )

        db.add(admin)
        db.commit()

        print("Administrator account created successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
