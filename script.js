document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const recordBtn = document.getElementById('recordBtn');
    const playBtn = document.getElementById('playBtn');
    const reverseBtn = document.getElementById('reverseBtn');
    const statusText = document.getElementById('statusText');
    const recordBtnText = recordBtn.querySelector('.text');

    // 状态变量
    let mediaRecorder = null;
    let audioChunks = [];
    let audioContext = null;
    let originalBuffer = null;
    let reversedBuffer = null;
    let activeSource = null;
    let isRecording = false;

    // 初始化 AudioContext (解决浏览器自动播放策略限制)
    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    // 录音按钮点击事件
    recordBtn.addEventListener('click', async () => {
        initAudioContext();

        if (!isRecording) {
            // 开始录音
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                startRecording(stream);
            } catch (err) {
                console.error('无法获取麦克风权限:', err);
                statusText.textContent = '无法获取麦克风权限，请检查设置';
                alert('请允许浏览器访问麦克风以使用此功能。');
            }
        } else {
            // 停止录音
            stopRecording();
        }
    });

    function startRecording(stream) {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            // 停止所有轨道
            stream.getTracks().forEach(track => track.stop());
            
            statusText.textContent = '处理录音中...';
            
            // 生成音频 Blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // 或者 'audio/ogg; codecs=opus'
            
            // 解码音频数据
            const arrayBuffer = await audioBlob.arrayBuffer();
            try {
                originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // 准备倒放数据
                reversedBuffer = cloneAndReverseBuffer(originalBuffer);
                
                // 更新 UI 状态
                statusText.textContent = '录音完成';
                playBtn.disabled = false;
                reverseBtn.disabled = false;
            } catch (e) {
                console.error('音频解码失败:', e);
                statusText.textContent = '音频处理失败，请重试';
            }
        };

        mediaRecorder.start();
        isRecording = true;
        
        // 更新 UI
        recordBtn.classList.add('recording');
        recordBtnText.textContent = '停止录音';
        statusText.textContent = '正在录音...';
        playBtn.disabled = true;
        reverseBtn.disabled = true;
        
        // 停止之前的播放
        stopPlayback();
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            
            // 更新 UI
            recordBtn.classList.remove('recording');
            recordBtnText.textContent = '开始录音';
        }
    }

    // 辅助函数：克隆并反转 AudioBuffer
    function cloneAndReverseBuffer(buffer) {
        const numChannels = buffer.numberOfChannels;
        const newBuffer = audioContext.createBuffer(
            numChannels,
            buffer.length,
            buffer.sampleRate
        );

        for (let i = 0; i < numChannels; i++) {
            const channelData = buffer.getChannelData(i);
            const newChannelData = newBuffer.getChannelData(i);
            
            // 反转数据
            for (let j = 0; j < buffer.length; j++) {
                newChannelData[j] = channelData[buffer.length - 1 - j];
            }
        }
        return newBuffer;
    }

    // 播放功能
    function playAudio(buffer, btnElement, actionName) {
        // 如果正在播放，先停止
        stopPlayback();
        
        if (!buffer) return;

        initAudioContext();

        // 创建音频源
        activeSource = audioContext.createBufferSource();
        activeSource.buffer = buffer;
        activeSource.connect(audioContext.destination);
        
        activeSource.onended = () => {
            statusText.textContent = '准备就绪';
            resetButtonState();
        };

        activeSource.start(0);
        
        // 更新 UI
        statusText.textContent = `正在${actionName}...`;
        
        // 视觉反馈：将当前按钮设为“停止”状态，或其他按钮禁用？
        // 简单起见，我们保持按钮可用，点击其他按钮会自动切歌
        // 但为了明确当前状态，我们可以给当前按钮加个高亮或改变文字
        // 这里简单处理：不做复杂的按钮文字变化，因为需求只要求点击即播放
    }

    function stopPlayback() {
        if (activeSource) {
            try {
                activeSource.stop();
            } catch (e) {
                // 忽略可能已经停止的错误
            }
            activeSource = null;
        }
    }

    function resetButtonState() {
        // 可以用来重置按钮样式（如果添加了播放中的特殊样式）
    }

    // 播放按钮事件
    playBtn.addEventListener('click', () => {
        playAudio(originalBuffer, playBtn, '播放');
    });

    // 倒放按钮事件
    reverseBtn.addEventListener('click', () => {
        playAudio(reversedBuffer, reverseBtn, '倒放');
    });

});
