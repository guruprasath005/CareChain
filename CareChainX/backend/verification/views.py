from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from profiles.models import CandidateProfile, EmployerProfile
from core.tasks import send_credential_rejection_task # We will create this next

class VerifyCredentialView(APIView):
    """
    An endpoint for admin users to accept a specific credential type for a profile.
    """
    permission_classes = [permissions.IsAdminUser] # Only staff can access this

    def post(self, request, *args, **kwargs):
        profile_type = request.data.get('profile_type')
        profile_id = request.data.get('profile_id')
        credential_field = request.data.get('credential_field')

        if profile_type == 'candidate':
            profile = get_object_or_404(CandidateProfile, pk=profile_id)
        elif profile_type == 'employer':
            profile = get_object_or_404(EmployerProfile, pk=profile_id)
        else:
            return Response({"error": "Invalid profile type"}, status=status.HTTP_400_BAD_REQUEST)

        # Securely set the attribute on the model
        if hasattr(profile, credential_field) and credential_field.startswith('is_'):
            setattr(profile, credential_field, True)
            profile.save()
            # You could also trigger a "Credential Approved" notification here
            return Response({"message": "Credential approved."})
        
        return Response({"error": "Invalid credential field."}, status=status.HTTP_400_BAD_REQUEST)

class RejectCredentialView(APIView):
    """
    An endpoint for admin users to reject a credential, which deletes the
    data and notifies the user with a reason.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, *args, **kwargs):
        profile_type = request.data.get('profile_type')
        profile_id = request.data.get('profile_id')
        credential_field = request.data.get('credential_field')
        data_field = request.data.get('data_field') # e.g., 'aadhaar_number'
        rejection_reason = request.data.get('reason')

        if not rejection_reason:
            return Response({"error": "A reason for rejection is required."}, status=status.HTTP_400_BAD_REQUEST)

        if profile_type == 'candidate':
            profile = get_object_or_404(CandidateProfile, pk=profile_id)
        else:
            profile = get_object_or_404(EmployerProfile, pk=profile_id)

        # Trigger the Celery task to handle the rejection logic
        send_credential_rejection_task.delay(
            profile_type=profile_type,
            profile_id=profile.id,
            credential_field=credential_field,
            data_field=data_field,
            reason=rejection_reason
        )
        
        return Response({"message": "Rejection task has been queued."})