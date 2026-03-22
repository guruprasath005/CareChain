from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db import transaction
from django.db.models import Avg, Q
from celery import chord
from .models import FormSubmissionToken, FeedbackSubmissionToken
from profiles.models import (
    CandidateProfile, EmployerProfile, EmployerCredential,CandidateCredential,
    InstitutionType, Speciality, DiagnosticFacility, RadiologyFacility,DegreeType,Country,Skill,Education,WorkExperience
)
from users.models import TelegramProfile, User
from jobs.models import JobPost
from feedback.models import Feedback,Attendance, CandidateFeedback
from core.tasks import escape_markdown
from core.tasks import (send_telegram_message_task, download_and_save_credential, 
                        generate_and_send_employer_profile_summary, geocode_profile_address, 
                        generate_and_send_candidate_profile_summary, send_error_notification_task,
                        run_matching_algorithm_for_job)
import logging
from django.utils import timezone
from datetime import datetime, timedelta, date

logger = logging.getLogger(__name__)

# --- HELPER FUNCTIONS ---

def sync_many_to_many(profile, data, data_key, model):
    """
    Synchronizes a ManyToManyField based on a list of names from the form.
    It finds or creates objects for each name and sets the relationship.
    """
    selected_names = data.get(data_key, [])
    if not isinstance(selected_names, list):
        return # Do nothing if data is not a list

    # Handle the "Other" option from Google Forms
    other_text = None
    if "Other" in selected_names and len(selected_names) > 1:
        other_text = selected_names[-1]
        selected_names = selected_names[:-1] # Remove the custom text from the list of choices

    # For any "Other" text, create a new entry in the lookup table
    if other_text:
        # get_or_create is not async, so we wrap it
        other_obj, _ = model.objects.get_or_create(name=other_text)
        # Add the new "Other" object to the list of selections
        if other_obj.name not in selected_names:
            selected_names.append(other_obj.name)

    # Find or create all the necessary objects in the lookup table
    objects_to_set = []
    for name in selected_names:
        if name: # Ensure name is not an empty string
            obj, _ = model.objects.get_or_create(name=name.strip())
            objects_to_set.append(obj)

    # Use .set() to efficiently update the relationship
    # This removes old relationships and adds the new ones.
    related_manager = getattr(profile, model._meta.model_name.lower() + '_set' if hasattr(profile, model._meta.model_name.lower() + '_set') else data_key)
    related_manager.set(objects_to_set)


def process_education_history(profile, data):
    """
    Parses the flat form data for repeating education sections,
    creates Education objects, and returns a dictionary mapping
    the new objects to their document URLs for later processing.
    """
    # First, delete all old education entries for a clean update
    profile.education.all().delete()
    
    education_docs_to_download = {}
    for i in range(1, 9): # Loop for up to 8 education entries
        degree_name = data.get(f'education_{i}_degree')
        if not degree_name:
            continue # Stop if the first field of a block is missing

        degree_obj, _ = DegreeType.objects.get_or_create(name=degree_name)
        country_obj = None
        country_name = data.get(f'education_{i}_country')
        if country_name:
            country_obj, _ = Country.objects.get_or_create(name=country_name)

        education_entry = Education.objects.create(
            candidate_profile=profile,
            degree=degree_obj,
            institution=data.get(f'education_{i}_institution'),
            year_of_graduation=data.get(f'education_{i}_year'),
            country=country_obj
        )
        
        # Store the doc URLs with the ID of the new education entry
        doc_urls = data.get(f'education_{i}_docs', [])
        if doc_urls:
            education_docs_to_download[education_entry.id] = doc_urls
            
    return education_docs_to_download


def process_work_history(profile, data):
    """
    Parses the flat form data for repeating work experience sections,
    creates WorkExperience objects, and returns a dictionary mapping
    the new objects to their document URLs.
    """
    profile.work_experience.all().delete()
    
    work_docs_to_download = {}
    for i in range(1, 11): # Loop for up to 10 work entries
        role = data.get(f'work_{i}_role')
        if not role:
            continue

        work_entry = WorkExperience.objects.create(
            candidate_profile=profile,
            role=role,
            department=data.get(f'work_{i}_department'),
            institution_name=data.get(f'work_{i}_institution'),
            start_date=data.get(f'work_{i}_start_date'),
            end_date=data.get(f'work_{i}_end_date')
        )
        
        doc_urls = data.get(f'work_{i}_docs', [])
        if doc_urls:
            work_docs_to_download[work_entry.id] = doc_urls
            
    return work_docs_to_download



def trigger_credential_downloads(profile, data, data_key, doc_type, CredentialModel, profile_field_name, **related_fields):
    """
    A generic helper that creates credentials and triggers download tasks.
    It can handle both standalone credentials and those linked to other models.
    """
    urls = data.get(data_key, [])
    if not isinstance(urls, list):
        return []

    tasks = []
    # Use the correct, generic download task for all credentials
    from core.tasks import download_and_save_credential 
    
    with transaction.atomic():
        for url in urls:
            if url:
                create_kwargs = {
                    profile_field_name: profile,
                    'document_type': doc_type,
                    'url': url,
                    **related_fields # Add any extra links (e.g., education_id)
                }
                credential = CredentialModel.objects.create(**create_kwargs)
                tasks.append(download_and_save_credential.s(credential.id, url, CredentialModel.__name__))
    return tasks

def generate_matrix_for_short_term_job(start_date_str, end_date_str, start_time_str, end_time_str):
    matrix = [[0] * 24 for _ in range(7)]
    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        start_hour = datetime.strptime(start_time_str, '%H:%M').hour
        end_hour = datetime.strptime(end_time_str, '%H:%M').hour
        
        duration = (end_date - start_date).days
        
        if duration < 7:
            # Iterate through specific dates
            current_date = start_date
            while current_date <= end_date:
                row_index = current_date.weekday() # Monday is 0
                for hour in range(start_hour, end_hour):
                    matrix[row_index][hour] = 1
                current_date += timedelta(days=1)
        else:
            # Fill the entire week
            for row_index in range(7):
                for hour in range(start_hour, end_hour):
                    matrix[row_index][hour] = 1
                    
    except (ValueError, TypeError) as e:
        logger.error(f"Could not generate matrix due to date/time parsing error: {e}")
        return [] # Return empty matrix on error
        
    return matrix


def validate_job_dates_and_times(data: dict):
    """
    Validates the date and time fields from the job post form data.
    Returns a tuple: (is_valid, error_message).
    """
    start_date_str = data.get('start_date')
    end_date_str = data.get('end_date')
    start_time_str = data.get('shift_start_time')
    end_time_str = data.get('shift_end_time')

    # Only validate if the required fields are present
    if not all([start_date_str, end_date_str, start_time_str, end_time_str]):
        return (True, None) # Not enough data to validate, so we allow it

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        start_time = datetime.strptime(start_time_str, '%H:%M').time()
        end_time = datetime.strptime(end_time_str, '%H:%M').time()
    except (ValueError, TypeError):
        return (False, "The date or time format submitted was invalid.")

    # 1. Check if start date is in the past
    if start_date < date.today():
        return (False, "The Start Date cannot be in the past.")

    # 2. Check if end date is before start date
    if end_date < start_date:
        return (False, "The End Date cannot be before the Start Date.")

    # 3. Check if end time is before or same as start time
    if end_time <= start_time:
        return (False, "The Shift End Time must be after the Shift Start Time.")

    # All checks passed
    return (True, None)




# --- WEBHOOK VIEWS ---


class EmployerProfileUpdateGoogleFormWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        token_str = request.data.get('token')
        data = request.data
        
        try:
            # Find the user associated with this token
            submission_token = FormSubmissionToken.objects.select_related('user').get(token=token_str, is_used=False)
            user = submission_token.user
            try:
                telegram_profile = TelegramProfile.objects.get(user=user)
            except TelegramProfile.DoesNotExist:
                logger.warning(f"No telegram profile for user {user.id} to send initial confirmation.")
            
            # --- PROACTIVE VALIDATION FOR AADHAAR AND CONTACT_NUM ---
            aadhaar = data.get('representative_aadhaar_num')
            contact = data.get('contact_num')
            
            # Check if another user already has this Aadhaar or Contact number
            if aadhaar and EmployerProfile.objects.filter(representative_aadhaar_num=aadhaar).exclude(user=user).exists():
                send_error_notification_task.delay(
                    chat_id=telegram_profile.telegram_chat_id,
                    error_message="An employer profile with this Aadhaar number already exists.",
                    action_message="Please check the number and try again, or contact support if you believe this is an error."
                )
                return Response({"error": "Duplicate Aadhaar"}, status=status.HTTP_400_BAD_REQUEST)

            if contact and EmployerProfile.objects.filter(contact_num=contact).exclude(user=user).exists():
                send_error_notification_task.delay(
                    chat_id=telegram_profile.telegram_chat_id,
                    error_message="An employer profile with this contact number already exists.",
                    action_message="Please use a different number or contact support."
                )
                return Response({"error": "Duplicate contact number"}, status=status.HTTP_400_BAD_REQUEST)
            # --------------------------------
            
            # --- SEND THE NEW INITIAL MESSAGE ---
           
            initial_message = "✅ Details received\\! I'm now processing your documents\\. You will be notified with a preview of your profile when it has been created\\.\n\n*IMPORTANT: To get the best job matches, please set your location again by sending the /setlocation command\\.*"
            send_telegram_message_task.delay(
                    chat_id=telegram_profile.telegram_chat_id,
                    message=initial_message
                )
            
            
            
            if submission_token.profile_type == 'Employer':
                profile, _ = EmployerProfile.objects.get_or_create(user=user)

                # --- Update Simple Fields ---
                profile.representative_first_name = data.get('representative_first_name', profile.representative_first_name)
                profile.representative_last_name = data.get('representative_last_name', profile.representative_last_name)
                profile.representative_aadhaar_num = data.get('representative_aadhaar_num', profile.representative_aadhaar_num)
                profile.contact_num = data.get('contact_num', profile.contact_num)
                profile.institution_name = data.get('institution_name', profile.institution_name)
                profile.institution_address = data.get('institution_address', profile.institution_address)
                profile.institution_pincode = data.get('institution_pincode', profile.institution_pincode)
                profile.institution_website = data.get('institution_website', profile.institution_website)
                profile.outpatient_clinic = data.get('outpatient_clinic') == 'Yes'
                profile.inpatient_facility = data.get('inpatient_facility') == 'Yes'
                profile.ip_bed_num = data.get('ip_bed_num') or 0
                profile.emd_room = data.get('emd_room') == 'Yes'
                profile.emd_bed_num = data.get('emd_bed_num') or 0
                profile.icu_facilities = data.get('icu_facilities') == 'Yes'
                profile.icu_bed_num = data.get('icu_bed_num') or 0
                profile.nicupicu = data.get('nicupicu') == 'Yes'
                profile.nicupicu_bed_num = data.get('nicupicu_bed_num') or 0
                profile.otroom = data.get('otroom') == 'Yes'
                profile.otroom_bed_num = data.get('otroom_bed_num') or 0
                profile.diag_lab = data.get('diag_lab') == 'Yes'
                profile.radio_lab = data.get('radio_lab') == 'Yes'
                profile.pharmacy = data.get('pharmacy') == 'Yes'
                profile.security = data.get('security') == 'Yes'
                profile.employed_doctors_num = data.get('employed_doctors_num') or 0
                profile.employed_nurses_num = data.get('employed_nurses_num') or 0

                # --- Update Relational Fields ---
                # Institution Type (ForeignKey)
                inst_type_name = data.get('institution_type')
                if inst_type_name:
                    inst_type_obj, _ = InstitutionType.objects.get_or_create(name=inst_type_name)
                    profile.institution_type = inst_type_obj
                
                # Specialities (ManyToManyField)
                sync_many_to_many(profile, data, 'specialities', Speciality)
                
                # Diagnostic Facilities (ManyToManyField)
                sync_many_to_many(profile, data, 'diag_lab_facilities', DiagnosticFacility)

                # Radiology Facilities (ManyToManyField)
                sync_many_to_many(profile, data, 'radio_lab_facilities', RadiologyFacility)

                profile.save() # Save all the simple fields
                
                
                if profile.institution_address and profile.institution_pincode:
                    full_address = f"{profile.institution_pincode}, India"
                    
                    # Trigger the geocoding task with the full address
                    geocode_profile_address.delay(
                        'EmployerProfile', 
                        profile.id, 
                        full_address
                    )
                

                # --- Prepare the Chord for Downloading Images ---
                # 1. Create the header: a group of download tasks
                download_tasks = []

                # Delete all old credentials first
                profile.credentials.all().delete()
                
                download_tasks.extend(trigger_credential_downloads(profile, data, 'aadhaar_photo_url', EmployerCredential.DocumentType.AADHAAR_PHOTO,EmployerCredential,'employer_profile'))
                download_tasks.extend(trigger_credential_downloads(profile, data, 'facility_images_urls', EmployerCredential.DocumentType.FACILITY_IMAGE,EmployerCredential,'employer_profile'))
                download_tasks.extend(trigger_credential_downloads(profile, data, 'registration_docs_urls', EmployerCredential.DocumentType.REGISTRATION_LICENSE,EmployerCredential,'employer_profile'))
                download_tasks.extend(trigger_credential_downloads(profile, data, 'infra_op_docs_urls', EmployerCredential.DocumentType.INFRA_OPERATIONAL,EmployerCredential,'employer_profile'))
                download_tasks.extend(trigger_credential_downloads(profile, data, 'qual_acc_docs_urls', EmployerCredential.DocumentType.QUALITY_ACCREDITATION,EmployerCredential,'employer_profile'))
                download_tasks.extend(trigger_credential_downloads(profile, data, 'other_docs_urls', EmployerCredential.DocumentType.OTHER,EmployerCredential,'employer_profile'))
                
                
                # 2. Define the callback: the summary task
                # This task will run after all downloads are complete.
                callback = generate_and_send_employer_profile_summary.s(profile_id=profile.id)

                # 3. Execute the chord
                if download_tasks:
                    chord(download_tasks)(callback)
                else:
                    # If there are no files to download, just run the callback directly
                    generate_and_send_employer_profile_summary.delay(profile_id=profile.id)
                # --------------------------
          
            # Mark the token as used so it can't be submitted again
            submission_token.is_used = True
            submission_token.save()

            return Response({"status": "success"}, status=status.HTTP_200_OK)

        except FormSubmissionToken.DoesNotExist:
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"An unexpected error occurred in the webhook: {e}")
            
            # Send Error Message to Telegram Bot
            try:
                if 'telegram_profile' in locals():
                    send_error_notification_task.delay(
                        chat_id=telegram_profile.telegram_chat_id,
                        error_message="An unexpected server error occurred while processing your profile.",
                        action_message="Please try again later or contact support."
                    )
            except Exception as notify_e:
                logger.error(f"Failed to send error notification: {notify_e}")
            
            
            return Response({"error": "An internal server error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)





class CandidateProfileUpdateGoogleFormWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        token_str = request.data.get('token')
        data = request.data
        
        try:
            submission_token = FormSubmissionToken.objects.select_related('user').get(token=token_str, is_used=False)
            user = submission_token.user
            
            try:
                telegram_profile = TelegramProfile.objects.get(user=user)
            except TelegramProfile.DoesNotExist:
                logger.warning(f"No telegram profile for user {user.id} to send confirmation.")
            
            # --- PROACTIVE VALIDATION FOR AADHAAR AND CONTACT NUMBER---
            aadhaar = data.get('aadhaar_number')
            contact = data.get('contact_number')

            if aadhaar and CandidateProfile.objects.filter(aadhaar_number=aadhaar).exclude(user=user).exists():
                send_error_notification_task.delay(
                    chat_id=telegram_profile.telegram_chat_id,
                    error_message="A candidate profile with this Aadhaar number already exists.",
                    action_message="Please check the number and try again, or contact support."
                )
                return Response({"error": "Duplicate Aadhaar"}, status=status.HTTP_400_BAD_REQUEST)

            if contact and CandidateProfile.objects.filter(contact_number=contact).exclude(user=user).exists():
                send_error_notification_task.delay(
                    chat_id=telegram_profile.telegram_chat_id,
                    error_message="A candidate profile with this contact number already exists.",
                    action_message="Please use a different number or contact support."
                )
                return Response({"error": "Duplicate contact number"}, status=status.HTTP_400_BAD_REQUEST)
            # --------------------------------
            
            
            # Send initial confirmation message

            initial_message = "✅ Details received\\! I'm now processing your profile and documents\\. You will get a final confirmation with a preview shortly\\.\n\n*IMPORTANT: To get the best job matches, please set your location again by sending the /setlocation command\\.*"
            send_telegram_message_task.delay(chat_id=telegram_profile.telegram_chat_id, message=initial_message)
                
            
            if submission_token.profile_type == 'Candidate':
                profile, _ = CandidateProfile.objects.get_or_create(user=user)

                # Update simple fields
                profile.date_of_birth = data.get('date_of_birth', profile.date_of_birth)
                profile.gender = data.get('gender', profile.gender)
                profile.contact_number = data.get('contact_number', profile.contact_number)
                profile.address = data.get('address', profile.address)
                profile.pincode = data.get('pincode',profile.pincode)
                profile.aadhaar_number = data.get('aadhaar_number', profile.aadhaar_number)
                profile.save()
                
                
                # Geocoding with Address
                if profile.address and profile.pincode:
                    full_address = f"{profile.pincode}, India"
                    
                    # Trigger the geocoding task with the full address
                    geocode_profile_address.delay(
                        'CandidateProfile', 
                        profile.id, 
                        full_address
                    )
                
                

                # Update ManyToMany fields
                sync_many_to_many(profile, data, 'specialization', Speciality)
                sync_many_to_many(profile, data, 'skills', Skill)

                # Process repeating sections and get back the doc URLs
                education_docs = process_education_history(profile, data)
                work_docs = process_work_history(profile, data)

                # Prepare the chord for all document downloads
                download_tasks = []
                profile.credentials.all().delete() # Clean slate for credentials

                # Handle standalone credentials
                download_tasks.extend(trigger_credential_downloads(profile, data, 'aadhaar_photo_url', CandidateCredential.DocumentType.AADHAAR_PHOTO,CandidateCredential,'candidate_profile'))
                download_tasks.extend(trigger_credential_downloads(profile, data, 'candidate_photo_url', CandidateCredential.DocumentType.CANDIDATE_PHOTO,CandidateCredential,'candidate_profile'))
                download_tasks.extend(trigger_credential_downloads(profile, data, 'certification_docs', CandidateCredential.DocumentType.CERTIFICATION,CandidateCredential,'candidate_profile'))
                for i in range(1, 5):
                    download_tasks.extend(trigger_credential_downloads(profile, data, f'licensure_{i}_doc', CandidateCredential.DocumentType.LICENSURE,CandidateCredential,'candidate_profile'))

                # Handle credentials linked to education entries
                for edu_id, urls in education_docs.items():
                    download_tasks.extend(trigger_credential_downloads(profile, {'docs': urls}, 'docs', CandidateCredential.DocumentType.EDUCATION_SUPPORT, CandidateCredential, 'candidate_profile', education_id = edu_id))

                # Handle credentials linked to work experience entries
                for work_id, urls in work_docs.items():
                    download_tasks.extend(trigger_credential_downloads(profile, {'docs': urls}, 'docs', CandidateCredential.DocumentType.WORK_EXPERIENCE_SUPPORT, CandidateCredential, 'candidate_profile',work_experience_id=work_id))

                # Define and execute the chord
                callback = generate_and_send_candidate_profile_summary.s(profile_id=profile.id)
                if download_tasks:
                    chord(download_tasks)(callback)
                else:
                    generate_and_send_candidate_profile_summary.delay(profile_id=profile.id)
          
            submission_token.is_used = True
            submission_token.save()
            return Response({"status": "success"}, status=status.HTTP_200_OK)

        except FormSubmissionToken.DoesNotExist:
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"An unexpected error occurred in the candidate webhook: {e}")
            
            # SEND ERROR MESSAGE TO TELEGRAM BOT
            try:
                if 'telegram_profile' in locals():
                    send_error_notification_task.delay(
                        chat_id=telegram_profile.telegram_chat_id,
                        error_message="An unexpected server error occurred while processing your profile.",
                        action_message="Please try again later or contact support."
                    )
            except Exception as notify_e:
                logger.error(f"Failed to send error notification: {notify_e}")
            
            
            return Response({"error": "An internal server error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CandidatePreferencesUpdateGoogleFormWebhookView(APIView):
    permission_classes = [permissions.AllowAny] # This must be a public endpoint

    def post(self, request, *args, **kwargs):
        token_str = request.data.get('token')
        data = request.data
        
        try:
            # Securely identify the user via the single-use token
            submission_token = FormSubmissionToken.objects.select_related('user').get(token=token_str, is_used=False)
            user = submission_token.user
            
            # Ensure the token is for a Candidate profile
            if submission_token.profile_type != 'Candidate':
                return Response({"error": "Invalid token type for this endpoint."}, status=status.HTTP_400_BAD_REQUEST)

            # Get or create the candidate's profile
            profile, _ = CandidateProfile.objects.get_or_create(user=user)

            # Update all the preference fields from the form data
            # The .get() method safely handles cases where a field is skipped and returns None
            profile.weekly_availability_matrix = data.get('weekly_availability_matrix', profile.weekly_availability_matrix)
            profile.pay_per_patient = data.get('pay_per_patient')
            profile.pay_per_hour = data.get('pay_per_hour')
            profile.pay_per_month = data.get('pay_per_month')
            profile.max_travel_distance = data.get('max_travel_distance')
            
            # Infer the preferred_job_type based on the pay fields
            job_types = set() # Use a set to automatically handle duplicates
            if profile.pay_per_patient or profile.pay_per_hour:
                job_types.add("Short-Term")
            
            if profile.pay_per_month:
                job_types.add("Long-Term")
            
            # Convert the set back to a list before saving
            profile.preferred_job_type = sorted(list(job_types))
            
            profile.save()

            # Mark the token as used so it can't be submitted again
            submission_token.is_used = True
            submission_token.save()

            # Send a confirmation message back to the user on Telegram
            try:
                telegram_profile = TelegramProfile.objects.get(user=user)
                message = "✅ Thank you\\! Your job preferences and weekly availability have been successfully updated\\. *Make sure to update your availability weekly by using /setjobpreferences\\.*"
                send_telegram_message_task.delay(
                    chat_id=telegram_profile.telegram_chat_id,
                    message=message
                )
            except TelegramProfile.DoesNotExist:
                logger.warning(f"No telegram profile for user {user.id} to send confirmation.")

            return Response({"status": "success"}, status=status.HTTP_200_OK)

        except FormSubmissionToken.DoesNotExist:
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"An unexpected error occurred in the candidate preferences webhook: {e}")
            
            # SEND ERROR MESSAGE TO TELEGRAM BOT
            try:
                # 'telegram_profile' might not exist if the first DB call failed, so we check
                if 'telegram_profile' in locals():
                    send_error_notification_task.delay(
                        chat_id=telegram_profile.telegram_chat_id,
                        error_message="An unexpected server error occurred while updating your preferences.",
                        action_message="Please try again later or contact support."
                    )
            except Exception as notify_e:
                logger.error(f"Failed to send error notification: {notify_e}")
            
            return Response({"error": "An internal server error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- NEW JOB POST WEBHOOK VIEW ---
class JobPostCreateGoogleFormWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        token_str = request.data.get('token')
        data = request.data
        
        try:
            submission_token = FormSubmissionToken.objects.select_related('user__employer_profile').get(token=token_str, is_used=False)
            employer_profile = submission_token.user.employer_profile
            telegram_profile = TelegramProfile.objects.get(user=submission_token.user)
            
            # Validation of Date and Time
            is_valid, error_message = validate_job_dates_and_times(data)
            if not is_valid:
                send_error_notification_task.delay(
                    chat_id=telegram_profile.telegram_chat_id,
                    error_message=f"Invalid job details: {error_message}",
                    action_message="Please generate a new form link with /newjobpost and correct the details."
                )
                return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)
 
            
            
            job_type = data.get('job_type')
            
            
            # Create the JobPost instance
            job = JobPost.objects.create(
                posted_by=employer_profile,
                job_title=data.get('job_title'),
                job_description=data.get('job_description'),
                job_type='LONG_TERM' if 'Long-Term' in job_type else 'SHORT_TERM',
                transport_provided=data.get('transport_provided') == 'Yes',
                accommodation_provided=data.get('accommodation_provided') == 'Yes',
                meals_provided=data.get('meals_provided') == 'Yes',
                min_experience_years=data.get('min_experience_years') or 0,
                start_date=data.get('start_date'),
                end_date=data.get('end_date'),
                shift_start_time=data.get('shift_start_time'),
                shift_end_time=data.get('shift_end_time')
            )

            # Handle type-specific fields
            if 'Short-Term' in job_type:

                job.short_term_pay_unit = data.get('short_term_pay_unit')
                job.short_term_pay_amount = data.get('short_term_pay_amount')
                # Generate and save the matrix
                job.weekly_availability_matrix = generate_matrix_for_short_term_job(
                    job.start_date, job.end_date, job.shift_start_time, job.shift_end_time
                )
            else: # Long-Term
                job.long_term_salary = data.get('long_term_salary')

            job.save()

            # Sync ManyToMany fields
            sync_many_to_many(job, data, 'required_qualifications', DegreeType)
            sync_many_to_many(job, data, 'required_skills', Skill)
            
            # --- TRIGGER THE MATCHING ALGORITHM ---
            run_matching_algorithm_for_job.delay(job.id)
            
            submission_token.is_used = True
            submission_token.save()

            # Send confirmation message
            try:
                
                escaped_job_title = escape_markdown(job.job_title)
                message = f"✅ Thank you\\! Your new job post '{escaped_job_title}' has been successfully created\\."
                send_telegram_message_task.delay(chat_id=telegram_profile.telegram_chat_id, message=message)
            except TelegramProfile.DoesNotExist:
                pass

            return Response({"status": "success"}, status=status.HTTP_201_CREATED)

        except FormSubmissionToken.DoesNotExist:
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"An unexpected error occurred in the job post webhook: {e}")
            
            try:
                # 'telegram_profile' might not exist if the first DB call failed, so we check
                if 'telegram_profile' in locals():
                    send_error_notification_task.delay(
                        chat_id=telegram_profile.telegram_chat_id,
                        error_message="An unexpected server error occurred while creating your job post.",
                        action_message="Please try again later or contact support if the issue persists."
                    )
            except Exception as notify_e:
                logger.error(f"Failed to send error notification: {notify_e}")
            
            
            return Response({"error": "An internal server error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        
        
class EmployerFeedbackSubmitView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        token_str = request.data.get('token')
        data = request.data
        
        try:
            token = FeedbackSubmissionToken.objects.select_related(
                'job_post__filled_by__user__telegram_profile', 
                'job_post__posted_by__user__telegram_profile'
            ).get(token=token_str, role_type=FeedbackSubmissionToken.RoleType.EMPLOYER)
            
            job = token.job_post
            candidate = job.filled_by
            employer_telegram_profile = job.posted_by.user.telegram_profile

        except FeedbackSubmissionToken.DoesNotExist:
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

        # CHECK IF ALREADY SUBMITTED 
        if token.is_used:
            send_error_notification_task.delay(
                chat_id=employer_telegram_profile.telegram_chat_id,
                error_message="This feedback form has already been submitted.",
                action_message="No further action is needed."
            )
            return Response({"error": "Token already used"}, status=status.HTTP_400_BAD_REQUEST)

        no_show = data.get('no_show', False)
        job_end_datetime = timezone.make_aware(datetime.combine(job.end_date, job.shift_end_time))
        
        # Update JobPost Status
        final_job_status = JobPost.JobStatus.COMPLETED
        if no_show or timezone.now() < job_end_datetime:
            final_job_status = JobPost.JobStatus.CLOSED

        # Update Attendance
        days_absent = int(data.get('number_of_days_absent', 0) or 0)
        Attendance.objects.create(job_post=job, was_no_show=no_show, number_of_days_absent=days_absent)

        
        # Calculate Quality Score
        quality_score = -1.0 if no_show else 0.0
        if not no_show:
            total_score = (data.get('competence_score', 0) + data.get('ethics_score', 0) + data.get('teamwork_score', 0) + data.get('conduct_score', 0))/4
            job_duration_days = (job.end_date - job.start_date).days + 1
            absence_penalty = (days_absent / job_duration_days)*5 if job_duration_days > 0 else 0
            quality_score = total_score - absence_penalty

        Feedback.objects.create(
            job_post=job,
            competence_score=data.get('competence_score', 0),
            ethics_score=data.get('ethics_score', 0),
            teamwork_score=data.get('teamwork_score', 0),
            conduct_score=data.get('conduct_score', 0),
            quality_score_for_job=quality_score, 
            employer_testimonial=data.get('employer_testimonial'),
            platform_rating=data.get('platform_rating'),
            employer_platform_testimonial=data.get('employer_platform_testimonial')
        )

        # Calculate Average Quality Score and Update
        all_feedback = Feedback.objects.filter(
            job_post__filled_by=candidate,
            job_post__status__in=[JobPost.JobStatus.COMPLETED, JobPost.JobStatus.CLOSED]
        )
        new_average = all_feedback.aggregate(avg_score=Avg('quality_score_for_job'))['avg_score'] or 0.0
        
        candidate.average_quality_score = max(0.1, new_average)
        candidate.save()

        job.status = final_job_status
        job.save()
        token.is_used = True
        token.save()

        # --- CONDITIONAL NOTIFICATION LOGIC ---
        try:
            candidate_chat_id = candidate.user.telegram_profile.telegram_chat_id
            
            if no_show:
                # If it was a no-show, send a simple notification without a feedback link.
                message = f"The employer for the job '{job.job_title}' has marked your attendance as a 'No-Show'\\. This will be reflected in your profile score\\. If you believe this is an error, please contact support\\."
                send_telegram_message_task.delay(candidate_chat_id, message)
            else:
                # If the candidate attended, check if they've already submitted feedback.
                candidate_token_exists = FeedbackSubmissionToken.objects.filter(
                    job_post=job, role_type=FeedbackSubmissionToken.RoleType.CANDIDATE, is_used=True
                ).exists()

                if not candidate_token_exists:
                    # If they haven't submitted, create a token and send the feedback link.
                    candidate_token, _ = FeedbackSubmissionToken.objects.get_or_create(
                        job_post=job, role_type=FeedbackSubmissionToken.RoleType.CANDIDATE
                    )
                    candidate_feedback_url = f"https://docs.google.com/forms/d/e/1FAIpQLSfIayJA-IloV-rKgB9_5YouT_P6GAnfZze_F6xWXdCZQuu6JQ/viewform?usp=pp_url&entry.2003688665={candidate_token.token}"
                    
                    status_message = "marked as complete" if final_job_status == JobPost.JobStatus.COMPLETED else "closed the job"
                    
                    message = f"The employer has {status_message} for the job '{job.job_title}'\\. Please take a moment to provide your feedback on the experience\\.\n\n[Open Feedback Form]({candidate_feedback_url})"
                    send_telegram_message_task.delay(candidate_chat_id, message)

        except TelegramProfile.DoesNotExist:
            pass # Fail silently if candidate has no telegram profile
        # ----------------------------------------------------------

        return Response({"status": "success"}, status=status.HTTP_200_OK)
    
    
    
class CandidateFeedbackSubmitView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        token_str = request.data.get('token')
        data = request.data
        
        try:
            token = FeedbackSubmissionToken.objects.select_related(
                'job_post__posted_by__user__telegram_profile',
                'job_post__filled_by__user__telegram_profile'
            ).get(token=token_str, role_type=FeedbackSubmissionToken.RoleType.CANDIDATE)
            
            job = token.job_post
            employer = job.posted_by
            candidate = job.filled_by
            candidate_telegram_profile = candidate.user.telegram_profile

        except FeedbackSubmissionToken.DoesNotExist:
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Validate if already used
        if token.is_used:
            send_error_notification_task.delay(
                chat_id=candidate_telegram_profile.telegram_chat_id,
                error_message="This feedback form has already been submitted.",
                action_message="No further action is needed."
            )
            return Response({"error": "Token already used"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Calculate the quality score for the employer for this specific job
        prof_score = int(data.get('professionalism_score', 0))
        env_score = int(data.get('work_environment_score', 0))
        ethics_score = int(data.get('ethics_score', 0))
        team_score = int(data.get('team_score', 0))
        quality_score = (prof_score + env_score + ethics_score + team_score) / 4.0

        # 3. Create the CandidateFeedback record
        CandidateFeedback.objects.create(
            job_post=job,
            professionalism_score=prof_score,
            work_environment_score=env_score,
            ethics_score=ethics_score,
            team_score=team_score,
            quality_score_for_job=quality_score,
            candidate_testimonial=data.get('candidate_testimonial'),
            platform_rating=data.get('platform_rating'),
            candidate_platform_testimonial=data.get('candidate_platform_testimonial')
        )

        # 4. Recalculate and update the employer's average quality score
        all_feedback = CandidateFeedback.objects.filter(
            job_post__posted_by=employer,
            job_post__status__in=[JobPost.JobStatus.COMPLETED, JobPost.JobStatus.CLOSED]
        )
        new_average = all_feedback.aggregate(avg_score=Avg('quality_score_for_job'))['avg_score'] or 0.0
        
        employer.average_quality_score = max(0.1, new_average)
        employer.save()


        # 5. Determine the final job status based on timing
        job_end_datetime = timezone.make_aware(datetime.combine(job.end_date, job.shift_end_time))
        
        final_job_status = JobPost.JobStatus.COMPLETED
        if timezone.now() < job_end_datetime:
            final_job_status = JobPost.JobStatus.CLOSED
        
        job.status = final_job_status
        job.save()
        # ---------------------------

        # 6. Mark the token as used
        token.is_used = True
        token.save()

        # 7. Notify the employer to provide their feedback (if they haven't already)
        employer_token_exists = FeedbackSubmissionToken.objects.filter(
            job_post=job, role_type=FeedbackSubmissionToken.RoleType.EMPLOYER
        ).exists()

        if not employer_token_exists:
            employer_token = FeedbackSubmissionToken.objects.create(
                job_post=job, role_type=FeedbackSubmissionToken.RoleType.EMPLOYER
            )
            employer_feedback_url = f"https://docs.google.com/forms/d/e/1FAIpQLSdbii8sfAbsZRrY5iEV-mGKY7uuEEQw9wZiRGC0ua_tziURwQ/viewform?usp=pp_url&entry.1089074305={employer_token.token}"
            
            # --- Use a different message based on the final status ---
            status_message = "marked as complete" if final_job_status == JobPost.JobStatus.COMPLETED else "closed the job"
            
            try:
                employer_chat_id = employer.user.telegram_profile.telegram_chat_id
                message = f"The candidate has {status_message} for the job '{job.job_title}'\\. Please take a moment to provide your feedback on their performance\\.\n\n[Open Feedback Form]({employer_feedback_url})"
                send_telegram_message_task.delay(employer_chat_id, message)
            except TelegramProfile.DoesNotExist:
                pass
        
        return Response({"status": "success"}, status=status.HTTP_200_OK)
