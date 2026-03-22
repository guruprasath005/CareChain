# profiles/urls.py
from django.urls import path
from .views import (
    InstitutionTypeListView, SpecialityListView,
    DiagnosticFacilityListView, RadiologyFacilityListView, DegreeTypeListView, CountryListView, SkillListView, ListTestimonialsView
)

urlpatterns = [
    path('institution-types/', InstitutionTypeListView.as_view(), name='institution-type-list'),
    path('specialities/', SpecialityListView.as_view(), name='speciality-list'),
    path('diagnostic-facilities/', DiagnosticFacilityListView.as_view(), name='diagnostic-facility-list'),
    path('radiology-facilities/', RadiologyFacilityListView.as_view(), name='radiology-facility-list'),
    path('degree-types/', DegreeTypeListView.as_view(), name='degree-type-list'),
    path('countries/', CountryListView.as_view(), name='country-list'),
    path('skills/', SkillListView.as_view(), name='skill-list'),
    
    # Generic URL for listing testimonials for either a candidate or an employer
    path('list-testimonials/', ListTestimonialsView.as_view(), name='list-testimonials'),
]
