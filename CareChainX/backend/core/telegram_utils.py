# core/telegram_utils.py
import httpx
from django.conf import settings
import logging

# Get an instance of a logger
logger = logging.getLogger(__name__)

async def send_telegram_message(chat_id: str, message: str):
    """
    A simple utility function to send a message to a specific user
    via the Telegram Bot API.

    This function is designed to be called from anywhere in the Django
    application (e.g., from a webhook view after processing a form).

    Args:
        chat_id (str): The unique identifier for the target chat.
        message (str): The text message to send. Supports Markdown.
    """
    # Get the bot token from your Django settings.py file
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        logger.error("CRITICAL: TELEGRAM_BOT_TOKEN is not configured in Django settings.")
        return

    # Construct the full URL for the sendMessage API method
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    
    # Prepare the data payload as a dictionary
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown"  # Allows for formatting like *bold* and _italic_
    }

    # Use httpx.AsyncClient for efficient, asynchronous network requests
    async with httpx.AsyncClient() as client:
        try:
            # Make the POST request to the Telegram API
            response = await client.post(url, json=payload)
            # Raise an exception if the request was unsuccessful (e.g., 400, 404, 500)
            response.raise_for_status()
            logger.info(f"Successfully sent message to chat_id {chat_id}")
        except httpx.RequestError as e:
            # This catches network-level errors (e.g., connection refused)
            logger.error(f"Failed to send Telegram message to {chat_id}: Network error {e}")
        except httpx.HTTPStatusError as e:
            # This catches API-level errors (e.g., bad request, invalid chat_id)
            logger.error(f"Failed to send Telegram message to {chat_id}: API error {e.response.status_code} - {e.response.text}")
