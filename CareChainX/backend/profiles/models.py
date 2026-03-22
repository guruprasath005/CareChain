import os
import uuid
from django.db import models
from users.models import User


class InstitutionType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    
    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Speciality(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = "Specialities" # Fixes the pluralization in Django admin

    def __str__(self):
        return self.name

class DiagnosticFacility(models.Model):
    name = models.CharField(max_length=100, unique=True)
    
    class Meta:
        ordering = ['name']
        verbose_name_plural = "Diagnostic Facilities"

    def __str__(self):
        return self.name

class RadiologyFacility(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = "Radiology Facilities"

    def __str__(self):
        return self.name

# --- MODELS FOR CANDIDATE ---
class DegreeType(models.Model):
    name = models.CharField(max_length=150, unique=True)
    class Meta: ordering = ['name']
    def __str__(self): return self.name

class Country(models.Model):
    name = models.CharField(max_length=100, unique=True)
    class Meta: ordering = ['name']; verbose_name_plural = "Countries"
    def __str__(self): return self.name

class Skill(models.Model):
    name = models.CharField(max_length=100, unique=True)
    class Meta: ordering = ['name']
    def __str__(self): return self.name


# --- PROFILE & RELATED MODELS ---

def get_candidate_credential_path(instance, filename):
    """Generates a clean path for a candidate's uploaded files."""
    user_id = instance.candidate_profile.user.id
    return os.path.join('candidate_credentials', f'user_{user_id}', filename)

class CandidateCredential(models.Model):
    """A single, unified model for all candidate document uploads."""
    class DocumentType(models.TextChoices):
        AADHAAR_PHOTO = 'AADHAAR_PHOTO', 'Aadhaar Card Photo'
        CANDIDATE_PHOTO = 'CANDIDATE_PHOTO', 'Candidate Photo'
        EDUCATION_SUPPORT = 'EDUCATION_SUPPORT', 'Education Supporting Document'
        LICENSURE = 'LICENSURE', 'Licensure Document'
        CERTIFICATION = 'CERTIFICATION', 'Certification Document'
        WORK_EXPERIENCE_SUPPORT = 'WORK_EXPERIENCE_SUPPORT', 'Work Experience Supporting Document'

    candidate_profile = models.ForeignKey('CandidateProfile', on_delete=models.CASCADE, related_name='credentials')
    document_type = models.CharField(max_length=50, choices=DocumentType.choices)
    file = models.FileField(upload_to=get_candidate_credential_path)
    url = models.URLField(max_length=1024, blank=True, null=True)
    
    # Link to a specific education or work experience entry
    education = models.ForeignKey('Education', on_delete=models.SET_NULL, null=True, blank=True, related_name='supporting_documents')
    work_experience = models.ForeignKey('WorkExperience', on_delete=models.SET_NULL, null=True, blank=True, related_name='supporting_documents')

    # This creates an link between a credential and a specific skill.Can be used for React front end to have a supporting document for each skill
    skill = models.ForeignKey(Skill, on_delete=models.SET_NULL, null=True, blank=True, related_name='credentials')

    
    def __str__(self):
        return f"{self.get_document_type_display()} for {self.candidate_profile.user.email}"

class CandidateProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='candidate_profile')
    
    # Personal Details
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=50, blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True,unique=True)
    address = models.TextField(blank=True, null=True)
    pincode = models.CharField(max_length=6, blank=True, null=True)
    aadhaar_number = models.CharField(max_length=12, blank=True, null=True, unique=True)
    
    # Relationships to lookup tables
    specialization = models.ManyToManyField(Speciality, blank=True)
    skills = models.ManyToManyField(Skill, blank=True)
    
    # Geolocation
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # Job Preference Fields
    
    preferred_job_type = models.JSONField(default=list, blank=True)
    
    # JSONField is perfect for storing the 7x24 matrix
    weekly_availability_matrix = models.JSONField(default=list, blank=True)
    
    # Use DecimalField for monetary values
    pay_per_patient = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    pay_per_hour = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    pay_per_month = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # IntegerField for distance
    max_travel_distance = models.PositiveIntegerField(null=True, blank=True)
    
    
    # Quality Score
    average_quality_score = models.FloatField(default=4.0)
    
    
    # Verification Status Flags
    is_aadhaar_verified = models.BooleanField(default=False)
    is_qualification_verified = models.BooleanField(default=False)
    is_skill_credential_verified = models.BooleanField(default=False)
    is_experience_credential_verified = models.BooleanField(default=False)
            
    
    def __str__(self):
        return f"Candidate Profile for {self.user.email}"

class Education(models.Model):
    candidate_profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='education')
    degree = models.ForeignKey(DegreeType, on_delete=models.SET_NULL, null=True, blank=True)
    institution = models.CharField(max_length=255, blank=True, null=True)
    year_of_graduation = models.PositiveIntegerField(null=True, blank=True)
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta: ordering = ['-year_of_graduation']
    def __str__(self): return f"{self.degree} from {self.institution}"

class WorkExperience(models.Model):
    candidate_profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='work_experience')
    role = models.CharField(max_length=255, blank=True, null=True)
    department = models.CharField(max_length=255, blank=True, null=True)
    institution_name = models.CharField(max_length=255, blank=True, null=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    class Meta: ordering = ['-start_date']
    def __str__(self): return f"{self.role} at {self.institution_name}"

def get_aadhaar_photo_path(instance, filename):
    """
    Generates a clean path for the representative's Aadhaar photo.
    Example: employer_aadhaar/user_123/aadhaar_photo_abc123.jpg
    """
    user_id = instance.user.id
    return os.path.join('employer_aadhaar', f'user_{user_id}', filename)


def get_employer_credential_path(instance, filename):
    """
    A helper function to generate a clean, organized path for uploaded files.
    It combines a user-specific directory with the provided filename.
    Example: employer_credentials/user_123/facility_image_abc123.jpg
    """
    user_id = instance.employer_profile.user.id
    # joins the directory with the filename
    return os.path.join('employer_credentials', f'user_{user_id}', filename)


class EmployerCredential(models.Model):
    
    """
    A separate model to store a single document/credential URL for an employer.
    This creates a clean one-to-many relationship with the EmployerProfile.
    """
    class DocumentType(models.TextChoices):
        AADHAAR_PHOTO = 'AADHAAR_PHOTO', 'Aadhaar Card Photo'
        FACILITY_IMAGE = 'FACILITY_IMAGE', 'Facility Image'
        REGISTRATION_LICENSE = 'REGISTRATION_LICENSE', 'Registration and Licenses'
        INFRA_OPERATIONAL = 'INFRA_OPERATIONAL', 'Infrastructure and Operational Clearance'
        QUALITY_ACCREDITATION = 'QUALITY_ACCREDITATION', 'Quality and Accreditation Standard'
        OTHER = 'OTHER', 'Other Documentation'

    # The 'ForeignKey' creates the many-to-one link.
    # An EmployerProfile can have many credentials.
    employer_profile = models.ForeignKey('EmployerProfile', on_delete=models.CASCADE, related_name='credentials')
    document_type = models.CharField(max_length=50, choices=DocumentType.choices)
    url = models.URLField(max_length=1024)# For Debugging
    file = models.FileField(upload_to=get_employer_credential_path, null=True, blank=True)
    
    # Optional: add a field for the original filename if needed
    # file_name = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.get_document_type_display()} for {self.employer_profile.institution_name}"




class EmployerProfile(models.Model):
    """Profile for a user acting as an Employer."""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employer_profile')


    # Representative's Details
    representative_first_name = models.CharField(max_length=255, blank=True, null=True)
    representative_last_name = models.CharField(max_length=255, blank=True, null=True)
    # email_id is already on the core User model
    representative_aadhaar_num = models.CharField(max_length=12, blank=True, null=True, unique=True)
    contact_num = models.CharField(max_length=20, blank=True, null=True, unique= True)
    
    # Institution Details
    institution_name = models.CharField(max_length=255, blank=True, null=True)
    # A ForeignKey relationship for the single-choice institution type
    institution_type = models.ForeignKey(InstitutionType, on_delete=models.SET_NULL, null=True, blank=True)
    
    institution_address = models.TextField(blank=True, null=True)
    institution_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    institution_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    institution_pincode = models.CharField(max_length=6, blank=True, null=True)
    institution_website = models.URLField(max_length=512, blank=True, null=True)
    
    # A ManyToManyField relationship for the multi-select specialities
    specialities = models.ManyToManyField(Speciality, blank=True)
    
    # Facility Details
    outpatient_clinic = models.BooleanField(null=True, blank=True)
    inpatient_facility = models.BooleanField(null=True, blank=True)
    ip_bed_num = models.PositiveIntegerField(default=0, blank=True, null=True)
    emd_room = models.BooleanField(null=True, blank=True)
    emd_bed_num = models.PositiveIntegerField(default=0, blank=True, null=True)
    icu_facilities = models.BooleanField(null=True, blank=True)
    icu_bed_num = models.PositiveIntegerField(default=0, blank=True, null=True)
    nicupicu = models.BooleanField(null=True, blank=True)
    nicupicu_bed_num = models.PositiveIntegerField(default=0, blank=True, null=True)
    otroom = models.BooleanField(null=True, blank=True)
    otroom_bed_num = models.PositiveIntegerField(default=0, blank=True, null=True)
    diag_lab = models.BooleanField(null=True, blank=True)
    diag_lab_facilities = models.ManyToManyField(DiagnosticFacility, blank=True)
    radio_lab = models.BooleanField(null=True, blank=True)
    radio_lab_facilities = models.ManyToManyField(RadiologyFacility, blank=True)
    pharmacy = models.BooleanField(null=True, blank=True)
    security = models.BooleanField(null=True, blank=True)
    
    # Staff Details
    employed_doctors_num = models.PositiveIntegerField(default=0, blank=True, null=True)
    employed_nurses_num = models.PositiveIntegerField(default=0, blank=True, null=True)

    # Ratings
    average_quality_score = models.FloatField(default=4.0)
    
    # --- VERIFICATION STATUS FLAGS ---
    is_aadhaar_verified = models.BooleanField(default=False)
    is_credential_verified = models.BooleanField(default=False)
    
    
    
    # Payment and Job Post Quota
    job_post_quota = models.PositiveIntegerField(default=0)
    
    def __str__(self):
        return f"Employer Profile for {self.user.email}"
