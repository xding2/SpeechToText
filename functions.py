import os
import datetime

def save_transcript(transcript, language, timestamp):
    """
    Save the transcript to a file
    
    Args:
        transcript (str): The text transcript
        language (str): The language code
        timestamp (str): The timestamp when the recording was made
    
    Returns:
        bool: True if saved successfully, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        if not os.path.exists('transcripts'):
            os.makedirs('transcripts')
        
        # Format current time if timestamp not provided
        if not timestamp:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create filename with timestamp and language
        filename = f"transcripts/transcript_{timestamp}_{language}.txt"
        
        # Write transcript to file
        with open(filename, "w", encoding="utf-8") as f:
            f.write(transcript)
        
        return True
    except Exception as e:
        print(f"Error saving transcript: {e}")
        return False