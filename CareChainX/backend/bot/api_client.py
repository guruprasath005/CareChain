# bot/api_client.py
import os
import httpx
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Get the base URL for the API from an environment variable.
# The default value 'http://web:8000/api' is specifically for Docker Compose,
# where 'web' is the name of our Django service.
API_BASE_URL = os.getenv("API_BASE_URL", "http://web:8000/api")
BOT_API_KEY = os.getenv("BOT_API_KEY")

async def check_telegram_profile(chat_id: str):
    """
    Calls the Django API to check if a Telegram profile exists for a given chat_id.
    """
    async with httpx.AsyncClient() as client:
        try:
            
            headers = {"X-Bot-Api-Key": BOT_API_KEY}
            response = await client.get(f"{API_BASE_URL}/users/telegram-check/{chat_id}/", headers=headers)
            response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
            return response.json()
        except httpx.RequestError as exc:
            logger.error(f"API call to check_telegram_profile failed: {exc}")
            return {"exists": False, "error": "API connection failed"}

async def register_user(data: dict):
    """
    Calls the Django API to register a new user.
    'data' should be a dictionary with first_name, last_name, email, password, and chat_id.
    """
    async with httpx.AsyncClient() as client:
        # The httpx library automatically handles converting the dict to JSON
        
        headers = {"X-Bot-Api-Key": BOT_API_KEY}
        response = await client.post(f"{API_BASE_URL}/users/register/", json=data,headers=headers)
        
        # This will raise an HTTPStatusError if the API returns an error (like 400 Bad Request)
        # which we can catch in our handler.
        response.raise_for_status()
        
        return response.json()


async def resend_verification_email(user_id: int):
    """
    Calls the Django API to request a new verification email for a user.
    Authenticates using the bot's secret API key.
    """
    if not BOT_API_KEY:
        logger.error("CRITICAL: BOT_API_KEY is not set!")
        raise ValueError("Bot API Key is missing.")

    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id}
    
    url = f"{API_BASE_URL}/users/resend-verification/"
    logger.info(f"Attempting to call API: POST {url}")
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()


async def create_role_profile(data: dict):
    """
    Calls the Django API to create a role profile (Candidate or Employer) for a user.
    'data' should be a dictionary with user_id and role.
    """
    
    if not BOT_API_KEY:
        logger.error("CRITICAL: BOT_API_KEY is not set in the environment!")
        raise ValueError("Bot API Key is missing.")

    # Create the authorization header with our secret key
    headers = {"X-Bot-Api-Key": BOT_API_KEY}   
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{API_BASE_URL}/users/role-profile/", json=data,headers=headers)
        response.raise_for_status()
        return response.json()
    

async def check_profile_status(user_id: int, profile_type: str):
    """
    Calls the Django API to check if a user's profile is complete.
    Authenticates using the bot's secret API key.
    """
    if not BOT_API_KEY:
        logger.error("CRITICAL: BOT_API_KEY is not set!")
        raise ValueError("Bot API Key is missing.")

    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id, "profile_type": profile_type}
    
    url = f"{API_BASE_URL}/users/profile-status-check/"
    logger.info(f"Attempting to call API: POST {url}")
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()


    

    
async def generate_form_token(user_id: int, profile_type: str):
    """
    Calls the Django API to get a new form submission token for a user.
    Authenticates using the bot's secret API key.
    """
    if not BOT_API_KEY:
        logger.error("CRITICAL: BOT_API_KEY is not set!")
        raise ValueError("Bot API Key is missing.")

    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id, "profile_type": profile_type}
    
    url = f"{API_BASE_URL}/users/generate-form-token/"
    logger.info(f"Attempting to call API: POST {url}")
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()


async def set_profile_location(user_id: int, profile_type: str, latitude: float, longitude: float):
    """
    Calls the Django API to save the coordinates for a user's profile.
    Authenticates using the bot's secret API key.
    """
    if not BOT_API_KEY:
        logger.error("CRITICAL: BOT_API_KEY is not set!")
        raise ValueError("Bot API Key is missing.")

    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {
        "user_id": user_id,
        "profile_type": profile_type,
        "latitude": latitude,
        "longitude": longitude
    }
    
    url = f"{API_BASE_URL}/users/set-location/"
    logger.info(f"Attempting to call API: POST {url}")
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()
    

async def request_profile_summary(user_id: int, role_type: str):
    """
    Calls the API to trigger the generation of the user's own profile summary.
    """
    if not BOT_API_KEY: raise ValueError("Bot API Key is missing.")
    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id, "role_type": role_type}
    url = f"{API_BASE_URL}/users/request-profile-summary/"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()

    
async def request_job_post_summary(user_id: int):
    """
    Calls the API to trigger the generation of the job post summary for a given user.
    This is a 'fire-and-forget' request.
    """
    if not BOT_API_KEY:
        raise ValueError("Bot API Key is missing.")
    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id}
    url = f"{API_BASE_URL}/jobs/employer/request-summary/" 
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()
    
    
async def request_my_applications_summary(user_id: int):
    """
    Calls the API to trigger the generation of the candidate's application list.
    This is a 'fire-and-forget' request.
    """
    if not BOT_API_KEY:
        raise ValueError("Bot API Key is missing.")

    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id}
    url = f"{API_BASE_URL}/jobs/candidate/request-applications-list/"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()
    
    
async def request_employee_list_summary(user_id: int):
    """
    Calls the API to trigger the generation of the employer's employee list.
    """
    if not BOT_API_KEY: raise ValueError("Bot API Key is missing.")
    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id}
    url = f"{API_BASE_URL}/jobs/employer/request-employee-list/"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()
    
    
async def request_my_jobs_summary(user_id: int):
    """
    Calls the API to trigger the generation of the candidate's current job list.
    """
    if not BOT_API_KEY: raise ValueError("Bot API Key is missing.")
    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id}
    url = f"{API_BASE_URL}/jobs/candidate/request-jobs-list/"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()
    
    
async def check_job_quota(user_id: int):
    """Calls the API to check if an employer has available job post quota."""
    if not BOT_API_KEY: raise ValueError("Bot API Key is missing.")
    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id}
    url = f"{API_BASE_URL}/users/check-job-quota/" # We will create this view next
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()

async def create_payment_link(user_id: int):
    """Calls the API to generate a Razorpay payment link."""
    if not BOT_API_KEY: raise ValueError("Bot API Key is missing.")
    headers = {"X-Bot-Api-Key": BOT_API_KEY}
    data = {"user_id": user_id}
    url = f"{API_BASE_URL}/payments/create-link/"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()