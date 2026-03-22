
import logging
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ConversationHandler, PicklePersistence

from bot.handlers import (
    start, register, received_first_name, received_last_name, received_email,
    confirmed_details,resend_email, choose_role, start_over, cancel,
    nudge, unsupported_content, catch_all_prompt,timeout, update_profile,set_location_start,
    received_profile_for_loc,received_location,set_job_preferences,
    new_job_post,my_job_posts,my_applications,my_employees,my_jobs,view_profile,
    ASKING_FIRST_NAME, ASKING_LAST_NAME, ASKING_EMAIL,
    CONFIRMING_DETAILS, CHOOSING_ROLE,ASKING_WHICH_PROFILE_FOR_LOC,AWAITING_LOCATION
)




def add_handlers(application: Application):
    """
    Takes a bot Application instance and adds all the necessary handlers to it.
    This function is now the single source of truth for our bot's logic.
    """    
    
    # Ensure that the bot is running only in a private conversation
    private_only = filters.ChatType.PRIVATE

    # A conversation for the multi-step registration process
    conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler("start", start, filters=private_only),
            CommandHandler("register", register, filters= private_only)
        ],
        states={
            # State for existing users after they /start 
            CHOOSING_ROLE: [MessageHandler(private_only & filters.Regex("^(I'm looking for a Job|I'm hiring)$"), choose_role),
                            MessageHandler(private_only & filters.TEXT & ~filters.COMMAND, nudge), # Catches wrong text
                            ],
            
            # All the states for the new user registration flow
            ASKING_FIRST_NAME: [MessageHandler(private_only & filters.TEXT & ~filters.COMMAND, received_first_name)
                                ],
            
            ASKING_LAST_NAME: [MessageHandler(private_only & filters.TEXT & ~filters.COMMAND, received_last_name),
                               ],
            
            ASKING_EMAIL: [MessageHandler(private_only & filters.TEXT & ~filters.COMMAND, received_email),
                           ],
            
            CONFIRMING_DETAILS: [
                MessageHandler(private_only & filters.Regex("^Confirm$"), confirmed_details),
                MessageHandler(private_only & filters.Regex("^Start Over$"), start_over),
                MessageHandler(private_only & filters.ALL &~filters.COMMAND, nudge) # Catches wrong text                
            ],
            # Handling Timeout
            ConversationHandler.TIMEOUT: [MessageHandler(filters.ALL, timeout)]
        },
        fallbacks=[CommandHandler("cancel", cancel,filters=private_only)],
        
        conversation_timeout=600, # Conversation Times out after 10 mins
        # This allows a user to start a new conversation even if they are in the middle of another one
        allow_reentry=True,
        persistent=True,
        name="main_conversation" 
    )
    
    # Set Location Handler
    set_location_handler = ConversationHandler(
        entry_points=[CommandHandler("setlocation", set_location_start, filters=private_only)],
        states={
            ASKING_WHICH_PROFILE_FOR_LOC: [
                MessageHandler(
                    private_only & filters.Regex("^(Location for Candidate Profile|Location for Employer Profile)$"),
                    received_profile_for_loc
                )
            ],
            AWAITING_LOCATION: [
                MessageHandler(private_only & filters.LOCATION, received_location)
            ],
            ConversationHandler.TIMEOUT: [MessageHandler(filters.ALL, timeout)]
        },
        fallbacks=[CommandHandler("cancel", cancel, filters=private_only)],
        conversation_timeout=300, # 5 minute timeout
        persistent=True,
        name="set_location_conversation"
    )
    

    # Add the handler to the application
    application.add_handler(conv_handler)
    
    # --- Command Handler for /resendemail ---
    application.add_handler(CommandHandler("resendemail", resend_email, filters=private_only))
    
    # Add Location Handler
    application.add_handler(set_location_handler)
    
    # --- Command handler for /updateprofile ---
    application.add_handler(CommandHandler("updateprofile", update_profile, filters=private_only))
    
    
    # --- Command handler for /viewprofile
    application.add_handler(CommandHandler("viewprofile", view_profile, filters=private_only))
    
    
    # --- Command handler for /setjobpreferences ---
    application.add_handler(CommandHandler("setjobpreferences", set_job_preferences, filters=private_only))
    
    
    # --- Command Handler for /newjobpost
    application.add_handler(CommandHandler("newjobpost", new_job_post, filters=private_only))
    
    # --- Command Handler for /myjobposts
    application.add_handler(CommandHandler("myjobposts", my_job_posts, filters=private_only))
    
    # --- Command Handler for /myapplications
    application.add_handler(CommandHandler("myapplications", my_applications, filters=private_only))
    
    # --- Command Handler for /myemployees
    application.add_handler(CommandHandler("myemployees", my_employees, filters=private_only))
    
    # --- Command Handler for /myjobs
    application.add_handler(CommandHandler("myjobs", my_jobs, filters=private_only))
    
    # Add a global handler for any message that is NOT part of a conversation.
    # The ~filters.COMMAND ensures it doesn't accidentally override any commands.
    application.add_handler(MessageHandler(private_only & filters.TEXT & ~filters.COMMAND, catch_all_prompt))
    
    # Add a global handler for any non-text, non-command content
    application.add_handler(MessageHandler(private_only & ~filters.TEXT & ~filters.COMMAND, unsupported_content))


