from django.contrib import admin
from django.urls import path
from django.shortcuts import render
from profiles.models import CandidateProfile, EmployerProfile

class VerificationAdminSite(admin.AdminSite):
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'credential-verification-dashboard/',
                self.admin_view(self.verification_dashboard_view),
                name='credential-verification-dashboard'
            ),
        ]
        return custom_urls + urls

    def verification_dashboard_view(self, request):
        candidates = CandidateProfile.objects.select_related('user').prefetch_related(
            'credentials', 'education', 'skills', 'work_experience'
        ).all()
        employers = EmployerProfile.objects.select_related('user').prefetch_related(
            'credentials', 'specialities'
        ).all()
        
        context = {
            **self.each_context(request),
            'title': 'Credential Verification',
            'candidates': candidates,
            'employers': employers,
        }
        return render(request, 'admin/verification_dashboard.html', context)

verification_site = VerificationAdminSite(name='VerificationAdmin')
