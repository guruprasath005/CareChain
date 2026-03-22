# api/urls.py
from django.urls import path, include

urlpatterns = [
    # Any URL starting with 'users/' will be handled by the 'users.urls' file.
    # The full path will be /api/users/...
    path('users/', include('users.urls')),
    path('profiles/', include('profiles.urls')),
    path('jobs/', include('jobs.urls')),
    
    
    # Google form Webhook Urls
    path('webhooks/', include('webhooks.urls')),
    
    # Telegram Endpoint
    path('telegram-webhook/', include('bot_webhook.urls')),
    path('payments/', include('payments.urls')),
    
    
    # Verification
    path('verification/', include('verification.urls')),

]