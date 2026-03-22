from django.db import models
from profiles.models import EmployerProfile, CandidateProfile, DegreeType, Skill
from django.utils import timezone

class JobPost(models.Model):
    class JobType(models.TextChoices):
        SHORT_TERM = 'SHORT_TERM', 'Short-Term Hire'
        LONG_TERM = 'LONG_TERM', 'Long-Term Hire'

    class PayUnit(models.TextChoices):
        PER_PATIENT = 'PER_PATIENT', 'Per Patient'
        PER_HOUR = 'PER_HOUR', 'Per Hour'
        
    class JobStatus(models.TextChoices):
        OPEN = 'OPEN', 'Open' # Actively seeking candidates
        FILLED = 'FILLED', 'Filled' # A candidate has been hired
        COMPLETED = 'COMPLETED', 'Completed' # The job duration has passed
        CANCELLED = 'CANCELLED', 'Cancelled' # Cancelled by the employer
        CLOSED = 'CLOSED', 'Closed' # Finished early or with a no-show

    # Core Details
    posted_by = models.ForeignKey(EmployerProfile, on_delete=models.CASCADE, related_name='job_posts')
    job_title = models.CharField(max_length=255)
    job_description = models.TextField(blank=True, null=True)
    job_type = models.CharField(max_length=20, choices=JobType.choices)

    # Status and Timestamps
    status = models.CharField(max_length=20, choices=JobStatus.choices, default=JobStatus.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    filled_at = models.DateTimeField(null=True, blank=True)
    auto_fill_enabled = models.BooleanField(default=False) # For future web app

    # Link to the candidate who filled the job
    filled_by = models.ForeignKey(CandidateProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='filled_jobs')

    # Benefits
    transport_provided = models.BooleanField(default=False)
    accommodation_provided = models.BooleanField(default=False)
    meals_provided = models.BooleanField(default=False)

    # Short-Term Hire Details
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    shift_start_time = models.TimeField(null=True, blank=True)
    shift_end_time = models.TimeField(null=True, blank=True)
    short_term_pay_unit = models.CharField(max_length=20, choices=PayUnit.choices, null=True, blank=True)
    short_term_pay_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # This is the 7x24 matrix, generated for Short-Term jobs
    weekly_availability_matrix = models.JSONField(default=list, blank=True)

    # Long-Term Hire Details
    long_term_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Requirements
    required_qualifications = models.ManyToManyField(DegreeType, blank=True)
    required_skills = models.ManyToManyField(Skill, blank=True)
    min_experience_years = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.job_title} at {self.posted_by.institution_name}"

 




class JobMatch(models.Model):
    """
    Stores the results of a matching run for a specific job post.
    """
    job_post = models.OneToOneField(JobPost, on_delete=models.CASCADE, related_name='matches')
    
    # A JSONField to store the ordered list of matched candidate profile IDs
    matched_candidates = models.JSONField(default=list)
    
    # Tracks which batch of notifications has been sent
    notification_iteration = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Matches for {self.job_post.job_title}"
    
    

class JobApplication(models.Model):
    """
    Represents and tracks the entire lifecycle of a candidate's
    application for a specific job post.
    """
    # --- STATUS LIST ---
    class ApplicationStatus(models.TextChoices):
        # Candidate Actions
        APPLIED = 'APPLIED', 'Applied' # Initial state after candidate clicks "Apply"
        CANDIDATE_REJECTED = 'CANDIDATE_REJECTED', 'Rejected by Candidate'
        
        # Employer Actions
        IN_REVIEW = 'IN_REVIEW', 'In Review' # Employer viewed the candidate's summary
        INTERVIEW = 'INTERVIEW', 'Interviewing' # Employer requested contact details
        HIRED = 'HIRED', 'Hired'
        EMPLOYER_REJECTED = 'EMPLOYER_REJECTED', 'Rejected by Employer'
    # ------------------------------------

    job_post = models.ForeignKey(JobPost, on_delete=models.CASCADE, related_name='applications')
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name='applications')
    status = models.CharField(max_length=20, choices=ApplicationStatus.choices, default=ApplicationStatus.APPLIED)
    applied_at = models.DateTimeField(auto_now_add=True)
    # A new field to track when the status was last updated
    status_last_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # A candidate can only apply to a specific job once
        unique_together = ('job_post', 'candidate')

    def __str__(self):
        return f"{self.candidate.user.email} applied for {self.job_post.job_title}"