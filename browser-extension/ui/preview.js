// Replay Preview Script
let storyboard = null;
let currentEventIndex = 0;
let isReplaying = false;
let replayTimeout = null;
let activeSubtitles = []; // Track active subtitle timeouts
let currentAudio = null; // Track currently playing voiceover audio
let originalAudio = null; // Audio element for original recording
let webcamVideo = null; // Video element for webcam recording
let audioBlob = null; // Original audio blob
let webcamBlob = null; // Webcam video blob

const status = document.getElementById('status');
const eventIndicator = document.getElementById('eventIndicator');
const eventLog = document.getElementById('eventLog');
const pageFrame = document.getElementById('pageFrame');
const clickMarker = document.getElementById('clickMarker');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const subtitleDisplay = document.getElementById('subtitleDisplay');

// Load storyboard from chrome.storage.local
async function loadStoryboardFromStorage(recordingId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([`storyboard_${recordingId}`], (result) => {
      const key = `storyboard_${recordingId}`;
      if (result[key]) {
        try {
          // Parse JSON string back to object
          const storyboard = typeof result[key] === 'string' ? JSON.parse(result[key]) : result[key];
          resolve(storyboard);
        } catch (error) {
          reject(new Error('Failed to parse storyboard: ' + error.message));
        }
      } else {
        reject(new Error('Storyboard not found in storage'));
      }
    });
  });
}

// Check for recordingId in query string
const urlParams = new URLSearchParams(window.location.search);
const recordingId = urlParams.get('id');

if (recordingId) {
  console.log('[Preview] Loading storyboard from chrome.storage.local:', recordingId);
  status.textContent = 'Loading storyboard...';

  loadStoryboardFromStorage(recordingId).then(async (loadedStoryboard) => {
    console.log('[Preview] Raw storyboard loaded:', loadedStoryboard);

    if (!loadedStoryboard) {
      throw new Error('Storyboard is null or undefined');
    }

    if (!loadedStoryboard.timeline) {
      throw new Error('Storyboard has no timeline property');
    }

    storyboard = loadedStoryboard;
    console.log('[Preview] Storyboard loaded from storage:', storyboard.timeline.length, 'events');

    // Log subtitles info
    if (storyboard.subtitles) {
      console.log('[Preview] Subtitles found:', storyboard.subtitles.length);
      storyboard.subtitles.forEach((sub, idx) => {
        console.log(`[Preview] Subtitle ${idx}:`, {
          time: sub.time,
          duration: sub.duration,
          text: sub.text,
          hasVoiceover: !!sub.voiceover,
          voiceoverBlobId: sub.voiceover?.blobId
        });
      });
    } else {
      console.log('[Preview] No subtitles in storyboard');
    }

    // Load audio from IndexedDB if available
    try {
      audioBlob = await getAudioFromDB(recordingId);
      if (audioBlob) {
        originalAudio = new Audio();
        originalAudio.src = URL.createObjectURL(audioBlob);
        console.log('[Preview] Audio loaded:', audioBlob.size, 'bytes');
      }
    } catch (error) {
      console.log('[Preview] No audio available:', error.message);
    }

    // Load webcam from IndexedDB if available
    try {
      webcamBlob = await getWebcamFromDB(recordingId);
      if (webcamBlob) {
        webcamVideo = document.createElement('video');
        webcamVideo.src = URL.createObjectURL(webcamBlob);
        webcamVideo.muted = true; // Muted to avoid duplicate audio
        console.log('[Preview] Webcam loaded:', webcamBlob.size, 'bytes');
      }
    } catch (error) {
      console.log('[Preview] No webcam available:', error.message);
    }

    status.textContent = 'Ready';

    // Load initial page
    const initialUrl = storyboard.meta?.baseUrl || storyboard.timeline.find(e => e.type === 'navigate')?.url;
    if (initialUrl) {
      pageFrame.src = initialUrl;
      console.log('[Preview] Loading page:', initialUrl);
    } else {
      console.warn('[Preview] No initial URL found');
    }
  }).catch((error) => {
    console.error('[Preview] Failed to load storyboard:', error);
    status.textContent = 'Error loading storyboard';
    alert('Failed to load recording: ' + error.message + '\n\nRecordingId: ' + recordingId);
  });
} else {
  console.log('[Preview] No recordingId in query string, waiting for postMessage');
  status.textContent = 'Waiting for storyboard...';
}

// Listen for storyboard data from parent (fallback)
window.addEventListener('message', (event) => {
  if (event.data.type === 'LOAD_STORYBOARD') {
    storyboard = event.data.storyboard;
    console.log('[Preview] Storyboard loaded via postMessage:', storyboard.timeline.length, 'events');

    // Load initial page
    const initialUrl = storyboard.meta.baseUrl || storyboard.timeline.find(e => e.type === 'navigate')?.url;
    if (initialUrl) {
      pageFrame.src = initialUrl;
      console.log('[Preview] Loading page:', initialUrl);
    }
  } else if (event.data.type === 'START_REPLAY') {
    startReplay();
  } else if (event.data.type === 'STOP_REPLAY') {
    stopReplay();
  }
});

// Notify parent that we're ready
window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');

startBtn.addEventListener('click', startReplay);
stopBtn.addEventListener('click', stopReplay);

function startReplay() {
  if (!storyboard) {
    alert('No storyboard loaded');
    return;
  }

  if (isReplaying) return;

  isReplaying = true;
  currentEventIndex = 0;
  eventLog.innerHTML = '<div style="color: #1976d2; font-weight: bold;">▶️ Replay Started</div>';
  status.textContent = 'Playing...';

  // Reset to initial page
  const initialUrl = storyboard.meta.baseUrl || storyboard.timeline.find(e => e.type === 'navigate')?.url;
  if (initialUrl) {
    pageFrame.src = initialUrl;
  }

  // Schedule all subtitles
  scheduleSubtitles();

  // Schedule original audio playback
  if (originalAudio) {
    const audioOffset = storyboard.originalAudioOffset || 0;
    originalAudio.currentTime = 0;
    if (audioOffset === 0) {
      originalAudio.play();
      console.log('[Preview] Playing original audio from start');
    } else {
      const audioTimeout = setTimeout(() => {
        if (isReplaying && originalAudio) {
          originalAudio.play();
          console.log('[Preview] Playing original audio at offset:', audioOffset, 'ms');
        }
      }, audioOffset);
      activeSubtitles.push(audioTimeout);
    }
  }

  // Schedule webcam video playback
  if (webcamVideo) {
    const webcamOffset = storyboard.webcamOffset || 0;
    webcamVideo.currentTime = 0;
    if (webcamOffset === 0) {
      webcamVideo.play();
      console.log('[Preview] Playing webcam video from start');
    } else {
      const webcamTimeout = setTimeout(() => {
        if (isReplaying && webcamVideo) {
          webcamVideo.play();
          console.log('[Preview] Playing webcam video at offset:', webcamOffset, 'ms');
        }
      }, webcamOffset);
      activeSubtitles.push(webcamTimeout);
    }
  }

  executeNextEvent();
}

function stopReplay() {
  isReplaying = false;
  if (replayTimeout) {
    clearTimeout(replayTimeout);
    replayTimeout = null;
  }

  // Clear all subtitle timeouts
  activeSubtitles.forEach(timeout => clearTimeout(timeout));
  activeSubtitles = [];

  // Stop any playing voiceover audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // Stop original audio
  if (originalAudio) {
    originalAudio.pause();
    originalAudio.currentTime = 0;
  }

  // Stop webcam video
  if (webcamVideo) {
    webcamVideo.pause();
    webcamVideo.currentTime = 0;
  }

  eventIndicator.style.display = 'none';
  clickMarker.style.display = 'none';
  subtitleDisplay.style.display = 'none';
  status.textContent = 'Stopped';
  eventLog.innerHTML += '<div style="color: #c62828; font-weight: bold; margin-top: 8px;">⏹️ Replay Stopped</div>';
}

function executeNextEvent() {
  if (!isReplaying || currentEventIndex >= storyboard.timeline.length) {
    isReplaying = false;
    status.textContent = 'Completed';
    eventIndicator.style.display = 'none';
    clickMarker.style.display = 'none';
    eventLog.innerHTML += '<div style="color: #2e7d32; font-weight: bold; margin-top: 8px;">✅ Replay Completed</div>';
    return;
  }

  const event = storyboard.timeline[currentEventIndex];
  const nextEvent = storyboard.timeline[currentEventIndex + 1];

  // Execute the event
  executeEvent(event);

  // Show event indicator
  showEventIndicator(event);

  // Log event
  logEvent(event);

  // Calculate delay to next event
  let delay = 0;
  if (nextEvent) {
    delay = nextEvent.t - event.t;
  } else {
    delay = event.durationMs || 1000;
  }

  // Update status
  status.textContent = `Event ${currentEventIndex + 1}/${storyboard.timeline.length}`;

  // Schedule next event
  currentEventIndex++;
  replayTimeout = setTimeout(executeNextEvent, Math.min(delay, 5000)); // Cap at 5s for preview
}

function executeEvent(event) {
  // Handle navigation
  if (event.type === 'navigate' && event.url) {
    pageFrame.src = event.url;
    console.log('[Preview] Navigating to:', event.url);
  }

  // Show click marker
  if (event.type === 'click' && event.position) {
    const frameRect = pageFrame.getBoundingClientRect();
    clickMarker.style.left = (frameRect.left + event.position.x) + 'px';
    clickMarker.style.top = (frameRect.top + event.position.y) + 'px';
    clickMarker.style.display = 'block';
    clickMarker.style.animation = 'none';
    setTimeout(() => {
      clickMarker.style.animation = 'clickPulse 0.6s ease-out';
    }, 10);

    // Hide after animation
    setTimeout(() => {
      clickMarker.style.display = 'none';
    }, 600);
  }
}

function showEventIndicator(event) {
  let description = '';
  switch (event.type) {
    case 'navigate':
      description = '🌐 Navigate to ' + event.url;
      break;
    case 'click':
      description = '👆 Click on ' + (event.target?.selectors?.[0] || 'element');
      break;
    case 'type':
      description = '⌨️ Type: ' + event.text;
      break;
    case 'keypress':
      description = '🔑 Press: ' + event.key;
      break;
    case 'scroll':
      description = '📜 Scroll';
      break;
    default:
      description = '📍 ' + event.type;
  }

  eventIndicator.textContent = description;
  eventIndicator.style.display = 'block';

  setTimeout(() => {
    eventIndicator.style.display = 'none';
  }, 2000);
}

function logEvent(event) {
  const time = formatTime(event.t);
  let color = '#666';
  let icon = '📍';

  switch (event.type) {
    case 'navigate':
      color = '#1976d2';
      icon = '🌐';
      break;
    case 'click':
      color = '#f44336';
      icon = '👆';
      break;
    case 'type':
      color = '#4caf50';
      icon = '⌨️';
      break;
    case 'keypress':
      color = '#ff9800';
      icon = '🔑';
      break;
    case 'scroll':
      color = '#9c27b0';
      icon = '📜';
      break;
  }

  const logEntry = document.createElement('div');
  logEntry.style.color = color;
  logEntry.style.marginTop = '4px';
  logEntry.innerHTML = `${icon} <strong>${time}</strong> - ${event.type}`;

  if (event.url) {
    logEntry.innerHTML += `: ${event.url}`;
  } else if (event.text) {
    logEntry.innerHTML += `: "${event.text}"`;
  } else if (event.key) {
    logEntry.innerHTML += `: ${event.key}`;
  }

  eventLog.appendChild(logEntry);
  eventLog.scrollTop = eventLog.scrollHeight;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${seconds}.${String(millis).padStart(3, '0')}s`;
}

// Schedule all subtitles for the replay
function scheduleSubtitles() {
  console.log('[Preview] scheduleSubtitles called');
  console.log('[Preview] storyboard:', storyboard);
  console.log('[Preview] storyboard.subtitles:', storyboard?.subtitles);

  if (!storyboard.subtitles || storyboard.subtitles.length === 0) {
    console.log('[Preview] No subtitles to schedule');
    return;
  }

  console.log('[Preview] Scheduling', storyboard.subtitles.length, 'subtitles');

  storyboard.subtitles.forEach(subtitle => {
    // Schedule subtitle show
    const showTimeout = setTimeout(() => {
      showSubtitle(subtitle);
    }, subtitle.time);
    activeSubtitles.push(showTimeout);

    // Schedule subtitle hide
    const hideTimeout = setTimeout(() => {
      hideSubtitle();
    }, subtitle.time + subtitle.duration);
    activeSubtitles.push(hideTimeout);

    // Schedule voiceover playback if available (check for either audioBlob or blobId)
    if (subtitle.voiceover && (subtitle.voiceover.audioBlob || subtitle.voiceover.blobId)) {
      const voiceoverTime = subtitle.time + (subtitle.voiceover.offset || 0);
      const voiceoverTimeout = setTimeout(() => {
        playVoiceover(subtitle.voiceover);
      }, voiceoverTime);
      activeSubtitles.push(voiceoverTimeout);
      console.log('[Preview] Scheduled voiceover at', voiceoverTime, 'ms (subtitle time:', subtitle.time, '+ offset:', subtitle.voiceover.offset || 0, ')');
    }
  });
}

// Show subtitle with styling
function showSubtitle(subtitle) {
  subtitleDisplay.textContent = subtitle.text;

  // Apply styling
  subtitleDisplay.style.fontFamily = subtitle.fontFamily || 'Arial, sans-serif';
  subtitleDisplay.style.fontSize = (subtitle.fontSize || 32) + 'px';
  subtitleDisplay.style.color = subtitle.fontColor || '#ffffff';

  // Apply position
  subtitleDisplay.className = 'subtitle-display ' + (subtitle.position || 'bottom');

  subtitleDisplay.style.display = 'block';

  console.log('[Preview] Showing subtitle:', subtitle.text);
}

// Hide subtitle
function hideSubtitle() {
  subtitleDisplay.style.display = 'none';
}

// Play voiceover audio
async function playVoiceover(voiceover) {
  try {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    let audioBlob = voiceover.audioBlob;

    // If audioBlob is not directly available, try to fetch from IndexedDB
    if (!audioBlob && voiceover.blobId) {
      console.log('[Preview] Loading voiceover from IndexedDB:', voiceover.blobId);
      try {
        audioBlob = await getVoiceoverBlob(voiceover.blobId);
        console.log('[Preview] Successfully loaded voiceover blob from IndexedDB');
      } catch (dbError) {
        console.error('[Preview] Failed to load voiceover from IndexedDB:', dbError);
        return;
      }
    }

    if (!audioBlob) {
      console.warn('[Preview] Voiceover audio blob not found (no audioBlob or blobId)');
      return;
    }

    // Create and play audio
    currentAudio = new Audio();
    currentAudio.src = URL.createObjectURL(audioBlob);

    try {
      await currentAudio.play();
      console.log('[Preview] Playing voiceover audio (duration:', voiceover.duration, 'ms)');
    } catch (playError) {
      console.error('[Preview] Failed to play audio:', playError);
    }

    // Clean up URL after playing
    currentAudio.addEventListener('ended', () => {
      URL.revokeObjectURL(currentAudio.src);
      currentAudio = null;
    });

  } catch (error) {
    console.error('[Preview] Error playing voiceover:', error);
  }
}

// Get voiceover blob from IndexedDB
function getVoiceoverBlob(blobId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayDB', 3);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('audioRecordings')) {
        db.createObjectStore('audioRecordings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('webcamRecordings')) {
        db.createObjectStore('webcamRecordings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('voiceovers')) {
        db.createObjectStore('voiceovers');
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      // Check if voiceovers store exists
      if (!db.objectStoreNames.contains('voiceovers')) {
        reject(new Error('Voiceovers store not found'));
        return;
      }

      const transaction = db.transaction(['voiceovers'], 'readonly');
      const store = transaction.objectStore('voiceovers');
      const getRequest = store.get(blobId);

      getRequest.onsuccess = () => {
        resolve(getRequest.result);
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    };
  });
}

// Load audio from IndexedDB
async function getAudioFromDB(recordingId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayDB', 3);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('audioRecordings')) {
        db.createObjectStore('audioRecordings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('webcamRecordings')) {
        db.createObjectStore('webcamRecordings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('voiceovers')) {
        db.createObjectStore('voiceovers');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['audioRecordings'], 'readonly');
      const store = transaction.objectStore('audioRecordings');
      const getRequest = store.get(recordingId);

      getRequest.onsuccess = () => {
        db.close();
        if (getRequest.result) {
          resolve(getRequest.result.blob);
        } else {
          reject(new Error('No audio found'));
        }
      };
      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };
  });
}

// Load webcam from IndexedDB
async function getWebcamFromDB(recordingId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayDB', 3);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('audioRecordings')) {
        db.createObjectStore('audioRecordings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('webcamRecordings')) {
        db.createObjectStore('webcamRecordings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('voiceovers')) {
        db.createObjectStore('voiceovers');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['webcamRecordings'], 'readonly');
      const store = transaction.objectStore('webcamRecordings');
      const getRequest = store.get(recordingId);

      getRequest.onsuccess = () => {
        db.close();
        if (getRequest.result) {
          resolve(getRequest.result.blob);
        } else {
          reject(new Error('No webcam found'));
        }
      };
      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };
  });
}

console.log('[Preview] Preview script loaded and ready');
