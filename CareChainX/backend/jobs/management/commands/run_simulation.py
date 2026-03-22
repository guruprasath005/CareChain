# jobs/management/commands/run_simulation.py
import random
import os
import time
import sys
from django.core.management.base import BaseCommand
from django.db import transaction
from faker import Faker
from datetime import date, timedelta, time as dt_time

from users.models import User, TelegramProfile
from profiles.models import (
    CandidateProfile, EmployerProfile, Speciality, Skill, DegreeType, Country, Education, WorkExperience
)
from jobs.models import JobPost, JobMatch
from core.tasks import run_matching_algorithm_for_job, send_match_notifications # Import the core logic and notification task

class Command(BaseCommand):
    help = 'Runs a full, synchronous matching simulation and analyzes the results.'

    def add_arguments(self, parser):
        parser.add_argument('--candidates', type=int, help='The number of random candidates to create.', default=1000)
        parser.add_argument('--chat_id', type=str, help='Your personal Telegram Chat ID for notification testing.', required=True)
        parser.add_argument('--email', type=str, help='The email of the user to link your chat_id to.', required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        # --- PHASE 1: SEEDING DATABASE ---
        self.stdout.write(self.style.SUCCESS("--- PHASE 1: SEEDING DATABASE ---"))
        
        count = options['candidates']
        chat_id = options['chat_id']
        email = options['email']
        fake = Faker('en_IN')

        self.stdout.write("🔥 Deleting old test data...")
        User.objects.filter(email__endswith='@test.carechain.com').delete()
        self.stdout.write("✅ Old test data deleted.")

        # Create Test Employer
        employer_user, _ = User.objects.get_or_create(email="test-employer@test.carechain.com", defaults={'first_name': 'Test', 'last_name': 'Employer', 'is_email_verified': True})
        employer_profile, _ = EmployerProfile.objects.get_or_create(user=employer_user, defaults={'institution_name': 'Apollo Hospital', 'institution_latitude': 13.0604, 'institution_longitude': 80.2495})

        # Link the specified user to the chat_id for notifications
        try:
            notification_user = User.objects.get(email=email)
            TelegramProfile.objects.update_or_create(user=notification_user, defaults={'telegram_chat_id': chat_id})
            self.stdout.write(self.style.SUCCESS(f"✅ Your chat_id has been linked to: {email}"))
        except User.DoesNotExist:
            self.stdout.write(self.style.WARNING(f"User {email} not found. No chat_id was linked."))

        # Create Random Candidates
        all_skills = list(Skill.objects.all())
        all_degrees = list(DegreeType.objects.all())
        all_countries = list(Country.objects.all())
        all_specialities = list(Speciality.objects.all())

        if not all_skills or not all_degrees:
            self.stdout.write(self.style.ERROR("Lookup tables are empty. Please run 'populate_lookups' first."))
            return

        for i in range(count):
            user, created = User.objects.get_or_create(
                email=f"user{i}@{fake.domain_name()}",
                defaults={'first_name': fake.first_name(), 'last_name': fake.last_name(), 'is_email_verified': True}
            )
            
            # Generate a random 7x24 availability matrix for each candidate
            random_matrix = [[random.choice([0, 1]) for _ in range(24)] for _ in range(7)]
            
            
            candidate, _ = CandidateProfile.objects.get_or_create(
                user=user,
                defaults={
                    'average_quality_score': round(random.uniform(3.0, 4.5), 1),
                    'max_travel_distance': random.choice([10, 25, 50, 100]),
                    'latitude': round(random.uniform(12.8, 13.2), 6),
                    'longitude': round(random.uniform(80.0, 80.4), 6),
                    'pay_per_hour': random.randint(500, 2000),
                    'preferred_job_type': random.choice([["Short-Term"], ["Long-Term"], ["Short-Term", "Long-Term"]]),
                    'weekly_availability_matrix': random_matrix 
                }
            )
            if all_degrees and all_countries:
                Education.objects.create(
                    candidate_profile=candidate, degree=random.choice(all_degrees),
                    institution=fake.company() + " University", year_of_graduation=random.randint(2000, 2023),
                    country=random.choice(all_countries)
                )
            exp_years = random.randint(0, 10)
            if exp_years > 0:
                WorkExperience.objects.create(
                    candidate_profile=candidate, role="Medical Officer",
                    start_date=date.today() - timedelta(days=exp_years*365),
                    end_date=date.today()
                )
            if all_skills:
                candidate.skills.set(random.sample(all_skills, k=random.randint(1, min(5, len(all_skills)))))
            if all_specialities:
                candidate.specialization.set(random.sample(all_specialities, k=1))
        
        self.stdout.write(self.style.SUCCESS(f"✅ Successfully created {count} random candidates."))


        # --- PHASE 2: CREATING JOB & TRIGGERING MATCH ---
        self.stdout.write(self.style.SUCCESS("\n--- PHASE 2: CREATING JOB & TRIGGERING MATCH ---"))
        
        employer = EmployerProfile.objects.get(user__email="test-employer@test.carechain.com")
        job, created = JobPost.objects.get_or_create(
            job_title="ER Doctor Needed for Night Shift", posted_by=employer,
            defaults={
                'job_type': JobPost.JobType.SHORT_TERM, 'min_experience_years': 5,
                'start_date': date.today(), 'end_date': date.today(),
                'shift_start_time': dt_time(20, 0), 'shift_end_time': dt_time(23, 0),
                'short_term_pay_unit': JobPost.PayUnit.PER_HOUR, 'short_term_pay_amount': 1500,
                'weekly_availability_matrix': [[(1 if 20 <= h < 23 else 0) for h in range(24)] for d in range(7)]
            }
        )
        job.required_qualifications.add(DegreeType.objects.get(name='MBBS'))
        job.required_skills.add(Skill.objects.get(name='emergency cricothyrotomy'))
        
        if created:
            self.stdout.write(self.style.SUCCESS(f"✅ Test job post created (ID: {job.id})."))
        else:
            self.stdout.write(self.style.WARNING(f"✅ Test job post already exists (ID: {job.id})."))

        # Use transaction.on_commit to guarantee the task is sent AFTER the database is saved.
        transaction.on_commit(lambda: run_matching_algorithm_for_job.delay(job.id))
        
        self.stdout.write(self.style.SUCCESS("✅ Matching task will be sent to the Celery worker upon transaction commit."))
        self.stdout.write("--------------------------------------------------")
        self.stdout.write("➡️  Wait a few seconds for the worker to finish, then run:")
        self.stdout.write(f"   docker-compose run --rm web python manage.py analyze_results --job_id {job.id}")
        self.stdout.write("--------------------------------------------------")

