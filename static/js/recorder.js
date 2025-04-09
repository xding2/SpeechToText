// static/js/recorder.js
// 这个文件提供录音功能的额外支持，处理不同浏览器的兼容性问题

class AudioRecorder {
    constructor(options = {}) {
        this.options = {
            mimeType: 'audio/webm',
            audioBitsPerSecond: 128000,
            ...options
        };
        
        this.mediaRecorder = null;
        this.stream = null;
        this.chunks = [];
        this.isRecording = false;
        this.onDataAvailable = null;
        this.onStop = null;
        this.onError = null;
    }

    // 获取支持的媒体类型
    static getSupportedMimeTypes() {
        const types = [
            'audio/webm', 
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/ogg',
            'audio/ogg;codecs=opus',
            'audio/wav'
        ];
        
        return types.filter(type => MediaRecorder.isTypeSupported(type));
    }

    // 获取最佳MIME类型
    static getBestMimeType() {
        const types = AudioRecorder.getSupportedMimeTypes();
        return types.length > 0 ? types[0] : 'audio/webm';
    }

    // 开始录音
    async start(constraints = { audio: true, video: false }) {
        if (this.isRecording) {
            throw new Error('录音已经在进行中');
        }

        try {
            // 请求媒体权限
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // 创建MediaRecorder实例
            const options = {
                mimeType: this.options.mimeType || AudioRecorder.getBestMimeType(),
                audioBitsPerSecond: this.options.audioBitsPerSecond
            };
            
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            
            // 设置事件处理器
            this.chunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                }
                
                if (typeof this.onDataAvailable === 'function') {
                    this.onDataAvailable(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
                
                if (typeof this.onStop === 'function') {
                    this.onStop(blob);
                }
                
                this.isRecording = false;
                this.releaseStream();
            };
            
            this.mediaRecorder.onerror = (event) => {
                if (typeof this.onError === 'function') {
                    this.onError(event.error);
                }
            };
            
            // 开始录音
            this.mediaRecorder.start(100); // 每100毫秒获取一次数据
            this.isRecording = true;
            
            return true;
        } catch (error) {
            if (typeof this.onError === 'function') {
                this.onError(error);
            }
            return false;
        }
    }

    // 停止录音
    stop() {
        if (!this.isRecording || !this.mediaRecorder) {
            return false;
        }
        
        this.mediaRecorder.stop();
        return true;
    }

    // 暂停录音
    pause() {
        if (!this.isRecording || !this.mediaRecorder) {
            return false;
        }
        
        if (this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            return true;
        }
        
        return false;
    }

    // 恢复录音
    resume() {
        if (!this.isRecording || !this.mediaRecorder) {
            return false;
        }
        
        if (this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            return true;
        }
        
        return false;
    }

    // 释放媒体流
    releaseStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    // 捕获系统音频（实验性功能，需要浏览器支持）
    async captureSystemAudio() {
        if (this.isRecording) {
            throw new Error('录音已经在进行中');
        }
        
        try {
            // 请求屏幕共享，包括系统音频
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            // 检查是否有音频轨道
            const audioTracks = this.stream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('没有找到音频轨道，可能需要选择"共享系统音频"选项');
            }
            
            // 创建仅包含音频的流
            const audioStream = new MediaStream([audioTracks[0]]);
            
            // 创建MediaRecorder实例
            const options = {
                mimeType: this.options.mimeType || AudioRecorder.getBestMimeType(),
                audioBitsPerSecond: this.options.audioBitsPerSecond
            };
            
            this.mediaRecorder = new MediaRecorder(audioStream, options);
            
            // 设置事件处理器
            this.chunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                }
                
                if (typeof this.onDataAvailable === 'function') {
                    this.onDataAvailable(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
                
                if (typeof this.onStop === 'function') {
                    this.onStop(blob);
                }
                
                this.isRecording = false;
                this.releaseStream();
            };
            
            this.mediaRecorder.onerror = (event) => {
                if (typeof this.onError === 'function') {
                    this.onError(event.error);
                }
            };
            
            // 开始录音
            this.mediaRecorder.start(100); // 每100毫秒获取一次数据
            this.isRecording = true;
            
            return true;
        } catch (error) {
            if (typeof this.onError === 'function') {
                this.onError(error);
            }
            return false;
        }
    }
}

// 导出AudioRecorder类
window.AudioRecorder = AudioRecorder;