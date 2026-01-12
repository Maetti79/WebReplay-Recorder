// Recording Control Script
console.log('[RecordingControl] Script loaded');

let replayTabId = null;
let recordingId = null;
let videoConfig = null;
let storyboard = null;

// UI elements
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const replayInfoEl = document.getElementById('replayInfo');
const closeBtn = document.getElementById('closeBtn');

// Recording state
let mediaRecorder = null;
let mediaStream = null;
let videoChunks = [];

// Get configuration from URL parameters
function loadConfig() {
  const params = new URLSearchParams(window.location.search);
  replayTabId = parseInt(params.get('replayTabId'));
  recordingId = params.get('recordingId');

  console.log('[RecordingControl] Config loaded:');
  console.log('  Replay Tab ID:', replayTabId);
  console.log('  Recording ID:', recordingId);

  if (!replayTabId) {
    showStatus('❌ Error: No replay tab ID provided', 'error');
    startBtn.disabled = true;
    return false;
  }

  return true;
}

// Show status message
function showStatus(message, type = 'info') {
  console.log('[RecordingControl] Status:', message);
  statusEl.textContent = message;
  statusEl.className = 'status show';

  if (type === 'error') {
    statusEl.classList.add('error');
  } else if (type === 'success') {
    statusEl.classList.add('success');
  }
}

// Update replay info display
function updateReplayInfo() {
  if (storyboard) {
    document.getElementById('recordingId').textContent = recordingId || 'N/A';
    document.getElementById('eventCount').textContent = storyboard.timeline?.length || 0;

    const subtitleCount = storyboard.subtitles?.length || 0;
    const voiceoverCount = storyboard.subtitles?.filter(s => s.voiceover?.audioBase64).length || 0;
    document.getElementById('subtitleCount').textContent = subtitleCount > 0 ?
      `${subtitleCount} (${voiceoverCount} with voiceover)` : '0';

    document.getElementById('quality').textContent = videoConfig ?
      `${videoConfig.width}x${videoConfig.height}` : '1280x720';
    replayInfoEl.classList.add('show');
  }
}

// Start recording
async function startRecording() {
  try {
    console.log('[RecordingControl] Starting recording process...');
    showStatus('📹 Please select the replay tab in the screen picker...', 'info');

    // Request screen capture with audio
    console.log('[RecordingControl] Requesting getDisplayMedia() with audio...');
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        width: { ideal: videoConfig?.width || 1280 },
        height: { ideal: videoConfig?.height || 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100
      },
      preferCurrentTab: false // Don't prefer current tab, user needs to select replay tab
    });

    console.log('[RecordingControl] ✅ Got media stream');
    console.log('[RecordingControl] Stream tracks:', mediaStream.getTracks().map(t => ({
      kind: t.kind,
      label: t.label
    })));

    // Setup MediaRecorder
    const options = {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log('[RecordingControl] VP9 not supported, using VP8');
      options.mimeType = 'video/webm;codecs=vp8';
    }

    mediaRecorder = new MediaRecorder(mediaStream, options);
    videoChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        videoChunks.push(event.data);
        const totalSize = videoChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log('[RecordingControl] Video chunk #' + videoChunks.length + ':',
          event.data.size, 'bytes, total:', totalSize, 'bytes');
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[RecordingControl] MediaRecorder stopped');
      const totalSize = videoChunks.reduce((sum, chunk) => sum + chunk.size, 0);
      console.log('[RecordingControl] Total chunks:', videoChunks.length, 'Total size:', totalSize, 'bytes');

      mediaStream.getTracks().forEach(track => track.stop());

      if (videoChunks.length === 0) {
        showStatus('❌ No video data recorded', 'error');
        return;
      }

      await downloadVideo();
    };

    mediaRecorder.onerror = (error) => {
      console.error('[RecordingControl] MediaRecorder error:', error);
      showStatus('❌ Recording error: ' + error, 'error');
    };

    mediaRecorder.onstart = () => {
      console.log('[RecordingControl] MediaRecorder started');
    };

    // Start recording
    console.log('[RecordingControl] Starting MediaRecorder...');
    mediaRecorder.start(1000);

    showStatus('🔴 Recording started! Replay is running...', 'success');
    startBtn.textContent = '🔴 Recording...';
    startBtn.classList.add('recording');
    startBtn.disabled = true;

    // Send message to replay tab to start replay
    console.log('[RecordingControl] Sending start message to replay tab:', replayTabId);
    console.log('[RecordingControl] Storyboard has', storyboard?.subtitles?.length || 0, 'subtitles');
    if (storyboard?.subtitles?.length > 0) {
      console.log('[RecordingControl] First subtitle:', storyboard.subtitles[0]);
      const withVoiceover = storyboard.subtitles.filter(s => s.voiceover).length;
      const withBase64Audio = storyboard.subtitles.filter(s => s.voiceover?.audioBase64).length;
      console.log('[RecordingControl] Subtitles with voiceover:', withVoiceover);
      console.log('[RecordingControl] Subtitles with base64 audio:', withBase64Audio);

      if (withBase64Audio > 0) {
        const firstWithAudio = storyboard.subtitles.find(s => s.voiceover?.audioBase64);
        if (firstWithAudio) {
          console.log('[RecordingControl] First base64 audio length:', firstWithAudio.voiceover.audioBase64.length, 'chars');
          console.log('[RecordingControl] First base64 audio type:', firstWithAudio.voiceover.audioType);
        }
      }
    }

    chrome.tabs.sendMessage(replayTabId, {
      type: 'START_TAB_REPLAY',
      storyboard: storyboard, // Contains audioBase64 instead of audioBlob
      speed: 1,
      recordingMode: false // Normal replay, not in-tab recording
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[RecordingControl] Error sending start message:', chrome.runtime.lastError);
      } else {
        console.log('[RecordingControl] Replay started successfully');
      }
    });

  } catch (error) {
    console.error('[RecordingControl] Failed to start recording:', error);
    showStatus('❌ Failed to start recording: ' + error.message, 'error');
    startBtn.disabled = false;
  }
}

// Stop recording
function stopRecording() {
  console.log('[RecordingControl] ========================================');
  console.log('[RecordingControl] stopRecording() called');
  console.log('[RecordingControl] ========================================');
  console.log('[RecordingControl] MediaRecorder exists:', !!mediaRecorder);
  console.log('[RecordingControl] MediaRecorder state:', mediaRecorder?.state);
  console.log('[RecordingControl] Video chunks collected:', videoChunks?.length);
  console.log('[RecordingControl] MediaStream exists:', !!mediaStream);
  console.log('[RecordingControl] MediaStream active:', mediaStream?.active);

  showStatus('⏳ Processing video...', 'info');

  if (!mediaRecorder) {
    console.error('[RecordingControl] No mediaRecorder found!');
    showStatus('❌ No recording in progress', 'error');
    return;
  }

  if (mediaRecorder.state === 'inactive') {
    console.warn('[RecordingControl] MediaRecorder already inactive');
    showStatus('⚠️ Recording already stopped', 'error');
    return;
  }

  console.log('[RecordingControl] Requesting final data...');
  mediaRecorder.requestData();

  console.log('[RecordingControl] Waiting 500ms before stopping...');
  setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      console.log('[RecordingControl] Calling mediaRecorder.stop()...');
      mediaRecorder.stop();
      console.log('[RecordingControl] mediaRecorder.stop() called, new state:', mediaRecorder.state);
    } else {
      console.log('[RecordingControl] MediaRecorder became inactive before timeout');
    }
  }, 500);
}

// Download video
async function downloadVideo() {
  console.log('[RecordingControl] Creating video blob...');
  const blob = new Blob(videoChunks, { type: 'video/webm' });
  console.log('[RecordingControl] Blob size:', blob.size, 'bytes');

  if (blob.size === 0) {
    showStatus('❌ Video is empty (0 bytes)', 'error');
    return;
  }

  // Convert to data URL
  const reader = new FileReader();
  reader.onloadend = async () => {
    const dataUrl = reader.result;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                      new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `replay_${recordingId || 'video'}_${timestamp}.webm`;

    console.log('[RecordingControl] Sending to background for download:', filename);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_VIDEO_BLOB',
        dataUrl: dataUrl,
        filename: filename
      });

      if (response && response.success) {
        console.log('[RecordingControl] ✅ Download successful');
        startBtn.textContent = '✅ Recording Complete';
        startBtn.classList.remove('recording');

        // Countdown before closing
        let countdown = 3;
        showStatus(`✅ Video downloaded! Closing in ${countdown}...`, 'success');

        const countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            showStatus(`✅ Video downloaded! Closing in ${countdown}...`, 'success');
          } else {
            clearInterval(countdownInterval);
            showStatus('✅ Closing tabs...', 'success');

            // Close replay tab first
            console.log('[RecordingControl] Closing replay tab:', replayTabId);
            chrome.tabs.remove(replayTabId, () => {
              if (chrome.runtime.lastError) {
                console.warn('[RecordingControl] Could not close replay tab:', chrome.runtime.lastError);
              }
            });

            // Close this tab
            console.log('[RecordingControl] Closing recording control tab...');
            setTimeout(() => {
              window.close();
            }, 500);
          }
        }, 1000);
      } else {
        showStatus('❌ Download failed: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('[RecordingControl] Download error:', error);
      showStatus('❌ Download failed: ' + error.message, 'error');

      // Still close tabs after error (after longer delay)
      setTimeout(() => {
        console.log('[RecordingControl] Closing tabs after error...');
        chrome.tabs.remove(replayTabId, () => {
          if (chrome.runtime.lastError) {
            console.warn('[RecordingControl] Could not close replay tab:', chrome.runtime.lastError);
          }
        });
        window.close();
      }, 5000);
    }
  };

  reader.onerror = (error) => {
    console.error('[RecordingControl] FileReader error:', error);
    showStatus('❌ Failed to read video data', 'error');

    // Close tabs after error
    setTimeout(() => {
      chrome.tabs.remove(replayTabId);
      window.close();
    }, 5000);
  };

  reader.readAsDataURL(blob);
}

// Listen for replay completion
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[RecordingControl] Received message:', message.type, 'from:', sender);

  if (message.type === 'REPLAY_COMPLETE') {
    console.log('[RecordingControl] 🎉 REPLAY_COMPLETE received!');
    console.log('[RecordingControl] Replay tab ID:', message.replayTabId);
    console.log('[RecordingControl] Expected replay tab ID:', replayTabId);
    console.log('[RecordingControl] MediaRecorder state:', mediaRecorder?.state);
    console.log('[RecordingControl] Chunks collected so far:', videoChunks?.length);

    showStatus('✅ Replay complete, processing video...', 'info');

    console.log('[RecordingControl] Waiting 1 second before stopping recording...');
    setTimeout(() => {
      console.log('[RecordingControl] Now calling stopRecording()...');
      stopRecording();
    }, 1000);

    sendResponse({ success: true });
  } else if (message.type === 'INIT_RECORDING_CONTROL') {
    console.log('[RecordingControl] Received initialization data');
    console.log('[RecordingControl] Storyboard events:', message.storyboard?.timeline?.length);
    console.log('[RecordingControl] Video config:', message.videoConfig);
    console.log('[RecordingControl] Replay tab ID:', message.replayTabId);

    storyboard = message.storyboard;
    videoConfig = message.videoConfig;
    updateReplayInfo();
    sendResponse({ success: true });
  } else {
    console.log('[RecordingControl] Unknown message type:', message.type);
  }

  return true;
});

// Close tabs immediately
function closeTabs() {
  console.log('[RecordingControl] Closing tabs now...');
  chrome.tabs.remove(replayTabId, () => {
    if (chrome.runtime.lastError) {
      console.warn('[RecordingControl] Could not close replay tab:', chrome.runtime.lastError);
    }
  });
  window.close();
}

// Button click handlers
startBtn.addEventListener('click', startRecording);
closeBtn.addEventListener('click', closeTabs);

// Initialize
if (loadConfig()) {
  showStatus('✅ Ready to record. Click "Start Recording" to begin.', 'success');
}
