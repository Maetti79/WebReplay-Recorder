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
const replayInTabBtn = document.getElementById('replayInTabBtn');
const speedSelect = document.getElementById('speedSelect');
const subtitleDisplay = document.getElementById('subtitleDisplay');
const corsWarning = document.getElementById('corsWarning');
const fakeCursor = document.getElementById('fakeCursor');
const frameBlockedWarning = document.getElementById('frameBlockedWarning');
const openInTabBtn = document.getElementById('openInTabBtn');
const dismissBlockedBtn = document.getElementById('dismissBlockedBtn');
let corsWarningShown = false;
let frameLoadTimeout = null;
let currentUrl = null;
let replayTabId = null;
let replaySpeed = 1;

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
    showModal('Failed to load recording: ' + error.message + '\n\nRecordingId: ' + recordingId);
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
replayInTabBtn.addEventListener('click', startReplayInTab);

// Update replay speed
speedSelect.addEventListener('change', (e) => {
  replaySpeed = parseFloat(e.target.value);
  console.log('[Preview] Replay speed changed to:', replaySpeed + 'x');
  status.textContent = `Speed: ${replaySpeed}x`;
});

// Handle frame blocked warning buttons
openInTabBtn.addEventListener('click', () => {
  if (currentUrl) {
    window.open(currentUrl, '_blank');
  }
});

dismissBlockedBtn.addEventListener('click', () => {
  frameBlockedWarning.style.display = 'none';
});

// Detect iframe load errors
pageFrame.addEventListener('load', () => {
  console.log('[Preview] Iframe loaded successfully');
  if (frameLoadTimeout) {
    clearTimeout(frameLoadTimeout);
    frameLoadTimeout = null;
  }

  // Check if we can access the iframe content
  setTimeout(() => {
    try {
      const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;
      if (!iframeDoc) {
        console.warn('[Preview] Cannot access iframe content after load');
        showCorsWarning();
      }
    } catch (error) {
      console.warn('[Preview] CORS error accessing iframe:', error);
      showCorsWarning();
    }
  }, 100);
});

pageFrame.addEventListener('error', () => {
  console.error('[Preview] Iframe failed to load');
  showFrameBlockedWarning();
});

function startReplay() {
  if (!storyboard) {
    showModal('No storyboard loaded');
    return;
  }

  if (isReplaying) return;

  console.log('%c[Preview] ▶️ Starting Replay', 'color: #1976d2; font-weight: bold; font-size: 14px');
  console.log('Total events:', storyboard.timeline.length);
  console.log('Replay speed:', replaySpeed + 'x');
  console.log('Subtitles:', storyboard.subtitles ? storyboard.subtitles.length : 0);

  isReplaying = true;
  currentEventIndex = 0;
  eventLog.innerHTML = '<div style="color: #1976d2; font-weight: bold;">▶️ Replay Started</div>';
  status.textContent = 'Playing...';

  // Hide any previous warnings
  frameBlockedWarning.style.display = 'none';
  corsWarning.style.display = 'none';
  corsWarningShown = false;

  // Reset to initial page
  const initialUrl = storyboard.meta.baseUrl || storyboard.timeline.find(e => e.type === 'navigate')?.url;
  if (initialUrl) {
    currentUrl = initialUrl;
    pageFrame.src = initialUrl;

    // Set timeout to detect frame blocking
    if (frameLoadTimeout) {
      clearTimeout(frameLoadTimeout);
    }
    frameLoadTimeout = setTimeout(() => {
      try {
        const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;
        if (!iframeDoc || iframeDoc.location.href === 'about:blank') {
          console.warn('[Preview] Initial iframe failed to load - likely blocked by X-Frame-Options');
          showFrameBlockedWarning();
        }
      } catch (error) {
        console.warn('[Preview] Initial iframe blocked or CORS issue:', error);
        showFrameBlockedWarning();
      }
    }, 5000);
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

  // Clear frame load timeout
  if (frameLoadTimeout) {
    clearTimeout(frameLoadTimeout);
    frameLoadTimeout = null;
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
  fakeCursor.style.display = 'none';
  status.textContent = 'Stopped';
  eventLog.innerHTML += '<div style="color: #c62828; font-weight: bold; margin-top: 8px;">⏹️ Replay Stopped</div>';
}

async function startReplayInTab() {
  if (!storyboard) {
    await showModal('No storyboard loaded', {
      title: 'Error',
      icon: '❌'
    });
    return;
  }

  console.log('[Preview] Starting replay in new tab');

  try {
    // Get the initial URL
    const initialUrl = storyboard.meta.baseUrl || storyboard.timeline.find(e => e.type === 'navigate')?.url;

    if (!initialUrl) {
      await showModal('No URL found in storyboard', {
        title: 'Error',
        icon: '❌'
      });
      return;
    }

    // Create a new tab
    chrome.tabs.create({ url: initialUrl, active: true }, async (tab) => {
      replayTabId = tab.id;
      console.log('[Preview] Created tab:', tab.id);

      // Register tab with background script for navigation tracking
      chrome.runtime.sendMessage({
        type: 'REGISTER_REPLAY_TAB',
        tabId: replayTabId
      }, (response) => {
        console.log('[Preview] Replay tab registered:', response);
      });

      // Wait for tab to load
      chrome.tabs.onUpdated.addListener(function tabLoadListener(tabId, changeInfo) {
        if (tabId === replayTabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(tabLoadListener);

          console.log('[Preview] Tab loaded, injecting replay script');

          // Inject the replay script
          chrome.scripting.executeScript({
            target: { tabId: replayTabId },
            files: ['scripts/replay.js']
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('[Preview] Failed to inject script:', chrome.runtime.lastError);
              showModal('Failed to inject replay script: ' + chrome.runtime.lastError.message, {
                title: 'Error',
                icon: '❌'
              });
              return;
            }

            console.log('[Preview] Script injected, sending storyboard');

            // Send the storyboard to the tab after a short delay
            setTimeout(() => {
              chrome.tabs.sendMessage(replayTabId, {
                type: 'START_TAB_REPLAY',
                storyboard: storyboard,
                speed: replaySpeed
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('[Preview] Failed to send message:', chrome.runtime.lastError);
                } else {
                  console.log('[Preview] Replay started in tab:', response);
                  showModal('Replay started in new tab!', {
                    title: 'Success',
                    icon: '✅'
                  });
                }
              });
            }, 500);
          });
        }
      });
    });
  } catch (error) {
    console.error('[Preview] Error starting tab replay:', error);
    await showModal('Failed to start tab replay: ' + error.message, {
      title: 'Error',
      icon: '❌'
    });
  }
}

function executeNextEvent() {
  if (!isReplaying || currentEventIndex >= storyboard.timeline.length) {
    isReplaying = false;
    status.textContent = 'Completed';
    eventIndicator.style.display = 'none';
    clickMarker.style.display = 'none';
    fakeCursor.style.display = 'none';
    eventLog.innerHTML += '<div style="color: #2e7d32; font-weight: bold; margin-top: 8px;">✅ Replay Completed</div>';

    console.log('%c[Preview] ✅ Replay Completed Successfully!', 'color: #2e7d32; font-weight: bold; font-size: 14px');
    console.log(`Total events executed: ${currentEventIndex}/${storyboard.timeline.length}`);

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

  // Apply speed multiplier
  delay = delay / replaySpeed;

  // Update status
  status.textContent = `Event ${currentEventIndex + 1}/${storyboard.timeline.length} (${replaySpeed}x)`;

  // Schedule next event
  currentEventIndex++;
  replayTimeout = setTimeout(executeNextEvent, Math.min(delay, 5000)); // Cap at 5s for preview
}

function executeEvent(event) {
  // Log event execution with details
  console.group(`%c[Preview] Executing Event: ${event.type}`, 'color: #2563eb; font-weight: bold');
  console.log('Event Data:', event);
  console.log('Timestamp:', event.t + 'ms');
  if (event.target) console.log('Target:', event.target);
  if (event.position) console.log('Position:', event.position);
  if (event.text) console.log('Text:', event.text);
  console.groupEnd();

  // Handle navigation
  if (event.type === 'navigate' && event.url) {
    currentUrl = event.url;
    pageFrame.src = event.url;
    console.log('[Preview] Navigating to:', event.url);

    // Set timeout to detect if iframe doesn't load (X-Frame-Options blocking)
    if (frameLoadTimeout) {
      clearTimeout(frameLoadTimeout);
    }
    frameLoadTimeout = setTimeout(() => {
      // Check if iframe is still loading after 5 seconds
      try {
        const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;
        if (!iframeDoc || iframeDoc.location.href === 'about:blank') {
          console.warn('[Preview] Iframe failed to load within timeout - likely blocked by X-Frame-Options');
          showFrameBlockedWarning();
        }
      } catch (error) {
        console.warn('[Preview] Iframe blocked or CORS issue:', error);
        showFrameBlockedWarning();
      }
    }, 5000);
  }

  // Execute click in iframe
  if (event.type === 'click') {
    // Move cursor to click position
    if (event.position) {
      moveCursor(event.position.x, event.position.y);
    }

    // Show click marker visualization
    if (event.position) {
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

    // Actually click the element in the iframe
    try {
      const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;

      if (!iframeDoc) {
        console.warn('[Preview] Cannot access iframe content - may be cross-origin');
        showCorsWarning();
        return;
      }

      if (iframeDoc) {
        // Try each selector until we find the element
        let targetElement = null;
        if (event.target && event.target.selectors) {
          for (const selector of event.target.selectors) {
            try {
              targetElement = iframeDoc.querySelector(selector);
              if (targetElement) {
                console.log('[Preview] Found element with selector:', selector);
                break;
              }
            } catch (e) {
              // Invalid selector, try next one
              continue;
            }
          }
        }

        // If selector didn't work, try using position
        if (!targetElement && event.position) {
          targetElement = iframeDoc.elementFromPoint(event.position.x, event.position.y);
          console.log('[Preview] Found element at position:', event.position);
        }

        if (targetElement) {
          // Trigger actual click
          targetElement.click();
          console.log('[Preview] Clicked element:', targetElement);

          // Also dispatch mouse events for more realistic interaction
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: pageFrame.contentWindow,
            clientX: event.position?.x || 0,
            clientY: event.position?.y || 0
          });
          targetElement.dispatchEvent(clickEvent);
        } else {
          console.warn('[Preview] Could not find element to click');
        }
      }
    } catch (error) {
      console.error('[Preview] Error executing click:', error);
    }
  }

  // Execute typing in iframe
  if (event.type === 'type') {
    try {
      const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;

      if (!iframeDoc) {
        console.warn('[Preview] Cannot access iframe content - may be cross-origin');
        showCorsWarning();
        return;
      }

      if (iframeDoc) {
        // Find the input element
        let targetElement = null;
        if (event.target && event.target.selectors) {
          for (const selector of event.target.selectors) {
            try {
              targetElement = iframeDoc.querySelector(selector);
              if (targetElement) break;
            } catch (e) {
              continue;
            }
          }
        }

        if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
          // Move cursor to input field
          const rect = targetElement.getBoundingClientRect();
          moveCursor(rect.left + rect.width / 2, rect.top + rect.height / 2);

          // Simulate typing with animation
          const text = event.text || '';
          const charsPerSec = event.typing?.charsPerSec || 10;
          const delayPerChar = 1000 / charsPerSec;

          targetElement.value = '';
          targetElement.focus();

          // Type character by character
          let currentIndex = 0;
          const typeInterval = setInterval(() => {
            if (currentIndex < text.length) {
              targetElement.value += text[currentIndex];

              // Dispatch input event
              const inputEvent = new Event('input', {
                bubbles: true,
                cancelable: true
              });
              targetElement.dispatchEvent(inputEvent);

              currentIndex++;
            } else {
              clearInterval(typeInterval);

              // Dispatch change event when done
              const changeEvent = new Event('change', {
                bubbles: true,
                cancelable: true
              });
              targetElement.dispatchEvent(changeEvent);

              console.log('[Preview] Finished typing:', text);
            }
          }, delayPerChar);
        } else {
          console.warn('[Preview] Could not find input element to type in');
        }
      }
    } catch (error) {
      console.error('[Preview] Error executing type:', error);
    }
  }

  // Execute keypress in iframe
  if (event.type === 'keypress') {
    try {
      const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;

      if (!iframeDoc) {
        console.warn('[Preview] Cannot access iframe content - may be cross-origin');
        showCorsWarning();
        return;
      }

      if (iframeDoc) {
        const keyEvent = new KeyboardEvent('keydown', {
          key: event.key,
          bubbles: true,
          cancelable: true,
          ctrlKey: event.modifiers?.ctrl || false,
          altKey: event.modifiers?.alt || false,
          shiftKey: event.modifiers?.shift || false,
          metaKey: event.modifiers?.meta || false
        });

        const activeElement = iframeDoc.activeElement || iframeDoc.body;
        activeElement.dispatchEvent(keyEvent);

        console.log('[Preview] Pressed key:', event.key);
      }
    } catch (error) {
      console.error('[Preview] Error executing keypress:', error);
    }
  }

  // Execute scroll in iframe
  if (event.type === 'scroll' && event.position) {
    try {
      const iframeWindow = pageFrame.contentWindow;

      if (!iframeWindow) {
        console.warn('[Preview] Cannot access iframe window - may be cross-origin');
        showCorsWarning();
        return;
      }

      if (iframeWindow) {
        iframeWindow.scrollTo({
          left: event.position.x,
          top: event.position.y,
          behavior: 'smooth'
        });
        console.log('[Preview] Scrolled to:', event.position);
      }
    } catch (error) {
      console.error('[Preview] Error executing scroll:', error);
    }
  }

  // Execute hover in iframe
  if (event.type === 'hover') {
    // Move cursor to hover position
    if (event.position) {
      moveCursor(event.position.x, event.position.y);
    }

    try {
      const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;

      if (!iframeDoc) {
        console.warn('[Preview] Cannot access iframe content - may be cross-origin');
        showCorsWarning();
        return;
      }

      // Find the target element
      let targetElement = null;
      if (event.target && event.target.selectors) {
        for (const selector of event.target.selectors) {
          try {
            targetElement = iframeDoc.querySelector(selector);
            if (targetElement) break;
          } catch (e) {
            continue;
          }
        }
      }

      // Fall back to position-based
      if (!targetElement && event.position) {
        targetElement = iframeDoc.elementFromPoint(event.position.x, event.position.y);
      }

      if (targetElement) {
        // Dispatch mouseover event
        const mouseOverEvent = new MouseEvent('mouseover', {
          bubbles: true,
          cancelable: true,
          view: pageFrame.contentWindow,
          clientX: event.position?.x || 0,
          clientY: event.position?.y || 0
        });
        targetElement.dispatchEvent(mouseOverEvent);

        // Also dispatch mouseenter (doesn't bubble but some frameworks use it)
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          bubbles: false,
          cancelable: true,
          view: pageFrame.contentWindow,
          clientX: event.position?.x || 0,
          clientY: event.position?.y || 0
        });
        targetElement.dispatchEvent(mouseEnterEvent);

        console.log('[Preview] Hovered element:', targetElement);

        // Add visual indicator
        targetElement.style.outline = '2px dashed #f59e0b';
        setTimeout(() => {
          targetElement.style.outline = '';
        }, 1000);
      } else {
        console.warn('[Preview] Could not find element to hover');
      }
    } catch (error) {
      console.error('[Preview] Error executing hover:', error);
    }
  }

  // Execute focus in iframe
  if (event.type === 'focus') {
    try {
      const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;

      if (!iframeDoc) {
        console.warn('[Preview] Cannot access iframe content - may be cross-origin');
        showCorsWarning();
        return;
      }

      // Find the target element
      let targetElement = null;
      if (event.target && event.target.selectors) {
        for (const selector of event.target.selectors) {
          try {
            targetElement = iframeDoc.querySelector(selector);
            if (targetElement) break;
          } catch (e) {
            continue;
          }
        }
      }

      if (targetElement) {
        // Move cursor to element
        const rect = targetElement.getBoundingClientRect();
        moveCursor(rect.left + rect.width / 2, rect.top + rect.height / 2);

        // Focus the element
        targetElement.focus();

        // Dispatch focus event (for frameworks that might need it)
        const focusEvent = new FocusEvent('focus', {
          bubbles: true,
          cancelable: true,
          view: pageFrame.contentWindow
        });
        targetElement.dispatchEvent(focusEvent);

        console.log('[Preview] Focused element:', targetElement);

        // Add visual indicator
        const originalOutline = targetElement.style.outline;
        targetElement.style.outline = '2px solid #2563eb';
        setTimeout(() => {
          targetElement.style.outline = originalOutline;
        }, 1500);
      } else {
        console.warn('[Preview] Could not find element to focus');
      }
    } catch (error) {
      console.error('[Preview] Error executing focus:', error);
    }
  }

  // Execute blur in iframe
  if (event.type === 'blur') {
    try {
      const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;

      if (!iframeDoc) {
        console.warn('[Preview] Cannot access iframe content - may be cross-origin');
        showCorsWarning();
        return;
      }

      // Find the target element
      let targetElement = null;
      if (event.target && event.target.selectors) {
        for (const selector of event.target.selectors) {
          try {
            targetElement = iframeDoc.querySelector(selector);
            if (targetElement) break;
          } catch (e) {
            continue;
          }
        }
      }

      if (targetElement) {
        // Blur the element
        targetElement.blur();

        // Dispatch blur event
        const blurEvent = new FocusEvent('blur', {
          bubbles: true,
          cancelable: true,
          view: pageFrame.contentWindow
        });
        targetElement.dispatchEvent(blurEvent);

        console.log('[Preview] Blurred element:', targetElement);
      } else {
        console.warn('[Preview] Could not find element to blur');
      }
    } catch (error) {
      console.error('[Preview] Error executing blur:', error);
    }
  }

  // Execute file upload in iframe
  if (event.type === 'upload' && event.files && event.files.length > 0) {
    try {
      const iframeDoc = pageFrame.contentDocument || pageFrame.contentWindow.document;

      if (!iframeDoc) {
        console.warn('[Preview] Cannot access iframe content - may be cross-origin');
        showCorsWarning();
        return;
      }

      // Find the file input element
      let targetElement = null;
      if (event.target && event.target.selectors) {
        for (const selector of event.target.selectors) {
          try {
            targetElement = iframeDoc.querySelector(selector);
            if (targetElement && targetElement.tagName === 'INPUT' && targetElement.type === 'file') {
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      if (targetElement) {
        // Convert stored file data back to File objects
        const filePromises = event.files.map(fileData => {
          return fetch(fileData.data)
            .then(res => res.blob())
            .then(blob => {
              return new File([blob], fileData.name, {
                type: fileData.type,
                lastModified: fileData.lastModified
              });
            })
            .catch(error => {
              console.error('[Preview] Failed to create file:', fileData.name, error);
              return null;
            });
        });

        Promise.all(filePromises).then(files => {
          const validFiles = files.filter(f => f !== null);

          if (validFiles.length > 0) {
            // Create a DataTransfer object to set files
            const dataTransfer = new DataTransfer();
            validFiles.forEach(file => dataTransfer.items.add(file));

            // Set the files on the input
            targetElement.files = dataTransfer.files;

            // Trigger change event
            const changeEvent = new Event('change', {
              bubbles: true,
              cancelable: true
            });
            targetElement.dispatchEvent(changeEvent);

            // Also trigger input event for some frameworks
            const inputEvent = new Event('input', {
              bubbles: true,
              cancelable: true
            });
            targetElement.dispatchEvent(inputEvent);

            console.log('[Preview] Uploaded files:', validFiles.length, 'file(s)');
          }
        });
      } else {
        console.warn('[Preview] Could not find file input element');
      }
    } catch (error) {
      console.error('[Preview] Error executing file upload:', error);
    }
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
    case 'upload':
      const fileCount = event.files?.length || 0;
      const fileNames = event.files?.map(f => f.name).join(', ') || '';
      description = '📎 Upload: ' + (fileCount === 1 ? fileNames : `${fileCount} files`);
      break;
    case 'hover':
      description = '🖱️ Hover over ' + (event.target?.selectors?.[0] || 'element');
      break;
    case 'focus':
      description = '🎯 Focus on ' + (event.target?.selectors?.[0] || 'element');
      break;
    case 'blur':
      description = '💨 Blur from ' + (event.target?.selectors?.[0] || 'element');
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
      color = '#2563eb';
      icon = '🌐';
      break;
    case 'click':
      color = '#ef4444';
      icon = '👆';
      break;
    case 'type':
      color = '#10b981';
      icon = '⌨️';
      break;
    case 'keypress':
      color = '#f59e0b';
      icon = '🔑';
      break;
    case 'scroll':
      color = '#8b5cf6';
      icon = '📜';
      break;
    case 'upload':
      color = '#06b6d4';
      icon = '📎';
      break;
    case 'hover':
      color = '#f59e0b';
      icon = '🖱️';
      break;
    case 'focus':
      color = '#2563eb';
      icon = '🎯';
      break;
    case 'blur':
      color = '#9ca3af';
      icon = '💨';
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
  } else if (event.files) {
    const fileCount = event.files.length;
    const fileNames = event.files.map(f => f.name).join(', ');
    logEntry.innerHTML += `: ${fileCount === 1 ? fileNames : fileCount + ' files'}`;
  } else if (event.target && event.target.selectors && event.target.selectors[0]) {
    const selector = event.target.selectors[0];
    logEntry.innerHTML += `: ${selector.length > 40 ? selector.substring(0, 40) + '...' : selector}`;
  }

  eventLog.appendChild(logEntry);
  eventLog.scrollTop = eventLog.scrollHeight;
}

function showCorsWarning() {
  if (!corsWarningShown && corsWarning) {
    corsWarning.style.display = 'block';
    corsWarningShown = true;

    // Auto-hide after 10 seconds
    setTimeout(() => {
      corsWarning.style.display = 'none';
    }, 10000);
  }
}

// Move fake cursor to position
function moveCursor(x, y) {
  if (!fakeCursor) return;

  const frameRect = pageFrame.getBoundingClientRect();

  // Position cursor relative to the iframe
  fakeCursor.style.left = x + 'px';
  fakeCursor.style.top = y + 'px';
  fakeCursor.style.display = 'block';

  console.log('[Preview] Moving cursor to:', x, y);
}

// Show frame blocked warning
function showFrameBlockedWarning() {
  if (frameBlockedWarning) {
    frameBlockedWarning.style.display = 'block';
    console.log('[Preview] Showing frame blocked warning');
  }
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
  subtitleDisplay.style.fontFamily = subtitle.fontFamily || 'Space Grotesk, Arial, sans-serif';
  subtitleDisplay.style.fontSize = (subtitle.fontSize || 32) + 'px';
  subtitleDisplay.style.color = subtitle.fontColor || '#ffffff';

  // Apply position
  subtitleDisplay.className = 'subtitle-display ' + (subtitle.position || 'bottom');

  // Show with animation
  subtitleDisplay.style.display = 'block';
  subtitleDisplay.style.animation = 'subtitleFadeIn 0.4s ease-out';

  console.log('[Preview] Showing subtitle:', subtitle.text);
}

// Hide subtitle
function hideSubtitle() {
  // Animate out
  subtitleDisplay.style.animation = 'subtitleFadeOut 0.3s ease-in';

  // Hide after animation
  setTimeout(() => {
    subtitleDisplay.style.display = 'none';
  }, 300);
}

// Play voiceover audio
async function playVoiceover(voiceover) {
  try {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    let audioBlob = null;

    // Check if we have base64 audio (passed via message)
    if (voiceover.audioBase64) {
      console.log('[Preview] Converting base64 to Blob...');
      try {
        // Decode base64 to binary string
        const binaryString = atob(voiceover.audioBase64);
        // Convert binary string to Uint8Array
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        // Create Blob from Uint8Array
        audioBlob = new Blob([bytes], { type: voiceover.audioType || 'audio/mpeg' });
        console.log('[Preview] ✅ Converted base64 to Blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
      } catch (conversionError) {
        console.error('[Preview] Failed to convert base64 to Blob:', conversionError);
      }
    }
    // Check if audioBlob is directly available
    else if (voiceover.audioBlob) {
      audioBlob = voiceover.audioBlob;
      console.log('[Preview] Using audioBlob from memory');
    }
    // If audioBlob is not available, try to fetch from IndexedDB
    else if (voiceover.blobId) {
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
      console.warn('[Preview] Voiceover audio blob not found (no audioBlob, audioBase64, or blobId)');
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

// Cleanup: unregister replay tab when preview page closes
window.addEventListener('beforeunload', () => {
  if (replayTabId) {
    console.log('[Preview] Unregistering replay tab on page close:', replayTabId);
    chrome.runtime.sendMessage({
      type: 'UNREGISTER_REPLAY_TAB',
      tabId: replayTabId
    });
  }
});

console.log('[Preview] Preview script loaded and ready');
