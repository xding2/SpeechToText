// DOM Elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const languageSelect = document.getElementById('language');
const audioSourceSelect = document.getElementById('audioSource');
const transcriptDiv = document.getElementById('transcript');
const interimDiv = document.getElementById('interim');
const statusSpan = document.getElementById('status');
const recordTimeDiv = document.getElementById('recordTime');
const wordCountSpan = document.getElementById('wordCount');
const charCountSpan = document.getElementById('charCount');

// Variables
let recognition;
let isRecording = false;
let isPaused = false;
let recordStartTime;
let recordTimer;
let finalTranscript = '';
let interimTranscript = '';

// Check browser support for SpeechRecognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

// Check if browser supports SpeechRecognition
if (!SpeechRecognition) {
    alert('您的浏览器不支持语音识别功能。请使用Chrome、Edge或Safari浏览器。');
    startBtn.disabled = true;
}

// Check if browser supports system audio capture
if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    const systemOption = document.querySelector('#audioSource option[value="system"]');
    if (systemOption) {
        systemOption.disabled = true;
        systemOption.textContent += ' (浏览器不支持)';
    }
}

// Initialize SpeechRecognition
function initRecognition() {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = languageSelect.value;
    
    recognition.onstart = function() {
        isRecording = true;
        isPaused = false;
        updateUI();
        statusSpan.textContent = '正在录音...';
        
        // Start record timer
        recordStartTime = new Date();
        updateRecordTime();
        recordTimer = setInterval(updateRecordTime, 1000);
    };
    
    // 设置结果处理函数
    updateRecognitionHandlers();
    
    recognition.onerror = function(event) {
        console.error('Speech recognition error', event.error);
        if (event.error === 'no-speech') {
            statusSpan.textContent = '未检测到语音，请说话';
        } else {
            statusSpan.textContent = '错误: ' + event.error;
        }
    };
    
    recognition.onend = function() {
        if (isRecording && !isPaused) {
            // If still recording and not paused, restart recognition
            // This helps with the continuous listening
            recognition.start();
        } else if (isPaused) {
            statusSpan.textContent = '已暂停';
        } else {
            statusSpan.textContent = '已停止';
            clearInterval(recordTimer);
        }
    };
}

// 语音片段暂存和处理
let currentUtterance = '';
let utterances = [];
let lastEndTime = 0;
let currentSpeaker = 1;

// Format transcript with improved speaker detection
function formatTranscript(text) {
    if (!text) return '';
    
    // 如果我们正在使用基于时间的分段
    if (document.getElementById('speakerDetection')?.value === 'time' && utterances.length > 0) {
        return formatTranscriptFromUtterances();
    }
    
    // 简单格式化，不尝试检测说话者
    if (document.getElementById('speakerDetection')?.value === 'off') {
        return text.replace(/\n/g, '<br>');
    }
    
    // 否则使用基于关键词的方法，但更保守
    let formattedText = text;
    
    // 定义一些强分隔符模式（这些是非常明显的说话者转换标志）
    // 只在这些地方分隔，减少错误分割同一个说话者
    const strongSeparatorPatterns = [
        /([.!?])\s+(oh|so|well|yes|no|hello|hi|hey|okay|thank you|alright|sorry|excuse me)\s+/i,  // 句号后跟特定词汇
        /([.!?])\s+([A-Z][a-z]+)\s+/,  // 句号后跟大写单词（新句子）
        /\?\s+([A-Z][a-z]+)/,  // 问号后跟大写字母开头的单词
        /\.\s+([A-Z][a-z]+)/,  // 句号后跟大写字母开头的单词
        /\s+okay\s+so\s+/i,    // "okay so" 通常表示转换
        /\s+right\s+so\s+/i,   // "right so" 通常表示转换
        /\s+thank\s+you[.!]\s+/i,  // "thank you"后跟终止符
        /\s+yes[.!]\s+/i,      // "yes"后跟终止符
        /\s+no[.!]\s+/i,       // "no"后跟终止符
    ];
    
    // 应用强分隔符模式
    strongSeparatorPatterns.forEach(pattern => {
        formattedText = formattedText.replace(pattern, (match, p1, p2) => {
            // 切换说话者
            currentSpeaker = currentSpeaker === 1 ? 2 : 1;
            if (p1 && p2) {
                return `${p1} </span><br><span class="speaker-${currentSpeaker}">${p2} `;
            } else {
                return ` </span><br><span class="speaker-${currentSpeaker}"> `;
            }
        });
    });
    
    // 确保有开始的span标签
    if (!formattedText.startsWith('<span')) {
        formattedText = `<span class="speaker-1">${formattedText}`;
    }
    
    // 确保有结束的span标签
    if (!formattedText.endsWith('</span>')) {
        formattedText += '</span>';
    }
    
    return formattedText;
}

// 基于语音停顿采集完整语句
function processUtterance(text, isFinal, timestamp) {
    // 当前时间
    const now = timestamp || new Date().getTime();
    
    // 如果这是最终结果，添加到当前语句
    if (isFinal) {
        currentUtterance += text + ' ';
        
        // 检查上次语音结束和这次开始之间的时间间隔
        const speechGap = now - lastEndTime;
        
        // 获取暂停阈值（如果有UI设置）
        let pauseThreshold = 2000; // 默认值更大一些，减少错误分割
        const pauseThresholdElement = document.getElementById('pauseThreshold');
        if (pauseThresholdElement) {
            pauseThreshold = parseInt(pauseThresholdElement.value, 10);
        }
        
        // 如果有明显的停顿，或者存在强终止符（句号、问号等）
        const hasEndPunctuation = /[.!?]\s*$/.test(currentUtterance.trim());
        const hasCompleteSentence = currentUtterance.length > 50 || hasEndPunctuation;
        
        if ((speechGap > pauseThreshold && lastEndTime > 0) || hasCompleteSentence) {
            // 存储当前完整语句
            if (currentUtterance.trim()) {
                // 检查是否是说话者转换的迹象
                let speakerChanged = false;
                
                // 如果前一个语句以问号结束，这个可能是另一个说话者的回答
                if (utterances.length > 0) {
                    const prevUtterance = utterances[utterances.length - 1].text;
                    if (prevUtterance.trim().endsWith('?')) {
                        speakerChanged = true;
                    }
                    
                    // 检查常见的回应词开头，可能暗示说话者改变
                    const responseStarters = ['yes', 'no', 'okay', 'right', 'sure', 'well', 'actually', 'yeah'];
                    const firstWord = currentUtterance.trim().split(' ')[0].toLowerCase();
                    if (responseStarters.includes(firstWord)) {
                        speakerChanged = true;
                    }
                }
                
                // 如果检测到说话者变化或者有大的时间间隔
                if (speakerChanged || speechGap > pauseThreshold * 1.5) {
                    currentSpeaker = currentSpeaker === 1 ? 2 : 1;
                }
                
                // 存储语句
                utterances.push({
                    text: currentUtterance.trim(),
                    speaker: currentSpeaker,
                    startTime: lastEndTime || now - 1000,
                    endTime: now,
                    gap: speechGap
                });
                
                // 重置当前语句
                currentUtterance = '';
            }
        }
        
        lastEndTime = now;
    }
}

// 基于完整语句重新格式化转录文本
function formatTranscriptFromUtterances() {
    if (utterances.length === 0) return '';
    
    let formattedText = '';
    let lastSpeaker = null;
    
    utterances.forEach(utterance => {
        // 如果说话者改变，添加换行
        if (lastSpeaker !== null && lastSpeaker !== utterance.speaker) {
            formattedText += '</span><br><span class="speaker-' + utterance.speaker + '">';
        } else if (lastSpeaker === null) {
            // 第一句话
            formattedText += '<span class="speaker-' + utterance.speaker + '">';
        }
        
        formattedText += utterance.text + ' ';
        lastSpeaker = utterance.speaker;
    });
    
    // 确保闭合最后一个span标签
    if (formattedText && !formattedText.endsWith('</span>')) {
        formattedText += '</span>';
    }
    
    return formattedText;
}

// 更新recognition.onresult处理器
function updateRecognitionHandlers() {
    recognition.onresult = function(event) {
        interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const newText = event.results[i][0].transcript + ' ';
                finalTranscript += newText;
                // 处理完整语句
                processUtterance(newText, true, new Date().getTime());
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        // 更新转录文本
        transcriptDiv.innerHTML = formatTranscript(finalTranscript);
        interimDiv.textContent = interimTranscript;
        
        // 更新统计
        updateStats();
    };
}

// Update record time display
function updateRecordTime() {
    if (!recordStartTime) return;
    
    const now = new Date();
    const diff = now - recordStartTime;
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    recordTimeDiv.textContent = 
        (hours < 10 ? '0' : '') + hours + ':' +
        (minutes < 10 ? '0' : '') + minutes + ':' +
        (seconds < 10 ? '0' : '') + seconds;
}

// Update word and character count
function updateStats() {
    const text = transcriptDiv.textContent || '';
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const charCount = text.length;
    
    wordCountSpan.textContent = wordCount + ' 词';
    charCountSpan.textContent = charCount + ' 字符';
}

// Update UI based on state
function updateUI() {
    startBtn.disabled = isRecording && !isPaused;
    pauseBtn.disabled = !isRecording || isPaused;
    stopBtn.disabled = !isRecording;
    
    if (isRecording) {
        startBtn.innerHTML = '<i class="fas fa-play"></i> 继续录音';
    } else {
        startBtn.innerHTML = '<i class="fas fa-play"></i> 开始录音';
    }
    
    if (isPaused) {
        pauseBtn.innerHTML = '<i class="fas fa-play"></i> 继续';
    } else {
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
    }
}

// Start audio capture based on selected source
async function startAudioCapture() {
    const source = audioSourceSelect.value;
    
    // 如果已经在录音并且清除了文本，我们需要确保真正重新开始
    if (isRecording) {
        if (recognition) {
            recognition.stop();
        }
        // 等待一小段时间确保停止完成
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 重置关键变量，确保真正开始新的会话
    finalTranscript = '';
    interimTranscript = '';
    currentUtterance = '';
    utterances = [];
    currentSpeaker = 1;
    lastEndTime = 0;
    
    if (source === 'microphone') {
        // Microphone is handled by the SpeechRecognition API
        initRecognition();
        recognition.start();
    } else if (source === 'system') {
        try {
            // Request system audio
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: false,
                audio: true
            });
            
            // Check if we actually got audio tracks
            if (stream.getAudioTracks().length === 0) {
                throw new Error('未能获取系统音频');
            }
            
            // Use MediaRecorder to capture system audio
            // This would require additional processing to convert to text
            // For now, we'll just show a message that this is a premium feature
            alert('系统音频捕获需要高级语音识别功能。当前演示版本仅支持麦克风输入。');
            
            // Stop the stream we just created
            stream.getTracks().forEach(track => track.stop());
            
            // Fall back to microphone for demo purposes
            audioSourceSelect.value = 'microphone';
            initRecognition();
            recognition.start();
        } catch (error) {
            console.error('Error capturing system audio:', error);
            alert('无法捕获系统音频: ' + error.message);
            statusSpan.textContent = '音频捕获失败';
        }
    }
}

// Event Listeners
startBtn.addEventListener('click', function() {
    if (!isRecording || isPaused) {
        if (isPaused) {
            // Resume
            isPaused = false;
            recognition.start();
            updateUI();
        } else {
            // Start new recording
            // 不再使用之前的文本，而是重新开始
            startAudioCapture();
        }
    }
});

pauseBtn.addEventListener('click', function() {
    if (isRecording && !isPaused) {
        isPaused = true;
        recognition.stop();
        updateUI();
    }
});

stopBtn.addEventListener('click', function() {
    if (isRecording) {
        isRecording = false;
        isPaused = false;
        if (recognition) {
            recognition.stop();
        }
        clearInterval(recordTimer);
        updateUI();
        statusSpan.textContent = '已完成';
    }
});

// 清除按钮处理事件
clearBtn.addEventListener('click', function() {
    if (confirm('确定要清除所有文本吗？')) {
        // 清除所有文本和相关变量
        finalTranscript = '';
        interimTranscript = '';
        currentUtterance = '';
        utterances = [];
        currentSpeaker = 1;
        lastEndTime = 0;
        
        // 清除DOM元素中的内容
        transcriptDiv.innerHTML = '';
        interimDiv.textContent = '';
        
        // 重置计时器
        if (recordStartTime) {
            recordStartTime = new Date();
            updateRecordTime();
        }
        
        // 更新统计
        updateStats();
        
        statusSpan.textContent = '已清除文本';
    }
});

copyBtn.addEventListener('click', function() {
    const text = transcriptDiv.innerText;
    navigator.clipboard.writeText(text).then(
        function() {
            alert('文本已复制到剪贴板');
        },
        function(err) {
            console.error('无法复制文本: ', err);
            alert('复制失败，请手动选择并复制文本');
        }
    );
});

saveBtn.addEventListener('click', function() {
    const text = transcriptDiv.innerText;
    const language = languageSelect.value;
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
    
    // Send to server
    fetch('/save_transcript', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            transcript: text,
            language: language,
            timestamp: timestamp
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('文本已保存');
        } else {
            alert('保存失败，请重试');
        }
    })
    .catch(error => {
        console.error('Error saving transcript:', error);
        alert('保存过程中发生错误');
    });
    
    // Also offer download as a file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `transcript_${timestamp}_${language}.txt`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
});

languageSelect.addEventListener('change', function() {
    if (recognition) {
        const wasRecording = isRecording;
        const wasPaused = isPaused;
        
        // Stop current recognition
        recognition.stop();
        
        // Restart with new language if it was active
        if (wasRecording && !wasPaused) {
            setTimeout(() => {
                initRecognition();
                recognition.start();
            }, 100);
        }
    }
});

// Toggle info panel
function toggleInfo() {
    const infoContent = document.getElementById('infoContent');
    if (infoContent.style.display === 'block') {
        infoContent.style.display = 'none';
    } else {
        infoContent.style.display = 'block';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set default language based on browser language
    const browserLang = navigator.language || navigator.userLanguage;
    const selectOptions = Array.from(languageSelect.options).map(opt => opt.value);
    
    // Try to match browser language with available options
    if (selectOptions.includes(browserLang)) {
        languageSelect.value = browserLang;
    } else {
        // Try to match just the primary language part (e.g., 'en' from 'en-US')
        const primaryLang = browserLang.split('-')[0];
        const matchingOption = selectOptions.find(opt => opt.startsWith(primaryLang + '-'));
        if (matchingOption) {
            languageSelect.value = matchingOption;
        }
    }
    
    // Add speaker detection settings
    addSpeakerDetectionSettings();
    
    // Update UI
    updateUI();
    updateStats();
});

// Add speaker detection options to the settings
function addSpeakerDetectionSettings() {
    // Create speaker settings section
    const controlPanel = document.querySelector('.control-panel');
    
    // Create speaker detection toggle
    const speakerDetectionDiv = document.createElement('div');
    speakerDetectionDiv.className = 'speaker-detection';
    speakerDetectionDiv.innerHTML = `
        <label for="speakerDetection">说话者识别:</label>
        <select id="speakerDetection">
            <option value="auto">关键词+时间间隔</option>
            <option value="time">仅按时间间隔</option>
            <option value="off">关闭</option>
        </select>
        
        <div class="pause-threshold">
            <label for="pauseThreshold">停顿阈值 (毫秒):</label>
            <input type="range" id="pauseThreshold" min="500" max="3000" step="100" value="1500">
            <span id="pauseThresholdValue">1500</span>
        </div>
    `;
    
    // Insert before buttons
    const buttonsDiv = document.querySelector('.buttons');
    controlPanel.insertBefore(speakerDetectionDiv, buttonsDiv);
    
    // Add event listener for pause threshold slider
    document.getElementById('pauseThreshold').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('pauseThresholdValue').textContent = value;
    });
    
    // Add event listener for speaker detection method change
    document.getElementById('speakerDetection').addEventListener('change', function() {
        if (this.value === 'time') {
            document.querySelector('.pause-threshold').style.display = 'block';
        } else {
            document.querySelector('.pause-threshold').style.display = 'none';
        }
    });
}