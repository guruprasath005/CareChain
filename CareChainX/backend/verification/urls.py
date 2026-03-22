from django.urls import path
from .views import VerifyCredentialView, RejectCredentialView

urlpatterns = [
    path('verify-credential/', VerifyCredentialView.as_view(), name='verify-credential'),
    path('reject-credential/', RejectCredentialView.as_view(), name='reject-credential'),
]