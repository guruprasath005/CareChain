from rest_framework import serializers
from .models import InstitutionType, Speciality, DiagnosticFacility, RadiologyFacility, DegreeType, Country, Skill

class InstitutionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstitutionType
        fields = ['name']

class SpecialitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Speciality
        fields = ['name']

class DiagnosticFacilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = DiagnosticFacility
        fields = ['name']

class RadiologyFacilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = RadiologyFacility
        fields = ['name']
        
        
class DegreeTypeSerializer(serializers.ModelSerializer):
    class Meta: model = DegreeType; fields = ['name']

class CountrySerializer(serializers.ModelSerializer):
    class Meta: model = Country; fields = ['name']

class SkillSerializer(serializers.ModelSerializer):
    class Meta: model = Skill; fields = ['name']
