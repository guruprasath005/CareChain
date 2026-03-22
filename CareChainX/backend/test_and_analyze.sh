#!/bin/bash
# To run this script  ./test_and_analyze.sh --candidates 10000 --chat_id 609288469 --email arjunsuresh1011@gmail.com
# A script to run the full simulation and then analyze the results interactively.
# It accepts all the same arguments as the run_simulation command.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🚀 STEP 1: Running the simulation to seed the database and create the job..."
echo "--------------------------------------------------"

# Run the simulation command, passing along all arguments given to this script (e.g., --candidates, --chat_id)
# We capture the output to find the job ID later.
SIMULATION_OUTPUT=$(docker-compose run --rm web python manage.py run_simulation "$@")

# Print the output from the simulation script for the user to see
echo "$SIMULATION_OUTPUT"

# --- This is the interactive part ---
echo ""
echo "✅ Simulation task has been sent to the Celery worker."
echo "   Watch your 'docker-compose logs -f celery_worker' to see its progress."
echo ""
read -p "Press [Enter] to continue and analyze the results..."

echo ""
echo "🚀 STEP 2: Analyzing the results..."
echo "--------------------------------------------------"

# --- This part intelligently finds the job ID ---
# It looks for the line containing 'analyze_results --job_id' in the output,
# and then extracts the number that follows.
JOB_ID=$(echo "$SIMULATION_OUTPUT" | grep 'analyze_results --job_id' | awk '{print $NF}')

if [ -z "$JOB_ID" ]; then
    echo "❌ Could not automatically find the Job ID from the simulation output."
    echo "Please run the analysis command manually."
    exit 1
fi
# -----------------------------------------

# Run the analysis command with the job ID we just found
docker-compose run --rm web python manage.py analyze_results --job_id "$JOB_ID"

echo ""
echo "🎉✅ Analysis complete!"

