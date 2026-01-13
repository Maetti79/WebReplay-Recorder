// Replay content script - executes recorded events directly in a tab
let storyboard = null;
let currentEventIndex = 0;
let isReplaying = false;
let replayTimeout = null;
let activeSubtitles = [];
let currentAudio = null;
let replayStartTime = null;
let replaySpeed = 1;

// Visual overlay elements
let overlayContainer = null;
let fakeCursor = null;
let clickMarker = null;
let subtitleDisplay = null;
let statusIndicator = null;
let audioElement = null; // Audio element for voiceover playback

// Recording state
let recordingMode = false;
let recordingButton = null;
let videoConfig = null;
let recordingId = null;
let replayInitialized = false; // Flag to prevent premature auto-resume

console.log('[Replay] ========================================');
console.log('[Replay] Content script loaded');
console.log('[Replay] Checking for existing state...');

// Check immediately if there's state (for debugging)
const immediateStateCheck = sessionStorage.getItem('webReplayState');
if (immediateStateCheck) {
  console.log('[Replay] ✅ Found existing replay state in sessionStorage');
  try {
    const state = JSON.parse(immediateStateCheck);
    console.log('[Replay] State details:');
    console.log('  - Current event index:', state.currentEventIndex);
    console.log('  - Total events:', state.storyboard?.timeline?.length || 'unknown');
    console.log('  - Is replaying:', state.isReplaying);
    console.log('  - State age:', (Date.now() - state.timestamp) / 1000, 'seconds');
  } catch (e) {
    console.error('[Replay] Failed to parse state:', e);
  }
} else {
  console.log('[Replay] No existing replay state found');
}
console.log('[Replay] ========================================');

// Storage keys
const STORAGE_KEY = 'webReplayState';

// Save replay state to sessionStorage
function saveReplayState() {
  if (!isReplaying || !storyboard) return;

  const state = {
    storyboard: storyboard,
    currentEventIndex: currentEventIndex,
    isReplaying: isReplaying,
    replayStartTime: replayStartTime,
    replaySpeed: replaySpeed,
    recordingMode: recordingMode,  // IMPORTANT: Save recording mode flag
    videoConfig: videoConfig,      // Save video config
    recordingId: recordingId,      // Save recording ID
    timestamp: Date.now()
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[Replay] State saved:', currentEventIndex, '/', storyboard.timeline.length, '(recording mode:', recordingMode, ')');
  } catch (error) {
    console.error('[Replay] Failed to save state:', error);
  }
}

// Load replay state from sessionStorage
function loadReplayState() {
  try {
    const stateStr = sessionStorage.getItem(STORAGE_KEY);
    if (!stateStr) return null;

    const state = JSON.parse(stateStr);

    // Check if state is recent (within last 30 seconds)
    if (Date.now() - state.timestamp > 30000) {
      console.log('[Replay] State expired, clearing');
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    console.log('[Replay] State loaded:', state.currentEventIndex, '/', state.storyboard.timeline.length);
    return state;
  } catch (error) {
    console.error('[Replay] Failed to load state:', error);
    return null;
  }
}

// Clear replay state
function clearReplayState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    console.log('[Replay] State cleared');
  } catch (error) {
    console.error('[Replay] Failed to clear state:', error);
  }
}

// Create visual overlay elements
function createOverlays() {
  // Create container
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'replay-overlay-container';
  overlayContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999999;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  // Create fake cursor
  fakeCursor = document.createElement('div');
  fakeCursor.style.cssText = `
    position: fixed;
    width: 20px;
    height: 20px;
    pointer-events: none;
    z-index: 1000000;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: none;
  `;
  fakeCursor.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));">
      <path d="M5.5 3.21V20.8l5.2-4.57 3.06 6.47 3.81-1.94-3.06-6.47 7.66-.43L5.5 3.21z" fill="#ffffff" stroke="#000000" stroke-width="1"/>
    </svg>
  `;

  // Create click marker
  clickMarker = document.createElement('div');
  clickMarker.style.cssText = `
    position: fixed;
    width: 24px;
    height: 24px;
    border: 3px solid #ef4444;
    border-radius: 50%;
    display: none;
    pointer-events: none;
    transform: translate(-50%, -50%);
    z-index: 1000001;
  `;

  // Create subtitle display
  subtitleDisplay = document.createElement('div');
  subtitleDisplay.style.cssText = `
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000002;
    text-align: center;
    padding: 20px 40px 40px;
    pointer-events: none;
    text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.95),
                 -1px -1px 4px rgba(0, 0, 0, 0.8),
                 1px 1px 4px rgba(0, 0, 0, 0.8),
                 0 0 16px rgba(0, 0, 0, 0.9);
    font-weight: 700;
    line-height: 1.5;
    display: none;
    background: linear-gradient(to bottom,
                rgba(0, 0, 0, 0) 0%,
                rgba(0, 0, 0, 0.75) 50%,
                rgba(0, 0, 0, 0) 100%);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    letter-spacing: 0.02em;
    color: white;
    font-size: 24px;
  `;

  // Create status indicator
  statusIndicator = document.createElement('div');
  statusIndicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2563eb;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    border: 1px solid #2563eb;
    z-index: 1000003;
    display: none;
    pointer-events: auto;
  `;

  // Append all to container
  overlayContainer.appendChild(fakeCursor);
  overlayContainer.appendChild(clickMarker);
  overlayContainer.appendChild(subtitleDisplay);
  overlayContainer.appendChild(statusIndicator);

  document.body.appendChild(overlayContainer);

  // Create audio element for voiceover playback (must be in DOM to be capturable)
  audioElement = document.createElement('audio');
  audioElement.style.display = 'none';
  audioElement.preload = 'auto';
  document.body.appendChild(audioElement);
  console.log('[Replay] Audio element created and added to DOM');

  // Add click animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes clickPulse {
      0% {
        transform: translate(-50%, -50%) scale(0.5);
        opacity: 1;
        border-width: 3px;
      }
      50% {
        transform: translate(-50%, -50%) scale(1.5);
        opacity: 0.6;
        border-width: 2px;
      }
      100% {
        transform: translate(-50%, -50%) scale(2);
        opacity: 0;
        border-width: 1px;
      }
    }

    @keyframes subtitleFadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes subtitleFadeOut {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(20px);
      }
    }
  `;
  document.head.appendChild(style);

  console.log('[Replay] Overlays created');
}

// Create recording button for recording mode
function createRecordingButton() {
  recordingButton = document.createElement('button');
  recordingButton.textContent = '🎥 Start Recording';
  recordingButton.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: #dc2626;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    border: 2px solid #dc2626;
    z-index: 1000004;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.2s ease;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  recordingButton.addEventListener('mouseenter', () => {
    recordingButton.style.background = '#b91c1c';
    recordingButton.style.borderColor = '#b91c1c';
    recordingButton.style.transform = 'scale(1.05)';
  });

  recordingButton.addEventListener('mouseleave', () => {
    recordingButton.style.background = '#dc2626';
    recordingButton.style.borderColor = '#dc2626';
    recordingButton.style.transform = 'scale(1)';
  });

  recordingButton.addEventListener('click', async () => {
    console.log('[Replay] Recording button clicked');
    await startRecording();
  });

  overlayContainer.appendChild(recordingButton);
  console.log('[Replay] Recording button created');
}

// Start recording the tab
async function startRecording() {
  try {
    console.log('[Replay] Starting tab recording...');
    console.log('[Replay] Current URL:', window.location.href);
    console.log('[Replay] Storyboard exists:', !!storyboard);
    console.log('[Replay] Timeline events:', storyboard?.timeline?.length || 0);

    if (!storyboard) {
      throw new Error('No storyboard loaded - cannot start recording');
    }

    if (!storyboard.timeline || storyboard.timeline.length === 0) {
      throw new Error('Storyboard has no events - cannot start recording');
    }

    // Check if we have a valid URL
    const currentUrl = window.location.href;
    if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('about:')) {
      throw new Error('Cannot record on chrome:// or about: pages. Must be on a valid URL.');
    }

    console.log('[Replay] Requesting screen capture with preferCurrentTab...');

    // Use actual screen dimensions for video recording to prevent blurring
    const fallbackWidth = window.screen.width || 1920;
    const fallbackHeight = window.screen.height || 1080;

    // Use getDisplayMedia with preferCurrentTab to auto-select current tab
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        width: { ideal: videoConfig?.width || fallbackWidth },
        height: { ideal: videoConfig?.height || fallbackHeight },
        frameRate: { ideal: 30 }
      },
      audio: false,
      preferCurrentTab: true // Auto-select current tab (Chrome 109+)
    });

    if (!stream) {
      throw new Error('Failed to get display media stream');
    }

    console.log('[Replay] ✅ Got media stream');
    console.log('[Replay] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, label: t.label })));

    // IMPORTANT: Filter out navigate events - recordings can't survive page navigation
    // because the MediaStream is destroyed when the page navigates
    const originalLength = storyboard.timeline.length;
    storyboard.timeline = storyboard.timeline.filter(event => event.type !== 'navigate');
    if (storyboard.timeline.length < originalLength) {
      const removed = originalLength - storyboard.timeline.length;
      console.log('[Replay] ⚠️ Removed', removed, 'navigate event(s) from timeline for recording mode');
      console.log('[Replay] Recording will only capture events on the current page');
      updateStatus(`⚠️ Removed ${removed} navigation event(s) - video recordings capture single page only`, true);
    }

    console.log('[Replay] Final timeline length:', storyboard.timeline.length, 'events');
    console.log('[Replay] ✅ Recording setup complete');

    // Setup MediaRecorder in content script (we have the stream here)
    const options = {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log('[Replay] VP9 not supported, using VP8');
      options.mimeType = 'video/webm;codecs=vp8';
    }

    const mediaRecorder = new MediaRecorder(stream, options);
    const videoChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      console.log('[Replay] ondataavailable fired, data size:', event.data?.size || 0);
      if (event.data && event.data.size > 0) {
        videoChunks.push(event.data);
        const totalSize = videoChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log('[Replay] Video chunk #' + videoChunks.length + ':', event.data.size, 'bytes, total:', totalSize, 'bytes');
      } else {
        console.warn('[Replay] Empty data chunk received');
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[Replay] MediaRecorder onstop fired!');
      console.log('[Replay] Total chunks collected:', videoChunks.length);

      const totalSize = videoChunks.reduce((sum, chunk) => sum + chunk.size, 0);
      console.log('[Replay] Total video size:', totalSize, 'bytes', '(' + (totalSize / 1024 / 1024).toFixed(2) + ' MB)');

      stream.getTracks().forEach(track => {
        console.log('[Replay] Stopping track:', track.kind, track.label);
        track.stop();
      });

      if (videoChunks.length === 0) {
        console.error('[Replay] No video chunks recorded!');
        updateStatus('❌ No video data recorded', true);
        return;
      }

      const blob = new Blob(videoChunks, { type: 'video/webm' });
      console.log('[Replay] Created blob:', blob.size, 'bytes, type:', blob.type);

      if (blob.size === 0) {
        console.error('[Replay] Video blob is 0 bytes!');
        updateStatus('❌ Video is 0 bytes - recording failed', true);
        return;
      }

      console.log('[Replay] Converting blob to data URL...');
      // Convert to data URL for sending to background
      const reader = new FileReader();

      reader.onerror = (error) => {
        console.error('[Replay] FileReader error:', error);
        updateStatus('❌ Failed to read video data', true);
      };

      reader.onloadend = async () => {
        console.log('[Replay] FileReader finished');
        const dataUrl = reader.result;
        console.log('[Replay] Data URL length:', dataUrl?.length || 0, 'characters');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                          new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `replay_${recordingId || 'video'}_${timestamp}.webm`;

        console.log('[Replay] Sending video to background for download...', filename);

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'DOWNLOAD_VIDEO_BLOB',
            dataUrl: dataUrl,
            filename: filename
          });

          console.log('[Replay] Download response:', response);

          if (response && response.success) {
            console.log('[Replay] ✅ Download initiated successfully');
            updateStatus('✅ Video downloaded: ' + filename, false);

            if (recordingButton) {
              recordingButton.textContent = '✅ Recording Complete';
              recordingButton.style.background = '#16a34a';
              recordingButton.style.borderColor = '#16a34a';
            }

            setTimeout(() => {
              console.log('[Replay] Closing tab...');
              window.close();
            }, 2000);
          } else {
            console.error('[Replay] Download failed:', response?.error);
            updateStatus('❌ Download failed: ' + (response?.error || 'Unknown error'), true);
          }
        } catch (error) {
          console.error('[Replay] Error sending download message:', error);
          updateStatus('❌ Failed to send download message', true);
        }
      };

      console.log('[Replay] Starting FileReader...');
      reader.readAsDataURL(blob);
    };

    mediaRecorder.onerror = (error) => {
      console.error('[Replay] MediaRecorder error:', error);
      stream.getTracks().forEach(track => track.stop());
      updateStatus('❌ Recording error', true);
    };

    mediaRecorder.onstart = () => {
      console.log('[Replay] MediaRecorder onstart event fired!');
      console.log('[Replay] MediaRecorder state:', mediaRecorder.state);
    };

    // Start recording
    console.log('[Replay] Calling mediaRecorder.start(1000)...');
    mediaRecorder.start(1000);
    console.log('[Replay] mediaRecorder.start() called, state:', mediaRecorder.state);

    // Store for later
    window._activeRecording = { mediaRecorder, stream, chunks: videoChunks };
    console.log('[Replay] Stored recording in window._activeRecording');

    // Update button
    recordingButton.textContent = '🔴 Recording...';
    recordingButton.style.background = '#16a34a';
    recordingButton.style.borderColor = '#16a34a';
    recordingButton.disabled = true;
    recordingButton.style.cursor = 'not-allowed';
    recordingButton.style.opacity = '0.8';

    console.log('[Replay] Now starting replay...');

    // Start replay
    startReplay(storyboard, 0, replaySpeed);

  } catch (error) {
    console.error('[Replay] Failed to start recording:', error);
    console.error('[Replay] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    updateStatus('❌ Recording failed: ' + error.message, true);

    // Reset button
    if (recordingButton) {
      recordingButton.textContent = '🎥 Start Recording';
      recordingButton.style.background = '#dc2626';
      recordingButton.style.borderColor = '#dc2626';
      recordingButton.disabled = false;
      recordingButton.style.cursor = 'pointer';
      recordingButton.style.opacity = '1';
    }
  }
}

// Stop recording
async function stopRecording() {
  console.log('[Replay] stopRecording() called');

  if (recordingButton) {
    recordingButton.textContent = '⏳ Processing video...';
    recordingButton.style.background = '#2563eb';
    recordingButton.style.borderColor = '#2563eb';
  }

  const recording = window._activeRecording;
  console.log('[Replay] Active recording:', recording ? 'found' : 'NOT FOUND');

  if (!recording) {
    console.error('[Replay] No active recording found in window._activeRecording!');
    updateStatus('❌ No active recording found', true);
    return;
  }

  const { mediaRecorder, stream, chunks } = recording;
  console.log('[Replay] MediaRecorder state:', mediaRecorder?.state);
  console.log('[Replay] Stream active:', stream?.active);
  console.log('[Replay] Chunks collected so far:', chunks?.length || 0);

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    console.log('[Replay] MediaRecorder is', mediaRecorder.state, '- requesting final data...');
    mediaRecorder.requestData();

    console.log('[Replay] Waiting 500ms before stopping...');
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.log('[Replay] Now calling mediaRecorder.stop()...');
        mediaRecorder.stop();
        console.log('[Replay] mediaRecorder.stop() called, state:', mediaRecorder.state);
      } else {
        console.log('[Replay] MediaRecorder became inactive before timeout');
      }
    }, 500);
  } else {
    console.warn('[Replay] MediaRecorder is already inactive, state:', mediaRecorder?.state);
  }
}


// Move cursor to position
function moveCursor(x, y) {
  if (!fakeCursor) return;
  fakeCursor.style.left = x + 'px';
  fakeCursor.style.top = y + 'px';
  fakeCursor.style.display = 'block';
  console.log('[Replay] Moving cursor to:', x, y);
}

// Show click animation
function showClickAnimation(x, y) {
  if (!clickMarker) return;
  clickMarker.style.left = x + 'px';
  clickMarker.style.top = y + 'px';
  clickMarker.style.display = 'block';
  clickMarker.style.animation = 'none';
  setTimeout(() => {
    clickMarker.style.animation = 'clickPulse 0.6s ease-out';
  }, 10);
  setTimeout(() => {
    clickMarker.style.display = 'none';
  }, 600);
}

// Show subtitle
function showSubtitle(text, duration, fontSize, color, position) {
  if (!subtitleDisplay) return;

  subtitleDisplay.textContent = text;
  subtitleDisplay.style.fontSize = (fontSize || 24) + 'px';
  subtitleDisplay.style.color = color || 'white';

  // Position
  subtitleDisplay.style.bottom = '';
  subtitleDisplay.style.top = '';
  if (position === 'top') {
    subtitleDisplay.style.top = '0';
    subtitleDisplay.style.paddingTop = '40px';
  } else if (position === 'middle') {
    subtitleDisplay.style.top = '50%';
    subtitleDisplay.style.transform = 'translateY(-50%)';
  } else {
    subtitleDisplay.style.bottom = '0';
    subtitleDisplay.style.paddingBottom = '40px';
  }

  subtitleDisplay.style.display = 'block';
  subtitleDisplay.style.animation = 'subtitleFadeIn 0.3s ease-out';

  console.log('[Replay] Showing subtitle:', text);
}

// Hide subtitle
function hideSubtitle() {
  if (!subtitleDisplay) return;
  subtitleDisplay.style.animation = 'subtitleFadeOut 0.3s ease-out';
  setTimeout(() => {
    subtitleDisplay.style.display = 'none';
  }, 300);
}

// Update status
function updateStatus(text, isError = false) {
  if (!statusIndicator) return;
  statusIndicator.textContent = text;
  statusIndicator.style.background = isError ? '#dc2626' : '#2563eb';
  statusIndicator.style.borderColor = isError ? '#dc2626' : '#2563eb';
  statusIndicator.style.display = 'block';
}

// Execute event
function executeEvent(event) {
  // Log event execution with details
  console.group(`%c[Replay] Executing Event: ${event.type}`, 'color: #059669; font-weight: bold');
  console.log('Event Data:', event);
  console.log('Timestamp:', event.t + 'ms');
  console.log('Event Index:', currentEventIndex + '/' + (storyboard ? storyboard.timeline.length : '?'));
  console.log('Replay Speed:', replaySpeed + 'x');
  if (event.target) console.log('Target:', event.target);
  if (event.position) console.log('Position:', event.position);
  if (event.text) console.log('Text:', event.text);
  if (event.url) console.log('URL:', event.url);
  console.groupEnd();

  // Handle navigation - save state before navigating
  if (event.type === 'navigate' && event.url) {
    console.log('%c[Replay] Preparing to navigate to: ' + event.url, 'color: #f59e0b; font-weight: bold');

    // Move to next event before navigation
    currentEventIndex++;

    // Save state so we can resume after page loads
    saveReplayState();

    // Navigate
    console.log('[Replay] Navigating now...');
    window.location.href = event.url;
    return;
  }

  // Execute click
  if (event.type === 'click') {
    if (event.position) {
      moveCursor(event.position.x, event.position.y);
      showClickAnimation(event.position.x, event.position.y);
    }

    // Find target element
    let targetElement = null;
    if (event.target && event.target.selectors) {
      for (const selector of event.target.selectors) {
        try {
          targetElement = document.querySelector(selector);
          if (targetElement) {
            console.log('[Replay] Found element with selector:', selector);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    // Fallback to position
    if (!targetElement && event.position) {
      targetElement = document.elementFromPoint(event.position.x, event.position.y);
      console.log('[Replay] Found element at position:', event.position);
    }

    if (targetElement) {
      targetElement.click();
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: event.position?.x || 0,
        clientY: event.position?.y || 0
      });
      targetElement.dispatchEvent(clickEvent);
      console.log('[Replay] Clicked element:', targetElement);
    }
  }

  // Execute typing
  if (event.type === 'type') {
    let targetElement = null;
    if (event.target && event.target.selectors) {
      for (const selector of event.target.selectors) {
        try {
          targetElement = document.querySelector(selector);
          if (targetElement) break;
        } catch (e) {
          continue;
        }
      }
    }

    if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
      const rect = targetElement.getBoundingClientRect();
      moveCursor(rect.left + rect.width / 2, rect.top + rect.height / 2);

      const text = event.text || '';
      const charsPerSec = event.typing?.charsPerSec || 10;
      const delayPerChar = 1000 / charsPerSec;

      targetElement.value = '';
      targetElement.focus();

      let currentIndex = 0;
      const typeInterval = setInterval(() => {
        if (currentIndex < text.length && isReplaying) {
          targetElement.value += text[currentIndex];
          targetElement.dispatchEvent(new Event('input', { bubbles: true }));
          currentIndex++;
        } else {
          clearInterval(typeInterval);
          targetElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, delayPerChar);
    }
  }

  // Execute hover
  if (event.type === 'hover') {
    if (event.position) {
      moveCursor(event.position.x, event.position.y);
    }

    let targetElement = null;
    if (event.target && event.target.selectors) {
      for (const selector of event.target.selectors) {
        try {
          targetElement = document.querySelector(selector);
          if (targetElement) break;
        } catch (e) {
          continue;
        }
      }
    }

    if (!targetElement && event.position) {
      targetElement = document.elementFromPoint(event.position.x, event.position.y);
    }

    if (targetElement) {
      const mouseOverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        clientX: event.position?.x || 0,
        clientY: event.position?.y || 0
      });
      targetElement.dispatchEvent(mouseOverEvent);
      targetElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
  }

  // Execute focus
  if (event.type === 'focus') {
    let targetElement = null;
    if (event.target && event.target.selectors) {
      for (const selector of event.target.selectors) {
        try {
          targetElement = document.querySelector(selector);
          if (targetElement) break;
        } catch (e) {
          continue;
        }
      }
    }

    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      moveCursor(rect.left + rect.width / 2, rect.top + rect.height / 2);
      targetElement.focus();
      targetElement.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    }
  }

  // Execute blur
  if (event.type === 'blur') {
    let targetElement = null;
    if (event.target && event.target.selectors) {
      for (const selector of event.target.selectors) {
        try {
          targetElement = document.querySelector(selector);
          if (targetElement) break;
        } catch (e) {
          continue;
        }
      }
    }

    if (targetElement) {
      targetElement.blur();
      targetElement.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    }
  }

  // Execute scroll
  if (event.type === 'scroll' && event.position) {
    window.scrollTo({
      left: event.position.x,
      top: event.position.y,
      behavior: 'smooth'
    });
  }

  // Execute keypress
  if (event.type === 'keypress') {
    const keyEvent = new KeyboardEvent('keydown', {
      key: event.key,
      bubbles: true,
      cancelable: true,
      ctrlKey: event.modifiers?.ctrl || false,
      altKey: event.modifiers?.alt || false,
      shiftKey: event.modifiers?.shift || false,
      metaKey: event.modifiers?.meta || false
    });

    if (event.target && event.target.selectors) {
      let targetElement = null;
      for (const selector of event.target.selectors) {
        try {
          targetElement = document.querySelector(selector);
          if (targetElement) break;
        } catch (e) {
          continue;
        }
      }
      if (targetElement) {
        targetElement.dispatchEvent(keyEvent);
      } else {
        document.body.dispatchEvent(keyEvent);
      }
    } else {
      document.body.dispatchEvent(keyEvent);
    }
  }

  // Execute file upload
  if (event.type === 'upload' && event.files && event.files.length > 0) {
    let targetElement = null;
    if (event.target && event.target.selectors) {
      for (const selector of event.target.selectors) {
        try {
          targetElement = document.querySelector(selector);
          if (targetElement) break;
        } catch (e) {
          continue;
        }
      }
    }

    if (targetElement && targetElement.tagName === 'INPUT' && targetElement.type === 'file') {
      const filePromises = event.files.map(fileData => {
        return fetch(fileData.data)
          .then(res => res.blob())
          .then(blob => new File([blob], fileData.name, {
            type: fileData.type,
            lastModified: fileData.lastModified
          }));
      });

      Promise.all(filePromises).then(files => {
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        targetElement.files = dataTransfer.files;
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  }
}

// Execute next event
function executeNextEvent() {
  if (!isReplaying || !storyboard || currentEventIndex >= storyboard.timeline.length) {
    stopReplay(true);
    return;
  }

  const event = storyboard.timeline[currentEventIndex];
  const nextEvent = storyboard.timeline[currentEventIndex + 1];

  // Save state before executing (in case of navigation)
  saveReplayState();

  executeEvent(event);

  // If this was a navigation event, don't schedule next event
  // The script will resume automatically after page load
  if (event.type === 'navigate') {
    console.log('[Replay] Navigation event executed, waiting for page load...');
    return;
  }

  // Calculate delay
  let delay = 0;
  if (nextEvent) {
    delay = nextEvent.t - event.t;
  } else {
    delay = event.durationMs || 1000;
  }

  // Apply speed multiplier
  delay = delay / replaySpeed;

  updateStatus(`Event ${currentEventIndex + 1}/${storyboard.timeline.length} (${replaySpeed}x)`);

  currentEventIndex++;
  replayTimeout = setTimeout(executeNextEvent, Math.min(delay, 5000));
}

// Schedule subtitles
function scheduleSubtitles() {
  if (!storyboard.subtitles) return;

  console.log('[Replay] Scheduling', storyboard.subtitles.length, 'subtitles');

  storyboard.subtitles.forEach((subtitle, index) => {
    const showTimeout = setTimeout(async () => {
      if (isReplaying) {
        console.log('[Replay] Showing subtitle', index + 1, ':', subtitle.text);

        showSubtitle(
          subtitle.text,
          subtitle.duration,
          subtitle.fontSize,
          subtitle.color,
          subtitle.position
        );

        // Play voiceover audio if available
        if (subtitle.voiceover) {
          console.log('[Replay] Subtitle has voiceover, attempting to play...');
          console.log('[Replay] Voiceover data:', {
            hasBlobId: !!subtitle.voiceover.blobId,
            hasAudioBlob: !!subtitle.voiceover.audioBlob,
            hasAudioBase64: !!subtitle.voiceover.audioBase64,
            audioBlobType: typeof subtitle.voiceover.audioBlob,
            audioBlobIsBlob: subtitle.voiceover.audioBlob instanceof Blob,
            offset: subtitle.voiceover.offset,
            duration: subtitle.voiceover.duration
          });

          try {
            let audioBlob = null;

            // Check if we have base64 audio (passed via message)
            if (subtitle.voiceover.audioBase64) {
              console.log('[Replay] Converting base64 to Blob...');
              try {
                // Decode base64 to binary string
                const binaryString = atob(subtitle.voiceover.audioBase64);
                // Convert binary string to Uint8Array
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                // Create Blob from Uint8Array
                audioBlob = new Blob([bytes], { type: subtitle.voiceover.audioType || 'audio/mpeg' });
                console.log('[Replay] ✅ Converted base64 to Blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
              } catch (conversionError) {
                console.error('[Replay] Failed to convert base64 to Blob:', conversionError);
              }
            }
            // Check if audioBlob is actually a valid Blob object
            else if (subtitle.voiceover.audioBlob instanceof Blob) {
              console.log('[Replay] Using audioBlob from memory');
              audioBlob = subtitle.voiceover.audioBlob;
            }
            // Otherwise, load from IndexedDB using blobId
            else if (subtitle.voiceover.blobId) {
              console.log('[Replay] Loading from IndexedDB:', subtitle.voiceover.blobId);
              audioBlob = await loadVoiceoverFromDB(subtitle.voiceover.blobId);
              console.log('[Replay] Loaded from IndexedDB:', !!audioBlob);
            }
            // No valid source
            else {
              console.error('[Replay] No valid audio source - neither base64, Blob in memory, nor blobId for IndexedDB');
            }

            if (audioBlob && audioBlob instanceof Blob) {
              console.log('[Replay] Audio blob size:', audioBlob.size, 'bytes, type:', audioBlob.type);

              // Use the DOM audio element
              if (!audioElement) {
                console.error('[Replay] Audio element not found! Creating one...');
                audioElement = document.createElement('audio');
                audioElement.style.display = 'none';
                document.body.appendChild(audioElement);
              }

              const audioUrl = URL.createObjectURL(audioBlob);
              audioElement.src = audioUrl;
              audioElement.volume = 1.0;

              audioElement.onplay = () => {
                console.log('[Replay] 🔊 Voiceover playing via DOM audio element');
              };

              audioElement.onended = () => {
                console.log('[Replay] Voiceover ended');
                URL.revokeObjectURL(audioUrl);
                audioElement.src = '';
              };

              audioElement.onerror = (error) => {
                console.error('[Replay] Voiceover playback error:', error, audioElement.error);
                URL.revokeObjectURL(audioUrl);
                audioElement.src = '';
              };

              audioElement.onloadeddata = () => {
                console.log('[Replay] Audio data loaded, duration:', audioElement.duration, 'seconds');
              };

              // Play the audio
              try {
                await audioElement.play();
                console.log('[Replay] ✅ Voiceover started playing');
              } catch (playError) {
                console.error('[Replay] Play error:', playError);
              }
            } else {
              console.warn('[Replay] No valid audio blob available for voiceover');
              console.warn('[Replay] Voiceover object:', subtitle.voiceover);
              console.warn('[Replay] This subtitle will be shown but no audio will play');
            }
          } catch (error) {
            console.error('[Replay] Error playing voiceover:', error);
          }
        } else {
          console.log('[Replay] Subtitle has no voiceover');
        }

        // Schedule hide
        const hideTimeout = setTimeout(() => {
          if (isReplaying) {
            hideSubtitle();
          }
        }, subtitle.duration);
        activeSubtitles.push(hideTimeout);
      }
    }, subtitle.time);
    activeSubtitles.push(showTimeout);
  });
}

// Load voiceover from IndexedDB
async function loadVoiceoverFromDB(blobId) {
  console.log('[Replay] loadVoiceoverFromDB called with blobId:', blobId);

  return new Promise((resolve, reject) => {
    // Use version 3 to match editor.js
    const request = indexedDB.open('WebReplayDB', 3);

    request.onerror = () => {
      console.error('[Replay] IndexedDB open error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[Replay] IndexedDB opened successfully, version:', request.result.version);
      const db = request.result;

      console.log('[Replay] Available stores:', Array.from(db.objectStoreNames));

      // Check if voiceovers store exists
      if (!db.objectStoreNames.contains('voiceovers')) {
        console.error('[Replay] IndexedDB does not contain "voiceovers" store');
        db.close();
        resolve(null);
        return;
      }

      const transaction = db.transaction(['voiceovers'], 'readonly');
      const store = transaction.objectStore('voiceovers');
      const getRequest = store.get(blobId);

      getRequest.onsuccess = () => {
        const result = getRequest.result;
        console.log('[Replay] IndexedDB get result:', result ? 'found' : 'not found');

        // Note: In editor.js, voiceovers are stored directly as blobs, not objects with a blob property
        // store.put(audioBlob, blobId) - so result IS the blob
        if (result) {
          if (result instanceof Blob) {
            console.log('[Replay] ✅ Loaded blob from IndexedDB:', result.size, 'bytes, type:', result.type);
            db.close();
            resolve(result);
          } else {
            console.warn('[Replay] Result is not a Blob:', typeof result);
            db.close();
            resolve(null);
          }
        } else {
          console.warn('[Replay] No voiceover found with blobId:', blobId);
          db.close();
          resolve(null);
        }
      };

      getRequest.onerror = () => {
        console.error('[Replay] IndexedDB get error:', getRequest.error);
        db.close();
        reject(getRequest.error);
      };
    };

    request.onupgradeneeded = (event) => {
      console.log('[Replay] IndexedDB upgrade needed, version:', event.oldVersion, '->', event.newVersion);
      const db = event.target.result;

      // Create all stores to match editor.js structure
      if (!db.objectStoreNames.contains('audioRecordings')) {
        console.log('[Replay] Creating audioRecordings object store');
        db.createObjectStore('audioRecordings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('webcamRecordings')) {
        console.log('[Replay] Creating webcamRecordings object store');
        db.createObjectStore('webcamRecordings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('voiceovers')) {
        console.log('[Replay] Creating voiceovers object store');
        db.createObjectStore('voiceovers'); // No keyPath - uses inline keys
      }
    };
  });
}

// Play original recorded audio (microphone/tab audio)
async function playOriginalAudio() {
  if (!storyboard.originalAudio || !storyboard.originalAudio.audioBase64) {
    console.log('[Replay] No original audio to play');
    return;
  }

  console.log('[Replay] Playing original recorded audio...');
  const originalAudio = storyboard.originalAudio;

  try {
    // Convert base64 to Blob
    console.log('[Replay] Converting original audio base64 to Blob...');
    const binaryString = atob(originalAudio.audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: originalAudio.audioType || 'audio/webm' });
    console.log('[Replay] ✅ Converted original audio base64 to Blob:', audioBlob.size, 'bytes, type:', audioBlob.type);

    // Create a separate audio element for original audio
    const originalAudioElement = document.createElement('audio');
    originalAudioElement.style.display = 'none';
    originalAudioElement.id = 'webReplayOriginalAudio';
    document.body.appendChild(originalAudioElement);

    const audioUrl = URL.createObjectURL(audioBlob);
    originalAudioElement.src = audioUrl;
    originalAudioElement.volume = 1.0;

    originalAudioElement.onplay = () => {
      console.log('[Replay] 🎤 Original audio playing via DOM audio element');
    };

    originalAudioElement.onended = () => {
      console.log('[Replay] Original audio ended');
      URL.revokeObjectURL(audioUrl);
    };

    originalAudioElement.onerror = (error) => {
      console.error('[Replay] Original audio playback error:', error, originalAudioElement.error);
      URL.revokeObjectURL(audioUrl);
    };

    // Apply offset and play
    const offsetMs = originalAudio.offset || 0;
    if (offsetMs > 0) {
      console.log('[Replay] Delaying original audio playback by', offsetMs, 'ms');
      setTimeout(() => {
        console.log('[Replay] Starting original audio playback now');
        originalAudioElement.play().catch(err => {
          console.error('[Replay] Failed to play original audio:', err);
        });
      }, offsetMs);
    } else {
      console.log('[Replay] Starting original audio playback immediately');
      originalAudioElement.play().catch(err => {
        console.error('[Replay] Failed to play original audio:', err);
      });
    }
  } catch (error) {
    console.error('[Replay] Failed to play original audio:', error);
  }
}

// Start replay
function startReplay(receivedStoryboard, startIndex = 0, speed = 1) {
  if (isReplaying) {
    console.log('[Replay] Already replaying');
    return;
  }

  storyboard = receivedStoryboard;
  currentEventIndex = startIndex;
  replayStartTime = Date.now();
  replaySpeed = speed;

  console.log('%c[Replay] ▶️ Starting Replay', 'color: #059669; font-weight: bold; font-size: 14px');
  console.log('Total events:', storyboard.timeline.length);
  console.log('Starting at index:', startIndex);
  console.log('Replay speed:', speed + 'x');
  console.log('Subtitles:', storyboard.subtitles ? storyboard.subtitles.length : 0);

  if (storyboard.subtitles && storyboard.subtitles.length > 0) {
    const withVoiceover = storyboard.subtitles.filter(s => s.voiceover).length;
    console.log('Subtitles with voiceover:', withVoiceover);
    if (withVoiceover > 0) {
      console.log('First subtitle with voiceover:', storyboard.subtitles.find(s => s.voiceover));
    }
  }

  console.log('Base URL:', storyboard.meta?.baseUrl || 'Not set');

  if (!overlayContainer) {
    createOverlays();
  }

  isReplaying = true;

  updateStatus(`Starting replay... (${startIndex}/${storyboard.timeline.length})`);

  // Only schedule subtitles and play original audio if starting from beginning
  if (startIndex === 0) {
    scheduleSubtitles();
    playOriginalAudio();
  }

  // Save initial state
  saveReplayState();

  // Start executing events after a short delay
  setTimeout(() => {
    executeNextEvent();
  }, 1000);
}

// Resume replay from saved state
function resumeReplay() {
  console.log('[Replay] 🔄 Attempting to resume replay...');
  const state = loadReplayState();

  if (!state) {
    console.log('[Replay] ⚠️ No state to resume (sessionStorage empty)');
    return false;
  }

  console.log('[Replay] ✅ Found saved state!');
  console.log('[Replay] Current event index:', state.currentEventIndex);
  console.log('[Replay] Total events:', state.storyboard?.timeline?.length || 'unknown');
  console.log('[Replay] Replay speed:', state.replaySpeed || 1);
  console.log('[Replay] Recording mode:', state.recordingMode || false);
  console.log('[Replay] State age:', (Date.now() - state.timestamp) / 1000, 'seconds');

  storyboard = state.storyboard;
  currentEventIndex = state.currentEventIndex;
  isReplaying = state.isReplaying;
  replayStartTime = state.replayStartTime;
  replaySpeed = state.replaySpeed || 1;
  replayInitialized = true; // Mark as initialized when resuming

  // IMPORTANT: Restore recording mode flags across navigation
  if (state.recordingMode) {
    console.log('[Replay] ⚠️ WARNING: Recording mode was active, but MediaRecorder was lost during navigation!');
    console.log('[Replay] The recording cannot be recovered after navigation.');
    console.log('[Replay] Recording mode will be disabled for safety.');
    recordingMode = false;
    // Note: We can't restore window._activeRecording because the MediaRecorder
    // and MediaStream objects don't survive page navigation
  } else {
    recordingMode = state.recordingMode || false;
    videoConfig = state.videoConfig || null;
    recordingId = state.recordingId || null;
  }

  if (!overlayContainer) {
    console.log('[Replay] Creating overlays...');
    createOverlays();
  }

  updateStatus(`Resuming replay... (${currentEventIndex}/${storyboard.timeline.length})`, false);

  console.log('[Replay] Waiting 1 second before continuing execution...');
  // Continue executing from current index
  setTimeout(() => {
    console.log('[Replay] 🎬 Resuming event execution from index:', currentEventIndex);
    executeNextEvent();
  }, 1000);

  return true;
}

// Stop replay
function stopReplay(completed = false) {
  isReplaying = false;

  if (replayTimeout) {
    clearTimeout(replayTimeout);
    replayTimeout = null;
  }

  activeSubtitles.forEach(timeout => clearTimeout(timeout));
  activeSubtitles = [];

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  if (fakeCursor) fakeCursor.style.display = 'none';
  if (clickMarker) clickMarker.style.display = 'none';
  if (subtitleDisplay) subtitleDisplay.style.display = 'none';

  // Clear replay state
  clearReplayState();

  updateStatus(completed ? '✅ Replay Completed' : '⏹️ Replay Stopped', !completed);

  // Log completion details
  if (completed) {
    console.log('%c[Replay] ✅ Replay Completed Successfully!', 'color: #2e7d32; font-weight: bold; font-size: 14px');
    console.log(`Total events executed: ${currentEventIndex}/${storyboard ? storyboard.timeline.length : '?'}`);
    console.log(`Replay speed: ${replaySpeed}x`);

    // Stop recording if in recording mode
    console.log('[Replay] Recording mode flag:', recordingMode);
    console.log('[Replay] Active recording exists:', !!window._activeRecording);

    if (recordingMode) {
      console.log('[Replay] ✅ Recording mode is active - stopping recording...');
      updateStatus('✅ Replay complete, processing video...', false);
      setTimeout(() => {
        console.log('[Replay] Calling stopRecording() after 1 second delay...');
        stopRecording();
      }, 1000); // Wait 1 second to ensure all final events are captured
    } else {
      console.log('[Replay] ⚠️ Not in recording mode - no recording to stop');
    }

    // Wait 1.5 seconds after last event before notifying completion
    // This ensures all animations, transitions, and final UI states are captured
    // Total time to stop recording: ~2 seconds (1500ms + processing time + 500ms for MediaRecorder shutdown)
    console.log('[Replay] ⏱️ Waiting 1.5 seconds after last event to capture final animations...');
    updateStatus('✅ Replay complete, capturing final state...', false);

    setTimeout(() => {
      console.log('[Replay] ✅ Time elapsed, sending REPLAY_COMPLETE message');
      // Notify background that replay is complete
      try {
        chrome.runtime.sendMessage({
          type: 'REPLAY_COMPLETE',
          tabId: chrome?.runtime?.id // Include sender info
        });
        console.log('[Replay] Sent REPLAY_COMPLETE message to background (will be forwarded to side panel)');
      } catch (error) {
        console.warn('[Replay] Could not send completion message:', error);
      }
    }, 1500);
  } else {
    console.log('%c[Replay] ⏹️ Replay Stopped', 'color: #c62828; font-weight: bold');
    console.log(`Events executed: ${currentEventIndex}/${storyboard ? storyboard.timeline.length : '?'}`);

    // Stop recording if in recording mode
    if (recordingMode) {
      stopRecording();
    }
  }

  setTimeout(() => {
    if (statusIndicator && !recordingMode) statusIndicator.style.display = 'none';
  }, 3000);
}

// Listen for messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Replay] Received message:', message.type);

  if (message.type === 'START_TAB_REPLAY') {
    console.log('[Replay] Received START_TAB_REPLAY message');

    // Check if we're already replaying (after navigation re-injection)
    const existingState = loadReplayState();
    if (existingState && isReplaying) {
      console.log('[Replay] Already replaying after navigation - ignoring START_TAB_REPLAY');
      sendResponse({ success: true, alreadyRunning: true });
      return true;
    }

    // Mark as initialized to prevent auto-resume
    replayInitialized = true;

    // Store storyboard and config
    storyboard = message.storyboard;
    replaySpeed = message.speed || 1;

    // Check if this is recording mode
    if (message.recordingMode) {
      console.log('[Replay] 🎥 Recording mode enabled');
      recordingMode = true;
      videoConfig = message.videoConfig;
      recordingId = message.recordingId;

      // IMPORTANT: Clear any old replay state from sessionStorage
      clearReplayState();
      console.log('[Replay] Cleared old replay state for fresh recording');

      // Create overlays and recording button
      if (!overlayContainer) {
        createOverlays();
      }
      createRecordingButton();

      updateStatus('📹 Click "Start Recording" to begin', false);
    } else {
      // Normal replay mode - start immediately
      startReplay(message.storyboard, 0, message.speed || 1);
    }

    sendResponse({ success: true });
  } else if (message.type === 'STOP_TAB_REPLAY') {
    stopReplay(false);
    sendResponse({ success: true });
  } else if (message.type === 'RECORDING_COMPLETE') {
    console.log('[Replay] Recording complete notification from background');
    console.log('[Replay] Filename:', message.filename);

    updateStatus('✅ Video downloaded: ' + message.filename, false);

    if (recordingButton) {
      recordingButton.textContent = '✅ Recording Complete';
      recordingButton.style.background = '#16a34a';
      recordingButton.style.borderColor = '#16a34a';
    }

    // Close tab after delay
    setTimeout(() => {
      console.log('[Replay] Closing tab...');
      window.close();
    }, 2000);

    sendResponse({ success: true });
  }

  return true;
});

// Auto-resume replay if state exists (after page navigation)
// Check for replay state on script load (might be injected after page load)
console.log('[Replay] Script loaded, checking for replay state immediately...');
setTimeout(() => {
  // Check if there's a valid state in sessionStorage first
  const state = loadReplayState();

  if (state) {
    // If we have state, this is a resume after navigation - always resume
    console.log('[Replay] Found replay state on script load, resuming after navigation...');
    const resumed = resumeReplay();
    if (resumed) {
      console.log('[Replay] ✅ Successfully resumed replay after navigation (script load)');
    } else {
      console.warn('[Replay] ⚠️ Failed to resume replay despite having state');
    }
  } else {
    // No state - this is a fresh load, wait for initialization
    if (!replayInitialized) {
      console.log('[Replay] No saved state and not initialized yet - waiting for START_TAB_REPLAY message');
      return;
    }

    // Don't auto-resume if in recording mode (button should trigger replay)
    if (recordingMode) {
      console.log('[Replay] Recording mode - skipping auto-resume, waiting for button click');
      return;
    }

    console.log('[Replay] No saved replay state found on script load');
  }
}, 100);

// Also check on window load (in case script loads before page)
window.addEventListener('load', () => {
  console.log('[Replay] Page loaded, checking for replay state...');

  // Wait a bit for page to stabilize
  setTimeout(() => {
    // Don't try to resume if already replaying
    if (isReplaying) {
      console.log('[Replay] Already replaying, skipping window.load resume');
      return;
    }

    // Check if there's a valid state in sessionStorage first
    const state = loadReplayState();

    if (state) {
      // If we have state, this is a resume after navigation - always resume
      console.log('[Replay] Found replay state on window load, resuming after navigation...');
      const resumed = resumeReplay();
      if (resumed) {
        console.log('[Replay] ✅ Successfully resumed replay after navigation (window load)');
      } else {
        console.log('[Replay] No replay to resume on window load');
      }
    } else {
      // No state - this is a fresh load
      if (!replayInitialized) {
        console.log('[Replay] Not initialized yet - skipping window.load auto-resume');
        return;
      }

      // Don't auto-resume if in recording mode
      if (recordingMode) {
        console.log('[Replay] Recording mode - skipping window.load auto-resume');
        return;
      }

      console.log('[Replay] No saved replay state found on window load');
    }
  }, 500);
});
