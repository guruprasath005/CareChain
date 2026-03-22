import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    """
    A custom Django management command to create a superuser non-interactively
    by reading credentials from environment variables.
    """
    help = 'Creates a superuser from environment variables (ADMIN_EMAIL, ADMIN_PASSWORD, etc.)'

    def handle(self, *args, **options):
        email = os.getenv('ADMIN_EMAIL')
        password = os.getenv('ADMIN_PASSWORD')
        first_name = os.getenv('ADMIN_FIRST_NAME', 'Admin')
        last_name = os.getenv('ADMIN_LAST_NAME', 'User')

        if not all([email, password]):
            self.stdout.write(self.style.ERROR(
                'ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.'
            ))
            return

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(
                f'Superuser with email {email} already exists. Skipping.'
            ))
        else:
            User.objects.create_superuser(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name
            )
            self.stdout.write(self.style.SUCCESS(
                f'Successfully created superuser: {email}'
            ))
