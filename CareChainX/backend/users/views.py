import jwt
import datetime
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer, UserRegistrationSerializer, PasswordChangeSerializer, LoginSerializer
from .models import TelegramProfile
from profiles.models import CandidateProfile, EmployerProfile
from webhooks.models import FormSubmissionToken
from core.permissions import IsBotOrAuthenticated, IsBot
from core.tasks import send_verification_email_task, generate_and_send_candidate_profile_summary, generate_and_send_employer_profile_summary
from django.shortcuts import render


User = get_user_model()

class RegisterUserView(generics.CreateAPIView):
    """Unified view for registering a new user from any client."""
    queryset = User.objects.all()
    permission_classes = [IsBot] # Even though it's registration, we still need to check if it's our bot
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        send_verification_email_task.delay(user.id, user.email)
        
        # Generate verification token
        token_payload = {'user_id': user.id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)}
        verification_token = jwt.encode(token_payload, settings.SECRET_KEY, algorithm='HS256')
        
        
        # In a real app, you would email this token to the user.
        # For now, we return it in the response for testing.
        
        refresh = RefreshToken.for_user(user)


        return Response({
            'user': UserSerializer(user).data,
            'verification_token': verification_token,
            'access':str(refresh.access_token),
            'refresh':str(refresh),            
            'message': 'User registered. A verification link has been sent to your email.'
        }, status=status.HTTP_201_CREATED)



class VerifyEmailView(APIView):
    """
    View for verifying a user's email. It now responds with either HTML or JSON
    based on what the client asks for.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        title = "Email Verification"
        message = "An unknown error occurred." # Default message

        if not token:
            message = "Verification token is missing. Please try the link from your email again."
        else:
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                user = User.objects.get(id=payload['user_id'])
                
                if not user.is_email_verified:
                    user.is_email_verified = True
                    user.save()
                
                title = "Verification Successful!"
                message = "Your email address has been successfully verified. You can now return to Telegram and use /start to set up your profile."

            except jwt.ExpiredSignatureError:
                title = "Link Expired"
                message = "This verification link has expired. Please use the /resendemail command in Telegram to get a new one."
            except (jwt.InvalidTokenError, User.DoesNotExist):
                title = "Invalid Link"
                message = "This verification link is invalid or has already been used. Please try again or contact support."
        
        # --- Content Negotiation ---
        if request.accepted_renderer.format == 'html':
            # For a browser, render the HTML template
            context = {'title': title, 'message': message}
            return render(request, 'general/action_confirmation.html', context)
        else:
            # For an API client, return JSON
            # We check the title to determine if it was a success or error
            if "Success" in title:
                return Response({"message": message})
            else:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)


class ResendVerificationEmailView(APIView):
    """
    A secure endpoint to request that a user's verification
    email be sent again.
    """
    permission_classes = [IsBotOrAuthenticated] # Secure this endpoint

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if user.is_email_verified:
            return Response({"message": "This email address has already been verified."}, status=status.HTTP_200_OK)
        
        # Trigger the existing Celery task to send the email
        send_verification_email_task.delay(user.id, user.email)
        
        return Response({"message": "A new verification email has been sent."}, status=status.HTTP_200_OK)





class LoginView(APIView):
    """Unified login for any user type using email and password."""
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        user = authenticate(request, username=email, password=password)

        if user is None:
            return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return Response({
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_200_OK)

    
class RoleProfileAPIView(APIView):
    """
    Creates a role profile (Candidate or Employer) for an existing user.
    This is called after registration or when a user wants to add a new role.
    """
    permission_classes = [IsBotOrAuthenticated] 

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        role = request.data.get('role') # Expecting 'Candidate' or 'Employer'

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if role == "Candidate":
            profile, created = CandidateProfile.objects.get_or_create(user=user)
            message = "Your Candidate profile is ready!" if created else "You are now in your Candidate profile."
        elif role == "Employer":
            profile, created = EmployerProfile.objects.get_or_create(user=user, defaults={'institution_name': f"{user.first_name}'s Facility"})
            message = "Your Employer profile is ready!" if created else "You are now in your Employer profile."
        else:
            return Response({"error": "Invalid role specified"}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": message}, status=status.HTTP_201_CREATED)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """View for retrieving and updating the authenticated user's profile."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user




class ChangePasswordView(generics.UpdateAPIView):
    """View for changing the authenticated user's password."""
    serializer_class = PasswordChangeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        user = request.user
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


class CheckJobQuotaView(APIView):
    """
    A secure endpoint for the bot to check if an employer has available job post quota.
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Use select_related and prefetch_related for an efficient query
            profile = EmployerProfile.objects.select_related('user').prefetch_related('job_posts').get(user_id=user_id)
        except EmployerProfile.DoesNotExist:
            return Response({"error": "Employer profile not found for this user."}, status=status.HTTP_404_NOT_FOUND)

        # Compare the number of jobs they have posted against their quota
        jobs_posted_count = profile.job_posts.count()
        quota_available = jobs_posted_count < profile.job_post_quota

        return Response({"quota_available": quota_available})




# --- TELEGRAM BOT VIEWS ---

class TelegramProfileCheckAPIView(APIView):
    """
    Endpoint for the Telegram bot to check if a user is registered
    and if their email is verified.
    """
    permission_classes = [IsBotOrAuthenticated]

    def get(self, request, chat_id, *args, **kwargs):
        try:
            profile = TelegramProfile.objects.select_related('user').get(telegram_chat_id=chat_id)
            user = profile.user
            return Response({
                "exists": True,
                "user_id": user.pk,
                "first_name": user.first_name,
                # --- THIS IS THE NEW LINE ---
                "is_email_verified": user.is_email_verified
            })
        except TelegramProfile.DoesNotExist:
            return Response({"exists": False})
        
        
class GenerateFormTokenView(APIView):
    """
    A secure endpoint for the bot to request a new, single-use
    form submission token for a specific user and profile type.
    """
    permission_classes = [IsBotOrAuthenticated] # Secure this endpoint

    def post(self, request, *args, **kwargs):
        # The bot will send the user_id in the request body.
        user_id = request.data.get('user_id')
        profile_type = request.data.get('profile_type') # Expecting 'Candidate' or 'Employer'

        if not all([user_id, profile_type]):
            return Response(
                {"error": "user_id and profile_type are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Create the new token in the database
        token = FormSubmissionToken.objects.create(user=user, profile_type=profile_type)
        
        # Return the token's UUID as a string
        return Response({"token": str(token.token)}, status=status.HTTP_201_CREATED)


class SetLocationAPIView(APIView):
    """
    A secure endpoint for the bot to save the latitude and longitude
    for a specific user's profile (either Candidate or Employer).
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        profile_type = request.data.get('profile_type')
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')

        if not all([user_id, profile_type, latitude, longitude]):
            return Response(
                {"error": "user_id, profile_type, latitude, and longitude are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if profile_type == 'Candidate':
                profile = CandidateProfile.objects.get(user_id=user_id)
                profile.latitude = latitude
                profile.longitude = longitude
            elif profile_type == 'Employer':
                profile = EmployerProfile.objects.get(user_id=user_id)
                profile.institution_latitude = latitude
                profile.institution_longitude = longitude
            else:
                return Response({"error": "Invalid profile_type."}, status=status.HTTP_400_BAD_REQUEST)
            
            profile.save()
            return Response({"message": "Location updated successfully."}, status=status.HTTP_200_OK)

        except (CandidateProfile.DoesNotExist, EmployerProfile.DoesNotExist):
            return Response({"error": "Profile not found for this user."}, status=status.HTTP_404_NOT_FOUND)



class ProfileStatusCheckView(APIView):
    """
    A secure endpoint to check if a user's profile is
    considered "complete" enough to proceed with other actions.
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        profile_type = request.data.get('profile_type')

        if not all([user_id, profile_type]):
            return Response({"error": "user_id and profile_type are required"}, status=status.HTTP_400_BAD_REQUEST)

        is_complete = False
        try:
            if profile_type == 'Candidate':
                profile = CandidateProfile.objects.get(user_id=user_id)
                # We define "complete" as having an Aadhaar number
                if profile.aadhaar_number:
                    is_complete = True
            elif profile_type == 'Employer':
                profile = EmployerProfile.objects.get(user_id=user_id)
                # We define "complete" as having an Aadhaar number
                if profile.representative_aadhaar_num:
                    is_complete = True
            
            return Response({"is_complete": is_complete})

        except (CandidateProfile.DoesNotExist, EmployerProfile.DoesNotExist):
            # If the profile doesn't even exist, it's definitely not complete
            return Response({"is_complete": False})
        
        
class RequestProfileSummaryView(APIView):
    """
    A secure endpoint for the bot to request that a user's own profile
    summary be generated and sent to them.
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        role_type = request.data.get('role_type') # 'Candidate' or 'Employer'

        if not all([user_id, role_type]):
            return Response({"error": "user_id and role_type are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.select_related('telegram_profile').get(pk=user_id)
            chat_id = user.telegram_profile.telegram_chat_id
            
            if role_type == 'Candidate':
                profile = CandidateProfile.objects.get(user=user)
                # Trigger the candidate summary task, sending it to the user themselves
                generate_and_send_candidate_profile_summary.delay(
                    download_results=None,
                    profile_id=profile.id,
                    send_to_chat_id=chat_id
                )
            elif role_type == 'Employer':
                profile = EmployerProfile.objects.get(user=user)
                # Trigger the employer summary task, sending it to the user themselves
                generate_and_send_employer_profile_summary.delay(
                    download_results=None,
                    profile_id=profile.id,
                    send_to_chat_id=chat_id
                )
            else:
                return Response({"error": "Invalid role_type."}, status=status.HTTP_400_BAD_REQUEST)

            return Response({"message": "Profile summary generation has been queued."})

        except (User.DoesNotExist, CandidateProfile.DoesNotExist, EmployerProfile.DoesNotExist, TelegramProfile.DoesNotExist):
            return Response({"error": "A valid user with that profile and Telegram account could not be found."}, status=status.HTTP_404_NOT_FOUND)
