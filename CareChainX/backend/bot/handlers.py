from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler
import logging
from bot import api_client
from bot.utils import set_user_commands


# --- Set Up Logging ----
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)


# --- State Definitions ---

# Define states for our two separate conversations
# Registration Conversation States
ASKING_FIRST_NAME, ASKING_LAST_NAME, ASKING_EMAIL, CONFIRMING_DETAILS = range(4)
# Role Selection Conversation State
CHOOSING_ROLE = 4
ASKING_WHICH_PROFILE_FOR_LOC, AWAITING_LOCATION = range(5, 7)



# Core Handlers
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handles the /start command with three branches:
    1. New user -> Prompt to register.
    2. Existing user, not verified -> Prompt to verify email.
    3. Existing user, verified -> Start role selection.
    """
    logger.info("Handler 'start' was called.")
    chat_id = str(update.effective_chat.id)
    
    profile_data = await api_client.check_telegram_profile(chat_id)

    if profile_data.get("exists"):
        # User exists, now check if they are verified
        if profile_data.get("is_email_verified"):
            # User is verified, proceed to role selection
            context.user_data['user_id'] = profile_data["user_id"]
            reply_keyboard = [["I'm looking for a Job", "I'm hiring"]]
            await update.message.reply_text(
                f"Welcome back, {profile_data['first_name']}!\n\nWhat can I help you with today?",
                reply_markup=ReplyKeyboardMarkup(reply_keyboard, one_time_keyboard=True),
            )
            await set_user_commands(context.application, update.effective_chat.id, role=None)
            return CHOOSING_ROLE
        else:
            # User exists but is not verified
            await update.message.reply_text(
                "Welcome! Your account isn’t active yet.\n\n"
                "\nPlease check your email to verify, then type /start.\n\n Need a new link? Use /resend."
            )
            await set_user_commands(context.application, update.effective_chat.id, role=None)
            return ConversationHandler.END
    else:
        # User is new
        await update.message.reply_text(
            "Hello and welcome to CareChain! I’m ISHA.\n\n It looks like you’re new here.\n\n"
            "Type /register to create your account and I’ll guide you through it."
        )
        await set_user_commands(context.application, update.effective_chat.id, role=None)
        return ConversationHandler.END




# ----- REGISTRATION FUNCTIONS ----

async def register(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Starts the registration conversation after checking the API."""
    logger.info("Handler 'register' was called.")
    chat_id = str(update.effective_chat.id)
    
    # ---Use the API client to check if the user is already registered ---
    profile_data = await api_client.check_telegram_profile(chat_id)
    
    if profile_data.get("exists"):
        await update.message.reply_text(
            "You are already registered!\n\nUse /start to access your profile and continue."
        )
        return ConversationHandler.END
    else:
        await update.message.reply_text("Let's get you set up. First, what is your first name?")
        return ASKING_FIRST_NAME

async def received_first_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    
    logger.info("Handler 'received_first_name' was called.")
  
    context.user_data['first_name'] = update.message.text
    await update.message.reply_text("Got it. Now, what is your last name?")
    return ASKING_LAST_NAME

async def received_last_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
  
    logger.info("Handler 'received_last_name' was called.")
  
    context.user_data['last_name'] = update.message.text
    await update.message.reply_text("Great. What is your email address?")
    return ASKING_EMAIL

async def received_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:

    logger.info("Handler 'received_email' was called.")

    context.user_data['email'] = update.message.text.lower()

    # Display a summary of the collected data
    user_details = (
        f"Please confirm your details:\n\n"
        f"First Name: {context.user_data['first_name']}\n"
        f"Last Name: {context.user_data['last_name']}\n"
        f"Email: {context.user_data['email']}\n"
        "Is this correct?"
    )
    reply_keyboard = [["Confirm", "Start Over"]]
    await update.message.reply_text(
        user_details,
        reply_markup=ReplyKeyboardMarkup(reply_keyboard, one_time_keyboard=True),
    )
    return CONFIRMING_DETAILS



async def confirmed_details(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Processes the confirmation, calls the API to create the user,
    and then ends the conversation.
    """
    logger.info("Handler 'confirmed_details' was called.")
    chat_id = str(update.effective_chat.id)
    registration_data = {
        "first_name": context.user_data['first_name'],
        "last_name": context.user_data['last_name'],
        "email": context.user_data['email'],
        "password": chat_id,
        "chat_id": chat_id
    }

    try:
        await api_client.register_user(registration_data)
    except Exception as e:
        logger.error(f"API registration failed: {e}")
        await update.message.reply_text("It looks like an account with this email may already exist. Please try again with a different email.")
        return ConversationHandler.END
    
    
    await update.message.reply_text(
        "Thank you! Your account has been created.\n\n"
        "A verification link has been sent to your email.\nPlease check your inbox to activate your account and then enter /start.\n\n Need a new link? Use /resend.",
        reply_markup=ReplyKeyboardRemove()
    )
    await set_user_commands(context.application, update.effective_chat.id, role=None)
    
    context.user_data.clear()
    return ConversationHandler.END


async def resend_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handles the /resendemail command.
    Calls the API to trigger a new verification email, but only if the
    user is registered and not yet verified.
    """
    logger.info("Handler 'resend_email' was called.")
    chat_id = str(update.effective_chat.id)
    
    # First, check the user's status
    profile_data = await api_client.check_telegram_profile(chat_id)

    if not profile_data.get("exists"):
        await update.message.reply_text("You'll need to register first. Please send /register to begin.")
        return
    
    if profile_data.get("is_email_verified"):
        await update.message.reply_text("Your email is already verified! You can use /start to access your profile.")
        return

    # If the user exists and is not verified, proceed
    try:
        user_id = profile_data["user_id"]
        response = await api_client.resend_verification_email(user_id)
        
        api_message = response.get('message', 'A new email has been sent. Please check your inbox to activate your account and then enter /start. Need a new link? Use /resend.')
        
        final_message = f"✅ {api_message}"
        
        await update.message.reply_text(final_message)
        
    except Exception as e:
        logger.error(f"API call to resend_verification_email failed: {e}")
        await update.message.reply_text("Sorry! I couldn’t send the email just now. Please try again in a little while.")






async def choose_role(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Creates the chosen profile by calling the role profile creation API endpoint.
    """
    logger.info("Handler 'choose_role' was called.")
    
    choice = update.message.text
    user_id = context.user_data.get('user_id')

    if not user_id:
        await update.message.reply_text("Sorry, something went wrong. Please /start again.")
        return ConversationHandler.END
    

    # Determine the role based on the user's button choice
    # Updated to match your new button text
    role = "Candidate" if "Job" in choice else "Employer"
    context.user_data['current_role'] = role
    
    # Prepare the data payload for the API call
    profile_data = {
        "user_id": user_id,
        "role": role
    }

    try:
        # Call the service function via the API client
        response_data = await api_client.create_role_profile(profile_data)
        message = response_data.get("message", "Your profile has been set up!")
        message += " Your profile is ready.\n\n I’ve updated your menu. Check the commands to see what you can do next."
    
        await set_user_commands(context.application, update.effective_chat.id, role=role)
    except Exception as e:
        logger.error(f"API call to create_role_profile failed: {e}")
        message = "Sorry, there was an error creating your profile. Please try again later."

    await update.message.reply_text(message, reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END


async def start_over(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Clears user data and sends user back to the start of registration."""

    logger.info("Handler 'start_over' was called.")

    context.user_data.clear()
    await update.message.reply_text("No problem, let's start over.", reply_markup=ReplyKeyboardRemove())
    return await register(update, context) # Re-run the register command


# --- UPDATE PROFILE FUNCTIONS ---
async def update_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Sends the user a link to update their profile via an interactive button.
    """
    logger.info("Handler 'update_profile' was called.")
    
    profile_type = context.user_data.get('current_role')
    user_id = context.user_data.get('user_id')

    if not profile_type or not user_id:
        await update.message.reply_text(
            "You need to log in first. Send /start and choose what you'd like to do."
        )
        return

    try:
        response = await api_client.generate_form_token(user_id, profile_type)
        token = response['token']
        
        if profile_type == "Candidate":
            form_link = f"https://docs.google.com/forms/d/e/1FAIpQLSckAM9SKiT6fl0eCZ9PlARE2A0_XyNwzM1rnoCEhobkXrXH2A/viewform?usp=pp_url&entry.1562203331={token}"
        else: # Employer
            form_link = f"https://docs.google.com/forms/d/e/1FAIpQLScEKxeeU8y5IY2I9WeONe1mFKAcd-entiVN7q4CgDo6qpxRwQ/viewform?usp=pp_url&entry.105123141={token}"

        # Create the interactive button
        keyboard = [
            [InlineKeyboardButton(f"Update your {profile_type} Profile", url=form_link)]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"Please click the button below to update your {profile_type} profile:",
            reply_markup=reply_markup
        )
    except Exception as e:
        logger.error(f"Failed to generate form token for /updateprofile: {e}")
        await update.message.reply_text("Sorry, I couldn't generate a profile update link right now. Please try again.")



# --- SET LOCATION HANDLER ---- 

async def set_location_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Starts the /setlocation conversation.
    If the user's current role is already known, it skips the selection
    step and directly asks for the location.
    """
    logger.info("Handler 'set_location_start' was called.")
    
    if 'user_id' not in context.user_data:
        await update.message.reply_text("Please send /start to begin.")
        return ConversationHandler.END

    # Check if a role is already active in the current session
    current_role = context.user_data.get('current_role')

    if current_role:
        # If the role is known, skip the question and ask for the location directly
        logger.info(f"User has an active role: {current_role}. Asking for location directly.")
        context.user_data['location_profile_type'] = current_role
        await update.message.reply_text(
            f"To set the location for your *{current_role} Profile*, please use the 'Attach' (📎) button in your Telegram app and select 'Location' to share your current position.",
            parse_mode="Markdown",
            reply_markup=ReplyKeyboardRemove()
        )
        return AWAITING_LOCATION
    else:
        # If no role is active, ask the user to choose
        logger.info("User has no active role. Asking them to choose.")
        reply_keyboard = [["Location for Candidate Profile", "Location for Employer Profile"]]
        await update.message.reply_text(
            "Which profile is this location for?",
            reply_markup=ReplyKeyboardMarkup(reply_keyboard, one_time_keyboard=True)
        )
        return ASKING_WHICH_PROFILE_FOR_LOC


async def received_profile_for_loc(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Saves the profile choice and asks the user to share their location."""
    logger.info("Handler 'received_profile_for_loc' was called.")
    choice = update.message.text
    profile_type = "Candidate" if "Candidate" in choice else "Employer"
    context.user_data['location_profile_type'] = profile_type

    await update.message.reply_text(
        f"Great! To set the location for your *{profile_type} Profile*, please use the 'Attach' (📎) button and select 'Location'.",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove()
    )
    return AWAITING_LOCATION

async def received_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Receives the user's location, calls the API, and ends the conversation."""
    logger.info("Handler 'received_location' was called.")
    location = update.message.location
    user_id = context.user_data['user_id']
    profile_type = context.user_data['location_profile_type']

    try:
        await api_client.set_profile_location(
            user_id=user_id,
            profile_type=profile_type,
            latitude=location.latitude,
            longitude=location.longitude
        )
        await update.message.reply_text("✅ Thank you! Your location has been updated successfully.")
    except Exception as e:
        logger.error(f"API call to set_profile_location failed: {e}")
        await update.message.reply_text("Sorry, there was an error saving your location. Please try again.")
    
    context.user_data.pop('location_profile_type', None)
    return ConversationHandler.END


# --- CANDIDATE SET JOB PREFERENCES FUNCTION ---
async def set_job_preferences(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handles the /setjobpreferences command.
    This is only for users currently in the 'Candidate' role.
    It generates a token and sends the link to the job preferences form as an interactive button.
    """
    logger.info("Handler 'set_job_preferences' was called.")
    
    # Check if the user has a role selected in their current session.
    current_role = context.user_data.get('current_role')
    user_id = context.user_data.get('user_id')

    if not user_id:
        await update.message.reply_text(
            "I need to know who you are first. Please send /start to begin."
        )
        return
        
    # This command is only for Candidates.
    if current_role != 'Candidate':
        await update.message.reply_text(
            "This command is only available for the Candidates. Please use /start and select 'I'm looking for a Job'."
        )
        return
    
    # Check Profile Status before proceeding
    status_data = await api_client.check_profile_status(user_id, 'Candidate')
    if not status_data.get('is_complete'):
        await update.message.reply_text("You must complete your Candidate Profile before you can set job preferences. Please use /updateprofile first.")
        return

    try:
        # We are generating a token for the 'Candidate' profile type
        response = await api_client.generate_form_token(user_id, 'Candidate')
        token = response['token']
        
        # Actual prefilled form_link
        form_link = f"https://docs.google.com/forms/d/e/1FAIpQLSeURvVL9Tbo3vxXuwk0lJ3GxYmHG-T7RqIIlclfp1DF05FUkA/viewform?usp=pp_url&entry.293957308={token}"


        # 1. Create the interactive button
        keyboard = [
            [InlineKeyboardButton("Set Job Preferences", url=form_link)]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        # 2. Send the message with the button
        await update.message.reply_text(
            "Please click the button below to set your job preferences and availability:",
            reply_markup=reply_markup
        )
        # ---------------------

    except Exception as e:
        logger.error(f"Failed to generate form token for /setjobpreferences: {e}")
        await update.message.reply_text("Sorry, I couldn't generate the preferences form link right now.")


async def view_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handles the /viewprofile command. Triggers the backend to generate
    and send the user's own profile summary based on their current role.
    """
    logger.info("Handler 'view_profile' was called.")
    
    current_role = context.user_data.get('current_role')
    user_id = context.user_data.get('user_id')

    if not user_id or not current_role:
        await update.message.reply_text("Please use /start and select a role first.")
        return
    
    try:
        await update.message.reply_text("Fetching your profile summary, please wait a moment...")
        await api_client.request_profile_summary(user_id, current_role)
        
    except Exception as e:
        logger.error(f"Failed to trigger profile summary: {e}")
        await update.message.reply_text("Sorry, there was an error fetching your profile.")




# --- EMPLOYER NEW JOB POST ----
async def new_job_post(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handles the /newjobpost command. It checks the employer's job post
    quota and sends all links as interactive buttons.
    """
    logger.info("Handler 'new_job_post' was called.")
    
    current_role = context.user_data.get('current_role')
    user_id = context.user_data.get('user_id')

    if not user_id or current_role != 'Employer':
        await update.message.reply_text("This command is only available for the Employer role. Please use /start and select 'I'm hiring'.")
        return

    # Check Profile Status before proceeding
    status_data = await api_client.check_profile_status(user_id, 'Employer')
    if not status_data.get('is_complete'):
        await update.message.reply_text("You must complete your Employer Profile before you can post a new job. Please use /updateprofile first.")
        return

    try:
        # 1. Check the job quota first
        quota_data = await api_client.check_job_quota(user_id)
        
        if quota_data.get("quota_available"):
            # If quota is available, send the form link as a button
            response = await api_client.generate_form_token(user_id, 'Employer')
            token = response['token']
            form_link = f"https://docs.google.com/forms/d/e/1FAIpQLScbNaLHjaQzn5mOsCRVyqnS3bBggqYV6jxgOcBqlLib8rqS-g/viewform?usp=pp_url&entry.1440552351={token}"
            
            keyboard = [[InlineKeyboardButton("Post a New Job", url=form_link)]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "You have an available job post credit. Please click the button below to create your post:",
                reply_markup=reply_markup
            )
        else:
            # If quota is exceeded, generate a payment link and send it as a button
            payment_data = await api_client.create_payment_link(user_id)
            payment_url = payment_data['payment_url']
            
            keyboard = [[InlineKeyboardButton("Pay ₹299 for a New Job Post", url=payment_url)]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                "You have used all of your available job post credits. To post a new job, please complete the payment using the button below.",
                reply_markup=reply_markup
            )

    except Exception as e:
        logger.error(f"Error in /newjobpost handler: {e}")
        await update.message.reply_text("Sorry, an error occurred. Please try again.")





# --- EMPLOYER LIST JOB POSTS ---

async def my_job_posts(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handles the /myjobposts command. It sends the user_id to the backend
    to trigger the summary generation.
    """
    logger.info("Handler 'my_job_posts' was called.")
    
    current_role = context.user_data.get('current_role')
    user_id = context.user_data.get('user_id')

    if not user_id or current_role != 'Employer':
        await update.message.reply_text("This command is only for Employers. Please use /start and select 'I'm hiring'.")
        return
    
    status_data = await api_client.check_profile_status(user_id, 'Employer')
    if not status_data.get('is_complete'):
        await update.message.reply_text("You must complete your Employer Profile before you can list your job posts. Please use /updateprofile first.")
        return

    
    try:
        await update.message.reply_text("Fetching your job posts, please wait a moment...")
        
        # Make API call
        await api_client.request_job_post_summary(user_id)
        
    except Exception as e:
        logger.error(f"Failed to trigger job post summary: {e}")
        await update.message.reply_text("Sorry, there was an error fetching your job posts. Please try again later.")


# --- CANDIDATE LIST JOB APPLICATIONS ---

async def my_applications(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handles the /myapplications command. Triggers the backend to generate
    and send the application list summary.
    """
    logger.info("Handler 'my_applications' was called.")
    
    current_role = context.user_data.get('current_role')
    user_id = context.user_data.get('user_id')

    if not user_id or current_role != 'Candidate':
        await update.message.reply_text("This command is only for Candidates. Please use /start and select 'I'm looking for a Job'.")
        return
    
    status_data = await api_client.check_profile_status(user_id, 'Candidate')
    if not status_data.get('is_complete'):
        await update.message.reply_text("You must complete your Candidate Profile before you can list your job posts. Please use /updateprofile first.")
        return
    
    try:
        await update.message.reply_text("Fetching your applications, please wait a moment...")
        await api_client.request_my_applications_summary(user_id)
        
    except Exception as e:
        logger.error(f"Failed to trigger application list summary: {e}")
        await update.message.reply_text("Sorry, there was an error fetching your applications.")

# --- EMPLOYER LIST ACTIVE EMPLOYEES ---
async def my_employees(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handles the /myemployees command. Triggers the backend to generate
    and send the employee list summary.
    """
    logger.info("Handler 'my_employees' was called.")
    
    current_role = context.user_data.get('current_role')
    user_id = context.user_data.get('user_id')

    if not user_id or current_role != 'Employer':
        await update.message.reply_text("This command is only for Employers. Please use /start and select 'I'm hiring'.")
        return
    
    status_data = await api_client.check_profile_status(user_id, 'Employer')
    if not status_data.get('is_complete'):
        await update.message.reply_text("You must complete your Employer Profile before you can manage employees. Please use /updateprofile first.")
        return
    
    try:
        await update.message.reply_text("Fetching your employee list, please wait a moment...")
        await api_client.request_employee_list_summary(user_id)
        
    except Exception as e:
        logger.error(f"Failed to trigger employee list summary: {e}")
        await update.message.reply_text("Sorry, there was an error fetching your employee list.")


# --- Candidate List Current Jobs ---
async def my_jobs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handles the /myjobs command. Triggers the backend to generate
    and send the current job list summary.
    """
    logger.info("Handler 'my_jobs' was called.")
    
    current_role = context.user_data.get('current_role')
    user_id = context.user_data.get('user_id')

    if not user_id or current_role != 'Candidate':
        await update.message.reply_text("This command is only for Candidates. Please use /start and select 'I'm looking for a Job'.")
        return
    
    status_data = await api_client.check_profile_status(user_id, 'Candidate')
    if not status_data.get('is_complete'):
        await update.message.reply_text("You must complete your Candidate Profile before you can manage your jobs. Please use /updateprofile first.")
        return
    
    try:
        await update.message.reply_text("Fetching your current jobs, please wait a moment...")
        await api_client.request_my_jobs_summary(user_id)
        
    except Exception as e:
        logger.error(f"Failed to trigger my_jobs summary: {e}")
        await update.message.reply_text("Sorry, there was an error fetching your jobs.")







# ---- GENERAL FUNCTIONS -----



async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Generic cancel handler for any conversation."""
    
    logger.info("Handler 'cancel' was called.")

    
    await update.message.reply_text("Action cancelled.", reply_markup=ReplyKeyboardRemove())
    context.user_data.clear()
    return ConversationHandler.END






 # --- ERROR HANDLING FUNCTIONS ---

async def nudge(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Catch-all inside an active conversation state.
    Keeps the user in the same state.
    """
    logger.info("Handler 'nudge' was called because of an invalid text input.")
    if update.effective_message:
        await update.effective_message.reply_text(
            "I didn't catch that. Please use the provided buttons or follow the instructions for this step."
        )
    return 


async def unsupported_content(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Politely reject non-text messages in text-only states.
    """
    logger.info("Handler 'unsupported_content' was called.")
    if update.effective_message:
        await update.effective_message.reply_text(
            "I can only process text at this step. Please send the requested details as text."
        )
    # Keep the user in the same state by returning None
    return 

async def catch_all_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Catch-all outside a conversation(things not caught by Conv Handler): guide user to start/register."""
    
    logger.info("Global 'catch_all_prompt' was called.")
    if update.effective_message:
        await update.effective_message.reply_text(
            "I'm sorry. I didn't catch that. Kindly follow the instructions. "
            "Or type /start to begin again."
        )
    
    return


async def timeout(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handles a conversation timeout.
    Informs the user that the conversation has timed out and clears any stored data.
    """
    logger.info("Handler 'timeout' was called.")
    
    # The update object might not have a message if the timeout is triggered by the library
    # so we use the chat_id from the context if available.
    chat_id = context._chat_id
    
    await context.bot.send_message(
        chat_id=chat_id,
        text="Sorry, you took too long to reply. The conversation has timed out.\n\n"
             "You can start again anytime with /start.",
        reply_markup=ReplyKeyboardRemove()
    )
    context.user_data.clear()
    return ConversationHandler.END