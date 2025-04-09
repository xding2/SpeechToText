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
    # 使用环境变量中的端口，如果没有则默认为5000
    port = int(os.environ.get("PORT", 5000))
    # 监听所有IP
    app.run(host='0.0.0.0', port=port)