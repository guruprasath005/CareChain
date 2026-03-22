from django.core.management.base import BaseCommand
from profiles.models import EmployerProfile, DegreeType, Skill
from jobs.models import JobPost
from core.tasks import run_matching_algorithm_for_job
from datetime import date, time

class Command(BaseCommand):
    help = 'Creates a test job post and triggers the matching algorithm.'

    def handle(self, *args, **options):
        self.stdout.write(" MINGW32_NT-10.0-19045 DESKTOP-N94002V 3.4.0.x86_64 2024-05-18 10:14 UTC Creating a test job post...")

        try:
            employer = EmployerProfile.objects.get(user__email="test-employer@test.carechain.com")
        except EmployerProfile.DoesNotExist:
            self.stdout.write(self.style.ERROR("Test employer not found. Please run 'populate_test_data' first."))
            return

        # --- Define the Test Job ---
        # This job is specifically designed to match our "control group" candidates.
        job, created = JobPost.objects.get_or_create(
            job_title="ER Doctor Needed for Night Shift",
            posted_by=employer,
            defaults={
                'job_type': JobPost.JobType.SHORT_TERM,
                'min_experience_years': 5,
                'start_date': date.today(),
                'end_date': date.today(),
                'shift_start_time': time(20, 0), # 8 PM
                'shift_end_time': time(23, 0),   # 11 PM
                'short_term_pay_unit': JobPost.PayUnit.PER_HOUR,
                'short_term_pay_amount': 1500,
                # This matrix will have 1s from 8pm to 11pm for every day
                'weekly_availability_matrix': [[(1 if 20 <= h < 23 else 0) for h in range(24)] for d in range(7)]
            }
        )
        job.required_qualifications.add(DegreeType.objects.get(name='MBBS'))
        job.required_skills.add(Skill.objects.get(name='emergency cricothyrotomy'), Skill.objects.get(name='end of life care communication'))
        
        if created:
            self.stdout.write(self.style.SUCCESS(f"✅ Test job post created (ID: {job.id})."))
        else:
            self.stdout.write(self.style.WARNING(f"✅ Test job post already exists (ID: {job.id})."))

        self.stdout.write("🚀 Triggering the matching algorithm...")
        run_matching_algorithm_for_job.delay(job.id)
        self.stdout.write(self.style.SUCCESS("✅ Matching task has been sent to the Celery worker."))
        self.stdout.write("➡️  Check your Celery worker logs and the Django admin to see the results.")
