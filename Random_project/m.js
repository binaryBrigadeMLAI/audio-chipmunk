'use strict';
let mediaRecorder;
let audioChunks = [];
let audioContext;
let offlineAudioContext;
let startBtn = document.getElementById('startBtn');
let stopBtn = document.getElementById('stopBtn');
let saveBtn = document.getElementById('saveBtn');
let audioPlayer = document.getElementById('audioPlayer');
let processedAudioBlob = null;

startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

            audioChunks = [];

            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            const arrayBuffer = await audioBlob.arrayBuffer();

            audioContext.decodeAudioData(arrayBuffer, (buffer) => {
                offlineAudioContext = new OfflineAudioContext(
                    buffer.numberOfChannels,
                    buffer.length,
                    audioContext.sampleRate
                );

                const source = offlineAudioContext.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.value = 1.5; 
                source.connect(offlineAudioContext.destination);
                source.start(0);

                offlineAudioContext.startRendering().then(renderedBuffer => {
                    processedAudioBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
                    const audioURL = URL.createObjectURL(processedAudioBlob);

                    audioPlayer.src = audioURL;

                    saveBtn.disabled = false;
                }).catch(err => {
                    console.error("Error rendering audio:", err);
                });
            }, (err) => {
                console.error("Error decoding audio data:", err);
            });
        };

        mediaRecorder.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Failed to access microphone. Please check your permissions and try again.");
    }
});

stopBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

saveBtn.addEventListener('click', () => {
    if (processedAudioBlob) {
        const url = URL.createObjectURL(processedAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chipmunk_audio.wav';
        a.click();
        URL.revokeObjectURL(url);
    }
});

function bufferToWave(audioBuffer, length) {
    const numOfChannels = audioBuffer.numberOfChannels;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numOfChannels * 2, true); 
    view.setUint16(32, numOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let channel = 0; channel < numOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let sampleIndex = 0; sampleIndex < length; sampleIndex++) {
            const sample = Math.max(-1, Math.min(1, channelData[sampleIndex]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
