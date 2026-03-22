#!/bin/bash

# A simple script to register the Telegram webhook.
# It should be run AFTER docker-compose up and ngrok are running.

echo "🚀 Registering your Telegram webhook..."
docker-compose run --rm web python manage.py set_telegram_webhook