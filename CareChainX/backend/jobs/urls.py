from django.urls import path
from .views import (ApplyForJobView, RejectJobView, ViewEmployerProfileView,
                    ViewCandidateProfileView, GetContactDetailsView, HireCandidateView,
                    RejectApplicationView, EmployerJobPostSummaryRequestView, 
                    CancelJobPostView,ListJobApplicantsView,
                    CandidateListApplicationsView,CandidateCancelApplicationView,
                    EmployerEmployeeListRequestView,CloseJobView, CandidateListCurrentJobsView)

urlpatterns = [
    # Candidate Urls
    path('apply/', ApplyForJobView.as_view(), name='job-apply'),
    path('reject/', RejectJobView.as_view(), name='job-reject'),
    path('view-employer/', ViewEmployerProfileView.as_view(), name='view-employer-profile'),
    path('candidate/request-applications-list/', CandidateListApplicationsView.as_view(), name='candidate-applications-list-request'),
    path('application/candidate-cancel/', CandidateCancelApplicationView.as_view(), name='candidate-cancel-application'),
    path('candidate/request-jobs-list/', CandidateListCurrentJobsView.as_view(), name='candidate-jobs-list-request'),
    
    # Employer Action Urls
    path('application/view-candidate/', ViewCandidateProfileView.as_view(), name='view-candidate-profile'),
    path('application/get-contact/', GetContactDetailsView.as_view(), name='get-contact-details'),
    path('application/hire/', HireCandidateView.as_view(), name='hire-candidate'),
    path('application/reject/', RejectApplicationView.as_view(), name='reject-application'),
    path('employer/request-summary/', EmployerJobPostSummaryRequestView.as_view(), name='employer-job-summary-request'), 
    path('cancel/', CancelJobPostView.as_view(), name='job-cancel'),
    path('list-applicants/', ListJobApplicantsView.as_view(), name='list-job-applicants'),
    path('employer/request-employee-list/', EmployerEmployeeListRequestView.as_view(), name='employer-employee-list-request'),
    
    
    # Common Action urls
    path('close/', CloseJobView.as_view(), name='job-close'),
    
]