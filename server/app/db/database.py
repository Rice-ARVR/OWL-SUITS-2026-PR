from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings

client: MongoClient | None = None
db: Database | None = None


def connect():
    global client, db
    client = MongoClient(settings.MONGODB_URL)
    client.admin.command("ping")
    db = client[settings.MONGO_DB]
    print(f"Connected to MongoDB (db: {settings.MONGO_DB})")


def disconnect():
    global client
    if client:
        client.close()
        print("Disconnected from MongoDB")
