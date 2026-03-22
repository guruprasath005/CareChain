# profiles/management/commands/populate_test_data.py
import random
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from faker import Faker
from datetime import date, timedelta

from users.models import User, TelegramProfile
from profiles.models import (
    CandidateProfile, EmployerProfile, Speciality, Skill, DegreeType, Country, Education, WorkExperience
)

class Command(BaseCommand):
    help = 'Populates the database with test candidates and one test employer.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, help='The number of random candidates to create.', default=50)
        parser.add_argument('--chat_id', type=str, help='The Telegram Chat ID to send all notifications to.', required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        count = options['count']
        chat_id = options['chat_id']
        fake = Faker('en_IN')

        self.stdout.write("🔥 Deleting old test data...")
        User.objects.filter(email__endswith='@test.carechain.com').delete()
        self.stdout.write("✅ Old test data deleted.")

        self.stdout.write("Creating test employer...")
        employer_user, _ = User.objects.get_or_create(
            email="test-employer@test.carechain.com",
            defaults={'first_name': 'Test', 'last_name': 'Employer', 'is_email_verified': True}
        )
        EmployerProfile.objects.get_or_create(user=employer_user, defaults={
            'institution_name': 'Apollo Hospital', 'institution_address': 'Greams Road',
            'institution_pincode': '600006', 'institution_latitude': 13.0604, 'institution_longitude': 80.2495
        })
        self.stdout.write(self.style.SUCCESS("✅ Test employer created."))

        self.stdout.write(f"Creating {count} test candidates...")
        all_skills = list(Skill.objects.all())
        all_degrees = list(DegreeType.objects.all())
        all_countries = list(Country.objects.all())
        all_specialities = list(Speciality.objects.all())

        if not all_skills or not all_degrees:
            self.stdout.write(self.style.ERROR("Lookup tables are empty. Please run 'populate_lookups' first."))
            return

        # --- "Control Group" Candidates for Accuracy Testing ---
        
        # 1. Dr. Perfect Match (This user gets YOUR chat_id)
        perfect_user, _ = User.objects.get_or_create(email="perfect.match@test.carechain.com", defaults={'first_name': 'Perfect', 'last_name': 'Match', 'is_email_verified': True})
        TelegramProfile.objects.get_or_create(user=perfect_user, defaults={'telegram_chat_id': chat_id})
        perfect_profile, _ = CandidateProfile.objects.get_or_create(user=perfect_user, defaults={'average_quality_score': 4.8, 'max_travel_distance': 25})
        WorkExperience.objects.get_or_create(candidate_profile=perfect_profile, role="Senior Resident", defaults={'start_date': date.today() - timedelta(days=6*365), 'end_date': date.today()})
        perfect_profile.skills.add(Skill.objects.get(name='emergency cricothyrotomy'), Skill.objects.get(name='end of life care communication'))
        perfect_profile.specialization.add(Speciality.objects.get(name='Emergency Medicine'))
        Education.objects.get_or_create(candidate_profile=perfect_profile, degree=DegreeType.objects.get(name='MBBS'))

        # 2. Dr. Good Enough (This user gets a FAKE chat_id so they exist but don't message you)
        good_user, _ = User.objects.get_or_create(email="good.enough@test.carechain.com", defaults={'first_name': 'Good', 'last_name': 'Enough', 'is_email_verified': True})
        TelegramProfile.objects.get_or_create(user=good_user, defaults={'telegram_chat_id': f"fake_{good_user.id}"})
        good_profile, _ = CandidateProfile.objects.get_or_create(user=good_user, defaults={'average_quality_score': 4.2, 'max_travel_distance': 50})
        WorkExperience.objects.get_or_create(candidate_profile=good_profile, role="Junior Resident", defaults={'start_date': date.today() - timedelta(days=4*365), 'end_date': date.today()})
        good_profile.skills.add(Skill.objects.get(name='ecg interpretation'))
        good_profile.specialization.add(Speciality.objects.get(name='General Medicine'))
        Education.objects.get_or_create(candidate_profile=good_profile, degree=DegreeType.objects.get(name='MBBS'))

        # 3. Dr. Mismatch (Does not need a TelegramProfile)
        mismatch_user, _ = User.objects.get_or_create(email="mismatch@test.carechain.com", defaults={'first_name': 'Mismatch', 'last_name': 'User', 'is_email_verified': True})
        mismatch_profile, _ = CandidateProfile.objects.get_or_create(user=mismatch_user, defaults={'average_quality_score': 5.0})
        mismatch_profile.skills.add(Skill.objects.get(name='elisa technique'))
        mismatch_profile.specialization.add(Speciality.objects.get(name='Pathology'))
        Education.objects.get_or_create(candidate_profile=mismatch_profile, degree=DegreeType.objects.get(name='BDS'))

        # --- Create Random Candidates ---
        for i in range(count):
            user, created = User.objects.get_or_create(
                email=f"user{i}@{fake.domain_name()}",
                defaults={'first_name': fake.first_name(), 'last_name': fake.last_name(), 'is_email_verified': True}
            )
            # --- THIS IS THE FIX: We no longer create a TelegramProfile for the random users ---
            candidate, _ = CandidateProfile.objects.get_or_create(
                user=user,
                defaults={
                    'average_quality_score': round(random.uniform(3.0, 5.0), 1),
                    'max_travel_distance': random.choice([10, 25, 50, 100]),
                    'latitude': round(random.uniform(13.0, 13.1), 6),
                    'longitude': round(random.uniform(80.2, 80.3), 6),
                    'pay_per_hour': random.randint(500, 2000),
                    'preferred_job_type': random.choice([["Short-Term"], ["Long-Term"], ["Short-Term", "Long-Term"]])
                }
            )
            if all_degrees and all_countries:
                Education.objects.create(
                    candidate_profile=candidate, degree=random.choice(all_degrees),
                    institution=fake.company() + " University", year_of_graduation=random.randint(2000, 2023),
                    country=random.choice(all_countries)
                )
            exp_years = random.randint(0, 20)
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
        
        self.stdout.write(self.style.SUCCESS(f"✅ Successfully created {count + 3} test candidates."))
