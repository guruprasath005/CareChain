import uuid
from django.db import models
from users.models import User 
from jobs.models import JobPost

class FormSubmissionToken(models.Model):
    """
    A single-use token to securely link a profile or job post form
    submission to a specific user.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    profile_type = models.CharField(max_length=20) # 'Candidate' or 'Employer'
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)
    
    

class FeedbackSubmissionToken(models.Model):
    """
    A single-use token to securely link a feedback form submission
    to a specific completed job. It also tracks the submitter's role.
    """
    class RoleType(models.TextChoices):
        EMPLOYER = 'EMPLOYER', 'Employer'
        CANDIDATE = 'CANDIDATE', 'Candidate'

    job_post = models.ForeignKey(JobPost, on_delete=models.CASCADE, related_name='feedback_tokens')
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    
    # This field tracks who the token was generated for.
    role_type = models.CharField(max_length=20, choices=RoleType.choices)
    
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        # A job can have one token for the employer and one for the candidate
        unique_together = ('job_post', 'role_type')

    def __str__(self):
        return f"Feedback Token for Job ID {self.job_post.id} ({self.role_type})"