from django.conf import settings
from rest_framework import permissions
import jwt


class IsBot(permissions.BasePermission):
    """
    Custom permission to only allow requests from our trusted bot
    (via a secret API key).
    """
    def has_permission(self, request, view):
        bot_api_key = request.headers.get('X-Bot-Api-Key')
        return bot_api_key and bot_api_key == settings.BOT_API_KEY



class IsBotOrAuthenticated(permissions.BasePermission):
    """
    Custom permission to only allow requests that are either:
    1. Authenticated with a user's JWT token (for the React app).
    2. Coming from our trusted bot, identified by a secret API key.
    """
    def has_permission(self, request, view):
        # Check if the request has the secret bot API key in its headers
        bot_api_key = request.headers.get('X-Bot-Api-Key')
        if bot_api_key and bot_api_key == settings.BOT_API_KEY:
            return True # Allow the request if the key is correct

        # If no valid bot key, fall back to the standard IsAuthenticated check
        # This will check for a user's JWT token.
        return request.user and request.user.is_authenticated



class HasValidActionToken(permissions.BasePermission):
    """
    A custom permission class that checks for a valid JWT in the URL
    query parameters.
    """
    message = 'Invalid or expired action token.'

    def has_permission(self, request, view):
        token = request.query_params.get('token')
        if not token:
            return False
            
        try:
            # Decode the token. This automatically checks the signature and expiration.
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            
            # Attach the validated payload to the request object so the view can use it.
            request.action_payload = payload
            
            return True
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return False