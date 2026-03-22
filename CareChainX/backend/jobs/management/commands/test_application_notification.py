# To use this command
# docker-compose run --rm web python manage.py test_application_notification --chat_id 609288469
from django.core.management.base import BaseCommand
from django.db import transaction

from users.models import User, TelegramProfile
from profiles.models import EmployerProfile, CandidateProfile
from jobs.models import JobPost, JobApplication
from core.tasks import generate_and_send_candidate_application_summary
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    """
    A simple script to test the 'New Application' notification card for employers.
    It creates a test employer, candidate, and job, simulates an application,
    and sends the notification to your specified chat_id.
    """
    help = 'Sends a test "New Application" summary to a specified chat_id.'

    def add_arguments(self, parser):
        parser.add_argument('--chat_id', type=str, help='Your personal Telegram Chat ID to receive the notification.', required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        chat_id = options['chat_id']

        self.stdout.write(self.style.SUCCESS("--- Setting up test environment for notification ---"))

        # 1. Create or get the test employer and link YOUR chat_id to them
        employer_user, _ = User.objects.get_or_create(
            email="test-notification-employer@test.carechain.com",
            defaults={'first_name': 'Notification', 'last_name': 'Employer', 'is_email_verified': True}
        )
        employer_profile, _ = EmployerProfile.objects.get_or_create(user=employer_user, defaults={'institution_name': 'Test Hospital'})
        TelegramProfile.objects.update_or_create(
            user=employer_user,
            defaults={'telegram_chat_id': chat_id}
        )
        self.stdout.write(f"✅ Your chat_id ({chat_id}) is now acting as the employer: {employer_user.email}")

        # 2. Create or get a test candidate
        candidate_user, _ = User.objects.get_or_create(
            email="test-applicant-candidate@test.carechain.com",
            defaults={'first_name': 'Test', 'last_name': 'Applicant', 'is_email_verified': True}
        )
        candidate_profile, _ = CandidateProfile.objects.get_or_create(user=candidate_user)
        self.stdout.write(f"✅ Ensured test candidate exists: {candidate_user.email}")

        # 3. Create or get a test job post
        job_post, _ = JobPost.objects.get_or_create(
            posted_by=employer_profile,
            job_title="Test Neurology Position",
            defaults={'job_type': 'LONG_TERM'}
        )
        self.stdout.write(f"✅ Ensured test job post exists: '{job_post.job_title}'")

        # 4. Simulate the application
        application, created = JobApplication.objects.get_or_create(
            job_post=job_post,
            candidate=candidate_profile,
            defaults={'status': JobApplication.ApplicationStatus.APPLIED}
        )
        if created:
            self.stdout.write(self.style.SUCCESS("✅ Simulated a new job application."))
        else:
            self.stdout.write(self.style.WARNING("✅ Found an existing application for this test job."))
        
        self.stdout.write(self.style.SUCCESS("\n--- Triggering Notification Task ---"))
        
        # 5. Trigger the Celery task to send the summary card to YOU (as the employer)
        generate_and_send_candidate_application_summary.delay(application.id)
        
        self.stdout.write(self.style.SUCCESS("✅ Task sent to Celery worker!"))
        self.stdout.write("➡️  Check your Telegram and the celery_worker logs.")