# --- THIS IS THE FIX ---
# We are switching from the old 'buster' to the newer, supported 'bullseye'
FROM python:3.11-slim-bullseye

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install curl, which is needed for the healthcheck in docker-compose.
# We also clean up the apt cache to keep the image size small.
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the rest of the application's code
COPY . .

# The command to run the application will be specified in docker-compose.yml
