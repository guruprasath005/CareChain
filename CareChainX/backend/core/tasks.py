from celery import shared_task
import httpx
from django.conf import settings
from django.core.files.base import ContentFile
from django.db.models import F, Count, Q
from geopy.distance import geodesic
from profiles.models import (EmployerCredential, EmployerProfile, 
                             CandidateProfile, CandidateCredential)
from jobs.models import JobPost, JobMatch, JobApplication
from feedback.models import Feedback, CandidateFeedback
from collections import defaultdict
import os
from users.models import TelegramProfile
import logging
import uuid
import mimetypes
from geopy.geocoders import Nominatim
from datetime import date, timedelta
import re
import jwt
from django.core.mail import send_mail
import datetime
from telegram import Update
from telegram.ext import Application, PicklePersistence
from bot.main import add_handlers
import asyncio
import time
from core.utils import generate_secure_action_url


logger = logging.getLogger(__name__)






# --- CELERY TASKS ---

@shared_task(max_retries=3, default_retry_delay=300)
def send_verification_email_task(user_id: int, user_email: str):
    """
    Generates a verification token and sends it to the user's email.
    """
    logger.info(f"Generating verification email for user {user_id}")
    
    # Create a temporary JWT token that expires in 1 day
    token_payload = {
        'user_id': user_id,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
    }
    token = jwt.encode(token_payload, settings.SECRET_KEY, algorithm='HS256')
    
    # Get the public domain for the link from environment variables
    site_domain = os.getenv('SITE_DOMAIN', 'localhost:8000')
    verification_link = f"https://{site_domain}/api/users/verify-email/?token={token}"
    
    subject = "Verify your Carechain Account"
    message = (
        f"Hello,\n\n"
        f"Thank you for registering with Carechain. Please click the link below to verify your email address:\n\n"
        f"{verification_link}\n\n"
        f"If you did not register for an account, please ignore this email.\n\n"
        f"Thanks,\nThe Carechain Team"
    )
    
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user_email],
            fail_silently=False,
        )
        logger.info(f"Successfully sent verification email to {user_email}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {user_email}: {e}")
        # Raising the exception will cause Celery to retry
        raise e
    
    
    

@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def download_and_save_credential(self, credential_id: int, google_drive_url: str, credential_model_name: str):
    """
    A generic Celery task that can download a file for either an
    EmployerCredential or a CandidateCredential.
    """
    logger.info(f"Starting download for {credential_model_name} ID {credential_id} from {google_drive_url}")
    
    # 1. Dynamically determine which model to use
    if credential_model_name == 'EmployerCredential':
        Model = EmployerCredential
    elif credential_model_name == 'CandidateCredential':
        Model = CandidateCredential
    else:
        logger.error(f"Unknown credential model name provided: {credential_model_name}")
        return "Unknown model."

    try:
        # 2. Fetch the correct credential object from the database
        credential = Model.objects.get(pk=credential_id)
    except Model.DoesNotExist:
        logger.error(f"{credential_model_name} with ID {credential_id} not found. Aborting.")
        return "Credential not found."

    try:
        with httpx.stream("GET", google_drive_url, follow_redirects=True, timeout=60) as response:
            response.raise_for_status()
            
            content_type = response.headers.get('content-type', 'application/octet-stream')
            logger.info(f"Credential ID {credential_id}: Received Content-Type: '{content_type}'")
            
            extension = mimetypes.guess_extension(content_type)
            
            # 3. The fallback logic is now also generic, as both models have `document_type`
            if not extension or extension == '.bin':
                if credential.document_type in [EmployerCredential.DocumentType.FACILITY_IMAGE, CandidateCredential.DocumentType.CANDIDATE_PHOTO]:
                    extension = '.jpg'
                else:
                    extension = '.pdf'
                logger.info(f"Content-Type was generic. Defaulting to extension '{extension}'.")
            
            file_content = response.read()
            new_filename = f"{credential.document_type.lower()}_{uuid.uuid4().hex}{extension}"
            
            # This logic is also generic and works for both models
            full_path = credential.file.storage.path(credential.file.field.upload_to(credential, new_filename))
            directory = os.path.dirname(full_path)
            os.makedirs(directory, exist_ok=True)
            
            credential.file.save(new_filename, ContentFile(file_content))
            credential.save()

        logger.info(f"Successfully downloaded and saved file '{new_filename}' for credential ID {credential_id}")
        return f"File saved for credential {credential_id}"

    except Exception as exc:
        logger.error(f"Failed to download file for credential ID {credential_id}. Retrying... Error: {exc}")
        raise self.retry(exc=exc)
    


@shared_task(max_retries=3, default_retry_delay=300)
def geocode_profile_address(profile_model_name: str, profile_id: int, full_address: str):
    """
    A Celery task that takes a profile, a full address, gets the latitude and
    longitude from Nominatim, and updates the profile in the database.
    """
    logger.info(f"Starting geocoding for {profile_model_name} ID {profile_id} with address '{full_address}'")
    
    geolocator = Nominatim(user_agent="carechain_app_v1")
    
    try:
        # Use the full address for a much more accurate result
        location = geolocator.geocode(full_address, timeout=10)
        
        if location:
            if profile_model_name == 'EmployerProfile':
                ProfileModel = EmployerProfile
                lat_field, lon_field = 'institution_latitude', 'institution_longitude'
            elif profile_model_name == 'CandidateProfile':
                ProfileModel = CandidateProfile
                lat_field, lon_field = 'latitude', 'longitude'
            else:
                logger.error(f"Unknown profile model name provided: {profile_model_name}")
                return

            profile = ProfileModel.objects.get(pk=profile_id)
            setattr(profile, lat_field, location.latitude)
            setattr(profile, lon_field, location.longitude)
            profile.save()
            logger.info(f"Successfully geocoded '{full_address}' to ({location.latitude}, {location.longitude})")
        else:
            logger.warning(f"Could not find coordinates for address: {full_address}")

    except Exception as e:
        logger.error(f"An error occurred during geocoding for address '{full_address}': {e}")
        raise e



@shared_task
def send_match_notifications():
    """
    This task runs every 20 minutes. It finds all unfilled jobs with
    pending matches and sends notifications to the next batch of candidates.
    """
    # Find all JobMatch objects for jobs that are not yet filled
    pending_matches = JobMatch.objects.filter(job_post__status=JobPost.JobStatus.OPEN)
    
    for match in pending_matches:
        iteration = match.notification_iteration
        start_index = iteration * 5
        end_index = start_index + 5
        
        # Get the next 5 candidate IDs from the sorted list
        candidate_matches_to_notify = match.matched_candidates[start_index:end_index]
        
        if not candidate_matches_to_notify:
            logger.info(f"No more candidates to notify for Job ID {match.job_post.id}.")
            continue

        # Get the candidate ids
        candidate_ids_to_notify = [c['candidate_id'] for c in candidate_matches_to_notify]
        
        for candidate_id in candidate_ids_to_notify:
            try:
                generate_and_send_job_post_summary.delay(job_id=match.job_post.id, candidate_id=candidate_id)                
            except TelegramProfile.DoesNotExist:
                continue # Skip candidates who don't have a Telegram account

        # Increment the iteration number for the next run
        match.notification_iteration += 1
        match.save()
        logger.info(f"Sent notifications to batch #{iteration + 1} for Job ID {match.job_post.id}.")




# --- THE MATCHING ENGINE TASK ---
@shared_task
def run_matching_algorithm_for_job(job_post_id: int):
    """
    The main matching engine. It uses a two-stage process:
    1. Hard-filter for qualified candidates.
    2. Score and rank the filtered candidates using a weighted, normalized algorithm.
    """
    # WEIGHTS
    
    SKILL_SCORE_WEIGHT = 3.0
    EXPERIENCE_SCORE_WEIGHT = 4.5
    SALARY_SCORE_WEIGHT = 5.0
    AVAILABILITY_SCORE_WEIGHT = 10.0
    LOCATION_SCORE_WEIGHT = 6.0
    
    
    
    start_time = time.time()
    
    try:
        
        job = JobPost.objects.select_related('posted_by__user').prefetch_related(
            'required_qualifications', 'required_skills'
        ).get(pk=job_post_id)
    except JobPost.DoesNotExist:
        logger.error(f"JobPost with ID {job_post_id} not found for matching.")
        return

    # Use prefetch_related to efficiently get all related work experiences

    # -- HARD FILTER ---
    eligible_candidates = CandidateProfile.objects.filter(
        user__is_active=True, user__is_email_verified=True
    ).prefetch_related('work_experience')
    
    
    # 1. Hard Filter: Job Type Preference
    if job.job_type == 'SHORT_TERM':
        eligible_candidates = eligible_candidates.filter(preferred_job_type__contains="Short-Term")
    elif job.job_type == 'LONG_TERM':
        eligible_candidates = eligible_candidates.filter(preferred_job_type__contains="Long-Term")

    # 2. Hard Filter: Required Qualifications (Degrees)
    required_quals = job.required_qualifications.all()
    if required_quals.exists():
        eligible_candidates = eligible_candidates.filter(education__degree__in=required_quals).distinct()
        
    # 3. Hard Filter: Not available
    if job.job_type == 'SHORT_TERM' and job.weekly_availability_matrix:
        truly_eligible_candidates = []
        for candidate in eligible_candidates:
            if not candidate.weekly_availability_matrix:
                continue # Skip candidates with no availability set

            # Check for at least one hour of overlap
            has_overlap = any(
                job.weekly_availability_matrix[i][j] == 1 and candidate.weekly_availability_matrix[i][j] == 1
                for i in range(7) for j in range(24)
            )
            
            if has_overlap:
                truly_eligible_candidates.append(candidate)
        
        # The list we loop through for scoring is now much smaller
        eligible_candidates = truly_eligible_candidates
      
    # 4. Hard Filter: Prevent Self-Matching
    # Exclude any candidate profile where the user is the same as the user who posted the job.
    employer_user = job.posted_by.user
    eligible_candidates = [
        candidate for candidate in eligible_candidates if candidate.user.id != employer_user.id
    ]
        
        
    # SCORING
    candidate_scores = []
    required_skill_ids = set(job.required_skills.values_list('id', flat=True))
    total_required_skills = len(required_skill_ids) if len(required_skill_ids) > 0 else 1

    for candidate in eligible_candidates:
        job_score = 0
        pref_score = 0

        # Skill Matching        
        skill_matches = candidate.skills.filter(id__in=job.required_skills.all()).count()
        skill_score = skill_matches/total_required_skills
        job_score += skill_score * SKILL_SCORE_WEIGHT
        
        # Dynamically calculate the candidate's total experience in years
        total_experience_days = 0
        for work in candidate.work_experience.all():
            if work.start_date and work.end_date:
                total_experience_days += (work.end_date - work.start_date).days
        
        candidate_experience_years = total_experience_days / 365.25

        # Now, use the calculated value for the match
        if candidate_experience_years >= job.min_experience_years:
            job_score += EXPERIENCE_SCORE_WEIGHT* (candidate_experience_years - job.min_experience_years)/(job.min_experience_years or 1)
        # ---------------------
        
        
        # Matching Based on Pay
        if job.job_type == 'SHORT_TERM' and "Short-Term" in candidate.preferred_job_type:
            if job.short_term_pay_unit == 'PER_HOUR' and candidate.pay_per_hour:
                salary_diff = float(job.short_term_pay_amount or 0) - float(candidate.pay_per_hour or 0)
                salary_score = 0.5 + (salary_diff / (float(candidate.pay_per_hour) * 2))
            elif job.short_term_pay_unit == 'PER_PATIENT' and candidate.pay_per_patient:
                salary_diff = float(job.short_term_pay_amount or 0) - float(candidate.pay_per_patient or 0)
                salary_score = 0.5 + (salary_diff / (float(candidate.pay_per_patient) * 2))
        elif job.job_type == 'LONG_TERM' and "Long-Term" in candidate.preferred_job_type:
            if candidate.pay_per_month and job.long_term_salary:
                salary_diff = float(job.long_term_salary or 0) - float(candidate.pay_per_month or 0)
                salary_score = 0.5 + (salary_diff / (float(candidate.pay_per_month) * 2))
        
        # Adds an adjustment factor to a baseline of 0.5. 0.5 => Exact match
        # Closer to 1- more the pay exceeds expectation.
        # Closer to 0- greater the expectation exceeds pay.         
        pref_score += SALARY_SCORE_WEIGHT * salary_score
        
        
        # Matching Based on Job Availability
        if job.job_type == 'SHORT_TERM' and job.weekly_availability_matrix and candidate.weekly_availability_matrix:
            overlap = sum(
                1 for i in range(7) for j in range(24) 
                if job.weekly_availability_matrix[i][j] == 1 and candidate.weekly_availability_matrix[i][j] == 1
            )
            # Calculate the Percentage of required hours the candidate is available for
            required_hours = sum(sum(row) for row in job.weekly_availability_matrix)
            availability_score = overlap / required_hours if required_hours > 0 else 0 
            
            pref_score += availability_score * AVAILABILITY_SCORE_WEIGHT

        
        # Matching Based on Location
        if candidate.latitude and candidate.longitude and job.posted_by.institution_latitude and job.posted_by.institution_longitude:
            job_location = (job.posted_by.institution_latitude, job.posted_by.institution_longitude)
            candidate_location = (candidate.latitude, candidate.longitude)
            distance = geodesic(job_location, candidate_location).kilometers
            
            if candidate.max_travel_distance and distance <= candidate.max_travel_distance:
                # Score is 1.0 if distance is 0, and 0.0 if distance is at the max preference
                location_score = 1.0 - (distance / candidate.max_travel_distance)
                pref_score += LOCATION_SCORE_WEIGHT*location_score

        # --- Final Score Calculation ---
        final_score = (job_score + pref_score) * (candidate.average_quality_score or 1.0)
        
        if final_score > 0:
            candidate_scores.append({'candidate_id': candidate.id, 'score': final_score})

    # --- RANKING ---
    sorted_candidates = sorted(candidate_scores, key=lambda x: x['score'], reverse=True)
    
    
    JobMatch.objects.create(
        job_post=job,
        matched_candidates=sorted_candidates
    )
    
    end_time = time.time()
    duration = end_time - start_time
    
    logger.info(f"Successfully completed matching for Job ID {job_post_id}. Found {len(sorted_candidates)} matches.")
    logger.info(f"PERFORMANCE: Matching algorithm took {duration:.4f} seconds to run.")
    
    send_match_notifications.delay()






# --- TELEGRAM TASKS --- #

@shared_task
def process_telegram_update(update_data: dict):
    """
    This task receives the raw update data from the webhook view.
    It creates a temporary, isolated bot instance to process the update,
    ensuring no event loop conflicts.
    """
    async def _process():
        # 1. Create a new, fresh application instance for this one task.
        # This is the key to guaranteeing a clean environment.
        persistence = PicklePersistence(filepath="/app/telegram_persistence/bot_persistence.pkl")
        application = (
            Application.builder()
            .token(settings.TELEGRAM_BOT_TOKEN)
            .persistence(persistence)
            .build()
        )
        
        # 2. Add all your handlers (conversations, commands, etc.)
        add_handlers(application)
        
        # 3. "Warm up" this specific instance
        await application.initialize()
        
        # 4. Process the single update that was passed in
        update = Update.de_json(update_data, application.bot)
        await application.process_update(update)
        
        # 5. Crucially, shut down this instance to clean up all connections
        # and ensure the persistence file is saved correctly.
        await application.shutdown()

    # This command creates a new event loop, runs our _process function,
    # and closes the loop, all in one safe, clean operation.
    asyncio.run(_process())


# --- HELPER FUNCTION ---
def escape_markdown(text: str) -> str:
    """
    Escapes special characters for Telegram's MarkdownV2 style.
    This prevents user-generated content from breaking the formatting.
    """
    if not text:
        return ""
    # The characters to escape are: _ * [ ] ( ) ~ ` > # + - = | { } . !
    escape_chars = r'\_*[]()~`>#+-=|{}.!'
    # Use re.sub to add a backslash before each special character
    return re.sub(f'([{re.escape(escape_chars)}])', r'\\\1', str(text))



@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_telegram_message_task(self, chat_id: str, message: str):
    """
    A Celery task to send a message to a user via the Telegram Bot API.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        logger.error("CRITICAL: TELEGRAM_BOT_TOKEN is not configured.")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    # Use 'MarkdownV2' which is more consistent and works with our escaping function
    payload = {"chat_id": chat_id, 
               "text": message, 
               "parse_mode": "MarkdownV2",
               "disable_web_page_preview": True
               }

    try:
        with httpx.Client() as client:
            response = client.post(url, json=payload)
            if response.status_code != 200:
                logger.error(f"Telegram API Error: {response.status_code} - {response.text}")
            response.raise_for_status()
        logger.info(f"Successfully sent message to chat_id {chat_id}")
        return "Message sent successfully."
    except Exception as exc:
        logger.error(f"Failed to send Telegram message to {chat_id}. Retrying... Error: {exc}")
        raise self.retry(exc=exc)



@shared_task
def generate_and_send_employer_profile_summary(profile_id: int, download_results=None, send_to_chat_id: str = None):
    """
    Generates and sends the Employer Profile summary.
    If 'send_to_chat_id' is provided, it sends the message to that user.
    Otherwise, it sends it to the profile owner.
    """
    logger.info(f"Generating employer profile summary for EmployerProfile ID {profile_id}")
    try:
        profile = EmployerProfile.objects.annotate(
            jobs_posted_count=Count('job_posts')
        ).prefetch_related(
            'credentials', 'specialities', 'diag_lab_facilities', 'radio_lab_facilities'
        ).get(pk=profile_id)
        
        user = profile.user
        
        if send_to_chat_id:
            target_chat_id = send_to_chat_id
        else:
            target_chat_id = user.telegram_profile.telegram_chat_id

    except (EmployerProfile.DoesNotExist, TelegramProfile.DoesNotExist) as e:
        logger.error(f"Could not find profile or telegram profile for ID {profile_id}. Error: {e}")
        return

    # --- Build the Styled Markdown Message ---
    message_parts = []
    site_domain = os.getenv('SITE_DOMAIN', 'localhost:8000')

    # 1. Header
    if profile.institution_name:
        message_parts.append(f"*{escape_markdown(profile.institution_name.upper())}*")

    # 2. Contact Details
    contact_info = []
    if profile.institution_address:
        address = escape_markdown(profile.institution_address)
        if profile.institution_pincode:
            address += f", Pincode: {escape_markdown(profile.institution_pincode)}"
        contact_info.append(address)
    if profile.institution_website:
        contact_info.append(f"[Website]({profile.institution_website})")
    if contact_info:
        message_parts.append("\n".join(contact_info))

    # 3. Representative
    if profile.representative_first_name:
        full_name = escape_markdown(f"{profile.representative_first_name} {profile.representative_last_name or ''}".strip())
        message_parts.append(f"*Representative:* {full_name}")

    # 4. Specialities
    specialities = ", ".join([escape_markdown(s.name) for s in profile.specialities.all()])
    if specialities:
        message_parts.append(f"*Specialities Available:*\n{specialities}")

    # 5. Facilities
    facilities_list = []
    if profile.outpatient_clinic: facilities_list.append("Outpatient Clinics")
    if profile.inpatient_facility: facilities_list.append(f"In-patient Facility ({profile.ip_bed_num or 0} beds)")
    if profile.emd_room: facilities_list.append(f"Emergency Room ({profile.emd_bed_num or 0} beds)")
    if profile.icu_facilities: facilities_list.append(f"ICU ({profile.icu_bed_num or 0} beds)")
    if profile.nicupicu: facilities_list.append(f"NICU/PICU ({profile.nicupicu_bed_num or 0} beds)")
    if profile.otroom: facilities_list.append(f"Operation Theatres ({profile.otroom_bed_num or 0})")
    if profile.diag_lab: facilities_list.append("Diagnostic Lab")
    if profile.radio_lab: facilities_list.append("Radiology Department")
    if profile.pharmacy: facilities_list.append("Pharmacy")
    if profile.security: facilities_list.append("Security Personnel") # Removed "Available" for consistency
    
    if facilities_list:
        escaped_facilities = [escape_markdown(f) for f in facilities_list]
        message_parts.append(f"*Facilities Available:*\n\\- " + "\n\\- ".join(escaped_facilities))

    # 6. Activity On Platform
    activity_parts = [
        "*ACTIVITY ON PLATFORM*",
        f"Number of Jobs Posted: {profile.jobs_posted_count}"
    ]
    
    has_testimonials = CandidateFeedback.objects.filter(
        job_post__posted_by=profile,
        job_post__status__in=[JobPost.JobStatus.COMPLETED, JobPost.JobStatus.CLOSED],
        candidate_testimonial__isnull=False
    ).exclude(candidate_testimonial='').exists()

    if has_testimonials:

        # Create a secure, tokenized URL for the action.
        payload = {
            'role_type': 'employer',
            'profile_id': profile.id,
            'send_to_chat_id': target_chat_id
        }
        list_testimonials_url = generate_secure_action_url('list-testimonials', payload)
        activity_parts.append(f"[List Testimonials from Candidates]({list_testimonials_url})")
        # ---------------------
    
    message_parts.append("\n".join(activity_parts))
    
    # 7. Credentials and Images
    credentials_by_type = defaultdict(list)
    for cred in profile.credentials.all():
        if cred.document_type != EmployerCredential.DocumentType.AADHAAR_PHOTO: # Exclude Aadhaar Photo from Credentials
            credentials_by_type[cred.document_type].append(cred)

    if credentials_by_type:
        doc_parts = []
        if EmployerCredential.DocumentType.FACILITY_IMAGE in credentials_by_type:
            doc_parts.append(f"*Facility Images*")
            for i, cred in enumerate(credentials_by_type[EmployerCredential.DocumentType.FACILITY_IMAGE], 1):
                file_url = f"https://{site_domain}{cred.file.url}"
                doc_parts.append(f"{i}\\. [Image {i}]({file_url})")
        
        # Check if there are any other types of credentials to list
        other_credentials_exist = any(
            doc_type != EmployerCredential.DocumentType.FACILITY_IMAGE for doc_type in credentials_by_type
        )
        if other_credentials_exist:
            doc_parts.append(f"*Credentials*")
            for doc_type_enum, credentials in credentials_by_type.items():
                if doc_type_enum != EmployerCredential.DocumentType.FACILITY_IMAGE:
                    category_title = escape_markdown(EmployerCredential.DocumentType(doc_type_enum).label)
                    doc_parts.append(f"_{category_title}_")
                    for i, cred in enumerate(credentials, 1):
                        file_url = f"https://{site_domain}{cred.file.url}"
                        doc_parts.append(f"{i}\\. [Document {i}]({file_url})")
        
        message_parts.append("\n".join(doc_parts))

    final_message = "\n\n".join(message_parts)
    send_telegram_message_task.delay(chat_id=target_chat_id, message=final_message)




@shared_task
def generate_and_send_candidate_profile_summary( profile_id: int,download_results=None, send_to_chat_id: str = None):
    """
    Generates and sends the Candidate Profile summary.
    If 'send_to_chat_id' is provided, it sends the message to that user.
    Otherwise, it sends it to the profile owner.
    """
    logger.info(f"Generating candidate profile summary for CandidateProfile ID {profile_id}")
    try:
        profile = CandidateProfile.objects.annotate(
            completed_jobs_count=Count(
                'filled_jobs', 
                filter=Q(filled_jobs__status__in=[JobPost.JobStatus.COMPLETED, JobPost.JobStatus.CLOSED])
            ),
            no_shows_count=Count(
                'filled_jobs__attendance',
                filter=Q(filled_jobs__attendance__was_no_show=True)
            )
        ).prefetch_related(
            'credentials', 'specialization', 'skills', 
            'education__supporting_documents', 'work_experience__supporting_documents'
        ).get(pk=profile_id)
        
        user = profile.user
        
        # Determine the target chat ID for the message
        if send_to_chat_id:
            target_chat_id = send_to_chat_id
        else:
            try:
                target_chat_id = profile.user.telegram_profile.telegram_chat_id
            except TelegramProfile.DoesNotExist:
                logger.error(f"Could not find telegram profile for Candidate {profile.user.id}")
                return
    except (CandidateProfile.DoesNotExist, TelegramProfile.DoesNotExist) as e:
        logger.error(f"Could not find profile or telegram profile for ID {profile_id}. Error: {e}")
        return

    # --- Build the Styled Markdown Message ---
    message_parts = []
    site_domain = os.getenv('SITE_DOMAIN', 'localhost:8000')

    # 1. Header
    full_name = escape_markdown(f"{user.first_name or ''} {user.last_name or ''}".strip())
    message_parts.append(f"*{full_name.upper()}*")

    # Personal Info
    personal_info = []
    if profile.date_of_birth:
        today = date.today()
        age = today.year - profile.date_of_birth.year - ((today.month, today.day) < (profile.date_of_birth.month, profile.date_of_birth.day))
        personal_info.append(f"{age} years old")
    if profile.gender:
        personal_info.append(escape_markdown(profile.gender))
    if personal_info:
        message_parts.append(escape_markdown(", ".join(personal_info)))

    # 2. Candidate Photo
    credentials_by_type = defaultdict(list)
    for cred in profile.credentials.all():
        credentials_by_type[cred.document_type].append(cred)
    
    if CandidateCredential.DocumentType.CANDIDATE_PHOTO in credentials_by_type:
        photo_cred = credentials_by_type[CandidateCredential.DocumentType.CANDIDATE_PHOTO][0]
        photo_url = f"https://{site_domain}{photo_cred.file.url}"
        message_parts.append(f"_[Candidate Photo]({photo_url})_")

    # 3. Specialization
    specializations = ", ".join([escape_markdown(s.name) for s in profile.specialization.all()])
    if specializations:
        message_parts.append(f"*SPECIALIZATION*\n{specializations}")

    # 4. Education
    education_entries = profile.education.all()
    if education_entries:
        edu_parts = ["*EDUCATION*"]
        for i, edu in enumerate(education_entries, 1):
            degree_name = escape_markdown(edu.degree.name if edu.degree else 'N/A')
            institution = escape_markdown(edu.institution or 'N/A')
            country = escape_markdown(edu.country.name if edu.country else 'N/A')
            edu_str = f"{i}\\. *{degree_name}*:"
            edu_details = f"Graduated in {edu.year_of_graduation or 'N/A'}, {institution}, {country}"
            
            doc_links = []
            for j, doc in enumerate(edu.supporting_documents.all(), 1):
                doc_url = f"https://{site_domain}{doc.file.url}"
                doc_links.append(f"_[Credential {j}]({doc_url})_")
            
            edu_parts.append(f"{edu_str}\n{edu_details}\n" + ", ".join(doc_links))     
        
        message_parts.append("\n".join(edu_parts))

    # 5. Off-Platform Work Experience
    work_entries = profile.work_experience.all()
    if work_entries:
        work_parts = ["*OFF\\-PLATFORM WORK EXPERIENCE*"]
        total_experience = sum([(w.end_date - w.start_date).days for w in work_entries if w.start_date and w.end_date])
        total_years = round(total_experience / 365.25, 1)
        work_parts.append(f"*Total Years of experience off platform:* {escape_markdown(str(total_years))} years")
        for i, work in enumerate(work_entries, 1):
            start_str = escape_markdown(work.start_date.strftime('%b %Y') if work.start_date else 'N/A')
            end_str = escape_markdown(work.end_date.strftime('%b %Y') if work.end_date else 'Present')
            work_str = f"{i}\\. *{start_str} \\- {end_str}*:"
            work_details = f"{escape_markdown(work.role or 'N/A')}, {escape_markdown(work.department or 'N/A')}, {escape_markdown(work.institution_name or 'N/A')}"
            
            doc_links = []
            for j, doc in enumerate(work.supporting_documents.all(), 1):
                doc_url = f"https://{site_domain}{doc.file.url}"
                doc_links.append(f"_[Credential {j}]({doc_url})_")
            
            work_parts.append(f"{work_str}\n{work_details}\n" + ", ".join(doc_links))
        
        message_parts.append("\n".join(work_parts))

    # 6. On-Platform Work Experience
    on_platform_parts = [
        "*ON\\-PLATFORM WORK EXPERIENCE*",
        f"Number of Jobs Completed: {profile.completed_jobs_count}",
        f"Number of No\\-Shows: {profile.no_shows_count}"
    ]
    # Only add the "List Testimonials" button if the candidate has completed jobs
    if profile.completed_jobs_count > 0:
        #
        # Create a secure, tokenized URL for the action.
        payload = {
            'role_type': 'candidate',
            'profile_id': profile.id,
            'send_to_chat_id': target_chat_id
        }
        list_testimonials_url = generate_secure_action_url('list-testimonials', payload)
        on_platform_parts.append(f"[List Testimonials]({list_testimonials_url})")
        # ---------------------
    
    message_parts.append("\n".join(on_platform_parts))

    # 7. Skills
    skills = ", ".join([escape_markdown(s.name) for s in profile.skills.all()])
    if skills:
        message_parts.append(f"*SKILLS*\n{skills}")

    # 8. Certifications
    if CandidateCredential.DocumentType.CERTIFICATION in credentials_by_type:
        cert_parts = ["*CERTIFICATIONS*"]
        for i, cred in enumerate(credentials_by_type[CandidateCredential.DocumentType.CERTIFICATION], 1):
            file_url = f"https://{site_domain}{cred.file.url}"
            cert_parts.append(f"{i}\\. _[Certification {i}]({file_url})_")
        message_parts.append("\n".join(cert_parts))

    final_message = "\n\n".join(message_parts)
    send_telegram_message_task.delay(chat_id=target_chat_id, message=final_message)


@shared_task
def send_error_notification_task(chat_id: str, error_message: str, action_message: str = None):
    """
    A generic task to send a formatted error message to a user on Telegram.
    """
    logger.info(f"Sending error notification to chat_id {chat_id}: {error_message}")
    
    # Format the message for clarity
    message = f"⚠️ *An Error Occurred*\n\n"
    message += f"{escape_markdown(error_message)}\n\n"
    if action_message:
        message += f"_*What to do:* {escape_markdown(action_message)}_"

    # We call the main send_telegram_message_task to actually send it.
    # This keeps all sending logic in one place.
    send_telegram_message_task.delay(chat_id=chat_id, message=message)
    
    
    
# ---  JOB POST SUMMARY TASK ---
@shared_task
def generate_and_send_job_post_summary(job_id: int, candidate_id: int):
    """
    Fetches a job post and a candidate, calculates their specific distance,
    and sends a formatted job alert card to the candidate with secure,
    tokenized action links.
    """
    logger.info(f"Generating job post summary for Job ID {job_id} for Candidate ID {candidate_id}")
    try:
        job = JobPost.objects.select_related('posted_by').prefetch_related('required_qualifications', 'required_skills').get(pk=job_id)
        candidate = CandidateProfile.objects.select_related('user__telegram_profile').get(pk=candidate_id)
    except (JobPost.DoesNotExist, CandidateProfile.DoesNotExist):
        logger.error(f"Could not find Job {job_id} or Candidate {candidate_id} for summary generation.")
        return

    message_parts = []

    # --- Header ---
    message_parts.append(f"*{escape_markdown(job.job_title.upper())}*")

    # --- Dates and Times ---
    if job.start_date and job.end_date and job.shift_start_time and job.shift_end_time:
        date_str = f"{job.start_date.strftime('%d %b %Y')} to {job.end_date.strftime('%d %b %Y')}"
        time_str = f"{job.shift_start_time.strftime('%I:%M %p')} to {job.shift_end_time.strftime('%I:%M %p')}"
        message_parts.append(f"_{escape_markdown(date_str)}_\n_{escape_markdown(time_str)}_")

    # --- Salary ---
    salary_str = ""
    if job.job_type == 'SHORT_TERM' and job.short_term_pay_amount:
        pay_unit = job.get_short_term_pay_unit_display().replace('Per ', 'per')
        salary_str = f"₹{job.short_term_pay_amount} {pay_unit}"
    elif job.job_type == 'LONG_TERM' and job.long_term_salary:
        salary_str = f"₹{job.long_term_salary} per Month"
    
    if salary_str:
        message_parts.append(f"*Salary:* {escape_markdown(salary_str)}")

    # --- Benefits ---
    benefits_list = []
    if job.transport_provided: benefits_list.append("Transport Provided")
    if job.accommodation_provided: benefits_list.append("Accommodation Provided")
    if job.meals_provided: benefits_list.append("Meals Provided")
    
    if benefits_list:
        benefits_str = escape_markdown(" | ".join(benefits_list))
        message_parts.append(f"*Benefits:* {benefits_str}")

    # --- Institution Details ---
    # ---  Use the secure URL generator ---
    view_employer_payload = {'job_id': job.id, 'candidate_id': candidate.id}
    view_employer_url = generate_secure_action_url('view-employer-profile', view_employer_payload)
    institution_line = f"[{escape_markdown(job.posted_by.institution_name)}]({view_employer_url})"
    
    distance_str = ""
    if candidate.latitude and job.posted_by.institution_latitude:
        distance = geodesic((job.posted_by.institution_latitude, job.posted_by.institution_longitude), (candidate.latitude, candidate.longitude)).kilometers
        distance_str = f" \\({escape_markdown(f'{distance:.1f} km away')}\\)"
    
    message_parts.append(f"{institution_line}{distance_str}\n{escape_markdown(job.posted_by.institution_address)}")

    # --- Job Description ---
    if job.job_description:
        message_parts.append(f"_{escape_markdown(job.job_description)}_")

    # --- Required Qualifications ---
    qualifications = ", ".join([escape_markdown(q.name) for q in job.required_qualifications.all()])
    if qualifications:
        message_parts.append(f"*Required Qualifications:*\n{qualifications}")

    # --- Required Skills ---
    skills = ", ".join([escape_markdown(s.name) for s in job.required_skills.all()])
    if skills:
        message_parts.append(f"*Required Skills:*\n{skills}")

    # --- Minimum Experience ---
    if job.min_experience_years > 0:
        message_parts.append(f"*Minimum years of experience needed:* {job.min_experience_years}")

    # --- Interactive Buttons (Now Secure) ---
    apply_payload = {'job_id': job.id, 'candidate_id': candidate.id, 'action': 'apply'}
    apply_url = generate_secure_action_url('job-apply', apply_payload)

    reject_payload = {'job_id': job.id, 'candidate_id': candidate.id, 'action': 'reject'}
    reject_url = generate_secure_action_url('job-reject', reject_payload)
    
    message_parts.append(f"[Apply]({apply_url}) \\| [Reject]({reject_url})")
    # ----------------------------------------------------
    
    final_message = "\n\n".join(message_parts)
    
    try:
        chat_id = candidate.user.telegram_profile.telegram_chat_id
        send_telegram_message_task.delay(chat_id=chat_id, message=final_message)
    except TelegramProfile.DoesNotExist:
        logger.warning(f"Cannot send job summary. No telegram profile for candidate {candidate.id}")


@shared_task
def exchange_contact_details_task(application_id: int):
    try:
        application = JobApplication.objects.select_related(
            'job_post__posted_by__user__telegram_profile',
            'candidate__user__telegram_profile'
        ).get(pk=application_id)
        
        employer = application.job_post.posted_by
        candidate = application.candidate
        
        # Send candidate's details to employer
        employer_chat_id = employer.user.telegram_profile.telegram_chat_id
        message_to_employer = f"Contact details for your application to *{escape_markdown(application.job_post.job_title)}*:\n\n*Candidate Name:* {escape_markdown(candidate.user.get_full_name())}\n*Contact Number:* {escape_markdown(candidate.contact_number)}\n*Email:* {escape_markdown(candidate.user.email)}"
        send_telegram_message_task.delay(employer_chat_id, message_to_employer)

        # Send employer's details to candidate
        candidate_chat_id = candidate.user.telegram_profile.telegram_chat_id
        message_to_candidate = f"The employer for *{escape_markdown(application.job_post.job_title)}* is interested in an interview\\! Here are their contact details:\n\n*Institution Name:* {escape_markdown(employer.institution_name)}\n*Contact Number:* {escape_markdown(employer.contact_num)}"
        send_telegram_message_task.delay(candidate_chat_id, message_to_candidate)

    except Exception as e:
        logger.error(f"Failed to exchange contact details for application {application_id}: {e}")



@shared_task
def generate_and_send_candidate_application_summary(application_id: int):
    """
    Fetches a job application and sends a detailed, interactive summary
    card to the employer on Telegram using secure, tokenized action links.
    """
    logger.info(f"Generating application summary for Application ID {application_id}")
    try:
        # Use prefetch_related and select_related for a highly efficient database query
        app = JobApplication.objects.select_related(
            'job_post__posted_by__user__telegram_profile', 
            'candidate__user'
        ).prefetch_related(
            'candidate__education__degree',
            'candidate__skills',
        ).get(pk=application_id)
        
        job = app.job_post
        candidate = app.candidate
        employer = job.posted_by
        employer_chat_id = employer.user.telegram_profile.telegram_chat_id
    except Exception as e:
        logger.error(f"Could not find data for application summary {application_id}: {e}")
        return

    message_parts = []

    # --- Header ---
    candidate_name = escape_markdown(candidate.user.get_full_name().upper())
    job_title = escape_markdown(job.job_title.upper())
    message_parts.append(f"*{candidate_name}* HAS APPLIED FOR *{job_title}*")

    # --- THIS IS THE FIX: Use the secure URL generator for all links ---
    # --- View Profile Link ---
    view_profile_payload = {'application_id': app.id}
    view_profile_url = generate_secure_action_url('view-candidate-profile', view_profile_payload)
    message_parts.append(f"[View Detailed Profile]({view_profile_url})")

    # --- Basic Info ---
    personal_info = []
    if candidate.date_of_birth:
        age = date.today().year - candidate.date_of_birth.year - ((date.today().month, date.today().day) < (candidate.date_of_birth.month, candidate.date_of_birth.day))
        personal_info.append(f"{age} years old")
    if candidate.gender:
        personal_info.append(escape_markdown(candidate.gender))
    if personal_info:
        message_parts.append(escape_markdown(", ".join(personal_info)))

    # --- Qualifications ---
    qualifications = ", ".join([escape_markdown(edu.degree.name) for edu in candidate.education.all() if edu.degree])
    if qualifications:
        message_parts.append(f"*Candidate Qualifications:*\n{qualifications}")

    # --- Skills ---
    skills = ", ".join([escape_markdown(s.name) for s in candidate.skills.all()])
    if skills:
        message_parts.append(f"*Candidate Skills:*\n{skills}")

    # --- Location (Distance Only) ---
    if candidate.latitude and employer.institution_latitude:
        distance = geodesic((employer.institution_latitude, employer.institution_longitude), (candidate.latitude, candidate.longitude)).kilometers
        distance_str = escape_markdown(f"Candidate lives {distance:.1f} km away")
        message_parts.append(distance_str)

    # --- Interactive Buttons (With Secure Url) ---
    get_contact_payload = {'application_id': app.id}
    get_contact_url = generate_secure_action_url('get-contact-details', get_contact_payload)

    hire_payload = {'application_id': app.id}
    hire_url = generate_secure_action_url('hire-candidate', hire_payload)

    reject_payload = {'application_id': app.id}
    reject_url = generate_secure_action_url('reject-application', reject_payload)
    
    # Escape the pipe character for MarkdownV2
    message_parts.append(f"[Hire]({hire_url}) \\| [Get Contact Details]({get_contact_url}) \\| [Reject]({reject_url})")
    # ----------------------------------------------------
    
    final_message = "\n\n".join(message_parts)
    send_telegram_message_task.delay(chat_id=employer_chat_id, message=final_message)    
    


@shared_task
def generate_and_send_employer_job_list_summary(employer_profile_id: int, chat_id: str):
    """
    Fetches all job posts for an employer, formats them into a summary,
    and sends it to them on Telegram using secure, tokenized action links.
    """
    logger.info(f"Generating job post list for EmployerProfile ID {employer_profile_id}")
    
    try:
        jobs = JobPost.objects.filter(
            posted_by_id=employer_profile_id
        ).annotate(
            num_applicants=Count('applications'),
            num_rejected=Count('applications', filter=Q(applications__status='CANDIDATE_REJECTED'))
        ).select_related('matches').order_by('-created_at')
    except Exception as e:
        logger.error(f"Failed to fetch job posts for employer {employer_profile_id}: {e}")
        send_error_notification_task.delay(chat_id, "Could not retrieve your job posts at this time.")
        return

    if not jobs:
        message = "You have not posted any jobs yet\\. Use the /newjobpost command to get started\\."
        send_telegram_message_task.delay(chat_id, message)
        return

    message_parts = ["*YOUR ACTIVE JOB POSTS*"]

    for job in jobs:
        job_part = []
        job_part.append(f"*{escape_markdown(job.job_title.upper())}*")
        
        posted_on_str = f"Posted On: {job.created_at.strftime('%d %b %Y, %I:%M %p')}"
        job_part.append(f"_{escape_markdown(posted_on_str)}_")
        
        viewed_by = 0
        try:
            viewed_by = job.matches.notification_iteration * 5
        except JobMatch.DoesNotExist:
            pass

        stats = (
            f"Viewed By: {viewed_by} | "
            f"Rejected by: {job.num_rejected} | "
            f"Applicants: {job.num_applicants}"
        )
        job_part.append(escape_markdown(stats))
        
        action_links = []
        if job.status == 'OPEN':
            # --- Use the secure URL generator for all links ---
            # Only show the "List Applicants" button if there are applicants
            if job.num_applicants > 0:
                list_applicants_payload = {'job_id': job.id}
                list_applicants_url = generate_secure_action_url('list-job-applicants', list_applicants_payload)
                action_links.append(f"[List Applicants]({list_applicants_url})")

            cancel_payload = {'job_id': job.id}
            cancel_url = generate_secure_action_url('job-cancel', cancel_payload)
            action_links.append(f"[Cancel Job Post]({cancel_url})")
            # ------------------------------------------------------------------
        else:
            job_part.append(f"*Status:* {escape_markdown(job.get_status_display())}")
        
        if action_links:
            # The pipe character must be escaped for MarkdownV2
            job_part.append(" \\| ".join(action_links))
            
        message_parts.append("\n".join(job_part))

    # The separator must also be escaped
    separator = "\n\n" + escape_markdown("---") + "\n\n"
    final_message = separator.join(message_parts)
    
    send_telegram_message_task.delay(chat_id=chat_id, message=final_message)
   
    
@shared_task
def generate_and_send_candidate_application_list(candidate_profile_id: int, chat_id: str):
    """
    Fetches all job applications for a candidate, formats them into a summary,
    and sends it to them on Telegram.
    """
    logger.info(f"Generating application list for CandidateProfile ID {candidate_profile_id}")
    
    # Fetch all applications, ordered by the most recent first
    applications = JobApplication.objects.filter(
        candidate_id=candidate_profile_id
    ).select_related('job_post__posted_by').order_by('-applied_at')

    if not applications:
        message = "You have not applied for any jobs yet\\."
        send_telegram_message_task.delay(chat_id, message)
        return

    message_parts = ["*YOUR JOB APPLICATIONS*"]

    for app in applications:
        job = app.job_post
        app_part = []
        
        app_part.append(f"*{escape_markdown(job.job_title.upper())}*")
        app_part.append(f"_{escape_markdown(job.posted_by.institution_name)}_")
        
        status_str = f"*Status:* {escape_markdown(app.get_status_display())}"
        app_part.append(status_str)
        
        # Only show the "Cancel" button if the application is in an active, cancellable state
        cancellable_statuses = [
            JobApplication.ApplicationStatus.APPLIED,
            JobApplication.ApplicationStatus.IN_REVIEW,
            JobApplication.ApplicationStatus.INTERVIEW
        ]
        if app.status in cancellable_statuses:
            
            # Create a secure, tokenized URL for the cancel action.
            payload = {'application_id': app.id}
            cancel_url = generate_secure_action_url('candidate-cancel-application', payload)
            app_part.append(f"[Cancel Application]({cancel_url})")
            # ---------------------
            
        message_parts.append("\n".join(app_part))

    # Join each application card with a separator
    separator = "\n\n" + escape_markdown("---") + "\n\n"
    final_message = separator.join(message_parts)
    send_telegram_message_task.delay(chat_id=chat_id, message=final_message)
    
    
@shared_task
def generate_and_send_employee_list_summary(employer_profile_id: int, chat_id: str):
    """
    Fetches all FILLED job posts for an employer, formats them into a list,
    and sends it to them on Telegram using a secure action link.
    """
    logger.info(f"Generating employee list for EmployerProfile ID {employer_profile_id}")
    
    # Fetch all filled jobs, ordered by the soonest start date first
    filled_jobs = JobPost.objects.filter(
        posted_by_id=employer_profile_id,
        status=JobPost.JobStatus.FILLED
    ).select_related('filled_by__user').order_by('start_date', 'shift_start_time')

    if not filled_jobs:
        message = "You do not have any active employees (filled jobs) at the moment\\."
        send_telegram_message_task.delay(chat_id, message)
        return

    message_parts = ["*YOUR CURRENTLY FILLED POSITIONS*"]

    for job in filled_jobs:
        job_part = []
        job_part.append(f"*{escape_markdown(job.job_title.upper())}*")
        
        date_str = f"{job.start_date.strftime('%d %b %Y')} to {job.end_date.strftime('%d %b %Y')}"
        time_str = f"{job.shift_start_time.strftime('%I:%M %p')} to {job.shift_end_time.strftime('%I:%M %p')}"
        job_part.append(f"_{escape_markdown(date_str)}, {escape_markdown(time_str)}_")
        
        if job.filled_by:
            job_part.append(f"Filled by: {escape_markdown(job.filled_by.user.get_full_name())}")
        
        # Create a secure, tokenized URL for the close job action.
        payload = {
            'job_id': job.id,
            'role_type': 'employer' # Specify that the employer is taking this action
        }
        close_job_url = generate_secure_action_url('job-close', payload)
        job_part.append(f"[Close Job & Give Feedback]({close_job_url})")
        # ---------------------
            
        message_parts.append("\n".join(job_part))

    # Join each job card with a separator
    separator = "\n\n" + escape_markdown("---") + "\n\n"
    final_message = separator.join(message_parts)
    send_telegram_message_task.delay(chat_id=chat_id, message=final_message)

    
@shared_task
def generate_and_send_candidate_job_list_summary(candidate_profile_id: int, chat_id: str):
    """
    Fetches all FILLED job posts for a candidate, formats them into a list,
    and sends it to them on Telegram using a secure action link.
    """
    logger.info(f"Generating current job list for CandidateProfile ID {candidate_profile_id}")
    
    # Fetch all filled jobs for this candidate, ordered by the soonest start date first
    filled_jobs = JobPost.objects.filter(
        filled_by_id=candidate_profile_id,
        status=JobPost.JobStatus.FILLED
    ).select_related('posted_by').order_by('start_date', 'shift_start_time')

    if not filled_jobs:
        message = "You do not have any active jobs at the moment\\."
        send_telegram_message_task.delay(chat_id, message)
        return

    message_parts = ["*YOUR CURRENT JOBS*"]

    for job in filled_jobs:
        job_part = []
        
        # 1. Job Title
        job_part.append(f"*{escape_markdown(job.job_title.upper())}*")
        
        # 2. Institution Name
        job_part.append(escape_markdown(job.posted_by.institution_name))
        
        # Dates and Times
        date_str = f"{job.start_date.strftime('%d %b %Y')} to {job.end_date.strftime('%d %b %Y')}"
        time_str = f"{job.shift_start_time.strftime('%I:%M %p')} to {job.shift_end_time.strftime('%I:%M %p')}"
        job_part.append(f"{escape_markdown(date_str)}, {escape_markdown(time_str)}")
        
        
        # Create a secure, tokenized URL for the close job action.
        payload = {
            'job_id': job.id,
            'role_type': 'candidate' # Specify that the candidate is taking this action
        }
        close_job_url = generate_secure_action_url('job-close', payload)
        job_part.append(f"[Close Job & Give Feedback]({close_job_url})")
        # ---------------------
            
        message_parts.append("\n".join(job_part))

    # Join each application card with a separator
    separator = "\n\n" + escape_markdown("---") + "\n\n"
    final_message = separator.join(message_parts)
    send_telegram_message_task.delay(chat_id=chat_id, message=final_message)
    
    
    
@shared_task
def generate_and_send_candidate_testimonials_list(candidate_profile_id: int, send_to_chat_id: str):
    """
    Fetches all employer testimonials for a candidate and sends them
    as a formatted list to the requesting user.
    """
    logger.info(f"Generating testimonials list for CandidateProfile ID {candidate_profile_id}")

    try:
        candidate = CandidateProfile.objects.get(pk=candidate_profile_id)
    except CandidateProfile.DoesNotExist:
        logger.error(f"CandidateProfile {candidate_profile_id} not found for testimonials.")
        return

    # Fetch all feedback where the employer left a non-empty testimonial
    # for jobs completed/closed by this candidate. Order by the oldest job first.
    feedbacks = Feedback.objects.filter(
        job_post__filled_by=candidate,
        job_post__status__in=[JobPost.JobStatus.COMPLETED, JobPost.JobStatus.CLOSED],
        employer_testimonial__isnull=False
    ).exclude(employer_testimonial='').select_related('job_post__posted_by').order_by('job_post__start_date')

    if not feedbacks:
        message = escape_markdown("This candidate has not received any written testimonials from employers yet.")
        send_telegram_message_task.delay(chat_id=send_to_chat_id, message=message)
        return

    message_parts = [f"*TESTIMONIALS FOR {escape_markdown(candidate.user.get_full_name().upper())}*"]

    for i, fb in enumerate(feedbacks, 1):
        job = fb.job_post
        testimonial_part = []

        # 1. Job Title
        testimonial_part.append(f"{i}\\. *{escape_markdown(job.job_title.upper())}*")
        # 2. Institution Name
        testimonial_part.append(escape_markdown(job.posted_by.institution_name))
        # 3. Dates
        if job.start_date and job.end_date:
            date_str = f"{job.start_date.strftime('%d %b %Y')} to {job.end_date.strftime('%d %b %Y')}"
            testimonial_part.append(escape_markdown(date_str))
        # 4. The testimonial itself in quotes
        testimonial_part.append(f"\"_{escape_markdown(fb.employer_testimonial)}_\"")

        message_parts.append("\n".join(testimonial_part))

    separator = "\n\n" + escape_markdown("---") + "\n\n"
    final_message = separator.join(message_parts)

    send_telegram_message_task.delay(chat_id=send_to_chat_id, message=final_message)
    
    
    
@shared_task
def generate_and_send_employer_testimonials_list(employer_profile_id: int, send_to_chat_id: str):
    """
    Fetches all candidate testimonials for an employer and sends them
    as a formatted list to the requesting user.
    """
    logger.info(f"Generating testimonials list for EmployerProfile ID {employer_profile_id}")

    try:
        employer = EmployerProfile.objects.get(pk=employer_profile_id)
    except EmployerProfile.DoesNotExist:
        logger.error(f"EmployerProfile {employer_profile_id} not found for testimonials.")
        return

    # Fetch all feedback where the candidate left a non-empty testimonial
    # for jobs posted by this employer. Order by the oldest job first.
    feedbacks = CandidateFeedback.objects.filter(
        job_post__posted_by=employer,
        job_post__status__in=[JobPost.JobStatus.COMPLETED, JobPost.JobStatus.CLOSED],
        candidate_testimonial__isnull=False
    ).exclude(candidate_testimonial='').select_related('job_post__filled_by__user').order_by('job_post__start_date')

    if not feedbacks:
        message = escape_markdown("This employer has not received any written testimonials from candidates yet.")
        send_telegram_message_task.delay(chat_id=send_to_chat_id, message=message)
        return

    message_parts = [f"*TESTIMONIALS FOR {escape_markdown(employer.institution_name.upper())}*"]

    for i, fb in enumerate(feedbacks, 1):
        job = fb.job_post
        candidate = job.filled_by
        testimonial_part = []

        # 1. Job Title
        testimonial_part.append(f"{i}\\. *{escape_markdown(job.job_title.upper())}*")
        
        # 2. Dates
        if job.start_date and job.end_date:
            date_str = f"{job.start_date.strftime('%d %b %Y')} to {job.end_date.strftime('%d %b %Y')}"
            testimonial_part.append(escape_markdown(date_str))
        
        # 3. From Candidate Name
        if candidate:
            testimonial_part.append(f"From: {escape_markdown(candidate.user.get_full_name())}")
            
        # 4. The testimonial itself in quotes and italics
        testimonial_part.append(f"\"_{escape_markdown(fb.candidate_testimonial)}_\"")

        message_parts.append("\n".join(testimonial_part))

    separator = "\n\n" + escape_markdown("---") + "\n\n"
    final_message = separator.join(message_parts)
    send_telegram_message_task.delay(chat_id=send_to_chat_id, message=final_message)
    
    
    
@shared_task
def send_credential_rejection_task(profile_type, profile_id, credential_field, data_field, reason):
    """
    Handles the logic for rejecting a credential. It updates the relevant
    verification flag, clears the Aadhaar number to mark the profile as
    incomplete, and notifies the user with the reason.
    """
    logger.info(f"Processing rejection for {profile_type} ID {profile_id}, field {credential_field}")
    
    if profile_type == 'candidate':
        profile = CandidateProfile.objects.get(pk=profile_id)
    else: # employer
        profile = EmployerProfile.objects.get(pk=profile_id)

    # 1. Set the specific verification flag to False
    if hasattr(profile, credential_field):
        setattr(profile, credential_field, False)
    
    # 2. Always clear the Aadhaar number to trigger the profile completion gate.
    # This ensures the user must re-verify their core identity.
    if profile_type == 'candidate':
        profile.aadhaar_number = None
    else: # employer
        profile.representative_aadhaar_num = None
    # ---------------------
    
    profile.save()

    # 3. Notify the user with the specific reason
    try:
        chat_id = profile.user.telegram_profile.telegram_chat_id
        # Create a user-friendly name for the credential
        credential_name = credential_field.replace('is_', '').replace('_verified', '').replace('_', ' ').title()
        
        error_message = f"Your {credential_name} has been rejected by our verification team."
        action_message = f"Reason: {reason}. Your profile is now marked as incomplete. Please use the /updateprofile command to submit the correct details and documents."
        
        send_error_notification_task.delay(chat_id, error_message, action_message)
    except Exception as e:
        logger.error(f"Failed to send rejection notification for profile {profile_id}: {e}")