from django.contrib import admin
from .models import FormSubmissionToken

@admin.register(FormSubmissionToken)
class FormSubmissionTokenAdmin(admin.ModelAdmin):
    """Define the admin pages for the FormSubmissionToken model."""
    list_display = ('user', 'profile_type', 'token', 'is_used', 'created_at')
    list_filter = ('is_used', 'profile_type')
    search_fields = ('user__email', 'token')
    readonly_fields = ('user', 'profile_type', 'token', 'created_at')
