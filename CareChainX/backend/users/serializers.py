from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import TelegramProfile

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """Serializer for the User object."""
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'is_email_verified')

class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""
    chat_id = serializers.CharField(max_length=255, write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'chat_id')
        extra_kwargs = {'password': {'write_only': True, 'min_length': 8}}

    def create(self, validated_data):
        chat_id = validated_data.pop('chat_id', None)
        user = User.objects.create_user(**validated_data)
        if chat_id:
            TelegramProfile.objects.create(user=user, telegram_chat_id=chat_id)
        return user

class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change."""
    new_password = serializers.CharField(required=True, min_length=8)