// Recording Side Panel Script
console.log('[Recording Side Panel] Script loaded');

// State
let recordingId = null;
let isPaused = false;
let startTime = null;
let pausedTime = 0;
let eventCount = 0;
let durationInterval = null;

// UI elements
const recordingDot = document.getElementById('recordingDot');
const headerTitle = document.getElementById('headerTitle');
const headerSubtitle = document.getElementById('headerSubtitle');
const eventCountEl = document.getElementById('eventCount');
const durationEl = document.getElementById('duration');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const eventsList = document.getElementById('eventsList');
const statusMessage = document.getElementById('statusMessage');

// Get recording ID from storage
async function loadRecordingInfo() {
  try {
    const result = await chrome.storage.local.get(['currentRecordingId']);
    if (result.currentRecordingId) {
      recordingId = result.currentRecordingId;
      console.log('[Recording Side Panel] Recording ID:', recordingId);
      return true;
    } else {
      showStatus('❌ No active recording found', 'error');
      return false;
    }
  } catch (error) {
    console.error('[Recording Side Panel] Failed to load recording info:', error);
    showStatus('❌ Failed to load recording info', 'error');
    return false;
  }
}

// Show status message
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message show';
  if (type === 'error') {
    statusMessage.style.background = 'rgba(239, 68, 68, 0.2)';
    statusMessage.style.borderColor = 'rgba(239, 68, 68, 0.4)';
  } else {
    statusMessage.style.background = 'rgba(251, 191, 36, 0.2)';
    statusMessage.style.borderColor = 'rgba(251, 191, 36, 0.4)';
  }

  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3000);
}

// Format time as MM:SS
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Update duration display
function updateDuration() {
  if (!startTime || isPaused) return;

  const elapsed = Date.now() - startTime - pausedTime;
  durationEl.textContent = formatDuration(elapsed);
}

// Start duration timer
function startDurationTimer() {
  startTime = Date.now();
  durationInterval = setInterval(updateDuration, 1000);
  updateDuration();
}

// Stop duration timer
function stopDurationTimer() {
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
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
    upload: '📁',
    change: '🔄',
    submit: '📤'
  };
  return icons[type] || '📍';
}

// Get descriptive text for event
function getEventText(event) {
  switch (event.type) {
    case 'click':
      return event.selector || event.text || 'Element clicked';
    case 'type':
      return `"${event.value || event.text || ''}"`;
    case 'navigate':
      try {
        return new URL(event.url).hostname;
      } catch {
        return event.url;
      }
    case 'scroll':
      return `to ${event.x || 0}, ${event.y || 0}`;
    case 'hover':
      return event.selector || 'Element';
    case 'keypress':
      return event.key || 'Key';
    case 'change':
      return event.selector || 'Input changed';
    case 'submit':
      return 'Form submitted';
    default:
      return event.selector || '';
  }
}

// Add event to list
function addEvent(event) {
  // Remove empty state if present
  const emptyState = eventsList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  // Create event item
  const eventItem = document.createElement('div');
  eventItem.className = 'event-item';

  const icon = getEventIcon(event.type);
  const eventType = event.type.charAt(0).toUpperCase() + event.type.slice(1);
  const eventText = getEventText(event);
  const time = formatDuration(event.t || 0);

  eventItem.innerHTML = `
    <div class="event-header">
      <span class="event-icon">${icon}</span>
      <span class="event-type">${eventType}</span>
      <span class="event-time">${time}</span>
    </div>
    ${eventText ? `<div class="event-details">${eventText}</div>` : ''}
  `;

  // Add to top of list
  eventsList.insertBefore(eventItem, eventsList.firstChild);

  // Update count
  eventCount++;
  eventCountEl.textContent = eventCount;

  // Auto-scroll to top
  eventsList.scrollTop = 0;
}

// Pause recording
async function pauseRecording() {
  try {
    console.log('[Recording Side Panel] Pausing recording...');

    const response = await chrome.runtime.sendMessage({
      type: 'PAUSE_RECORDING'
    });

    if (response && response.success) {
      isPaused = true;
      recordingDot.classList.add('paused');
      headerTitle.textContent = 'Recording Paused';
      headerSubtitle.textContent = 'Click Resume to continue';
      pauseBtn.textContent = '▶️ Resume';
      pauseBtn.className = 'btn-resume';
      pausedTime = Date.now() - startTime;
      stopDurationTimer();
      showStatus('⏸️ Recording paused', 'info');
      console.log('[Recording Side Panel] Recording paused');
    } else {
      showStatus('❌ Failed to pause recording', 'error');
    }
  } catch (error) {
    console.error('[Recording Side Panel] Error pausing recording:', error);
    showStatus('❌ Error: ' + error.message, 'error');
  }
}

// Resume recording
async function resumeRecording() {
  try {
    console.log('[Recording Side Panel] Resuming recording...');

    const response = await chrome.runtime.sendMessage({
      type: 'RESUME_RECORDING'
    });

    if (response && response.success) {
      isPaused = false;
      recordingDot.classList.remove('paused');
      headerTitle.textContent = 'Recording in Progress';
      headerSubtitle.textContent = 'Capturing events in real-time';
      pauseBtn.textContent = '⏸️ Pause';
      pauseBtn.className = 'btn-pause';
      startTime = Date.now() - pausedTime;
      startDurationTimer();
      showStatus('▶️ Recording resumed', 'info');
      console.log('[Recording Side Panel] Recording resumed');
    } else {
      showStatus('❌ Failed to resume recording', 'error');
    }
  } catch (error) {
    console.error('[Recording Side Panel] Error resuming recording:', error);
    showStatus('❌ Error: ' + error.message, 'error');
  }
}

// Stop recording
async function stopRecording() {
  try {
    console.log('[Recording Side Panel] Stopping recording...');

    showStatus('⏳ Finishing recording...', 'info');

    const response = await chrome.runtime.sendMessage({
      type: 'STOP_RECORDING'
    });

    if (response && response.success) {
      stopDurationTimer();
      recordingDot.style.background = '#10b981';
      recordingDot.style.animation = 'none';
      headerTitle.textContent = 'Recording Complete';
      headerSubtitle.textContent = `${eventCount} events captured`;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      showStatus('✅ Recording saved! Opening editor...', 'info');
      console.log('[Recording Side Panel] Recording stopped successfully');

      // Close side panel after a delay
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      showStatus('❌ Failed to stop recording', 'error');
    }
  } catch (error) {
    console.error('[Recording Side Panel] Error stopping recording:', error);
    showStatus('❌ Error: ' + error.message, 'error');
  }
}

// Handle pause/resume toggle
pauseBtn.addEventListener('click', () => {
  if (isPaused) {
    resumeRecording();
  } else {
    pauseRecording();
  }
});

// Handle stop button
stopBtn.addEventListener('click', () => {
  stopRecording();
});

// Listen for messages from background/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Recording Side Panel] Received message:', message.type);

  if (message.type === 'EVENT_RECORDED') {
    // Add event to list
    addEvent(message.event);
    sendResponse({ success: true });
  } else if (message.type === 'RECORDING_STATUS') {
    // Update status
    if (message.isPaused) {
      isPaused = true;
      recordingDot.classList.add('paused');
      headerTitle.textContent = 'Recording Paused';
      pauseBtn.textContent = '▶️ Resume';
      pauseBtn.className = 'btn-resume';
    }
    sendResponse({ success: true });
  }

  return true;
});

// Initialize
async function initialize() {
  console.log('[Recording Side Panel] Initializing...');

  // Wait a bit for storage to be set
  await new Promise(resolve => setTimeout(resolve, 100));

  const loaded = await loadRecordingInfo();
  if (loaded) {
    startDurationTimer();
    console.log('[Recording Side Panel] Ready');
  } else {
    // Try again after a short delay (race condition with storage)
    console.log('[Recording Side Panel] Retrying after delay...');
    await new Promise(resolve => setTimeout(resolve, 500));
    const retried = await loadRecordingInfo();
    if (retried) {
      startDurationTimer();
      console.log('[Recording Side Panel] Ready (after retry)');
    } else {
      // Still enable buttons - they'll work even without recordingId
      console.warn('[Recording Side Panel] Could not load recordingId, but buttons still enabled');
    }
  }
}

initialize();
