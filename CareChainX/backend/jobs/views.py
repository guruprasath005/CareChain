from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from .models import JobPost, JobApplication
from profiles.models import CandidateProfile
from users.models import User
from core.tasks import (send_telegram_message_task, generate_and_send_employer_profile_summary, escape_markdown, send_error_notification_task,
                        generate_and_send_candidate_profile_summary,generate_and_send_candidate_application_summary,exchange_contact_details_task,
                        generate_and_send_employer_job_list_summary, generate_and_send_candidate_application_list,
                        generate_and_send_employee_list_summary, generate_and_send_candidate_job_list_summary)
from webhooks.models import FeedbackSubmissionToken
from datetime import date, datetime
from django.shortcuts import render
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import render, get_object_or_404
from .models import JobPost, JobApplication
from profiles.models import CandidateProfile, EmployerProfile
from users.models import User, TelegramProfile
from datetime import date
from core.permissions import IsBotOrAuthenticated, HasValidActionToken


class ApplyForJobView(APIView):
    """
    Handles a candidate's application. It validates the request before
    creating the application to ensure data integrity.
    """
    permission_classes = [HasValidActionToken]

    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        job_id = payload.get('job_id')
        candidate_id = payload.get('candidate_id')
        
        job_to_apply = get_object_or_404(JobPost, pk=job_id)
        candidate = get_object_or_404(CandidateProfile, pk=candidate_id)
        
        
        # 0. Check if Job has been filled or cancelled
        title = "Application Failed" # Default title for errors
        
        if job_to_apply.status == JobPost.JobStatus.FILLED:
            message = "This job has already been filled and is no longer accepting applications."
        elif job_to_apply.status == JobPost.JobStatus.CANCELLED:
            message = "This job post has been cancelled by the employer."
        else:
            message = None # No error, proceed with other checks
        
        if message: # If there was a job status error, stop here
            if request.accepted_renderer.format == 'html':
                return render(request, 'general/action_confirmation.html', {'title': title, 'message': message})
            else:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. First, check if an application already exists.
        try:
            application = JobApplication.objects.get(job_post=job_to_apply, candidate=candidate)
            # If it exists, inform the user of the current status and stop.
            if application.status == JobApplication.ApplicationStatus.APPLIED:
                title = "Already Applied"
                message = "You have already applied for this job."
            elif application.status == JobApplication.ApplicationStatus.CANDIDATE_REJECTED:
                title = "Application Failed"
                message = "You cannot apply for a job that you have previously rejected."
            else:
                title = "Application Status"
                message = f"Your application is already in the '{application.get_status_display()}' state."
            
            if request.accepted_renderer.format == 'html':
                return render(request, 'general/action_confirmation.html', {'title': title, 'message': message})
            else:
                return Response({"message": message}, status=status.HTTP_400_BAD_REQUEST)

        except JobApplication.DoesNotExist:
            # If no application exists, we can proceed with validation.
            pass

        # 2. If no application exists, perform schedule clash detection.
        if job_to_apply.job_type == JobPost.JobType.SHORT_TERM and job_to_apply.weekly_availability_matrix:
            existing_commitments = JobPost.objects.filter(
                filled_by=candidate, status=JobPost.JobStatus.FILLED,
                job_type=JobPost.JobType.SHORT_TERM, end_date__gte=date.today()
            ).exclude(pk=job_to_apply.id)

            for committed_job in existing_commitments:
                if committed_job.weekly_availability_matrix:
                    for i in range(7):
                        for j in range(24):
                            if job_to_apply.weekly_availability_matrix[i][j] == 1 and committed_job.weekly_availability_matrix[i][j] == 1:
                                # If a clash is found, notify the user and stop.
                                error_message = f"You cannot apply for '{job_to_apply.job_title}' because its schedule conflicts with another job you have accepted: '{committed_job.job_title}'."
                                try:
                                    chat_id = candidate.user.telegram_profile.telegram_chat_id
                                    send_error_notification_task.delay(chat_id, error_message, "You can view your upcoming jobs with the /myjobs command.")
                                except Exception: pass
                                
                                if request.accepted_renderer.format == 'html':
                                    return render(request, 'general/action_confirmation.html', {'title': 'Schedule Conflict', 'message': error_message})
                                else:
                                    return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)
      
        # 3. If all checks pass, THEN create the application.
        application = JobApplication.objects.create(
            job_post=job_to_apply,
            candidate=candidate,
            status=JobApplication.ApplicationStatus.APPLIED
        )

        # Notify the employer
        try:
            generate_and_send_candidate_application_summary.delay(application.id)
        except Exception:
            pass
        
        # Finally, send the success response.
        title = "Application Submitted!"
        message = "Your application has been sent to the employer. You will be notified of any updates."
        if request.accepted_renderer.format == 'html':
            return render(request, 'general/action_confirmation.html', {'title': title, 'message': message})
        else:
            return Response({"message": message})



class RejectJobView(APIView):
    """
    Handles a candidate's rejection of a job offer. It checks the
    existing application status and returns the appropriate response format.
    """
    permission_classes = [HasValidActionToken]

    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        job_id = payload.get('job_id')
        candidate_id = payload.get('candidate_id')
        
        job = get_object_or_404(JobPost, pk=job_id)
        candidate = get_object_or_404(CandidateProfile, pk=candidate_id)
        
        title = "Job Rejected"
        message = "You have successfully rejected this job opportunity. We will not send you further notifications about it."

        try:
            # First, try to get an existing application
            application = JobApplication.objects.get(job_post=job, candidate=candidate)
            
            # If we find one, check its status to prevent conflicting actions
            if application.status == JobApplication.ApplicationStatus.APPLIED:
                title = "Action Not Allowed"
                message = "You cannot reject a job you have already applied for. Please contact support to withdraw your application."
            elif application.status == JobApplication.ApplicationStatus.CANDIDATE_REJECTED:
                title = "Already Rejected"
                message = "You have already rejected this job."
            else:
                title = "Application Status"
                message = f"This job application is already in the '{application.get_status_display()}' state and cannot be rejected now."

        except JobApplication.DoesNotExist:
            # If no application exists, it's safe to create a new "rejected" one.
            JobApplication.objects.create(
                job_post=job,
                candidate=candidate,
                status=JobApplication.ApplicationStatus.CANDIDATE_REJECTED
            )
            # Send a confirmation message back to the candidate only if a new rejection was created
            try:
                telegram_profile = candidate.user.telegram_profile
                escaped_job_title = escape_markdown(job.job_title)
                tg_message = f"You have rejected the job post: *{escaped_job_title}*\\. We will not notify you about this job again\\."
                send_telegram_message_task.delay(
                    chat_id=telegram_profile.telegram_chat_id,
                    message=tg_message
                )
            except Exception:
                pass
        
        # --- Content Negotiation ---
        if request.accepted_renderer.format == 'html':
            # For a browser, render the HTML template
            context = {'title': title, 'message': message}
            return render(request, 'general/action_confirmation.html', context)
        else:
            # For an API client, return JSON
            return Response({"message": message})
        
        
        
class ViewEmployerProfileView(APIView):
    """
    Triggers the task to send the employer's profile to the candidate,
    but only if the job is still open.
    Responds with either HTML or JSON.
    """
    permission_classes = [HasValidActionToken]

    # The method signature now accepts the job_id from the URL
    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        job_id = payload.get('job_id')
        candidate_id = payload.get('candidate_id')
        
        job = get_object_or_404(JobPost, pk=job_id)
        candidate = get_object_or_404(CandidateProfile, pk=candidate_id)
        
        # --- NEW: VALIDATION CHECKS ---
        title = "Action Not Allowed" # Default title for errors
        
        if job.status == JobPost.JobStatus.FILLED:
            message = "This job has already been filled and is no longer active."
        elif job.status == JobPost.JobStatus.CANCELLED:
            message = "This job post has been cancelled by the employer."
        else:
            # If all checks pass, proceed with the action
            try:
                chat_id = candidate.user.telegram_profile.telegram_chat_id
                generate_and_send_employer_profile_summary.delay(
                    download_results=None,
                    profile_id=job.posted_by.id,
                    send_to_chat_id=chat_id
                )
                title = "Request Received"
                message = "The employer's detailed profile is being generated and will be sent to your Telegram chat momentarily."
            except Exception:
                title = "Error"
                message = "An unexpected error occurred. Please try again later."
        
        # --- Content Negotiation ---
        if request.accepted_renderer.format == 'html':
            context = {'title': title, 'message': message}
            return render(request, 'general/action_confirmation.html', context)
        else:
            # Check the title to determine if it was a success or error
            if "Received" in title:
                return Response({"message": message})
            else:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        

        
class ViewCandidateProfileView(APIView):
    """
    Triggered when an employer clicks 'View Detailed Profile'.
    It validates the application status, updates it to 'In Review',
    sends the candidate's full profile, and responds with either HTML or JSON.
    """
    permission_classes = [HasValidActionToken]

    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        application_id = payload.get('application_id')
        
        application = get_object_or_404(
            JobApplication.objects.select_related('job_post', 'candidate__user'), 
            pk=application_id
        )
        
        # --- NEW: VALIDATION CHECKS ---
        title = "Action Not Allowed" # Default title for errors

        if application.status == JobApplication.ApplicationStatus.CANDIDATE_REJECTED:
            message = "The candidate has already rejected this job opportunity."
        elif application.job_post.status == JobPost.JobStatus.CANCELLED:
            message = "This job post has been cancelled and is no longer active."
        elif application.job_post.status == JobPost.JobStatus.FILLED:
            message = "This job has already been filled."
        else:
            # If all checks pass, proceed with the action
            
            # Update status to 'In Review' if it's a new application
            if application.status == JobApplication.ApplicationStatus.APPLIED:
                application.status = JobApplication.ApplicationStatus.IN_REVIEW
                application.save()

            # Trigger the task to send the candidate's full profile to the employer
            try:
                employer_chat_id = application.job_post.posted_by.user.telegram_profile.telegram_chat_id
                generate_and_send_candidate_profile_summary.delay(
                    download_results=None, # Not needed for this call
                    profile_id=application.candidate.id,
                    send_to_chat_id=employer_chat_id
                )
                title = "Request Received"
                message = "The candidate's detailed profile is being generated and will be sent to your Telegram chat momentarily."
            except Exception:
                title = "Error"
                message = "An unexpected error occurred while generating the profile. Please try again later."
        
        # --- Content Negotiation ---
        if request.accepted_renderer.format == 'html':
            context = {'title': title, 'message': message}
            return render(request, 'general/action_confirmation.html', context)
        else:
            # Check the title to determine if it was a success or error
            if "Received" in title:
                return Response({"message": message})
            else:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        

        
class GetContactDetailsView(APIView):
    """
    Triggered when an employer clicks 'Get Contact Details'.
    It validates the job and application status before proceeding.
    Responds with either HTML or JSON.
    """
    permission_classes = [HasValidActionToken]

    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        application_id = payload.get('application_id')
        
        # Use select_related to efficiently fetch the related job post
        application = get_object_or_404(
            JobApplication.objects.select_related('job_post'), 
            pk=application_id
        )
        job = application.job_post
        
        # --- VALIDATION CHECKS ---
        
        # 1. Check if the parent job post has been cancelled
        if job.status == JobPost.JobStatus.CANCELLED:
            title = "Action Not Allowed"
            message = "This job post has been cancelled and is no longer active."
        
        # 2. Check the current status of this specific application
        elif application.status == JobApplication.ApplicationStatus.INTERVIEW:
            title = "Already Requested"
            message = "You have already requested the contact details for this candidate."
        elif application.status == JobApplication.ApplicationStatus.EMPLOYER_REJECTED:
            title = "Action Not Allowed"
            message = "You cannot request contact details for an application you have already rejected."
        elif application.status == JobApplication.ApplicationStatus.HIRED:
            title = "Action Not Allowed"
            message = "This candidate has already been hired for this position."
        elif application.status == JobApplication.ApplicationStatus.CANDIDATE_REJECTED:
            title = "Action Not Allowed"
            message = "The candidate has rejected this job opportunity."
        
        # 3. If all checks pass, proceed with the action
        else:
            application.status = JobApplication.ApplicationStatus.INTERVIEW
            application.save()

            # Trigger the Celery task to exchange contact details
            exchange_contact_details_task.delay(application.id)

            title = 'Contact Details Shared'
            message = "The candidate's contact details have been sent to your Telegram chat, and yours have been sent to them. Please coordinate for an interview."
        
        # --- Content Negotiation ---
        if request.accepted_renderer.format == 'html':
            # For a browser, render the HTML template
            context = {'title': title, 'message': message}
            return render(request, 'general/action_confirmation.html', context)
        else:
            # For an API client, return JSON
            # Check the title to determine if it was a success or error
            if "Shared" in title:
                return Response({"message": message})
            else:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)


class HireCandidateView(APIView):
    """
    Triggered when an employer clicks 'Hire'.
    It now validates against schedule conflicts before updating statuses
    and notifying both parties.
    """
    permission_classes = [HasValidActionToken]

    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        application_id = payload.get('application_id')
        
        application = get_object_or_404(
            JobApplication.objects.select_related('job_post', 'candidate__user'), 
            pk=application_id
        )
        job = application.job_post
        candidate = application.candidate

        # --- VALIDATION CHECKS ---
        title = "Action Not Allowed"
        message = None
        
        if job.status == JobPost.JobStatus.CANCELLED:
            message = "This job post has been cancelled and is no longer active."
        elif job.status == JobPost.JobStatus.FILLED:
            message = f"This job has already been filled by {job.filled_by.user.get_full_name()}."
        elif application.status == JobApplication.ApplicationStatus.HIRED:
            message = "This candidate has already been hired for this position."
        elif application.status == JobApplication.ApplicationStatus.EMPLOYER_REJECTED:
            message = "You cannot hire a candidate you have already rejected."
        elif application.status == JobApplication.ApplicationStatus.CANDIDATE_REJECTED:
            message = "You cannot hire a candidate who has rejected this job opportunity."

        # --- SCHEDULE CLASH DETECTION (if no other errors) ---
        if not message and job.job_type == JobPost.JobType.SHORT_TERM and job.weekly_availability_matrix:
            existing_commitments = JobPost.objects.filter(
                filled_by=candidate, status=JobPost.JobStatus.FILLED,
                job_type=JobPost.JobType.SHORT_TERM, end_date__gte=date.today()
            ).exclude(pk=job.id)

            for committed_job in existing_commitments:
                if committed_job.weekly_availability_matrix:
                    for i in range(7):
                        for j in range(24):
                            if job.weekly_availability_matrix[i][j] == 1 and committed_job.weekly_availability_matrix[i][j] == 1:
                                # Clash found!
                                title = "Schedule Conflict"
                                message = f"You cannot hire this candidate as their schedule conflicts with another job they have accepted."
                                break # Exit inner loop
                    if message:
                        break # Exit outer loop
        # ---------------------------------------------------------

        # If any validation failed, message will have a value.
        if message:
            if request.accepted_renderer.format == 'html':
                return render(request, 'general/action_confirmation.html', {'title': title, 'message': message})
            else:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        
        # If all checks pass, proceed with the hiring logic
        # 1. Exchange contact details if needed
        if application.status != JobApplication.ApplicationStatus.INTERVIEW:
            exchange_contact_details_task.delay(application.id)

        # 2. Update statuses
        application.status = JobApplication.ApplicationStatus.HIRED
        application.save()
        
        job.status = JobPost.JobStatus.FILLED
        job.filled_by = candidate
        job.filled_at = timezone.now()
        job.save()

        # 3. Notify both parties
        try:
            candidate_chat_id = candidate.user.telegram_profile.telegram_chat_id
            message_to_candidate = f"🎉 Congratulations\\! You have been hired for the position: *{escape_markdown(job.job_title)}*\\. The employer will be in touch shortly\\."
            send_telegram_message_task.delay(candidate_chat_id, message_to_candidate)

            employer_chat_id = job.posted_by.user.telegram_profile.telegram_chat_id
            message_to_employer = f"✅ You have successfully hired *{escape_markdown(candidate.user.get_full_name())}* for the position: *{escape_markdown(job.job_title)}*\\."
            send_telegram_message_task.delay(employer_chat_id, message_to_employer)
        except Exception:
            pass

        # --- Final Success Response ---
        title = 'Candidate Hired!'
        message = f"You have successfully hired {candidate.user.get_full_name()}. Both parties have been notified and contact details have been exchanged."
        
        if request.accepted_renderer.format == 'html':
            return render(request, 'general/action_confirmation.html', {'title': title, 'message': message})
        else:
            return Response({"message": message})          
            
            
        
class RejectApplicationView(APIView):
    """
    Triggered when an employer clicks 'Reject'.
    It validates the job/application status before updating the status
    and notifying the candidate.
    """
    permission_classes = [HasValidActionToken]
    

    def get(self, request,*args, **kwargs):
        
        payload = request.action_payload
        application_id = payload.get('application_id')
        
        application = get_object_or_404(
            JobApplication.objects.select_related('job_post', 'candidate__user'), 
            pk=application_id
        )
        job = application.job_post
        candidate = application.candidate

        # --- VALIDATION CHECKS ---
        title = "Action Not Allowed" # Default title for errors
        
        if job.status == JobPost.JobStatus.CANCELLED:
            message = "This job post has been cancelled and is no longer active."
        elif job.status == JobPost.JobStatus.FILLED:
            message = f"This job has already been filled and cannot be actioned further."
        elif application.status == JobApplication.ApplicationStatus.HIRED:
            message = "You cannot reject a candidate who has already been hired for this position."
        elif application.status == JobApplication.ApplicationStatus.EMPLOYER_REJECTED:
            title = "Already Rejected"
            message = "You have already rejected this candidate for this position."
        elif application.status == JobApplication.ApplicationStatus.CANDIDATE_REJECTED:
            message = "The candidate has already rejected this job opportunity."
        else:
            # If all checks pass, proceed with the rejection logic
            application.status = JobApplication.ApplicationStatus.EMPLOYER_REJECTED
            application.save()

            # Notify the candidate
            try:
                candidate_chat_id = candidate.user.telegram_profile.telegram_chat_id
                escaped_job_title = escape_markdown(job.job_title)
                message_to_candidate = f"Regarding your application for *{escaped_job_title}*: the employer has decided to move forward with other candidates at this time\\. We encourage you to apply for other open positions\\."
                send_telegram_message_task.delay(candidate_chat_id, message_to_candidate)
            except Exception:
                pass

            title = 'Application Rejected'
            message = "You have rejected the application. The candidate has been notified."
        
        # --- Content Negotiation ---
        if request.accepted_renderer.format == 'html':
            context = {'title': title, 'message': message}
            return render(request, 'general/action_confirmation.html', context)
        else:
            if "Rejected" in title: # Check for success or already-actioned states
                return Response({"message": message})
            else: # It was an error
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
            
            
class EmployerJobPostSummaryRequestView(APIView):
    """
    A secure endpoint for the bot to trigger the generation and sending
    of an employer's job post summary. It receives the user_id from the bot.
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Find the employer's profile and chat_id from the user_id
        try:
            # We use select_related for an efficient query
            user = User.objects.select_related('employer_profile', 'telegram_profile').get(pk=user_id)
            employer_profile = user.employer_profile
            chat_id = user.telegram_profile.telegram_chat_id
        except (User.DoesNotExist, EmployerProfile.DoesNotExist, TelegramProfile.DoesNotExist):
            return Response({"error": "A valid employer profile and Telegram profile could not be found for this user."}, status=status.HTTP_404_NOT_FOUND)

        # Trigger the Celery task to do the heavy lifting
        generate_and_send_employer_job_list_summary.delay(
            employer_profile_id=employer_profile.id,
            chat_id=chat_id
        )
        
        # Immediately return a success response to the bot
        return Response({"message": "Job post summary generation has been queued."})


class CancelJobPostView(APIView):
    """
    Handles an employer's request to cancel a job post.
    It now refunds the job post quota if no active applications exist.
    """
    permission_classes = [HasValidActionToken]

    def get(self, request, *args, **kwargs):
        payload = request.action_payload
        job_id = payload.get('job_id')
        
        job = get_object_or_404(JobPost, pk=job_id)
        employer_profile = job.posted_by
        
        title = "Action Not Allowed"
        message = None

        # --- VALIDATION CHECKS ---
        if job.status == JobPost.JobStatus.FILLED:
            message = "You cannot cancel a job that has already been filled."
        elif job.status == JobPost.JobStatus.CANCELLED:
            title = "Already Cancelled"
            message = "This job post has already been cancelled."
        
        if message:
            if request.accepted_renderer.format == 'html':
                return render(request, 'general/action_confirmation.html', {'title': title, 'message': message})
            else:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

        # --- THIS IS THE NEW LOGIC ---
        # 1. Check for active applications
        has_active_applications = job.applications.exclude(
            status=JobApplication.ApplicationStatus.CANDIDATE_REJECTED
        ).exists()

        # 2. Cancel the job
        job.status = JobPost.JobStatus.CANCELLED
        job.save()
        
        title = "Job Cancelled"
        
        # 3. Determine the message and update quota
        if has_active_applications:
            message = f"Your job post '{job.job_title}' has been successfully cancelled. Because candidates had already applied, your job post credit was not refunded."
        else:
            # If no active applications, refund the quota.
            employer_profile.job_post_quota += 1
            employer_profile.save()
            message = f"Your job post '{job.job_title}' has been successfully cancelled. As no candidates had applied, your job post credit has been refunded."
        # ------------------------------------

        # --- Content Negotiation for Success Response ---
        if request.accepted_renderer.format == 'html':
            return render(request, 'general/action_confirmation.html', {'title': title, 'message': message})
        else:
            return Response({"message": message})



class ListJobApplicantsView(APIView):
    """
    Triggered when an employer clicks 'List Applicants'.
    It finds all applications for the job and triggers the summary task for each one.
    """
    permission_classes = [HasValidActionToken] 

    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        job_id = payload.get('job_id')
        
        job = get_object_or_404(JobPost, pk=job_id)
        
        # Find all applications for this job that are in a reviewable state
        applications = job.applications.filter(
            status__in=[
                JobApplication.ApplicationStatus.APPLIED,
                JobApplication.ApplicationStatus.IN_REVIEW,
                JobApplication.ApplicationStatus.INTERVIEW
            ]
        )

        if not applications.exists():
            title = "No Applicants"
            message = "There are currently no active applicants for this job post."
        else:
            # Trigger the summary task for each application
            for app in applications:
                generate_and_send_candidate_application_summary.delay(app.id)
            
            title = "Request Received"
            message = f"The application summaries for your job '{job.job_title}' are being sent to your Telegram chat."

        # --- Content Negotiation ---
        if request.accepted_renderer.format == 'html':
            context = {'title': title, 'message': message}
            return render(request, 'general/action_confirmation.html', context)
        else:
            return Response({"message": message})
        
        
        
class CandidateListApplicationsView(APIView):
    """
    A secure endpoint for the bot to trigger the generation and sending
    of a candidate's application list summary. This is a fire-and-forget endpoint.
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Find the candidate's profile and chat_id from the user_id
            user = User.objects.select_related('candidate_profile', 'telegram_profile').get(pk=user_id)
            candidate_profile = user.candidate_profile
            chat_id = user.telegram_profile.telegram_chat_id
        except (User.DoesNotExist, CandidateProfile.DoesNotExist, TelegramProfile.DoesNotExist):
            return Response({"error": "A valid candidate profile and Telegram profile could not be found for this user."}, status=status.HTTP_404_NOT_FOUND)

        # Trigger the Celery task to do the heavy lifting
        generate_and_send_candidate_application_list.delay(
            candidate_profile_id=candidate_profile.id,
            chat_id=chat_id
        )
        
        # Immediately return a success response to the bot
        return Response({"message": "Candidate application list generation has been queued."})


class CandidateCancelApplicationView(APIView):
    """
    Handles a candidate's request to cancel (withdraw) their application.
    Includes validation to ensure the action is allowed.
    """
    permission_classes = [HasValidActionToken] # The link is the authentication

    def get(self, request,*args, **kwargs):
        
        payload = request.action_payload
        application_id = payload.get('application_id')
        
        application = get_object_or_404(JobApplication, pk=application_id)
        
        title = "Action Not Allowed"
        message = None

        # --- VALIDATION CHECKS ---
        allowed_statuses = [
            JobApplication.ApplicationStatus.APPLIED,
            JobApplication.ApplicationStatus.IN_REVIEW,
            JobApplication.ApplicationStatus.INTERVIEW
        ]
        if application.status not in allowed_statuses:
            message = f"You can no longer cancel this application as it is in the '{application.get_status_display()}' state."
        
        if not message:
            # If all checks pass, cancel the application
            application.status = JobApplication.ApplicationStatus.CANDIDATE_REJECTED
            application.save()
            title = "Application Cancelled"
            message = f"You have successfully withdrawn your application for the job: '{application.job_post.job_title}'."

        # --- Content Negotiation ---
        if request.accepted_renderer.format == 'html':
            return render(request, 'general/action_confirmation.html', {'title': title, 'message': message})
        else:
            status_code = status.HTTP_200_OK if "Cancelled" in title else status.HTTP_400_BAD_REQUEST
            return Response({"message": message}, status=status_code)
        
    
    
class EmployerEmployeeListRequestView(APIView):
    """
    A secure endpoint for the bot to trigger the generation and sending
    of an employer's current employee/filled job list.
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.select_related('employer_profile', 'telegram_profile').get(pk=user_id)
            employer_profile = user.employer_profile
            chat_id = user.telegram_profile.telegram_chat_id
        except (User.DoesNotExist, EmployerProfile.DoesNotExist, TelegramProfile.DoesNotExist):
            return Response({"error": "Valid employer profile and Telegram profile not found."}, status=status.HTTP_404_NOT_FOUND)

        # Trigger the Celery task to do the heavy lifting
        generate_and_send_employee_list_summary.delay(
            employer_profile_id=employer_profile.id,
            chat_id=chat_id
        )
        return Response({"message": "Employee list summary generation has been queued."})



class CandidateListCurrentJobsView(APIView):
    """
    A secure endpoint for the bot to trigger the generation and sending
    of a candidate's current job list summary.
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.select_related('candidate_profile', 'telegram_profile').get(pk=user_id)
            candidate_profile = user.candidate_profile
            chat_id = user.telegram_profile.telegram_chat_id
        except (User.DoesNotExist, CandidateProfile.DoesNotExist, TelegramProfile.DoesNotExist):
            return Response({"error": "A valid candidate profile and Telegram profile could not be found for this user."}, status=status.HTTP_404_NOT_FOUND)

        # Trigger the Celery task to do the heavy lifting
        generate_and_send_candidate_job_list_summary.delay(
            candidate_profile_id=candidate_profile.id,
            chat_id=chat_id
        )
        return Response({"message": "Candidate job list generation has been queued."})




class CloseJobView(APIView):
    """
    Handles a request from either an Employer or a Candidate to close a job
    and provide feedback.
    """
    permission_classes = [HasValidActionToken]

    def get(self, request, *args, **kwargs):
        
        payload = request.action_payload
        job_id = payload.get('job_id')
        role_type = payload.get('role_type')
        
        job = get_object_or_404(JobPost, pk=job_id)
        
        title = "Action Not Allowed"
        message = None
        context = {}

        # 1. Validation: The job MUST be in the 'FILLED' state to be closed.
        if job.status != JobPost.JobStatus.FILLED:
            if job.status == JobPost.JobStatus.OPEN:
                message = "This job is still open and has not been filled."
            elif job.status == JobPost.JobStatus.COMPLETED:
                message = "This job has already been marked as completed."
            elif job.status == JobPost.JobStatus.CANCELLED:
                message = "This job has already been cancelled."
            else:
                message = f"This action is not available. The job's current status is '{job.get_status_display()}'."
        
        if message:
            context = {'title': title, 'message': message}
        else:
            # 2. If validation passes, proceed with the logic
            role_type_enum = FeedbackSubmissionToken.RoleType.EMPLOYER if role_type == 'employer' else FeedbackSubmissionToken.RoleType.CANDIDATE
            feedback_token, created = FeedbackSubmissionToken.objects.update_or_create(
                job_post=job,
                role_type=role_type_enum,
                defaults={'is_used': False} # Ensure a fresh token is available
            )
            
            
            # 3. Determine which feedback form to use based on the role_type
            if role_type == 'employer':
                feedback_form_url = f"https://docs.google.com/forms/d/e/1FAIpQLSdbii8sfAbsZRrY5iEV-mGKY7uuEEQw9wZiRGC0ua_tziURwQ/viewform?usp=pp_url&entry.1089074305={feedback_token.token}"
            elif role_type == 'candidate':
                feedback_form_url = f"https://docs.google.com/forms/d/e/1FAIpQLSfIayJA-IloV-rKgB9_5YouT_P6GAnfZze_F6xWXdCZQuu6JQ/viewform?usp=pp_url&entry.2003688665={feedback_token.token}"
            else:
                # This is a safeguard against invalid role_type in the URL
                context = {'title': "Error", 'message': "Invalid role specified in the request."}
                return render(request, 'general/action_confirmation.html', context)

            # 4. Determine the message based on timing
            job_end_datetime = timezone.make_aware(datetime.combine(job.end_date, job.shift_end_time))
            
            if timezone.now() < job_end_datetime:
                title = "Early Job Closure"
                message = f"You are about to close the job '{job.job_title}' before its scheduled end time. Please provide your feedback using the form below."
            else:
                title = "Mark Job as Complete"
                message = f"You are marking the job '{job.job_title}' as complete. Please provide your valuable feedback."

            context = {
                'title': title,
                'message': message,
                'button_text': 'Open Feedback Form',
                'button_url': feedback_form_url
            }

        # 5. Content Negotiation
        if request.accepted_renderer.format == 'html':
            return render(request, 'general/action_confirmation.html', context)
        else:
            if 'button_url' in context:
                return Response({"message": context['message'], "feedback_form_url": context['button_url']})
            else:
                return Response({"error": context['message']}, status=status.HTTP_400_BAD_REQUEST)
