import json
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from core.tasks import process_telegram_update # Import our new Celery task

@method_decorator(csrf_exempt, name='dispatch')
class TelegramWebhookView(View):
    """
    A simple, fast, and synchronous webhook.
    Its only job is to receive an update from Telegram and pass it to a
    Celery task for reliable background processing.
    """
    def post(self, request, *args, **kwargs):
        # 1. Security Check
        secret_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if secret_token != settings.TELEGRAM_SECRET_TOKEN:
            return JsonResponse({"status": "unauthorized"}, status=403)

        # 2. Pass the work to Celery
        try:
            data = json.loads(request.body)
            # Trigger the background task, passing the raw JSON data.
            # This call is synchronous and returns instantly.
            process_telegram_update.delay(data)
            # Immediately return a success response to Telegram.
            return JsonResponse({"status": "ok"})
        except json.JSONDecodeError:
            return JsonResponse({"status": "bad request"}, status=400)
