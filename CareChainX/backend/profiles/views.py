# profiles/views.py
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from .models import InstitutionType, Speciality, DiagnosticFacility, RadiologyFacility, DegreeType,Country, Skill
from .serializers import (
    InstitutionTypeSerializer, SpecialitySerializer, 
    DiagnosticFacilitySerializer, RadiologyFacilitySerializer,
    DegreeTypeSerializer,CountrySerializer,SkillSerializer
)
from core.tasks import generate_and_send_candidate_testimonials_list, generate_and_send_employer_testimonials_list
from django.shortcuts import render
from rest_framework.response import Response
from core.permissions import HasValidActionToken

# These are public, read-only endpoints.
class InstitutionTypeListView(generics.ListAPIView):
    queryset = InstitutionType.objects.all()
    serializer_class = InstitutionTypeSerializer
    permission_classes = [permissions.AllowAny]

class SpecialityListView(generics.ListAPIView):
    queryset = Speciality.objects.all()
    serializer_class = SpecialitySerializer
    permission_classes = [permissions.AllowAny]

class DiagnosticFacilityListView(generics.ListAPIView):
    queryset = DiagnosticFacility.objects.all()
    serializer_class = DiagnosticFacilitySerializer
    permission_classes = [permissions.AllowAny]

class RadiologyFacilityListView(generics.ListAPIView):
    queryset = RadiologyFacility.objects.all()
    serializer_class = RadiologyFacilitySerializer
    permission_classes = [permissions.AllowAny]
    
    
class DegreeTypeListView(generics.ListAPIView):
    queryset = DegreeType.objects.all(); serializer_class = DegreeTypeSerializer; permission_classes = [permissions.AllowAny]

class CountryListView(generics.ListAPIView):
    queryset = Country.objects.all(); serializer_class = CountrySerializer; permission_classes = [permissions.AllowAny]

class SkillListView(generics.ListAPIView):
    queryset = Skill.objects.all(); serializer_class = SkillSerializer; permission_classes = [permissions.AllowAny]


class ListTestimonialsView(APIView):
    """
    A generic public endpoint triggered by the 'List Testimonials' button.
    It triggers the correct Celery task based on the role_type.
    """
    permission_classes = [HasValidActionToken]

    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        role_type = payload.get('role_type')
        profile_id = payload.get('profile_id')
        chat_id = payload.get('send_to_chat_id')
        
        # Determine which task to run based on the role_type from the URL
        if role_type == 'candidate':
            generate_and_send_candidate_testimonials_list.delay(
                candidate_profile_id=profile_id,
                send_to_chat_id=chat_id
            )
            message = "The candidate's testimonials are being generated and will be sent to your Telegram chat momentarily."
        elif role_type == 'employer':
            generate_and_send_employer_testimonials_list.delay(
                employer_profile_id=profile_id,
                send_to_chat_id=chat_id
            )
            message = "The employer's testimonials are being generated and will be sent to your Telegram chat momentarily."
        else:
            # Handle invalid role_type
            message = "Invalid request. Unknown role type."
            if request.accepted_renderer.format == 'html':
                return render(request, 'general/action_confirmation.html', {'title': 'Error', 'message': message})
            else:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

        # --- Content Negotiation ---
        title = 'Request Received'
        if request.accepted_renderer.format == 'html':
            context = {'title': title, 'message': message}
            return render(request, 'general/action_confirmation.html', context)
        else:
            return Response({"message": message})
