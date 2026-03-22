# core/utils.py
import jwt
import os
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.urls import reverse

def generate_secure_action_url(path_name: str, payload: dict, expiry_days: int = 3):
    """
    Generates a secure, time-limited URL with an embedded JWT.

    Args:
        path_name (str): The 'name' of the URL pattern from urls.py.
        payload (dict): The data to encode into the JWT.
        expiry_days (int): How many days the link should be valid for.

    Returns:
        str: The full, absolute URL with the token.
    """
    # Add expiration and issuance timestamps to the payload
    payload['exp'] = datetime.now(timezone.utc) + timedelta(days=expiry_days)
    payload['iat'] = datetime.now(timezone.utc)
    
    # Create the JWT
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    
    # Get the base URL path from the Django router
    relative_url = reverse(path_name)
    
    # Get the public domain from the environment
    site_domain = os.getenv('SITE_DOMAIN', 'localhost:8000')
    
    # Construct the final, absolute URL with the token
    return f"https://{site_domain}{relative_url}?token={token}"
