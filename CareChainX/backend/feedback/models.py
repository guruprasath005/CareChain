# feedback/models.py
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from profiles.models import CandidateProfile, EmployerProfile
from jobs.models import JobPost


class Feedback(models.Model):
    """
    Stores the feedback given by an employer for a completed/closed job.
    """
    job_post = models.OneToOneField(JobPost, on_delete=models.CASCADE, related_name='feedback')
    
    # Graded scores from the feedback form
    competence_score = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    ethics_score = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    teamwork_score = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    conduct_score = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    
    # The calculated quality score for this specific job
    quality_score_for_job = models.FloatField(default=0.0)
    
    employer_testimonial = models.TextField(blank=True, null=True)
    
    # Platform Feedback by Employer
    platform_rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True, blank=True
    )
    employer_platform_testimonial = models.TextField(blank=True, null=True)
    

    def __str__(self):
        return f"Feedback for {self.job_post}"

class Attendance(models.Model):
    """
    Stores attendance records for a completed/closed job.
    """
    job_post = models.OneToOneField(JobPost, on_delete=models.CASCADE, related_name='attendance')
    number_of_days_absent = models.PositiveIntegerField(default=0)
    was_no_show = models.BooleanField(default=False)

    def __str__(self):
        return f"Attendance for {self.job_post}"
    
    
class CandidateFeedback(models.Model):
    """
    Stores feedback from a CANDIDATE about an EMPLOYER for a completed/closed job.
    """
    job_post = models.OneToOneField(JobPost, on_delete=models.CASCADE, related_name='candidate_feedback')
    
    # Graded scores from the candidate's feedback form
    professionalism_score = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    work_environment_score = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    ethics_score = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    team_score = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    
    # The calculated quality score for the employer for this specific job
    quality_score_for_job = models.FloatField(default=0.0)

    # Testimonials and platform feedback from the candidate
    candidate_testimonial = models.TextField(blank=True, null=True)
    platform_rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True, blank=True
    )
    candidate_platform_testimonial = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Candidate Feedback for {self.job_post.job_title}"

