#!/bin/bash

# A script to perform a "scorched earth" reset of the development environment.
# This script is fully automated. It deletes all data, rebuilds the containers,
# sets up the database, creates a superuser, and populates lookup tables.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- CONFIGURATION ---
# If your project folder is named something other than 'carechain',
# you might need to change the volume names here.
# You can check the correct names by running `docker volume ls`.
DB_VOLUME_NAME="carechain_postgres_data"
MEDIA_VOLUME_NAME="carechain_media_data"


# --- SCRIPT START ---
echo "🛑 STEP 1: Stopping and removing all Docker containers..."
docker-compose down

echo "🔥 STEP 2: Deleting database and media volumes..."
# '|| true' prevents the script from failing if a volume doesn't exist yet
docker volume rm ${DB_VOLUME_NAME} || true
docker volume rm ${MEDIA_VOLUME_NAME} || true
echo "✅ Volumes deleted."

echo "🔥 STEP 3: Deleting bot persistence and recreating folder..."
rm -rf telegram_persistence
mkdir telegram_persistence
echo "✅ Bot persistence folder recreated."

echo "🔥 STEP 4: Deleting all old migration files..."
# This command finds and deletes all .py and .pyc files in any 'migrations'
# directory, except for the essential '__init__.py' file.
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc"  -delete
echo "✅ Old migration files deleted."

echo "🚀 STEP 5: Building fresh Docker images..."
docker-compose build

echo "🚀 STEP 6: Creating new migration files for all apps..."
# Make sure to include all apps that have models
docker-compose run --rm web python manage.py makemigrations

echo "🚀 STEP 7: Applying migrations to the new database..."
docker-compose run --rm web python manage.py migrate

echo "🚀 STEP 8: Creating superuser from .env variables..."
docker-compose run --rm web python manage.py create_superuser_from_env

echo "🚀 STEP 9: Populating lookup tables from /data files..."
docker-compose run --rm web python manage.py populate_lookups

echo ""
echo "🎉✅ All Done! Your development environment has been reset."
echo "--------------------------------------------------"
echo "➡️  NEXT STEPS (The 'Webhook Workflow'):"
echo "1. Start all services in the background:"
echo "   docker-compose up -d"
echo ""
echo "2. In a NEW terminal, start ngrok to get a public URL:"
echo "   ngrok http 8000"
echo ""
echo "3. Update the SITE_DOMAIN in your .env file with the new ngrok URL."
echo ""
echo "4. Register the webhook with Telegram by running:"
echo "   ./set_webhook.sh"
echo "--------------------------------------------------"