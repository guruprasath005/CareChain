from django.urls import path
# Make sure to import the correctly named view
from .views import (EmployerProfileUpdateGoogleFormWebhookView, CandidateProfileUpdateGoogleFormWebhookView, 
                    CandidatePreferencesUpdateGoogleFormWebhookView,
                    JobPostCreateGoogleFormWebhookView,EmployerFeedbackSubmitView,
                    CandidateFeedbackSubmitView)

urlpatterns = [
    path('employer-profile-update/', EmployerProfileUpdateGoogleFormWebhookView.as_view(), name='employer-profile-webhook'),
    path('candidate-profile-update/', CandidateProfileUpdateGoogleFormWebhookView.as_view(), name='candidate-profile-webhook'),
    path('candidate-preferences-update/', CandidatePreferencesUpdateGoogleFormWebhookView.as_view(), name='candidate-preferences-webhook'),
    path('job-post-create/', JobPostCreateGoogleFormWebhookView.as_view(), name='job-post-webhook'),
    path('employer-feedback-submit/', EmployerFeedbackSubmitView.as_view(), name='employer-feedback-webhook'),
    path('candidate-feedback-submit/', CandidateFeedbackSubmitView.as_view(), name='candidate-feedback-webhook'),
]