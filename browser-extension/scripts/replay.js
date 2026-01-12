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

console.log('[Replay] Content script loaded');

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
    timestamp: Date.now()
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[Replay] State saved:', currentEventIndex, '/', storyboard.timeline.length);
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
  console.log('[Replay] Executing event:', event.type, event);

  // Handle navigation - save state before navigating
  if (event.type === 'navigate' && event.url) {
    console.log('[Replay] Preparing to navigate to:', event.url);

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

  storyboard.subtitles.forEach(subtitle => {
    const showTimeout = setTimeout(() => {
      if (isReplaying) {
        showSubtitle(
          subtitle.text,
          subtitle.duration,
          subtitle.fontSize,
          subtitle.color,
          subtitle.position
        );

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

  console.log('[Replay] Starting replay with', storyboard.timeline.length, 'events, starting at index', startIndex, 'at speed', speed + 'x');

  if (!overlayContainer) {
    createOverlays();
  }

  isReplaying = true;

  updateStatus(`Starting replay... (${startIndex}/${storyboard.timeline.length})`);

  // Only schedule subtitles if starting from beginning
  if (startIndex === 0) {
    scheduleSubtitles();
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
  const state = loadReplayState();
  if (!state) {
    console.log('[Replay] No state to resume');
    return false;
  }

  console.log('[Replay] Resuming replay from event', state.currentEventIndex);

  storyboard = state.storyboard;
  currentEventIndex = state.currentEventIndex;
  isReplaying = state.isReplaying;
  replayStartTime = state.replayStartTime;
  replaySpeed = state.replaySpeed || 1;

  if (!overlayContainer) {
    createOverlays();
  }

  updateStatus(`Resuming replay... (${currentEventIndex}/${storyboard.timeline.length})`);

  // Continue executing from current index
  setTimeout(() => {
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

  setTimeout(() => {
    if (statusIndicator) statusIndicator.style.display = 'none';
  }, 3000);

  console.log('[Replay] Replay stopped');
}

// Listen for messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Replay] Received message:', message.type);

  if (message.type === 'START_TAB_REPLAY') {
    startReplay(message.storyboard, 0, message.speed || 1);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_TAB_REPLAY') {
    stopReplay(false);
    sendResponse({ success: true });
  }

  return true;
});

// Auto-resume replay if state exists (after page navigation)
window.addEventListener('load', () => {
  console.log('[Replay] Page loaded, checking for replay state...');

  // Wait a bit for page to stabilize
  setTimeout(() => {
    const resumed = resumeReplay();
    if (resumed) {
      console.log('[Replay] Successfully resumed replay after navigation');
    } else {
      console.log('[Replay] No replay to resume');
    }
  }, 500);
});
