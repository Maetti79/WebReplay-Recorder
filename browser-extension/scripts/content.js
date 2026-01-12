// Content script - captures user interactions on the page

let isRecording = false;
let startTime = null;
let recordedEvents = [];

// Generate robust selectors for an element
function generateSelectors(element) {
  const selectors = [];
  const textHint = element.textContent?.trim().substring(0, 50) || null;

  // Try stable attributes first
  if (element.id) {
    selectors.push(`#${element.id}`);
  }

  if (element.getAttribute('data-testid')) {
    selectors.push(`[data-testid="${element.getAttribute('data-testid')}"]`);
  }

  if (element.name) {
    selectors.push(`[name="${element.name}"]`);
  }

  if (element.getAttribute('aria-label')) {
    selectors.push(`[aria-label="${element.getAttribute('aria-label')}"]`);
  }

  // Generate CSS path
  let path = [];
  let current = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ').filter(c => c && !c.match(/^(hover|active|focus)/));
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }

    path.unshift(selector);
    current = current.parentElement;

    // Limit depth
    if (path.length >= 5) break;
  }

  if (path.length > 0) {
    selectors.push(path.join(' > '));
  }

  // Add type-specific selectors
  if (element.tagName === 'INPUT' && element.type) {
    selectors.push(`input[type="${element.type}"]${element.placeholder ? `[placeholder*="${element.placeholder}"]` : ''}`);
  }

  if (element.tagName === 'BUTTON' || element.type === 'submit') {
    if (textHint) {
      selectors.push(`button:contains("${textHint}")`);
    }
  }

  return {
    selectors: [...new Set(selectors)], // Remove duplicates
    textHint,
    tag: element.tagName.toLowerCase(),
    type: element.type || null,
    placeholder: element.placeholder || null
  };
}

// Get current timestamp relative to recording start
function getTimestamp() {
  if (!startTime) return 0;
  return Date.now() - startTime;
}

// Record click event
function recordClick(event) {
  if (!isRecording) return;

  const target = generateSelectors(event.target);
  const clickData = {
    t: getTimestamp(),
    type: 'click',
    target,
    clickType: event.button === 2 ? 'right' : event.button === 1 ? 'middle' : 'left',
    position: {
      x: event.clientX,
      y: event.clientY
    }
  };

  recordedEvents.push(clickData);
  console.log('[Recorder] Click recorded:', clickData);
}

// Record input/typing
let inputTimers = new Map();

function recordInput(event) {
  if (!isRecording) return;

  const element = event.target;
  const target = generateSelectors(element);

  // Debounce input events to capture final value
  if (inputTimers.has(element)) {
    clearTimeout(inputTimers.get(element));
  }

  const timer = setTimeout(() => {
    const inputData = {
      t: getTimestamp(),
      type: 'type',
      target,
      text: element.value,
      typing: {
        charsPerSec: 10 // Default, can be adjusted in editor
      }
    };

    recordedEvents.push(inputData);
    console.log('[Recorder] Input recorded:', inputData);
    inputTimers.delete(element);
  }, 500);

  inputTimers.set(element, timer);
}

// Record keyboard events (for shortcuts)
function recordKeydown(event) {
  if (!isRecording) return;

  // Only record special keys
  if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') {
    const keyData = {
      t: getTimestamp(),
      type: 'keypress',
      key: event.key,
      modifiers: {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey
      }
    };

    recordedEvents.push(keyData);
    console.log('[Recorder] Key recorded:', keyData);
  }
}

// Record navigation
let lastUrl = window.location.href;

function checkNavigation() {
  if (!isRecording) return;

  if (window.location.href !== lastUrl) {
    const navData = {
      t: getTimestamp(),
      type: 'navigate',
      url: window.location.href,
      from: lastUrl
    };

    recordedEvents.push(navData);
    console.log('[Recorder] Navigation recorded:', navData);
    lastUrl = window.location.href;
  }
}

// Record scroll events
let scrollTimer = null;

function recordScroll(event) {
  if (!isRecording) return;

  if (scrollTimer) {
    clearTimeout(scrollTimer);
  }

  scrollTimer = setTimeout(() => {
    const scrollData = {
      t: getTimestamp(),
      type: 'scroll',
      position: {
        x: window.scrollX,
        y: window.scrollY
      }
    };

    recordedEvents.push(scrollData);
    console.log('[Recorder] Scroll recorded:', scrollData);
  }, 300);
}

// Sync events to background periodically (in case of navigation)
function syncEventsToBackground() {
  if (recordedEvents.length > 0) {
    console.log('[Recorder] Syncing', recordedEvents.length, 'events to background');
    chrome.runtime.sendMessage({
      type: 'SYNC_EVENTS',
      events: recordedEvents
    });
  }
}

// Start recording
function startRecording() {
  isRecording = true;
  startTime = Date.now();
  recordedEvents = [];

  // Record initial page state
  recordedEvents.push({
    t: 0,
    type: 'navigate',
    url: window.location.href,
    waitFor: { type: 'load' }
  });

  console.log('[Recorder] Recording started');

  // Sync events every 2 seconds to prevent data loss on navigation
  if (!window.eventSyncInterval) {
    window.eventSyncInterval = setInterval(syncEventsToBackground, 2000);
  }
}

// Stop recording
function stopRecording() {
  isRecording = false;

  // Clear any pending timers
  inputTimers.forEach(timer => clearTimeout(timer));
  inputTimers.clear();

  if (scrollTimer) {
    clearTimeout(scrollTimer);
  }

  // Clear sync interval
  if (window.eventSyncInterval) {
    clearInterval(window.eventSyncInterval);
    window.eventSyncInterval = null;
  }

  console.log('[Recorder] Recording stopped. Total events:', recordedEvents.length);

  // Send final events to background script
  chrome.runtime.sendMessage({
    type: 'RECORDING_COMPLETE',
    events: recordedEvents,
    meta: {
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timestamp: new Date().toISOString()
    }
  });

  return recordedEvents;
}

// Event listeners
document.addEventListener('click', recordClick, true);
document.addEventListener('input', recordInput, true);
document.addEventListener('keydown', recordKeydown, true);
document.addEventListener('scroll', recordScroll, true);

// Check for navigation changes
setInterval(checkNavigation, 1000);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Recorder] Received message:', message.type);

  if (message.type === 'START_RECORDING') {
    console.log('[Recorder] Starting recording...');
    startRecording();
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    console.log('[Recorder] Stopping recording...');
    const events = stopRecording();
    sendResponse({ success: true, events });
  } else if (message.type === 'GET_STATUS') {
    sendResponse({ isRecording, eventCount: recordedEvents.length });
  }

  return true; // Keep channel open for async response
});

console.log('[Recorder] Content script loaded');

// Check if recording is active when content script loads (for page navigation)
(async () => {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (status.isRecording) {
      console.log('[Recorder] Resuming recording after page navigation');
      startRecording();
    }
  } catch (error) {
    console.error('[Recorder] Failed to check recording status:', error);
  }
})();
