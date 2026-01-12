// Background service worker - manages recording state and media

let currentRecording = {
  isActive: false,
  tabId: null,
  startTime: null,
  events: [],
  audioStream: null,
  audioChunks: [],
  mediaRecorder: null,
  webcamStream: null,
  webcamChunks: [],
  webcamRecorder: null
};

let storyboards = {}; // Store storyboards by ID

// IndexedDB for audio storage
let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayDB', 3);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;
      console.log(`[Background] Upgrading database from version ${oldVersion} to ${newVersion}`);

      if (!db.objectStoreNames.contains('audioRecordings')) {
        db.createObjectStore('audioRecordings', { keyPath: 'id' });
        console.log('[Background] Created audioRecordings store');
      }
      if (!db.objectStoreNames.contains('webcamRecordings')) {
        db.createObjectStore('webcamRecordings', { keyPath: 'id' });
        console.log('[Background] Created webcamRecordings store');
      }
      if (!db.objectStoreNames.contains('voiceovers')) {
        db.createObjectStore('voiceovers');
        console.log('[Background] Created voiceovers store');
      }
      console.log('[Background] Database upgrade complete');
    };
  });
}

// Initialize DB on startup
initDB().catch(console.error);

// Offscreen document management
async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    console.log('[Background] Offscreen document already exists');
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording audio and webcam for screen recordings'
  });

  console.log('[Background] Offscreen document created');
}

async function saveAudioToDB(recordingId, audioBlob) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['audioRecordings'], 'readwrite');
    const store = transaction.objectStore('audioRecordings');
    const request = store.put({ id: recordingId, blob: audioBlob, timestamp: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAudioFromDB(recordingId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['audioRecordings'], 'readonly');
    const store = transaction.objectStore('audioRecordings');
    const request = store.get(recordingId);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.blob);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function saveWebcamToDB(recordingId, webcamBlob) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['webcamRecordings'], 'readwrite');
    const store = transaction.objectStore('webcamRecordings');
    const request = store.put({ id: recordingId, blob: webcamBlob, timestamp: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getWebcamFromDB(recordingId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['webcamRecordings'], 'readonly');
    const store = transaction.objectStore('webcamRecordings');
    const request = store.get(recordingId);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.blob);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Generate unique ID
function generateId() {
  return `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Check if content script is injected
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' });
    return true; // Content script is present
  } catch (error) {
    // Content script not loaded, inject it
    console.log('[Background] Content script not found, injecting...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['scripts/content.js']
      });
      // Give it a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (injectError) {
      console.error('[Background] Failed to inject content script:', injectError);
      return false;
    }
  }
}

// Start recording
async function startRecording(tabId, settings = {}) {
  if (currentRecording.isActive) {
    console.log('[Background] Recording already active');
    return { success: false, error: 'Recording already active' };
  }

  // Default settings
  const recordingSettings = {
    audioEnabled: true,
    webcamEnabled: true,
    webcamPosition: 'bottom-right',
    ...settings
  };

  try {
    // Ensure content script is loaded
    const contentScriptReady = await ensureContentScript(tabId);
    if (!contentScriptReady) {
      return {
        success: false,
        error: 'Cannot inject content script on this page. Try reloading the page.'
      };
    }

    // Initialize recording state
    currentRecording = {
      isActive: true,
      tabId,
      startTime: Date.now(),
      events: [],
      audioChunks: [],
      webcamChunks: [],
      recordingId: generateId(),
      settings: recordingSettings
    };

    // Send message to content script to start tracking interactions
    console.log('[Background] Sending START_RECORDING to content script...');
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
      console.log('[Background] START_RECORDING message sent to content script');
    } catch (error) {
      console.error('[Background] Failed to send START_RECORDING to content script:', error);
      throw error;
    }

    // Start audio and webcam recording based on settings
    const mediaConstraints = {};

    if (recordingSettings.audioEnabled) {
      mediaConstraints.audio = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
    }

    if (recordingSettings.webcamEnabled) {
      mediaConstraints.video = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      };
    }

    // Only request media if at least one is enabled
    if (recordingSettings.audioEnabled || recordingSettings.webcamEnabled) {
      console.log('[Background] Starting media capture via offscreen document...');
      console.log('[Background] Settings:', recordingSettings);

      try {
        // Create offscreen document if needed
        await setupOffscreenDocument();

        // Request media capture from offscreen document
        const result = await chrome.runtime.sendMessage({
          type: 'START_MEDIA_CAPTURE',
          settings: recordingSettings,
          recordingId: currentRecording.recordingId
        });

        console.log('[Background] Media capture result:', result);

        if (result.audioStarted) {
          console.log('[Background] ✅ Audio recording started');
        } else if (recordingSettings.audioEnabled) {
          console.warn('[Background] ⚠️ Audio was enabled but failed to start');
        }

        if (result.webcamStarted) {
          console.log('[Background] ✅ Webcam recording started');
        } else if (recordingSettings.webcamEnabled) {
          console.warn('[Background] ⚠️ Webcam was enabled but failed to start');
        }

        if (result.errors && result.errors.length > 0) {
          console.warn('[Background] Media capture errors:', result.errors);
        }
      } catch (error) {
        console.error('[Background] Failed to start media capture:', error);
      }
    } else {
      console.log('[Background] Screen recording only (no audio/webcam)');
    }

    console.log('[Background] Recording started for tab:', tabId);
    return { success: true, recordingId: currentRecording.recordingId };

  } catch (error) {
    console.error('[Background] Failed to start recording:', error);
    currentRecording.isActive = false;
    return { success: false, error: error.message };
  }
}

// Stop recording
async function stopRecording() {
  if (!currentRecording.isActive) {
    return { success: false, error: 'No active recording' };
  }

  try {
    // Stop content script tracking
    if (currentRecording.tabId) {
      await chrome.tabs.sendMessage(currentRecording.tabId, { type: 'STOP_RECORDING' });
    }

    // Stop media capture in offscreen document
    try {
      await chrome.runtime.sendMessage({ type: 'STOP_MEDIA_CAPTURE' });
      console.log('[Background] Media capture stopped');
    } catch (error) {
      console.warn('[Background] Could not stop media capture:', error);
    }

    console.log('[Background] Recording stopped');
    return { success: true };

  } catch (error) {
    console.error('[Background] Error stopping recording:', error);
    return { success: false, error: error.message };
  }
}

// Build storyboard from recorded events
function buildStoryboard(events, meta, audioBlob, webcamBlob, recordingId = null) {
  const storyboard = {
    version: '1.0',
    meta: {
      title: meta.title || 'Untitled Recording',
      createdAt: meta.timestamp || new Date().toISOString(),
      viewport: meta.viewport || { width: 1440, height: 900, deviceScaleFactor: 1 },
      baseUrl: meta.url || '',
      locale: 'en-US',
      recordingId: recordingId // Store recordingId for loading audio/video later
    },
    assets: {
      micWav: audioBlob ? 'audio/recording.webm' : null,
      webcamMp4: webcamBlob ? 'video/webcam.webm' : null,
      uploads: []
    },
    settings: {
      cursor: {
        visible: true,
        style: 'default',
        smooth: 0.85,
        minMoveDurationMs: 120,
        maxSpeedPxPerSec: 1600
      },
      typing: {
        charsPerSec: 12,
        randomize: 0.15,
        pasteLongTextOver: 80
      },
      render: {
        fps: 60,
        resolution: { width: 1920, height: 1080 }
      },
      webcam: {
        enabled: !!webcamBlob,
        position: currentRecording.settings?.webcamPosition || 'bottom-right'
      }
    },
    timeline: events || [],
    audioTrack: audioBlob ? [
      {
        t: 0,
        type: 'voice',
        source: 'micWav',
        gainDb: 0
      }
    ] : []
  };

  return storyboard;
}

// Handle recording completion
async function handleRecordingComplete(events, meta) {
  console.log('[Background] Processing recorded events:', events.length);
  console.log('[Background] Requesting media chunks from offscreen document...');

  const recordingId = currentRecording.recordingId;

  // Wait for media recorders to stop and flush final chunks
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Request chunks from offscreen document (they're in IndexedDB)
  let audioBlob = null;
  let webcamBlob = null;

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'GET_MEDIA_CHUNKS',
      recordingId
    });

    console.log('[Background] Media chunks result:', {
      success: result.success,
      audioSize: result.audioSize,
      webcamSize: result.webcamSize
    });

    if (result.success) {
      // Offscreen document saved blobs directly to IndexedDB to avoid message passing size limits
      // Now read them from IndexedDB
      if (result.audioSize > 0) {
        audioBlob = await getAudioFromDB(recordingId);
        if (audioBlob) {
          console.log('[Background] ✅ Audio blob loaded from IndexedDB:', audioBlob.size, 'bytes');
        } else {
          console.warn('[Background] No audio data in IndexedDB');
        }
      }

      if (result.webcamSize > 0) {
        webcamBlob = await getWebcamFromDB(recordingId);
        if (webcamBlob) {
          console.log('[Background] ✅ Webcam blob loaded from IndexedDB:', webcamBlob.size, 'bytes');
        } else {
          console.warn('[Background] No webcam data in IndexedDB');
        }
      }
    }
  } catch (error) {
    console.error('[Background] Error getting media chunks:', error);
  }

  // Build storyboard
  const storyboard = buildStoryboard(events, meta, audioBlob, webcamBlob, recordingId);

    // Store storyboard in memory
    storyboards[recordingId] = {
      storyboard,
      audioBlob,
      webcamBlob,
      timestamp: Date.now()
    };

    // Save to chrome.storage
    await chrome.storage.local.set({
      [`storyboard_${recordingId}`]: JSON.stringify(storyboard),
      lastRecordingId: recordingId
    });

    // Save audio to IndexedDB for persistence
    if (audioBlob) {
      try {
        await saveAudioToDB(recordingId, audioBlob);
        console.log('[Background] Audio saved to IndexedDB');
      } catch (error) {
        console.warn('[Background] Failed to save audio to IndexedDB:', error);
      }
    }

    // Save webcam to IndexedDB
    if (webcamBlob) {
      try {
        await saveWebcamToDB(recordingId, webcamBlob);
        console.log('[Background] Webcam saved to IndexedDB');
      } catch (error) {
        console.warn('[Background] Failed to save webcam to IndexedDB:', error);
      }
    }

    console.log('[Background] Storyboard saved:', recordingId);

    // Reset recording state
    currentRecording = {
      isActive: false,
      tabId: null,
      startTime: null,
      events: [],
      audioChunks: [],
      mediaRecorder: null,
      audioStream: null
    };

  // Notify popup
  chrome.runtime.sendMessage({
    type: 'STORYBOARD_READY',
    recordingId
  }).catch(() => {
    // Popup might be closed
    console.log('[Background] Could not notify popup (may be closed)');
  });
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type);

  if (message.type === 'START_RECORDING') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        const result = await startRecording(tabs[0].id, message.settings);
        sendResponse(result);
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true; // Async response

  } else if (message.type === 'STOP_RECORDING') {
    stopRecording().then(result => {
      sendResponse(result);
    });
    return true;

  } else if (message.type === 'GET_STATUS') {
    sendResponse({
      isRecording: currentRecording.isActive,
      recordingId: currentRecording.recordingId,
      eventCount: currentRecording.events.length
    });

  } else if (message.type === 'SYNC_EVENTS') {
    // Periodic sync from content script (prevents data loss on navigation)
    if (currentRecording.isActive) {
      console.log('[Background] Syncing', message.events.length, 'events from content script');

      // Merge events instead of replacing to preserve events across page navigation
      const existingEvents = currentRecording.events || [];
      const newEvents = message.events || [];

      // Find the highest timestamp in existing events
      const maxExistingTimestamp = existingEvents.length > 0
        ? Math.max(...existingEvents.map(e => e.t || e.timestamp || 0))
        : -1;

      // Only add events that are newer than what we have
      const eventsToAdd = newEvents.filter(event => {
        const eventTime = event.t || event.timestamp || 0;
        return eventTime > maxExistingTimestamp;
      });

      if (eventsToAdd.length > 0) {
        currentRecording.events = [...existingEvents, ...eventsToAdd];
        console.log('[Background] Added', eventsToAdd.length, 'new events. Total:', currentRecording.events.length);
      }
    }
    sendResponse({ success: true });

  } else if (message.type === 'RECORDING_COMPLETE') {
    // From content script - merge final events with what we've been syncing
    const existingEvents = currentRecording.events || [];
    const newEvents = message.events || [];

    // Find the highest timestamp in existing events
    const maxExistingTimestamp = existingEvents.length > 0
      ? Math.max(...existingEvents.map(e => e.t || e.timestamp || 0))
      : -1;

    // Only add events that are newer than what we have
    const eventsToAdd = newEvents.filter(event => {
      const eventTime = event.t || event.timestamp || 0;
      return eventTime > maxExistingTimestamp;
    });

    // Merge and use the complete event list
    const allEvents = [...existingEvents, ...eventsToAdd];
    currentRecording.events = allEvents;

    console.log('[Background] Recording complete. Total events:', allEvents.length);
    handleRecordingComplete(allEvents, message.meta);
    sendResponse({ success: true });

  } else if (message.type === 'GET_STORYBOARD') {
    const recordingId = message.recordingId;
    if (storyboards[recordingId]) {
      sendResponse({
        success: true,
        storyboard: storyboards[recordingId].storyboard
      });
    } else {
      // Try loading from storage
      chrome.storage.local.get([`storyboard_${recordingId}`], (result) => {
        const key = `storyboard_${recordingId}`;
        if (result[key]) {
          sendResponse({
            success: true,
            storyboard: JSON.parse(result[key])
          });
        } else {
          sendResponse({ success: false, error: 'Storyboard not found' });
        }
      });
    }
    return true;

  } else if (message.type === 'DOWNLOAD_FILE') {
    const { recordingId, fileType } = message;

    (async () => {
      try {
        console.log(`[Background] Downloading ${fileType} for:`, recordingId);

        let storyboard, audioBlob, webcamBlob;

        // Try in-memory first
        if (storyboards[recordingId]) {
          const data = storyboards[recordingId];
          storyboard = data.storyboard;
          audioBlob = data.audioBlob;
          webcamBlob = data.webcamBlob;
        } else {
          // Fallback to chrome.storage and IndexedDB
          const result = await chrome.storage.local.get([`storyboard_${recordingId}`]);
          const key = `storyboard_${recordingId}`;

          if (result[key]) {
            storyboard = JSON.parse(result[key]);

            // Try to load audio from IndexedDB
            try {
              audioBlob = await getAudioFromDB(recordingId);
              if (audioBlob) {
                console.log('[Background] Loaded audio from IndexedDB');
              }
            } catch (error) {
              console.warn('[Background] Could not load audio from IndexedDB:', error);
            }

            // Try to load webcam from IndexedDB
            try {
              webcamBlob = await getWebcamFromDB(recordingId);
              if (webcamBlob) {
                console.log('[Background] Loaded webcam from IndexedDB');
              }
            } catch (error) {
              console.warn('[Background] Could not load webcam from IndexedDB:', error);
            }
          } else {
            sendResponse({ success: false, error: 'Recording not found' });
            return;
          }
        }

        // Convert blobs to data URLs (works in service workers)
        async function blobToDataUrl(blob) {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }

        // Download based on file type
        if (fileType === 'json' || fileType === 'all') {
          const jsonText = JSON.stringify(storyboard, null, 2);
          const jsonDataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonText);

          await chrome.downloads.download({
            url: jsonDataUrl,
            filename: `storyboard_${recordingId}.json`,
            saveAs: fileType !== 'all'
          });
          console.log('[Background] ✅ Downloaded JSON');
        }

        // Download audio if requested
        if ((fileType === 'audio' || fileType === 'all') && audioBlob) {
          try {
            const audioDataUrl = await blobToDataUrl(audioBlob);
            await chrome.downloads.download({
              url: audioDataUrl,
              filename: `recording_${recordingId}.webm`,
              saveAs: fileType !== 'all'
            });
            console.log('[Background] ✅ Downloaded audio');
          } catch (error) {
            console.warn('[Background] Could not download audio:', error);
            if (fileType === 'audio') {
              sendResponse({ success: false, error: 'Audio file not available or failed to download' });
              return;
            }
          }
        } else if (fileType === 'audio' && !audioBlob) {
          sendResponse({ success: false, error: 'No audio recording available' });
          return;
        }

        // Download webcam if requested
        if ((fileType === 'video' || fileType === 'all') && webcamBlob) {
          try {
            const webcamDataUrl = await blobToDataUrl(webcamBlob);
            await chrome.downloads.download({
              url: webcamDataUrl,
              filename: `webcam_${recordingId}.webm`,
              saveAs: fileType !== 'all'
            });
            console.log('[Background] ✅ Downloaded webcam');
          } catch (error) {
            console.warn('[Background] Could not download webcam:', error);
            if (fileType === 'video') {
              sendResponse({ success: false, error: 'Video file not available or failed to download' });
              return;
            }
          }
        } else if (fileType === 'video' && !webcamBlob) {
          sendResponse({ success: false, error: 'No webcam recording available' });
          return;
        }

        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] Error downloading file:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep channel open for async response

  } else if (message.type === 'MEDIA_RECORDING_STOPPED') {
    // Notification from offscreen that media recording stopped
    // Chunks are already in IndexedDB
    console.log(`[Background] ${message.mediaType} recording stopped for:`, message.recordingId);
    return true;

  } else if (message.type === 'DELETE_RECORDING') {
    const recordingId = message.recordingId;

    (async () => {
      try {
        console.log('[Background] Deleting recording:', recordingId);

        // Remove from in-memory storage
        if (storyboards[recordingId]) {
          delete storyboards[recordingId];
          console.log('[Background] ✅ Removed from memory');
        }

        // Remove from chrome.storage
        await chrome.storage.local.remove([`storyboard_${recordingId}`]);
        console.log('[Background] ✅ Removed from chrome.storage');

        // Remove from background's IndexedDB (final blobs)
        if (db) {
          try {
            // Delete audio
            await new Promise((resolve, reject) => {
              const audioTransaction = db.transaction(['audioRecordings'], 'readwrite');
              const request = audioTransaction.objectStore('audioRecordings').delete(recordingId);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
            console.log('[Background] ✅ Removed audio from IndexedDB');

            // Delete webcam
            await new Promise((resolve, reject) => {
              const webcamTransaction = db.transaction(['webcamRecordings'], 'readwrite');
              const request = webcamTransaction.objectStore('webcamRecordings').delete(recordingId);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
            console.log('[Background] ✅ Removed webcam from IndexedDB');
          } catch (dbError) {
            console.warn('[Background] Error deleting from IndexedDB:', dbError);
          }
        }

        // Delete chunks from offscreen IndexedDB
        try {
          const offscreenResult = await chrome.runtime.sendMessage({
            type: 'DELETE_CHUNKS',
            recordingId
          });
          if (offscreenResult?.success) {
            console.log('[Background] ✅ Removed chunks from offscreen IndexedDB');
          }
        } catch (error) {
          console.warn('[Background] Could not delete chunks from offscreen (document may not be active):', error);
        }

        // Update lastRecordingId if it was deleted
        const { lastRecordingId } = await chrome.storage.local.get(['lastRecordingId']);
        if (lastRecordingId === recordingId) {
          await chrome.storage.local.remove(['lastRecordingId']);
          console.log('[Background] ✅ Cleared lastRecordingId');
        }

        console.log('[Background] ✅ Recording deleted successfully:', recordingId);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] ❌ Error deleting recording:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Async response
  }

  return true;
});

// Listen for navigation events to re-inject content script during recording
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only handle top-level navigation (not iframes)
  if (details.frameId !== 0) return;

  // Check if we're currently recording this tab
  if (!currentRecording.isActive || currentRecording.tabId !== details.tabId) {
    return;
  }

  console.log('[Background] Page navigation detected during recording:', details.url);
  console.log('[Background] Re-injecting content script...');

  try {
    // Wait a bit for page to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Ensure content script is loaded
    const contentScriptReady = await ensureContentScript(details.tabId);
    if (!contentScriptReady) {
      console.warn('[Background] Failed to re-inject content script after navigation');
      return;
    }

    // Send START_RECORDING to the new page
    await chrome.tabs.sendMessage(details.tabId, { type: 'START_RECORDING' });
    console.log('[Background] ✅ Content script re-initialized after navigation');

    // Record the navigation event
    currentRecording.events.push({
      type: 'navigate',
      t: Date.now() - currentRecording.startTime,
      url: details.url,
      title: details.url // Will be updated by content script
    });

  } catch (error) {
    console.error('[Background] Error re-injecting content script after navigation:', error);
  }
});

// Track replay tabs
let replayTabs = new Set();

// Listen for replay tab registrations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REGISTER_REPLAY_TAB') {
    console.log('[Background] Registering replay tab:', message.tabId);
    replayTabs.add(message.tabId);
    sendResponse({ success: true });
  } else if (message.type === 'UNREGISTER_REPLAY_TAB') {
    console.log('[Background] Unregistering replay tab:', message.tabId);
    replayTabs.delete(message.tabId);
    sendResponse({ success: true });
  }
  return true;
});

// Listen for tab navigation to re-inject replay script
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only handle replay tabs
  if (!replayTabs.has(details.tabId)) {
    return;
  }

  // Skip iframe navigations
  if (details.frameId !== 0) {
    return;
  }

  console.log('[Background] Replay tab navigated:', details.tabId, details.url);

  try {
    // Wait for page to be ready
    await new Promise(resolve => setTimeout(resolve, 800));

    // Re-inject replay script
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['scripts/replay.js']
    });

    console.log('[Background] ✅ Replay script re-injected after navigation');

  } catch (error) {
    console.error('[Background] Error re-injecting replay script:', error);
    // If injection fails, unregister the tab
    replayTabs.delete(details.tabId);
  }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (replayTabs.has(tabId)) {
    console.log('[Background] Replay tab closed:', tabId);
    replayTabs.delete(tabId);
  }
});

console.log('[Background] Service worker initialized');
