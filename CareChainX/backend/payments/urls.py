from django.urls import path
from .views import CreatePaymentLinkView, RazorpayWebhookView

urlpatterns = [
    path('create-link/', CreatePaymentLinkView.as_view(), name='create-payment-link'),
    path('webhook/', RazorpayWebhookView.as_view(), name='razorpay-webhook'),
]