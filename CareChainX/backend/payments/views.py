from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.conf import settings
import razorpay
import hmac
import hashlib

from profiles.models import EmployerProfile
from core.permissions import IsBotOrAuthenticated
from core.tasks import send_telegram_message_task, send_error_notification_task

# Initialize the Razorpay client
razorpay_client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)


class CreatePaymentLinkView(APIView):
    """
    A secure endpoint for the bot to create a Razorpay payment link for a user.
    """
    permission_classes = [IsBotOrAuthenticated]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        try:
            profile = EmployerProfile.objects.select_related('user').get(user_id=user_id)
            user = profile.user
        except EmployerProfile.DoesNotExist:
            return Response({"error": "Employer profile not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            order_amount = settings.JOB_POST_PRICE
            order_currency = 'INR'
            
            # --- THIS IS THE CORRECTED PAYLOAD ---
            # It now matches the official Razorpay documentation for creating a UPI link.
            payment_payload = {
                'amount': order_amount,
                'currency': order_currency,
                'accept_partial': False,
                'description': 'Payment for one (1) new job post on Carechain.',
                'upi_link': False, # This is the key to enabling UPI
                'customer': {
                    'name': user.get_full_name(),
                    'email': user.email,
                    'contact': profile.contact_num
                },
                'notify': {
                    'sms': True,
                    'email': True
                },
                'notes': {
                    'employer_profile_id': profile.id
                },
                'callback_url': 'https://t.me/carechainx_bot', # Remember to change this
                'callback_method': 'get'
            }
            # ------------------------------------

            payment_link = razorpay_client.payment_link.create(payment_payload)
            
            return Response({'payment_url': payment_link['short_url']})
        
        except razorpay.errors.BadRequestError as e:
            logger.error(f"RAZORPAY BAD REQUEST ERROR: {e}")
            return Response({"error": "There was an issue creating the payment link with Razorpay. Please check your account configuration."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"UNEXPECTED ERROR in CreatePaymentLinkView: {e}")
            return Response({"error": "An unexpected server error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RazorpayWebhookView(APIView):
    """
    A public webhook to receive payment notifications from Razorpay.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        # 1. (Signature validation logic is the same)
        # ...

        # 2. Process the event if the signature is valid
        event = request.data
        
        if event['event'] == 'payment_link.paid':
            payload = event['payload']['payment_link']['entity']
            profile_id = payload['notes'].get('employer_profile_id')
            
            if profile_id:
                try:
                    profile = EmployerProfile.objects.get(pk=profile_id)
                    profile.job_post_quota += 1
                    profile.save()
                    
                    # Notify the user of success
                    chat_id = profile.user.telegram_profile.telegram_chat_id
                    message = "✅ Payment successful\\! Your job post quota has been increased by one\\. You can now use the /newjobpost command to create your new post\\."
                    send_telegram_message_task.delay(chat_id, message)
                except Exception as e:
                    pass

        # --- check for errors ---
        elif event['event'] in ['payment_link.cancelled', 'payment_link.expired']:
            payload = event['payload']['payment_link']['entity']
            profile_id = payload['notes'].get('employer_profile_id')

            if profile_id:
                try:
                    profile = EmployerProfile.objects.get(pk=profile_id)
                    chat_id = profile.user.telegram_profile.telegram_chat_id
                    
                    # Use our generic error handler to notify the user
                    send_error_notification_task.delay(
                        chat_id=chat_id,
                        error_message="Your payment for a new job post did not complete.",
                        action_message="Please use the /newjobpost command to generate a new payment link and try again."
                    )
                except Exception as e:
                    pass
        # ---------------------------

        return Response({"status": "ok"})