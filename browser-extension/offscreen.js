// Offscreen document for media capture
// Service workers can't access getUserMedia, so we do it here

console.log('[Offscreen] Document loaded');

let mediaRecorders = {
  audio: null,
  webcam: null
};

let mediaStreams = {
  audio: null,
  webcam: null
};

let currentRecordingId = null;
let db = null;

// Initialize IndexedDB for direct chunk storage
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayOffscreenDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      console.log('[Offscreen] IndexedDB initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('audioChunks')) {
        db.createObjectStore('audioChunks', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('webcamChunks')) {
        db.createObjectStore('webcamChunks', { keyPath: 'id', autoIncrement: true });
      }
      console.log('[Offscreen] IndexedDB object stores created');
    };
  });
}

// Initialize DB on load
initDB().catch(console.error);

// Save chunk directly to IndexedDB
async function saveChunkToDB(storeName, chunk, recordingId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add({
      recordingId,
      chunk,
      timestamp: Date.now()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Read all chunks for a recording from IndexedDB
async function getAllChunksFromDB(storeName, recordingId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const allRecords = request.result;
      const chunks = allRecords
        .filter(record => record.recordingId === recordingId)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(record => record.chunk);
      resolve(chunks);
    };
    request.onerror = () => reject(request.error);
  });
}

// Clear chunks for a recording
async function clearChunksFromDB(storeName, recordingId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const allRecords = request.result;
      const recordsToDelete = allRecords.filter(record => record.recordingId === recordingId);

      const deleteTransaction = db.transaction([storeName], 'readwrite');
      const deleteStore = deleteTransaction.objectStore(storeName);

      recordsToDelete.forEach(record => {
        deleteStore.delete(record.id);
      });

      deleteTransaction.oncomplete = () => resolve();
      deleteTransaction.onerror = () => reject(deleteTransaction.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] Received message:', message.type);

  if (message.type === 'START_MEDIA_CAPTURE') {
    currentRecordingId = message.recordingId;
    console.log('[Offscreen] Starting capture for recording:', currentRecordingId);
    startMediaCapture(message.settings, currentRecordingId).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }

  if (message.type === 'STOP_MEDIA_CAPTURE') {
    stopMediaCapture(currentRecordingId).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'PAUSE_MEDIA_CAPTURE') {
    const result = pauseMediaCapture();
    sendResponse(result);
    return true;
  }

  if (message.type === 'RESUME_MEDIA_CAPTURE') {
    const result = resumeMediaCapture();
    sendResponse(result);
    return true;
  }

  if (message.type === 'GET_MEDIA_DATA') {
    sendResponse({
      success: true,
      hasAudio: !!mediaRecorders.audio,
      hasWebcam: !!mediaRecorders.webcam
    });
    return true;
  }

  if (message.type === 'GET_MEDIA_CHUNKS') {
    const { recordingId } = message;
    console.log('[Offscreen] Getting media chunks for recording:', recordingId);

    (async () => {
      try {
        // Read chunks from IndexedDB
        const audioChunks = await getAllChunksFromDB('audioChunks', recordingId);
        const webcamChunks = await getAllChunksFromDB('webcamChunks', recordingId);

        console.log('[Offscreen] Retrieved audio chunks:', audioChunks.length);
        console.log('[Offscreen] Retrieved webcam chunks:', webcamChunks.length);

        // Create blobs
        let audioBlob = null;
        let webcamBlob = null;

        if (audioChunks.length > 0) {
          audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log('[Offscreen] Audio blob size:', audioBlob.size, 'bytes');
        }

        if (webcamChunks.length > 0) {
          webcamBlob = new Blob(webcamChunks, { type: 'video/webm' });
          console.log('[Offscreen] Webcam blob size:', webcamBlob.size, 'bytes');
        }

        // IMPORTANT: Large ArrayBuffers (>5MB) fail to transfer via messages
        // Instead, save directly to background's IndexedDB
        console.log('[Offscreen] Saving blobs to background IndexedDB...');

        // Open background's IndexedDB and save blobs there
        const backgroundDB = await new Promise((resolve, reject) => {
          const request = indexedDB.open('WebReplayDB', 3);

          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('audioRecordings')) {
              db.createObjectStore('audioRecordings', { keyPath: 'id' });
              console.log('[Offscreen] Created audioRecordings store');
            }
            if (!db.objectStoreNames.contains('webcamRecordings')) {
              db.createObjectStore('webcamRecordings', { keyPath: 'id' });
              console.log('[Offscreen] Created webcamRecordings store');
            }
            if (!db.objectStoreNames.contains('voiceovers')) {
              db.createObjectStore('voiceovers');
              console.log('[Offscreen] Created voiceovers store');
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        // Save audio
        if (audioBlob) {
          await new Promise((resolve, reject) => {
            const tx = backgroundDB.transaction(['audioRecordings'], 'readwrite');
            const store = tx.objectStore('audioRecordings');
            const request = store.put({ id: recordingId, blob: audioBlob, timestamp: Date.now() });
            request.onsuccess = () => {
              console.log('[Offscreen] ✅ Audio saved to background IndexedDB');
              resolve();
            };
            request.onerror = () => reject(request.error);
          });
        }

        // Save webcam
        if (webcamBlob) {
          await new Promise((resolve, reject) => {
            const tx = backgroundDB.transaction(['webcamRecordings'], 'readwrite');
            const store = tx.objectStore('webcamRecordings');
            const request = store.put({ id: recordingId, blob: webcamBlob, timestamp: Date.now() });
            request.onsuccess = () => {
              console.log('[Offscreen] ✅ Webcam saved to background IndexedDB');
              resolve();
            };
            request.onerror = () => reject(request.error);
          });
        }

        backgroundDB.close();

        // Return success with sizes (but not the data itself)
        sendResponse({
          success: true,
          audioSize: audioBlob ? audioBlob.size : 0,
          webcamSize: webcamBlob ? webcamBlob.size : 0
        });
      } catch (error) {
        console.error('[Offscreen] Error getting media chunks:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Async response
  }

  if (message.type === 'DELETE_CHUNKS') {
    const { recordingId } = message;
    console.log('[Offscreen] Deleting chunks for recording:', recordingId);

    (async () => {
      try {
        // Clear audio chunks
        await clearChunksFromDB('audioChunks', recordingId);
        console.log('[Offscreen] ✅ Deleted audio chunks');

        // Clear webcam chunks
        await clearChunksFromDB('webcamChunks', recordingId);
        console.log('[Offscreen] ✅ Deleted webcam chunks');

        sendResponse({ success: true });
      } catch (error) {
        console.error('[Offscreen] Error deleting chunks:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Async response
  }
});

async function startMediaCapture(settings, recordingId) {
  console.log('[Offscreen] Starting media capture with settings:', settings);
  console.log('[Offscreen] Recording ID:', recordingId);

  // Clear previous chunks from IndexedDB
  try {
    await clearChunksFromDB('audioChunks', recordingId);
    await clearChunksFromDB('webcamChunks', recordingId);
    console.log('[Offscreen] Cleared previous chunks from IndexedDB');
  } catch (error) {
    console.warn('[Offscreen] Could not clear previous chunks:', error);
  }

  const results = {
    success: true,
    audioStarted: false,
    webcamStarted: false,
    errors: []
  };

  // Capture webcam
  if (settings.webcamEnabled) {
    try {
      console.log('[Offscreen] Requesting webcam access...');
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      mediaStreams.webcam = webcamStream;
      mediaRecorders.webcam = new MediaRecorder(webcamStream, {
        mimeType: 'video/webm'
      });

      // Write chunks directly to IndexedDB as they arrive
      mediaRecorders.webcam.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log('[Offscreen] Webcam chunk received:', event.data.size, 'bytes - writing to IndexedDB');
          try {
            await saveChunkToDB('webcamChunks', event.data, recordingId);
            console.log('[Offscreen] ✅ Webcam chunk saved to IndexedDB');
          } catch (error) {
            console.error('[Offscreen] Failed to save webcam chunk:', error);
          }
        }
      };

      mediaRecorders.webcam.onstop = async () => {
        console.log('[Offscreen] Webcam recording stopped');
        // Notify background that webcam recording is complete
        chrome.runtime.sendMessage({
          type: 'MEDIA_RECORDING_STOPPED',
          mediaType: 'webcam',
          recordingId
        });
      };

      mediaRecorders.webcam.start(1000); // Collect data every 1 second
      results.webcamStarted = true;
      console.log('[Offscreen] ✅ Webcam recording started');
    } catch (error) {
      console.error('[Offscreen] Webcam capture failed:', error);
      results.errors.push(`Webcam: ${error.message}`);
    }
  }

  // Capture audio
  if (settings.audioEnabled) {
    try {
      console.log('[Offscreen] Requesting audio access...');
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreams.audio = audioStream;
      mediaRecorders.audio = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm'
      });

      // Write chunks directly to IndexedDB as they arrive
      mediaRecorders.audio.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log('[Offscreen] Audio chunk received:', event.data.size, 'bytes - writing to IndexedDB');
          try {
            await saveChunkToDB('audioChunks', event.data, recordingId);
            console.log('[Offscreen] ✅ Audio chunk saved to IndexedDB');
          } catch (error) {
            console.error('[Offscreen] Failed to save audio chunk:', error);
          }
        }
      };

      mediaRecorders.audio.onstop = async () => {
        console.log('[Offscreen] Audio recording stopped');
        // Notify background that audio recording is complete
        chrome.runtime.sendMessage({
          type: 'MEDIA_RECORDING_STOPPED',
          mediaType: 'audio',
          recordingId
        });
      };

      mediaRecorders.audio.start(1000); // Collect data every 1 second
      results.audioStarted = true;
      console.log('[Offscreen] ✅ Audio recording started');
    } catch (error) {
      console.error('[Offscreen] Audio capture failed:', error);
      results.errors.push(`Audio: ${error.message}`);
    }
  }

  return results;
}

async function stopMediaCapture(recordingId) {
  console.log('[Offscreen] Stopping media capture for recording:', recordingId);

  return new Promise(async (resolve) => {
    const stoppedRecorders = [];

    // Stop audio recording
    if (mediaRecorders.audio && mediaRecorders.audio.state !== 'inactive') {
      try {
        console.log('[Offscreen] Requesting final audio data...');
        // Request any buffered data before stopping
        if (mediaRecorders.audio.state === 'recording') {
          mediaRecorders.audio.requestData();
        }

        // Wait then stop
        await new Promise(r => setTimeout(r, 100));

        if (mediaRecorders.audio && mediaRecorders.audio.state !== 'inactive') {
          console.log('[Offscreen] Stopping audio recorder...');
          mediaRecorders.audio.stop();
          stoppedRecorders.push('audio');
        }
        if (mediaStreams.audio) {
          mediaStreams.audio.getTracks().forEach(track => track.stop());
        }
      } catch (error) {
        console.error('[Offscreen] Error stopping audio:', error);
      }
    }

    // Stop webcam recording
    if (mediaRecorders.webcam && mediaRecorders.webcam.state !== 'inactive') {
      try {
        console.log('[Offscreen] Requesting final webcam data...');
        // Request any buffered data before stopping
        if (mediaRecorders.webcam.state === 'recording') {
          mediaRecorders.webcam.requestData();
        }

        // Wait then stop
        await new Promise(r => setTimeout(r, 100));

        if (mediaRecorders.webcam && mediaRecorders.webcam.state !== 'inactive') {
          console.log('[Offscreen] Stopping webcam recorder...');
          mediaRecorders.webcam.stop();
          stoppedRecorders.push('webcam');
        }
        if (mediaStreams.webcam) {
          mediaStreams.webcam.getTracks().forEach(track => track.stop());
        }
      } catch (error) {
        console.error('[Offscreen] Error stopping webcam:', error);
      }
    }

    // Wait for onstop handlers to fire and save final chunks
    setTimeout(async () => {
      // Reset recorders
      mediaRecorders = { audio: null, webcam: null };
      mediaStreams = { audio: null, webcam: null };

      console.log('[Offscreen] Media capture stopped successfully');
      resolve({ success: true, stoppedRecorders });
    }, 500);
  });
}

// Pause media capture
function pauseMediaCapture() {
  try {
    console.log('[Offscreen] Pausing media capture...');

    // Pause audio recorder
    if (mediaRecorders.audio && mediaRecorders.audio.state === 'recording') {
      mediaRecorders.audio.pause();
      console.log('[Offscreen] Audio recorder paused');
    }

    // Pause webcam recorder
    if (mediaRecorders.webcam && mediaRecorders.webcam.state === 'recording') {
      mediaRecorders.webcam.pause();
      console.log('[Offscreen] Webcam recorder paused');
    }

    return { success: true };
  } catch (error) {
    console.error('[Offscreen] Error pausing media capture:', error);
    return { success: false, error: error.message };
  }
}

// Resume media capture
function resumeMediaCapture() {
  try {
    console.log('[Offscreen] Resuming media capture...');

    // Resume audio recorder
    if (mediaRecorders.audio && mediaRecorders.audio.state === 'paused') {
      mediaRecorders.audio.resume();
      console.log('[Offscreen] Audio recorder resumed');
    }

    // Resume webcam recorder
    if (mediaRecorders.webcam && mediaRecorders.webcam.state === 'paused') {
      mediaRecorders.webcam.resume();
      console.log('[Offscreen] Webcam recorder resumed');
    }

    return { success: true };
  } catch (error) {
    console.error('[Offscreen] Error resuming media capture:', error);
    return { success: false, error: error.message };
  }
}

console.log('[Offscreen] Ready for media capture');
