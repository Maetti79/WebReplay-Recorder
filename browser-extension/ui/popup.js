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
const deleteAllBtn = document.getElementById('deleteAllBtn');

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

    // Open recording side panel
    try {
      console.log('[Popup] Opening recording side panel...');

      // Ensure recording ID is in storage for side panel access
      await chrome.storage.local.set({
        currentRecordingId: currentRecordingId
      });
      console.log('[Popup] Recording ID stored for side panel:', currentRecordingId);

      await chrome.sidePanel.setOptions({
        path: 'ui/recording-sidepanel.html',
        enabled: true
      });

      // Get current window and open side panel
      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      console.log('[Popup] Recording side panel opened');

      // Close popup after opening side panel
      window.close();
    } catch (error) {
      console.error('[Popup] Failed to open recording side panel:', error);
      // Continue without side panel if it fails

      // Update UI (fallback if side panel fails)
      statusEl.className = 'status recording';
      statusTextEl.textContent = 'Recording...';
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      infoEl.classList.remove('hidden');

      // Start duration timer
      durationInterval = setInterval(updateDuration, 100);

      // Poll for event count
      setInterval(updateStatus, 1000);
    }

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
  try {
    // Get all keys from storage
    const allData = await chrome.storage.local.get(null);

    // Filter for storyboard keys
    const recordingKeys = Object.keys(allData).filter(key => key.startsWith('storyboard_'));

    recordingsEl.classList.remove('hidden');

    if (recordingKeys.length === 0) {
      recordingsListEl.innerHTML = '<p style="color: #6b7280; font-size: 13px; padding: 12px; text-align: center; font-style: italic;">No recordings yet. Start recording to create your first one!</p>';
      deleteAllBtn.style.display = 'none';
      return;
    }

    // Show delete all button when there are recordings
    deleteAllBtn.style.display = 'block';
    recordingsListEl.innerHTML = '';

    // Parse recordings with metadata
    const recordings = [];
    for (const key of recordingKeys) {
      const recordingId = key.replace('storyboard_', '');
      try {
        const storyboard = JSON.parse(allData[key]);
        recordings.push({
          id: recordingId,
          title: storyboard.meta?.title || 'Untitled Recording',
          createdAt: storyboard.meta?.createdAt || null,
          eventCount: storyboard.timeline?.length || 0,
          subtitleCount: storyboard.subtitles?.length || 0
        });
      } catch (error) {
        console.warn('[Popup] Failed to parse recording:', recordingId, error);
      }
    }

    // Sort by creation date (newest first)
    recordings.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Display all recordings
    recordings.forEach(recording => {
      const recordingItem = document.createElement('div');
      recordingItem.className = 'recording-item';

      const infoDiv = document.createElement('div');
      infoDiv.style.flex = '1';
      infoDiv.style.minWidth = '0';

      const titleDiv = document.createElement('div');
      titleDiv.style.fontWeight = '600';
      titleDiv.style.fontSize = '14px';
      titleDiv.style.color = '#202124';
      titleDiv.style.marginBottom = '4px';
      titleDiv.textContent = recording.title;

      const metaDiv = document.createElement('div');
      metaDiv.className = 'recording-id';
      metaDiv.style.fontSize = '11px';

      const parts = [];
      if (recording.createdAt) {
        const date = new Date(recording.createdAt);
        parts.push(date.toLocaleDateString() + ' ' + date.toLocaleTimeString());
      }
      parts.push(`${recording.eventCount} events`);
      if (recording.subtitleCount > 0) {
        parts.push(`${recording.subtitleCount} subtitles`);
      }
      metaDiv.textContent = parts.join(' • ');
      metaDiv.title = recording.id; // Show full ID on hover

      infoDiv.appendChild(titleDiv);
      infoDiv.appendChild(metaDiv);

      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'recording-buttons';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-primary btn-small';
      editBtn.textContent = '✏️ Edit';
      editBtn.title = 'Open in timeline editor';
      editBtn.onclick = () => openEditor(recording.id);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-danger btn-small';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete recording';
      deleteBtn.onclick = () => deleteRecording(recording.id);

      buttonsDiv.appendChild(editBtn);
      buttonsDiv.appendChild(deleteBtn);

      recordingItem.appendChild(infoDiv);
      recordingItem.appendChild(buttonsDiv);

      recordingsListEl.appendChild(recordingItem);
    });

    console.log('[Popup] Loaded', recordings.length, 'recordings');
  } catch (error) {
    console.error('[Popup] Failed to load recordings:', error);
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

      // Show temporary message
      recordingsListEl.innerHTML = '<p style="color: #22c55e; font-size: 13px; padding: 12px; text-align: center; font-weight: 500;">✅ Recording deleted successfully</p>';

      // Reload recordings after a moment
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

// Delete all recordings
async function deleteAllRecordings() {
  const confirmed = await showConfirm('Delete ALL recordings? This cannot be undone.\n\nThis will remove:\n- All storyboard JSONs\n- All audio recordings\n- All webcam videos\n- All recording chunks\n- All voiceovers', {
    title: 'Delete All Recordings',
    icon: '🗑️',
    danger: true,
    confirmText: 'Delete All'
  });
  if (!confirmed) {
    return;
  }

  try {
    console.log('[Popup] Deleting all recordings...');

    // Get all recording keys
    const allData = await chrome.storage.local.get(null);
    const recordingKeys = Object.keys(allData).filter(key => key.startsWith('storyboard_'));

    if (recordingKeys.length === 0) {
      showModal('No recordings to delete');
      return;
    }

    // Extract recording IDs
    const recordingIds = recordingKeys.map(key => key.replace('storyboard_', ''));

    // Delete each recording
    let successCount = 0;
    let errorCount = 0;

    for (const recordingId of recordingIds) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'DELETE_RECORDING',
          recordingId
        });

        if (response && response.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error('[Popup] Failed to delete recording:', recordingId, error);
        errorCount++;
      }
    }

    console.log('[Popup] Deleted', successCount, 'recordings,', errorCount, 'errors');

    // Show result message
    if (errorCount > 0) {
      recordingsListEl.innerHTML = `<p style="color: #f59e0b; font-size: 13px; padding: 12px; text-align: center; font-weight: 500;">⚠️ Deleted ${successCount} recordings, ${errorCount} failed</p>`;
    } else {
      recordingsListEl.innerHTML = `<p style="color: #22c55e; font-size: 13px; padding: 12px; text-align: center; font-weight: 500;">✅ All ${successCount} recordings deleted successfully</p>`;
    }

    // Hide delete all button
    deleteAllBtn.style.display = 'none';

    // Reload recordings after a moment
    setTimeout(() => {
      loadRecentRecordings();
    }, 1500);

  } catch (error) {
    console.error('[Popup] Error deleting all recordings:', error);
    showModal('Failed to delete all recordings: ' + error.message);
  }
}

// Event listeners
startBtn.addEventListener('click', () => startRecording());
stopBtn.addEventListener('click', () => stopRecording());
deleteAllBtn.addEventListener('click', () => deleteAllRecordings());

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
