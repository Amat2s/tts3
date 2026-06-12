"""Shared pytest fixtures for backend tests.

Provides an isolated in-memory SQLite database session so DB-backed services
(e.g. the Unit 43 solver result application service) can be tested without a
running Postgres instance. No new package is required — SQLite ships with
Python and is supported by SQLAlchemy.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401  (registers all models on Base.metadata)
from db.session import Base


@pytest.fixture
def db():
    """Yield a fresh, isolated SQLite-backed SQLAlchemy session per test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
