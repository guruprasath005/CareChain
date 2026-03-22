import os
import asyncio
from django.core.management.base import BaseCommand
from django.conf import settings
from telegram import Bot

class Command(BaseCommand):
    help = 'Sets the Telegram webhook to the URL defined in the environment.'

    def handle(self, *args, **options):
        site_domain = os.getenv('SITE_DOMAIN')
        secret_token = os.getenv('TELEGRAM_SECRET_TOKEN')

        if not all([site_domain, secret_token]):
            self.stdout.write(self.style.ERROR('SITE_DOMAIN and TELEGRAM_SECRET_TOKEN must be set in .env'))
            return

        webhook_url = f"https://{site_domain}/api/telegram-webhook/"
        
        async def set_webhook():
            bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
            await bot.set_webhook(url=webhook_url, secret_token=secret_token)
            self.stdout.write(self.style.SUCCESS(f'Webhook successfully set to: {webhook_url}'))

        asyncio.run(set_webhook())
