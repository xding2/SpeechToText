from flask import Flask, render_template, jsonify, request
import functions
import os

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/save_transcript', methods=['POST'])
def save_transcript():
    data = request.get_json()
    transcript = data.get('transcript', '')
    language = data.get('language', 'en-US')
    timestamp = data.get('timestamp', '')
    
    success = functions.save_transcript(transcript, language, timestamp)
    
    return jsonify({"success": success})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))