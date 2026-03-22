
from django.contrib import admin
from .models import (
    # Employer Models
    InstitutionType, Speciality, DiagnosticFacility, RadiologyFacility,
    EmployerProfile, EmployerCredential,
    # Candidate Models
    CandidateProfile, CandidateCredential, Education, WorkExperience,
    DegreeType, Country, Skill
)

# --- INLINES FOR A CLEANER ADMIN INTERFACE ---

class EmployerCredentialInline(admin.TabularInline):
    """Allows editing employer credentials directly within the EmployerProfile admin page."""
    model = EmployerCredential
    extra = 1 # How many empty forms to show
    readonly_fields = ('url',)

class CandidateCredentialInline(admin.TabularInline):
    """Allows editing candidate credentials directly within the CandidateProfile admin page."""
    model = CandidateCredential
    extra = 1
    readonly_fields = ('url',)

class EducationInline(admin.TabularInline):
    """Allows editing education history directly within the CandidateProfile admin page."""
    model = Education
    extra = 1

class WorkExperienceInline(admin.TabularInline):
    """Allows editing work history directly within the CandidateProfile admin page."""
    model = WorkExperience
    extra = 1


# --- ADMIN VIEW REGISTRATIONS ---

@admin.register(EmployerProfile)
class EmployerProfileAdmin(admin.ModelAdmin):
    """Define the admin pages for the EmployerProfile model."""
    list_display = ('user', 'institution_name', 'contact_num', 'average_quality_score')
    search_fields = ('user__email', 'institution_name', 'representative_first_name')
    inlines = [EmployerCredentialInline]

@admin.register(CandidateProfile)
class CandidateProfileAdmin(admin.ModelAdmin):
    """Define the admin pages for the CandidateProfile model."""
    list_display = ('user', 'contact_number', 'average_quality_score')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    # Add all the new inlines here for a unified view
    inlines = [
        EducationInline,
        WorkExperienceInline,
        CandidateCredentialInline
    ]

# Register all the simple lookup models so you can manage their choices
admin.site.register(InstitutionType)
admin.site.register(Speciality)
admin.site.register(DiagnosticFacility)
admin.site.register(RadiologyFacility)
admin.site.register(DegreeType)
admin.site.register(Country)
admin.site.register(Skill)
