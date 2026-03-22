# jobs/management/commands/analyze_results.py
import time
from django.core.management.base import BaseCommand
from profiles.models import CandidateProfile
from jobs.models import JobMatch, JobPost
from datetime import timedelta
from geopy.distance import geodesic

class Command(BaseCommand):
    help = 'Analyzes and displays the results of a matching run for a given job ID.'

    def add_arguments(self, parser):
        parser.add_argument('--job_id', type=int, help='The ID of the job post to analyze.', required=True)

    def handle(self, *args, **options):
        job_id = options['job_id']
        self.stdout.write(self.style.SUCCESS(f"--- ANALYZING RESULTS FOR JOB ID: {job_id} ---"))

        try:
            job_match = JobMatch.objects.select_related('job_post__posted_by').get(job_post_id=job_id)
            job = job_match.job_post
        except JobMatch.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ No match results found for Job ID {job_id}. The Celery task may have failed or is still running."))
            return

        self.stdout.write(self.style.SUCCESS("✅ Match results found!"))
        
        top_matches = job_match.matched_candidates[:10]
        
        self.stdout.write(self.style.HTTP_INFO("\n--- TOP 10 MATCHES ---"))
        
        for i, match in enumerate(top_matches, 1):
            # Use prefetch_related for efficiency
            candidate = CandidateProfile.objects.select_related('user').prefetch_related(
                'education__degree', 'work_experience', 'skills'
            ).get(pk=match['candidate_id'])
            user = candidate.user
            
            # --- CALCULATE AND DISPLAY DETAILED MATCHING DATA ---
            
            # 1. Education
            education_list = [edu.degree.name for edu in candidate.education.all() if edu.degree]

            # 2. Job Type Preference
            job_type_pref = ", ".join(candidate.preferred_job_type)

            # 3. Distance Calculation
            distance_str = "N/A"
            if candidate.latitude and candidate.longitude and job.posted_by.institution_latitude and job.posted_by.institution_longitude:
                job_location = (job.posted_by.institution_latitude, job.posted_by.institution_longitude)
                candidate_location = (candidate.latitude, candidate.longitude)
                distance = geodesic(job_location, candidate_location).kilometers
                distance_str = f"{distance:.1f} km"

            # 4. Salary Difference Calculation
            salary_diff_str = "N/A"
            if job.job_type == 'SHORT_TERM' and candidate.pay_per_hour and job.short_term_pay_unit == 'PER_HOUR':
                salary_diff = float(job.short_term_pay_amount or 0) - float(candidate.pay_per_hour or 0)
                salary_diff_str = f"₹{salary_diff:+.2f}/hr" # Show positive/negative difference
            elif job.job_type == 'LONG_TERM' and candidate.pay_per_month and job.long_term_salary:
                salary_diff = float(job.long_term_salary or 0) - float(candidate.pay_per_month or 0)
                salary_diff_str = f"₹{salary_diff:+.2f}/month"

            # 5. Availability Score Calculation
            availability_score_str = "N/A"
            if job.job_type == 'SHORT_TERM' and job.weekly_availability_matrix and candidate.weekly_availability_matrix:
                required_hours = sum(sum(row) for row in job.weekly_availability_matrix)
                if required_hours > 0:
                    overlap = sum(
                        1 for row_idx in range(7) for col_idx in range(24)
                        if len(job.weekly_availability_matrix) > row_idx and len(job.weekly_availability_matrix[row_idx]) > col_idx and
                           len(candidate.weekly_availability_matrix) > row_idx and len(candidate.weekly_availability_matrix[row_idx]) > col_idx and
                           job.weekly_availability_matrix[row_idx][col_idx] == 1 and candidate.weekly_availability_matrix[row_idx][col_idx] == 1
                    )
                    availability_score_percent = (overlap / required_hours) * 100
                    availability_score_str = f"{overlap}/{required_hours} hrs ({availability_score_percent:.1f}%)"

            exp_days = sum([(w.end_date - w.start_date).days for w in candidate.work_experience.all() if w.start_date and w.end_date])
            exp_years = round(exp_days / 365.25, 1)

            # --- PRINT THE DETAILED OUTPUT ---
            self.stdout.write(f"\nRANK #{i}: {user.first_name} {user.last_name} (ID: {candidate.id})")
            self.stdout.write(f"  - SCORE: {match['score']:.2f}")
            self.stdout.write(f"  - Experience: {exp_years} years | Quality Score: {candidate.average_quality_score}")
            self.stdout.write(f"  - Education: {education_list}")
            self.stdout.write(f"  - Job Type Pref: {job_type_pref}")
            self.stdout.write(f"  - Distance: {distance_str} (Prefers <= {candidate.max_travel_distance} km)")
            self.stdout.write(f"  - Salary Match: {salary_diff_str}")
            self.stdout.write(f"  - Availability Match: {availability_score_str}")
            self.stdout.write(f"  - Skills: {[s.name for s in candidate.skills.all()]}")
