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
        # 尝试在当前工作目录创建transcripts文件夹
        transcripts_dir = os.path.join(os.getcwd(), 'transcripts')
        if not os.path.exists(transcripts_dir):
            os.makedirs(transcripts_dir)
        
        # 如果上面失败，尝试在/tmp目录创建（Render通常允许写入这个目录）
        if not os.path.exists(transcripts_dir):
            transcripts_dir = "/tmp/transcripts"
            if not os.path.exists(transcripts_dir):
                os.makedirs(transcripts_dir)
        
        # Format current time if timestamp not provided
        if not timestamp:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create filename with timestamp and language
        filename = os.path.join(transcripts_dir, f"transcript_{timestamp}_{language}.txt")
        
        # Write transcript to file
        with open(filename, "w", encoding="utf-8") as f:
            f.write(transcript)
        
        return True
    except Exception as e:
        print(f"Error saving transcript: {e}")
        return False