from telegram import BotCommand
from telegram.ext import Application
import logging

logger = logging.getLogger(__name__)

# --- THE COMMAND SETS FOR EACH ROLE ---

# Commands for users who are not yet verified or have not chosen a role
DEFAULT_COMMANDS = [
    BotCommand("start", "Start or restart the bot"),
    BotCommand("register", "Create a new account"),
    BotCommand("resendemail", "Resend your verification email"),
    BotCommand("cancel", "Cancel the ongoing action"),
]

# Commands for users who have selected the 'Candidate' role
CANDIDATE_COMMANDS = [
    
    BotCommand("start", "Return to the main menu"),
    BotCommand("viewprofile", "View your candidate profile"),
    BotCommand("updateprofile", "Update your profile details"),
    BotCommand("setlocation", "Update your precise location"),
    BotCommand("setjobpreferences", "Set your job preferences & availability"),
    BotCommand("myapplications", "View your submitted job applications"),
    BotCommand("myjobs", "View your current filled jobs"),
    BotCommand("cancel", "Cancel the ongoing action"),
    
]

# Commands for users who have selected the 'Employer' role
EMPLOYER_COMMANDS = [
    BotCommand("start", "Return to the main menu"),
    BotCommand("viewprofile", "View your employer profile"),
    BotCommand("updateprofile", "Update your profile details"),
    BotCommand("setlocation", "Update your institution's location"),
    BotCommand("newjobpost", "Post a new job vacancy"),
    BotCommand("myjobposts", "View and manage your job posts"),
    BotCommand("myemployees", "View and manage your current employees"),
    BotCommand("cancel", "Cancel the ongoing action"),
]

async def set_user_commands(application: Application, chat_id: int, role: str = None):
    """
    Sets the bot's command menu for a specific user based on their role.
    """
    if role == 'Candidate':
        commands = CANDIDATE_COMMANDS
    elif role == 'Employer':
        commands = EMPLOYER_COMMANDS
    else: # Default for new or unverified users
        commands = DEFAULT_COMMANDS
    
    try:
        # The scope targets this one specific user
        await application.bot.set_my_commands(commands, scope={"type": "chat", "chat_id": chat_id})
        logger.info(f"Set command menu for chat_id {chat_id} to role: {role or 'Default'}")
    except Exception as e:
        logger.error(f"Failed to set command menu for chat_id {chat_id}: {e}")
