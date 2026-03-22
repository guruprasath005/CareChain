from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, TelegramProfile

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Define the admin pages for the custom User model."""
    list_display = ('email', 'first_name', 'last_name', 'is_staff', 'is_email_verified', 'date_joined')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'groups')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'is_email_verified', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password', 'first_name', 'last_name'),
        }),
    )

@admin.register(TelegramProfile)
class TelegramProfileAdmin(admin.ModelAdmin):
    """Define the admin pages for the TelegramProfile model."""
    list_display = ('user', 'telegram_chat_id')
    search_fields = ('user__email', 'telegram_chat_id')