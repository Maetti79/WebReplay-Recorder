// Side Panel Recording Control Script
console.log('[SidePanel] Script loaded');

let replayTabId = null;
let recordingId = null;
let videoConfig = null;
let storyboard = null;

// UI elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const replayInfoEl = document.getElementById('replayInfo');
const closeBtn = document.getElementById('closeBtn');
const eventListEl = document.getElementById('eventList');
const eventListContent = document.getElementById('eventListContent');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const recordModeCheckbox = document.getElementById('recordModeCheckbox');
const modeDescription = document.getElementById('modeDescription');
const instructionsRecord = document.getElementById('instructionsRecord');
const instructionsDryRun = document.getElementById('instructionsDryRun');

// Recording state
let mediaRecorder = null;
let mediaStream = null;
let videoChunks = [];
let currentEventIndex = 0;
let totalEvents = 0;
let isRecordingMode = true; // Default to recording mode

// Get configuration from storage (set by editor)
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['sidePanelConfig']);
    if (result.sidePanelConfig) {
      const config = result.sidePanelConfig;
      replayTabId = config.replayTabId;
      recordingId = config.recordingId;
      storyboard = config.storyboard;
      videoConfig = config.videoConfig;

      console.log('[SidePanel] Config loaded:');
      console.log('  Replay Tab ID:', replayTabId);
      console.log('  Recording ID:', recordingId);
      console.log('  Events:', storyboard?.timeline?.length);

      if (!replayTabId) {
        showStatus('❌ Error: No replay tab ID provided', 'error');
        startBtn.disabled = true;
        return false;
      }

      // Build event list
      buildEventList();
      updateReplayInfo();
      showStatus('✅ Ready to record. Click "Start Recording" to begin.', 'success');
      return true;
    } else {
      showStatus('❌ No configuration found. Please start recording from the editor.', 'error');
      startBtn.disabled = true;
      return false;
    }
  } catch (error) {
    console.error('[SidePanel] Failed to load config:', error);
    showStatus('❌ Failed to load configuration', 'error');
    startBtn.disabled = true;
    return false;
  }
}

// Build event list UI
function buildEventList() {
  if (!storyboard || !storyboard.timeline) return;

  totalEvents = storyboard.timeline.length;
  eventListContent.innerHTML = '';

  storyboard.timeline.forEach((event, index) => {
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.id = `event-${index}`;

    const icon = getEventIcon(event.type);
    const eventType = event.type.charAt(0).toUpperCase() + event.type.slice(1);
    const eventText = getEventText(event);

    eventItem.innerHTML = `
      <span class="event-icon">${icon}</span>
      <div class="event-details">
        <div class="event-type">${eventType}</div>
        <div class="event-text">${eventText}</div>
      </div>
      <span class="event-status">⏳</span>
    `;

    eventListContent.appendChild(eventItem);
  });
}

// Get icon for event type
function getEventIcon(type) {
  const icons = {
    click: '🖱️',
    type: '⌨️',
    navigate: '🚀',
    scroll: '📜',
    hover: '👆',
    focus: '🎯',
    blur: '⚪',
    keypress: '⌨️',
    upload: '📁'
  };
  return icons[type] || '📍';
}

// Get descriptive text for event
function getEventText(event) {
  switch (event.type) {
    case 'click':
      return event.selector || 'Unknown element';
    case 'type':
      return `"${event.value || ''}"`;
    case 'navigate':
      return new URL(event.url).hostname;
    case 'scroll':
      return `to ${event.x}, ${event.y}`;
    case 'hover':
      return event.selector || 'Unknown element';
    case 'keypress':
      return event.key || 'Key';
    default:
      return '';
  }
}

// Update event progress
function updateEventProgress(eventIndex) {
  currentEventIndex = eventIndex;

  // Update progress bar
  const progress = ((eventIndex + 1) / totalEvents) * 100;
  progressFill.style.width = `${progress}%`;

  // Update event items
  const allItems = eventListContent.querySelectorAll('.event-item');
  allItems.forEach((item, index) => {
    const statusSpan = item.querySelector('.event-status');

    if (index < eventIndex) {
      item.classList.remove('current');
      item.classList.add('completed');
      statusSpan.textContent = '✅';
    } else if (index === eventIndex) {
      item.classList.remove('completed');
      item.classList.add('current');
      statusSpan.textContent = '▶️';
      // Scroll into view
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      item.classList.remove('current', 'completed');
      statusSpan.textContent = '⏳';
    }
  });
}

// Show status message
function showStatus(message, type = 'info') {
  console.log('[SidePanel] Status:', message);
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

    const displayWidth = videoConfig?.width || window.screen.width || 1920;
    const displayHeight = videoConfig?.height || window.screen.height || 1080;
    document.getElementById('quality').textContent = `${displayWidth}x${displayHeight}`;
    replayInfoEl.classList.add('show');
  }
}

// Start recording or dry run
async function startRecording() {
  try {
    if (isRecordingMode) {
      console.log('[SidePanel] Starting recording process...');
      showStatus('📹 Please select the replay tab in the screen picker...', 'info');

      // Request screen capture with audio
      console.log('[SidePanel] Requesting getDisplayMedia() with audio...');
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
        preferCurrentTab: false
      });

      console.log('[SidePanel] ✅ Got media stream');

      // Setup MediaRecorder
      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      };

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log('[SidePanel] VP9 not supported, using VP8');
        options.mimeType = 'video/webm;codecs=vp8';
      }

      mediaRecorder = new MediaRecorder(mediaStream, options);
      videoChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[SidePanel] MediaRecorder stopped');
        mediaStream.getTracks().forEach(track => track.stop());

        if (videoChunks.length === 0) {
          showStatus('❌ No video data recorded', 'error');
          return;
        }

        await downloadVideo();
      };

      mediaRecorder.onerror = (error) => {
        console.error('[SidePanel] MediaRecorder error:', error);
        showStatus('❌ Recording error: ' + error, 'error');
      };

      // Start recording
      console.log('[SidePanel] Starting MediaRecorder...');
      mediaRecorder.start(1000);

      showStatus('🔴 Recording started! Replay is running...', 'success');
    } else {
      // Dry run mode - no screen capture
      console.log('[SidePanel] Starting dry run (no recording)...');
      showStatus('▶️ Dry run started! Watch the replay...', 'success');
    }

    // Update UI
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    stopBtn.textContent = isRecordingMode ? '⏹️ Stop Recording' : '⏹️ Stop Replay';
    recordModeCheckbox.disabled = true; // Lock mode during replay
    instructionsRecord.style.display = 'none';
    instructionsDryRun.style.display = 'none';
    eventListEl.classList.add('show');
    progressBar.classList.add('show');

    // Send message to replay tab to start replay
    console.log('[SidePanel] Sending start message to replay tab:', replayTabId);
    chrome.tabs.sendMessage(replayTabId, {
      type: 'START_TAB_REPLAY',
      storyboard: storyboard,
      speed: 1,
      recordingMode: false
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[SidePanel] Error sending start message:', chrome.runtime.lastError);
      } else {
        console.log('[SidePanel] Replay started successfully');
      }
    });

  } catch (error) {
    console.error('[SidePanel] Failed to start:', error);
    showStatus('❌ Failed to start: ' + error.message, 'error');
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    recordModeCheckbox.disabled = false;
  }
}

// Stop recording or dry run
function stopRecording() {
  if (isRecordingMode) {
    console.log('[SidePanel] Stopping recording...');
    showStatus('⏳ Processing video...', 'info');

    if (!mediaRecorder) {
      console.error('[SidePanel] No mediaRecorder found!');
      showStatus('❌ No recording in progress', 'error');
      return;
    }

    if (mediaRecorder.state === 'inactive') {
      console.warn('[SidePanel] MediaRecorder already inactive');
      return;
    }

    console.log('[SidePanel] Requesting final data...');
    mediaRecorder.requestData();

    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.log('[SidePanel] Calling mediaRecorder.stop()...');
        mediaRecorder.stop();
      }
    }, 500);
  } else {
    // Dry run mode - just finish up
    console.log('[SidePanel] Dry run complete');
    handleDryRunComplete();
  }
}

// Handle dry run completion
function handleDryRunComplete() {
  showStatus('✅ Dry run complete!', 'success');
  stopBtn.style.display = 'none';
  startBtn.style.display = 'block';
  startBtn.textContent = '▶️ Start Dry Run';
  recordModeCheckbox.disabled = false; // Unlock mode

  // Mark all events as completed
  const allItems = eventListContent.querySelectorAll('.event-item');
  allItems.forEach(item => {
    item.classList.add('completed');
    item.classList.remove('current');
    item.querySelector('.event-status').textContent = '✅';
  });
  progressFill.style.width = '100%';

  // Show option to switch to recording mode
  showStatus('✅ Dry run complete! Enable "Record Video" to create a video.', 'success');
}

// Download video
async function downloadVideo() {
  console.log('[SidePanel] Creating video blob...');
  const blob = new Blob(videoChunks, { type: 'video/webm' });
  console.log('[SidePanel] Blob size:', blob.size, 'bytes');

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

    console.log('[SidePanel] Sending to background for download:', filename);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_VIDEO_BLOB',
        dataUrl: dataUrl,
        filename: filename
      });

      if (response && response.success) {
        console.log('[SidePanel] ✅ Download successful');
        stopBtn.style.display = 'none';
        closeBtn.style.display = 'block';

        // Mark all events as completed
        const allItems = eventListContent.querySelectorAll('.event-item');
        allItems.forEach(item => {
          item.classList.add('completed');
          item.classList.remove('current');
          item.querySelector('.event-status').textContent = '✅';
        });
        progressFill.style.width = '100%';

        // Countdown before auto-closing
        let countdown = 3;
        showStatus(`✅ Video downloaded! Auto-closing in ${countdown}s...`, 'success');

        const countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            showStatus(`✅ Video downloaded! Auto-closing in ${countdown}s...`, 'success');
          } else {
            clearInterval(countdownInterval);
            closeTabs();
          }
        }, 1000);
      } else {
        showStatus('❌ Download failed: ' + (response?.error || 'Unknown error'), 'error');
        closeBtn.style.display = 'block';
      }
    } catch (error) {
      console.error('[SidePanel] Download error:', error);
      showStatus('❌ Download failed: ' + error.message, 'error');
      closeBtn.style.display = 'block';
      setTimeout(closeTabs, 5000);
    }
  };

  reader.onerror = (error) => {
    console.error('[SidePanel] FileReader error:', error);
    showStatus('❌ Failed to read video data', 'error');
    closeBtn.style.display = 'block';
    setTimeout(closeTabs, 5000);
  };

  reader.readAsDataURL(blob);
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SidePanel] Received message:', message.type);

  if (message.type === 'REPLAY_COMPLETE') {
    console.log('[SidePanel] 🎉 REPLAY_COMPLETE received!');

    if (isRecordingMode) {
      showStatus('✅ Replay complete, processing video...', 'info');
      // Stop recording immediately - replay.js already waited 2 seconds after last event
      setTimeout(() => {
        stopRecording();
      }, 100);
    } else {
      showStatus('✅ Replay complete!', 'success');
      setTimeout(() => {
        stopRecording();
      }, 100);
    }

    sendResponse({ success: true });
  }

  return true;
});

// Close tabs
function closeTabs() {
  console.log('[SidePanel] Closing replay tab...');
  chrome.tabs.remove(replayTabId, () => {
    if (chrome.runtime.lastError) {
      console.warn('[SidePanel] Could not close replay tab:', chrome.runtime.lastError);
    }
  });
  // Note: Side panel stays open unless user closes it
  if (isRecordingMode) {
    showStatus('✅ Recording complete. You can close this panel.', 'success');
  } else {
    showStatus('✅ Tab closed. You can close this panel.', 'success');
  }
}

// Mode toggle handler
recordModeCheckbox.addEventListener('change', () => {
  isRecordingMode = recordModeCheckbox.checked;
  updateModeUI();
});

// Update UI based on mode
function updateModeUI() {
  if (isRecordingMode) {
    modeDescription.textContent = 'Recording mode: Screen capture will be requested';
    instructionsRecord.style.display = 'block';
    instructionsDryRun.style.display = 'none';
    startBtn.textContent = '🎥 Start Recording';
  } else {
    modeDescription.textContent = 'Dry run mode: Replay only, no video capture';
    instructionsRecord.style.display = 'none';
    instructionsDryRun.style.display = 'block';
    startBtn.textContent = '▶️ Start Dry Run';
  }
}

// Button click handlers
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
closeBtn.addEventListener('click', closeTabs);

// Initialize
updateModeUI();
loadConfig();
