# To run the command 
# docker-compose run --rm web python manage.py test_job_notification --chat_id 609288469

from django.core.management.base import BaseCommand
from django.db import transaction

from users.models import User, TelegramProfile
from profiles.models import EmployerProfile, CandidateProfile
from jobs.models import JobPost
from core.tasks import generate_and_send_job_post_summary
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    """
    A simple script to test the job post summary notification.
    It creates a test employer, links it to your chat_id, finds a job and a
    candidate, and triggers the summary task to be sent to you.
    """
    help = 'Sends a test job post summary notification to a specified chat_id.'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='The email for the test employer.', default="test-notification-employer@test.carechain.com")
        parser.add_argument('--chat_id', type=str, help='Your personal Telegram Chat ID to receive the notification.', required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        employer_email = options['email']
        chat_id = options['chat_id']

        self.stdout.write(self.style.SUCCESS("--- Setting up test environment ---"))

        # 1. Create or get the test employer
        employer_user, _ = User.objects.get_or_create(
            email=employer_email,
            defaults={'first_name': 'Notification', 'last_name': 'Tester', 'is_email_verified': True}
        )
        employer_profile, _ = EmployerProfile.objects.get_or_create(user=employer_user)
        self.stdout.write(f"✅ Ensured test employer exists: {employer_email}")

        # 2. Find a job post to send (we'll use the first one available)
        job_to_send = JobPost.objects.first()
        if not job_to_send:
            self.stdout.write(self.style.ERROR("❌ No job posts found in the database. Please run the simulation script first."))
            return
        self.stdout.write(f"✅ Found test job to send: '{job_to_send.job_title}'")

        # 3. Find a candidate to receive the notification
        # For this test, we'll link YOUR chat_id to this candidate
        candidate_to_notify = CandidateProfile.objects.first()
        if not candidate_to_notify:
            self.stdout.write(self.style.ERROR("❌ No candidate profiles found. Please run the simulation script first."))
            return
        
        # Link your chat_id to this candidate so you receive the message
        TelegramProfile.objects.update_or_create(
            user=candidate_to_notify.user,
            defaults={'telegram_chat_id': chat_id}
        )
        self.stdout.write(f"✅ Temporarily linked your chat_id to candidate: {candidate_to_notify.user.email}")
        
        self.stdout.write(self.style.SUCCESS("\n--- Triggering Notification Task ---"))
        
        # 4. Trigger the Celery task
        generate_and_send_job_post_summary.delay(
            job_id=job_to_send.id,
            candidate_id=candidate_to_notify.id
        )
        
        self.stdout.write(self.style.SUCCESS("✅ Task sent to Celery worker!"))
        self.stdout.write("➡️  Check your Telegram and the celery_worker logs.")
