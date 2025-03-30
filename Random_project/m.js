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

// Start recording
startBtn.addEventListener('click', async () => {
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream);

        // When data is available, push it into the audioChunks array
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        // When recording stops, process the audio
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

            // Reset audioChunks to delete original audio
            audioChunks = [];

            // Create an AudioContext for processing the audio
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Convert audio blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();

            // Decode the array buffer to get an audio buffer
            audioContext.decodeAudioData(arrayBuffer, (buffer) => {
                // Create an OfflineAudioContext based on the length of the recorded audio
                offlineAudioContext = new OfflineAudioContext(
                    buffer.numberOfChannels,
                    buffer.length,
                    audioContext.sampleRate
                );

                // Apply chipmunk effect by changing playback rate
                const source = offlineAudioContext.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.value = 1.5; // Increase this for more chipmunk effect
                source.connect(offlineAudioContext.destination);
                source.start(0);

                // Start rendering the audio
                offlineAudioContext.startRendering().then(renderedBuffer => {
                    // Create a blob from the rendered audio
                    processedAudioBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
                    const audioURL = URL.createObjectURL(processedAudioBlob);

                    // Set the processed audio as the source for the audio player
                    audioPlayer.src = audioURL;

                    // Enable the save button
                    saveBtn.disabled = false;
                }).catch(err => {
                    console.error("Error rendering audio:", err);
                });
            }, (err) => {
                console.error("Error decoding audio data:", err);
            });
        };

        // Start recording
        mediaRecorder.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Failed to access microphone. Please check your permissions and try again.");
    }
});

// Stop recording
stopBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

// Save the processed audio as a downloadable file
saveBtn.addEventListener('click', () => {
    if (processedAudioBlob) {
        const url = URL.createObjectURL(processedAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chipmunk_audio.wav'; // Name the file
        a.click();
        URL.revokeObjectURL(url);
    }
});

// Function to convert AudioBuffer to WAV format
function bufferToWave(audioBuffer, length) {
    const numOfChannels = audioBuffer.numberOfChannels;
    const buffer = new ArrayBuffer(44 + length * 2); // WAV header + audio data
    const view = new DataView(buffer);

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // Mono audio
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numOfChannels * 2, true); // byte rate
    view.setUint16(32, numOfChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, length * 2, true);

    // Write the audio data
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

// Helper function to write strings into DataView
function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
