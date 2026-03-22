from django.contrib import admin
from .models import JobPost, JobMatch, JobApplication

@admin.register(JobPost)
class JobPostAdmin(admin.ModelAdmin):
    list_display = ('job_title', 'posted_by', 'job_type', 'status', 'created_at')
    list_filter = ('job_type', 'status', 'created_at')
    search_fields = ('job_title', 'posted_by__institution_name')
    readonly_fields = ('created_at', 'filled_at')

@admin.register(JobMatch)
class JobMatchAdmin(admin.ModelAdmin):
    list_display = ('job_post', 'notification_iteration', 'created_at')
    readonly_fields = ('matched_candidates', 'created_at')
    search_fields = ('job_post__job_title',)

@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ('job_post', 'candidate', 'status', 'applied_at')
    list_filter = ('status',)
    search_fields = ('job_post__job_title', 'candidate__user__email')
