import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Use environment variable for MongoDB URI
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is not set")

client = MongoClient(MONGO_URI)

# Select the database
db = client.smart_whatsapp
