"""Shared fixtures for Pattern Pack Python tests."""

from __future__ import annotations

import os

import pytest
from pymongo import MongoClient

DEFAULT_URI = "mongodb://127.0.0.1:27017"


def get_uri() -> str:
    return os.environ.get("MONGODB_URI", DEFAULT_URI)


@pytest.fixture(scope="session")
def mongo_uri() -> str:
    return get_uri()


@pytest.fixture(scope="session")
def client(mongo_uri: str):
    c = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    c.admin.command("ping")
    yield c
    c.close()
