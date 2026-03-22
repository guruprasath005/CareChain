# Carechain Backend API

Welcome to the Carechain backend repository. This project provides the core API services for the Carechain platform, built with Django and containerized using Docker for a consistent and reliable development environment.

The stack includes:

- **Backend Framework:** Django & Django REST Framework
    
- **Database:** PostgreSQL
    
- **Asynchronous Tasks:** Celery
    
- **Message Broker & Cache:** Redis
    
- **Containerization:** Docker & Docker Compose
    

## 🚀 First-Time Setup

Follow these instructions to get the project running on your local machine for the first time.

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Git:** For cloning the repository.
    
- **Docker:** [Install Docker Desktop](https://www.docker.com/products/docker-desktop/ "null") (includes Docker Compose).
    

### 1. Clone the Repository

```
git clone <your-repository-url>
cd carechain
```

### 2. Create and Configure the Environment File

The application uses an `.env` file to manage all secret keys and configuration variables. We provide an example template to get you started.

```
# Create your local .env file from the template
cp .env.example .env
```

Now, open the new `.env` file and fill in your specific secrets, such as `TELEGRAM_BOT_TOKEN` and `BOT_API_KEY`.

> **Important:** The `.env` file contains sensitive information and is listed in `.gitignore`. It should **never** be committed to version control.

### 3. Run the Automated Reset Script

For a complete and clean first-time setup, run the automated development reset script. This script will handle everything: deleting old data, building containers, creating database migrations, and setting up your initial superuser.

```
# First, make the script executable (you only need to do this once)
chmod +x reset_dev.sh

# Now, run the script
./reset_dev.sh
```

This script automates all the necessary setup steps, including running migrations and creating a superuser based on the credentials in your `.env` file.

### 4. Start All Services

Once the reset script is finished, you can start all the application services in the background.

```
docker-compose up -d
```

### ✅ You're All Set!

The application is now running.

- **API Server:** `http://localhost:8000`
    
- **Django Admin:** `http://localhost:8000/admin` (Log in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env` file).
    

## 🪛 The `reset_dev.sh` Script (For Development)

After making significant changes to your database models (`models.py`), you will need to reset your development database. The `reset_dev.sh` script is a powerful tool that performs a "scorched earth" reset.

**Run `./reset_dev.sh` anytime you need to:**

- Completely wipe the database and media files.
    
- Delete and recreate all migration files from scratch.
    
- Rebuild your Docker images.
    
- Automatically create a superuser and populate lookup tables.
    

It is the fastest and most reliable way to ensure your development environment is in a clean state.

## ⚙️ Daily Workflow Commands

- **To start all services:** `docker-compose up -d`
    
- **To stop all services:** `docker-compose down`
    
- **To view logs for a specific service:** `docker-compose logs -f <service_name>` (e.g., `web`, `telegram_bot`, `celery_worker`)
    
- **To run a one-off command (like `makemigrations`):** `docker-compose run --rm web python manage.py makemigrations <app_name>`
    

## 📂 Project Structure

The project is organized into several distinct applications and directories, following a professional, decoupled architecture.

```
.
├── api/                  # Main API switchboard (directs traffic to other apps)
├── bot/                  # Standalone Telegram bot application (the "front-end")
│   ├── api_client.py     # Handles all communication with our Django API
│   ├── handlers.py       # Contains the bot's conversation logic
│   └── main.py           # The entry point for running the bot
├── core/                 # Core Django project configuration
│   ├── settings.py       # Main Django settings file
│   ├── urls.py           # Root URL configuration for the project
│   └── tasks.py          # Celery background tasks
├── data/                 # Contains .txt files for populating lookup tables
├── media/                # (Docker Volume) Stores all user-uploaded files
├── persistence/          # (Local folder) Stores the bot's conversation state
├── profiles/             # Django app for Candidate & Employer profiles and lookups
├── users/                # Django app for the core User model and authentication API
├── webhooks/             # Django app for receiving data from external services (Google Forms)
├── .env                  # Local environment variables (NEVER commit)
├── .env.example          # Template for environment variables
├── reset_dev.sh          # Automated script for resetting the dev environment
├── docker-compose.yml    # Defines and orchestrates all Docker services
├── Dockerfile            # Recipe for building the Django/Celery application image
└── requirements.txt      # List of Python dependencies
```

### Key Components

- **`web` service (Django):** This is the heart of the backend. Its only job is to be a secure API server. It handles all business logic, database interactions, and authentication.
    
- **`telegram_bot` service (Standalone Bot):** This acts as a client or "front-end." It contains all the logic for talking to users on Telegram. It has **no direct access** to the database and communicates with the backend exclusively through the API, just like a React app would.
    
- **`celery_worker` service:** This is the background workhorse. It handles slow or unreliable tasks like sending messages, downloading files, and processing data, ensuring the main API remains fast and responsive.