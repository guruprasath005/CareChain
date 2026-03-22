# feedback/admin.py
from django.contrib import admin
from .models import Feedback, Attendance, CandidateFeedback

# The CompletedJob model and its admin have been removed.

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    """Admin view for feedback submitted by Employers about Candidates."""
    list_display = (
        'job_post', 
        'competence_score', 
        'ethics_score', 
        'teamwork_score', 
        'conduct_score',
        'platform_rating',
        'quality_score_for_job'
    )
    readonly_fields = ('quality_score_for_job', 'job_post')
    search_fields = ('job_post__job_title',)

@admin.register(CandidateFeedback)
class CandidateFeedbackAdmin(admin.ModelAdmin):
    """Admin view for feedback submitted by Candidates about Employers."""
    list_display = (
        'job_post',
        'professionalism_score',
        'work_environment_score',
        'ethics_score',
        'team_score',
        'platform_rating',
        'quality_score_for_job'
    )
    readonly_fields = ('quality_score_for_job', 'job_post')
    search_fields = ('job_post__job_title',)

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    """Admin view for Attendance records."""
    list_display = ('job_post', 'number_of_days_absent', 'was_no_show')
    search_fields = ('job_post__job_title',)
