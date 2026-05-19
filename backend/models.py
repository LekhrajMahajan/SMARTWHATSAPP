from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from typing import Optional

def get_ist_time():
    # India Standard Time (IST) is UTC+5:30
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).replace(tzinfo=None)

def is_within_ist_window(start_hour=10, end_hour=18):
    now = get_ist_time()
    return start_hour <= now.hour < end_hour

class User(BaseModel):
    username: str
    email: str
    hashed_password: str
    linked_wa_number: Optional[str] = None
    is_verified: bool = False
    verification_token: Optional[str] = None

class Contact(BaseModel):
    username: str
    name: str
    number: str

class MessageLog(BaseModel):
    username: str
    name: str
    number: str
    message: str
    status: str
    created_at: Optional[datetime] = None

    def __init__(self, **data):
        super().__init__(**data)
        if self.created_at is None:
            self.created_at = get_ist_time()