from django.urls import path
from .views import (
    RegisterUserView,
    LoginView,
    VerifyEmailView,
    ResendVerificationEmailView,
    RoleProfileAPIView,
    UserProfileView,
    ChangePasswordView,
    TelegramProfileCheckAPIView,
    GenerateFormTokenView,
    SetLocationAPIView,
    ProfileStatusCheckView,
    RequestProfileSummaryView,
    CheckJobQuotaView
)

urlpatterns = [
    path('register/', RegisterUserView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('resend-verification/', ResendVerificationEmailView.as_view(), name='resend-verification'),
    path('role-profile/', RoleProfileAPIView.as_view(), name='role-profile'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('profile-status-check/', ProfileStatusCheckView.as_view(), name='profile-status-check'),
    path('check-job-quota/', CheckJobQuotaView.as_view(), name='check-job-quota'),
    
    # TELEGRAM URLS
    path('telegram-check/<str:chat_id>/', TelegramProfileCheckAPIView.as_view(), name='telegram-check'),
    path('generate-form-token/', GenerateFormTokenView.as_view(), name='generate-form-token'),
    path('set-location/', SetLocationAPIView.as_view(), name='set-location'),
    path('request-profile-summary/', RequestProfileSummaryView.as_view(), name='request-profile-summary')
]
