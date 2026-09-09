import os
import requests

mailtrap_token = "066b94e6b23c13be36a7473aa4054fdf"
mailtrap_inbox_id = "4640958"

url = f"https://sandbox.api.mailtrap.io/api/send/{mailtrap_inbox_id}"

payload = {
    "to": [{"email": "test@example.com"}],
    "from": {"email": "noreply@smartwhatsapp.com", "name": "Smart WhatsApp Sender"},
    "subject": "Test Email",
    "text": "This is a test email."
}

headers = {
    "Authorization": f"Bearer {mailtrap_token}",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
