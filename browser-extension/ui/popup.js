// Popup UI controller

let isRecording = false;
let startTime = null;
let durationInterval = null;
let currentRecordingId = null;

// Settings state
let settings = {
  audioEnabled: true,
  webcamEnabled: true,
  webcamPosition: 'bottom-right'
};

// DOM elements
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const infoEl = document.getElementById('info');
const eventCountEl = document.getElementById('eventCount');
const durationEl = document.getElementById('duration');
const recordingsEl = document.getElementById('recordings');
const recordingsListEl = document.getElementById('recordingsList');

// Settings elements
const audioToggle = document.getElementById('audioToggle');
const webcamToggle = document.getElementById('webcamToggle');
const webcamPosition = document.getElementById('webcamPosition');
const webcamPreview = document.getElementById('webcamPreview');
const previewVideo = document.getElementById('previewVideo');

// Format duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Update duration display
function updateDuration() {
  if (startTime) {
    const elapsed = Date.now() - startTime;
    durationEl.textContent = formatDuration(elapsed);
  }
}

// Update status from background
async function updateStatus() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

  if (response.isRecording && !isRecording) {
    // Recording was started elsewhere
    startRecording(response.recordingId);
  } else if (!response.isRecording && isRecording) {
    // Recording was stopped elsewhere
    stopRecording();
  }

  if (response.isRecording) {
    eventCountEl.textContent = response.eventCount || 0;
  }
}

// Load settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['recordingSettings']);

  if (result.recordingSettings) {
    settings = { ...settings, ...result.recordingSettings };
  }

  // Update UI
  audioToggle.classList.toggle('active', settings.audioEnabled);
  webcamToggle.classList.toggle('active', settings.webcamEnabled);
  webcamPosition.value = settings.webcamPosition;
  webcamPosition.disabled = !settings.webcamEnabled;
}

// Save settings
async function saveSettings() {
  await chrome.storage.local.set({ recordingSettings: settings });
  console.log('[Popup] Settings saved:', settings);
}

// Start recording
async function startRecording(recordingId = null) {
  try {
    if (!recordingId) {
      const response = await chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        settings
      });

      if (!response.success) {
        showModal('Failed to start recording: ' + response.error);
        return;
      }

      currentRecordingId = response.recordingId;
    } else {
      currentRecordingId = recordingId;
    }

    isRecording = true;
    startTime = Date.now();

    // Update UI
    statusEl.className = 'status recording';
    statusTextEl.textContent = 'Recording...';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    infoEl.classList.remove('hidden');

    // Start duration timer
    durationInterval = setInterval(updateDuration, 100);

    // Poll for event count
    setInterval(updateStatus, 1000);

  } catch (error) {
    console.error('Error starting recording:', error);
    showModal('Failed to start recording: ' + error.message);
  }
}

// Stop recording
async function stopRecording() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

    if (!response.success) {
      console.error('Failed to stop recording:', response.error);
    }

    isRecording = false;
    startTime = null;

    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }

    // Update UI
    statusEl.className = 'status idle';
    statusTextEl.textContent = 'Processing...';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');

  } catch (error) {
    console.error('Error stopping recording:', error);
  }
}

// Load recent recordings
async function loadRecentRecordings() {
  const result = await chrome.storage.local.get(['lastRecordingId']);

  if (result.lastRecordingId) {
    recordingsEl.classList.remove('hidden');

    const recordingItem = document.createElement('div');
    recordingItem.className = 'recording-item';

    const idSpan = document.createElement('div');
    idSpan.className = 'recording-id';
    idSpan.textContent = result.lastRecordingId;
    idSpan.title = result.lastRecordingId; // Show full ID on hover

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'recording-buttons';

    // Download buttons group
    const downloadGroup = document.createElement('div');
    downloadGroup.className = 'download-group';

    const downloadJsonBtn = document.createElement('button');
    downloadJsonBtn.className = 'btn-secondary btn-small';
    downloadJsonBtn.textContent = '📄 JSON';
    downloadJsonBtn.title = 'Download storyboard JSON';
    downloadJsonBtn.onclick = () => downloadFile(result.lastRecordingId, 'json');

    const downloadAudioBtn = document.createElement('button');
    downloadAudioBtn.className = 'btn-secondary btn-small';
    downloadAudioBtn.textContent = '🎤 Audio';
    downloadAudioBtn.title = 'Download audio recording';
    downloadAudioBtn.onclick = () => downloadFile(result.lastRecordingId, 'audio');

    const downloadVideoBtn = document.createElement('button');
    downloadVideoBtn.className = 'btn-secondary btn-small';
    downloadVideoBtn.textContent = '📹 Video';
    downloadVideoBtn.title = 'Download webcam video';
    downloadVideoBtn.onclick = () => downloadFile(result.lastRecordingId, 'video');

    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.className = 'btn-primary btn-small';
    downloadAllBtn.textContent = '💾 All';
    downloadAllBtn.title = 'Download all files';
    downloadAllBtn.onclick = () => downloadFile(result.lastRecordingId, 'all');

    downloadGroup.appendChild(downloadJsonBtn);
    downloadGroup.appendChild(downloadAudioBtn);
    downloadGroup.appendChild(downloadVideoBtn);
    downloadGroup.appendChild(downloadAllBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-primary btn-small';
    editBtn.textContent = '✏️ Edit';
    editBtn.title = 'Open in timeline editor';
    editBtn.onclick = () => openEditor(result.lastRecordingId);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-danger btn-small';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete recording';
    deleteBtn.onclick = () => deleteRecording(result.lastRecordingId);

    buttonsDiv.appendChild(downloadGroup);
    buttonsDiv.appendChild(editBtn);
    buttonsDiv.appendChild(deleteBtn);

    recordingItem.appendChild(idSpan);
    recordingItem.appendChild(buttonsDiv);

    recordingsListEl.innerHTML = '';
    recordingsListEl.appendChild(recordingItem);
  }
}

// Download specific file or all files
async function downloadFile(recordingId, fileType) {
  try {
    console.log(`[Popup] Downloading ${fileType} for:`, recordingId);

    const response = await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      recordingId,
      fileType // 'json', 'audio', 'video', or 'all'
    });

    if (!response) {
      showModal('Failed to download: No response from background script');
      return;
    }

    if (!response.success) {
      showModal('Failed to download: ' + (response.error || 'Unknown error'));
    } else {
      console.log(`[Popup] Download ${fileType} successful`);
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    showModal('Failed to download: ' + error.message);
  }
}

// Open editor with recording
function openEditor(recordingId) {
  const editorUrl = chrome.runtime.getURL(`ui/editor.html?recordingId=${recordingId}`);
  chrome.tabs.create({ url: editorUrl });
}

// Delete recording
async function deleteRecording(recordingId) {
  const confirmed = await showConfirm('Delete this recording? This cannot be undone.\n\nThis will remove:\n- Storyboard JSON\n- Audio recording\n- Webcam video\n- All recording chunks', {
    title: 'Delete Recording',
    icon: '🗑️',
    danger: true,
    confirmText: 'Delete'
  });
  if (!confirmed) {
    return;
  }

  try {
    console.log('[Popup] Deleting recording:', recordingId);

    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_RECORDING',
      recordingId
    });

    if (!response) {
      showModal('Failed to delete: No response from background script');
      return;
    }

    if (response.success) {
      console.log('[Popup] Recording deleted successfully');
      // Clear the recordings display
      recordingsEl.classList.add('hidden');
      recordingsListEl.innerHTML = '<p style="color: #666; font-size: 12px; padding: 8px;">Recording deleted</p>';

      // Wait a moment then reload
      setTimeout(() => {
        loadRecentRecordings();
      }, 1000);
    } else {
      showModal('Failed to delete: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('[Popup] Error deleting recording:', error);
    showModal('Failed to delete: ' + error.message);
  }
}

// Event listeners
startBtn.addEventListener('click', () => startRecording());
stopBtn.addEventListener('click', () => stopRecording());

// Settings event listeners
audioToggle.addEventListener('click', () => {
  settings.audioEnabled = !settings.audioEnabled;
  audioToggle.classList.toggle('active', settings.audioEnabled);
  saveSettings();

  // Update start button text
  if (!settings.audioEnabled && !settings.webcamEnabled) {
    startBtn.textContent = 'Start Recording (Screen Only)';
  } else {
    startBtn.textContent = 'Start Recording';
  }
});

webcamToggle.addEventListener('click', () => {
  settings.webcamEnabled = !settings.webcamEnabled;
  webcamToggle.classList.toggle('active', settings.webcamEnabled);
  webcamPosition.disabled = !settings.webcamEnabled;
  saveSettings();

  // Hide preview if disabled
  if (!settings.webcamEnabled) {
    webcamPreview.classList.remove('active');
    if (previewVideo.srcObject) {
      previewVideo.srcObject.getTracks().forEach(track => track.stop());
      previewVideo.srcObject = null;
    }
  }

  // Update start button text
  if (!settings.audioEnabled && !settings.webcamEnabled) {
    startBtn.textContent = 'Start Recording (Screen Only)';
  } else {
    startBtn.textContent = 'Start Recording';
  }
});

webcamPosition.addEventListener('change', () => {
  settings.webcamPosition = webcamPosition.value;
  saveSettings();
});

// Test webcam button (optional - show preview)
webcamToggle.addEventListener('dblclick', async () => {
  if (!settings.webcamEnabled) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    });

    previewVideo.srcObject = stream;
    webcamPreview.classList.add('active');

    // Stop preview after 3 seconds
    setTimeout(() => {
      webcamPreview.classList.remove('active');
      stream.getTracks().forEach(track => track.stop());
      previewVideo.srcObject = null;
    }, 3000);
  } catch (error) {
    console.error('Webcam preview error:', error);
    showModal('Could not access webcam: ' + error.message);
  }
});

// Listen for storyboard ready
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STORYBOARD_READY') {
    statusTextEl.textContent = 'Recording saved!';

    setTimeout(() => {
      statusTextEl.textContent = 'Ready to record';
      infoEl.classList.add('hidden');
      loadRecentRecordings();
    }, 2000);
  }
});

// Initialize
loadSettings();
updateStatus();
loadRecentRecordings();
