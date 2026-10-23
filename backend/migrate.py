
from sqlalchemy import inspect, text

from app.database import Base, engine
from app import models


def migrate():
    # Create any missing tables without deleting existing data.
    Base.metadata.create_all(bind=engine)

    # Check the existing users table columns.
    inspector = inspect(engine)
    columns = {
        column["name"]
        for column in inspector.get_columns("users")
    }

    # Add is_active to existing databases if it is missing.
    if "is_active" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
                )
            )

        print("Added users.is_active successfully.")
        print("Existing users are active by default.")
    else:
        print("users.is_active already exists. No changes needed.")

    print("Module 13 database migration completed successfully.")


if __name__ == "__main__":
    migrate()
