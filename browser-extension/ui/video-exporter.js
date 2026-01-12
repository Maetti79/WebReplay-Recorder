// Direct Video Exporter - Fully automated, no screen capture needed
console.log('[VideoExporter] Initializing...');

let storyboard = null;
let videoConfig = null;
let canvas = null;
let ctx = null;
let mediaRecorder = null;
let videoChunks = [];
let startTime = null;
let audioContext = null;
let mixedAudioDest = null;

// UI Elements
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const timeElapsed = document.getElementById('timeElapsed');
const totalEventsEl = document.getElementById('totalEvents');
const processedEventsEl = document.getElementById('processedEvents');
const videoSizeEl = document.getElementById('videoSize');
const logEl = document.getElementById('log');
const completeMessageEl = document.getElementById('completeMessage');
const canvasEl = document.getElementById('renderCanvas');

// Initialize
window.addEventListener('load', async () => {
  startTime = Date.now();
  startTimeCounter();

  // Get parameters from URL
  const params = new URLSearchParams(window.location.search);
  const recordingId = params.get('id');
  const width = parseInt(params.get('width')) || 1280;
  const height = parseInt(params.get('height')) || 720;
  const bitrate = parseInt(params.get('bitrate')) || 5000000;

  videoConfig = { width, height, bitrate, recordingId };

  // Setup canvas
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';

  log('Initialized video exporter');
  log(`Resolution: ${width}x${height}, Bitrate: ${(bitrate / 1000000).toFixed(1)}Mbps`);

  updateStatus('Loading recording data...');
  updateProgress(5);

  try {
    // Load storyboard
    storyboard = await loadStoryboard(recordingId);

    if (!storyboard) {
      throw new Error('Storyboard is null or undefined');
    }

    if (!storyboard.timeline) {
      throw new Error('Storyboard has no timeline property');
    }

    if (!Array.isArray(storyboard.timeline)) {
      throw new Error('Timeline is not an array');
    }

    if (storyboard.timeline.length === 0) {
      throw new Error('Timeline has no events');
    }

    totalEventsEl.textContent = storyboard.timeline.length;
    log(`Loaded ${storyboard.timeline.length} events`);

    // Load audio/video blobs
    updateStatus('Loading audio and video files...');
    updateProgress(10);

    const audioBlob = await loadAudioFromIndexedDB(recordingId).catch(() => null);
    const webcamBlob = await loadWebcamFromIndexedDB(recordingId).catch(() => null);
    const voiceoverBlobs = await loadVoiceoversFromIndexedDB(recordingId).catch(() => ({}));

    log(`Audio: ${audioBlob ? 'loaded' : 'none'}`);
    log(`Webcam: ${webcamBlob ? 'loaded' : 'none'}`);
    log(`Voiceovers: ${Object.keys(voiceoverBlobs).length} files`);

    // Start export
    updateStatus('Starting video export...');
    updateProgress(15);

    await exportVideo(audioBlob, webcamBlob, voiceoverBlobs);

  } catch (error) {
    console.error('[VideoExporter] Error:', error);
    updateStatus('Error: ' + error.message);
    log('ERROR: ' + error.message);
  }
});

// Load storyboard from storage
function loadStoryboard(recordingId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([`storyboard_${recordingId}`], (result) => {
      const key = `storyboard_${recordingId}`;
      if (result[key]) {
        try {
          const data = typeof result[key] === 'string' ? JSON.parse(result[key]) : result[key];
          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse storyboard'));
        }
      } else {
        reject(new Error('Storyboard not found'));
      }
    });
  });
}

// Load audio from IndexedDB
function loadAudioFromIndexedDB(recordingId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayRecorder', 3);

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

      // Check if object store exists
      if (!db.objectStoreNames.contains('audioRecordings')) {
        db.close();
        reject(new Error('No audio recordings store'));
        return;
      }

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
    request.onerror = () => reject(request.error);
  });
}

// Load webcam from IndexedDB
function loadWebcamFromIndexedDB(recordingId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayRecorder', 3);

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

      // Check if object store exists
      if (!db.objectStoreNames.contains('webcamRecordings')) {
        db.close();
        reject(new Error('No webcam recordings store'));
        return;
      }

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
    request.onerror = () => reject(request.error);
  });
}

// Load voiceovers from IndexedDB
function loadVoiceoversFromIndexedDB(recordingId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayRecorder', 3);

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

      // Check if object store exists
      if (!db.objectStoreNames.contains('voiceovers')) {
        db.close();
        reject(new Error('No voiceovers store'));
        return;
      }

      const transaction = db.transaction(['voiceovers'], 'readonly');
      const store = transaction.objectStore('voiceovers');
      const voiceovers = {};

      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const data = cursor.value;
          if (data.recordingId === recordingId) {
            voiceovers[data.subtitleId] = data.blob;
          }
          cursor.continue();
        } else {
          db.close();
          resolve(voiceovers);
        }
      };
      cursorRequest.onerror = () => {
        db.close();
        reject(cursorRequest.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

// Main export function
async function exportVideo(audioBlob, webcamBlob, voiceoverBlobs) {
  updateStatus('Setting up audio mixer...');
  updateProgress(20);

  // Setup audio context and mixing
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  mixedAudioDest = audioContext.createMediaStreamDestination();

  // Add original audio if exists
  if (audioBlob) {
    const audioElement = new Audio(URL.createObjectURL(audioBlob));
    const audioSource = audioContext.createMediaElementSource(audioElement);

    // Apply offset
    const offset = (storyboard.originalAudioOffset || 0) / 1000;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.7; // Reduce volume slightly to make room for voiceovers
    audioSource.connect(gainNode);
    gainNode.connect(mixedAudioDest);

    // Start audio with offset
    setTimeout(() => {
      audioElement.play().catch(e => log('Audio play failed: ' + e.message));
    }, offset);

    log(`Audio track added with ${offset}s offset`);
  }

  // Add voiceover tracks
  if (storyboard.subtitles) {
    for (const subtitle of storyboard.subtitles) {
      if (subtitle.voiceover && voiceoverBlobs[subtitle.id]) {
        const voAudio = new Audio(URL.createObjectURL(voiceoverBlobs[subtitle.id]));
        const voSource = audioContext.createMediaElementSource(voAudio);

        const voGain = audioContext.createGain();
        voGain.gain.value = 1.0;
        voSource.connect(voGain);
        voGain.connect(mixedAudioDest);

        // Schedule voiceover playback
        setTimeout(() => {
          voAudio.play().catch(e => log(`Voiceover ${subtitle.id} failed: ` + e.message));
        }, subtitle.time);

        log(`Voiceover scheduled at ${subtitle.time}ms`);
      }
    }
  }

  updateStatus('Setting up video encoder...');
  updateProgress(25);

  // Create canvas stream
  const canvasStream = canvas.captureStream(30); // 30 FPS
  log(`Canvas stream created, video tracks: ${canvasStream.getVideoTracks().length}`);

  // Get video track
  const videoTrack = canvasStream.getVideoTracks()[0];
  log(`Video track: ${videoTrack ? 'present' : 'MISSING'}`);

  // Only include audio if we actually have audio sources
  const hasAudio = audioBlob || (storyboard.subtitles && storyboard.subtitles.some(s => s.voiceover));
  let finalStream;

  if (hasAudio) {
    const audioTrack = mixedAudioDest.stream.getAudioTracks()[0];
    log(`Audio track: ${audioTrack ? 'present' : 'MISSING'}`);
    finalStream = new MediaStream([videoTrack, audioTrack].filter(t => t));
  } else {
    log('No audio sources - creating video-only stream');
    finalStream = new MediaStream([videoTrack]);
  }

  log(`Final stream tracks: ${finalStream.getTracks().length} (video: ${finalStream.getVideoTracks().length}, audio: ${finalStream.getAudioTracks().length})`);

  // Setup MediaRecorder
  try {
    // Check supported mimeTypes (prefer with audio if we have it, otherwise video-only)
    const mimeTypes = hasAudio ? [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ] : [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    let selectedMimeType = null;
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        log(`Using mimeType: ${mimeType}`);
        break;
      }
    }

    if (!selectedMimeType) {
      throw new Error('No supported video mimeType found');
    }

    const recorderOptions = {
      mimeType: selectedMimeType,
      videoBitsPerSecond: videoConfig.bitrate
    };

    if (hasAudio) {
      recorderOptions.audioBitsPerSecond = 128000;
    }

    mediaRecorder = new MediaRecorder(finalStream, recorderOptions);

    log(`MediaRecorder created with mimeType: ${mediaRecorder.mimeType}, hasAudio: ${hasAudio}`);

    mediaRecorder.ondataavailable = (event) => {
      log(`Data available: ${event.data ? event.data.size + ' bytes' : 'null'}`);
      if (event.data && event.data.size > 0) {
        videoChunks.push(event.data);
        const sizeMB = videoChunks.reduce((sum, chunk) => sum + chunk.size, 0) / (1024 * 1024);
        videoSizeEl.textContent = sizeMB.toFixed(2) + ' MB';
        log(`Total chunks: ${videoChunks.length}, Total size: ${sizeMB.toFixed(2)} MB`);
      } else {
        log('WARNING: Data event but no data or size is 0');
      }
    };

    mediaRecorder.onstop = async () => {
      log('Video encoding complete');
      log(`Total chunks collected: ${videoChunks.length}`);
      log(`Chunks array: ${JSON.stringify(videoChunks.map(c => c.size))}`);

      updateStatus('Creating video file...');
      updateProgress(95);

      const blob = new Blob(videoChunks, { type: 'video/webm' });
      log(`Blob created: ${blob.size} bytes (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`);

      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${videoConfig.recordingId}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);

      updateStatus('Complete!');
      updateProgress(100);
      completeMessageEl.style.display = 'block';
      log(`Video exported: ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);
    };

    mediaRecorder.onerror = (event) => {
      log(`ERROR: MediaRecorder error: ${event.error}`);
      console.error('[VideoExporter] MediaRecorder error:', event.error);
    };

    // Start recording and WAIT for it to actually start
    log('Starting MediaRecorder...');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        log('WARNING: MediaRecorder onstart timeout after 5s, proceeding anyway');
        resolve();
      }, 5000);

      mediaRecorder.onstart = () => {
        clearTimeout(timeout);
        log('MediaRecorder started - ready to record');
        resolve();
      };

      try {
        mediaRecorder.start(1000); // Collect data every second
        log('MediaRecorder.start() called');
      } catch (error) {
        clearTimeout(timeout);
        log(`ERROR starting MediaRecorder: ${error.message}`);
        reject(error);
      }
    });

    updateStatus('Rendering frames...');
    updateProgress(30);

    // Render the timeline
    log('Beginning frame rendering...');
    await renderTimeline();
    log('Frame rendering complete');

    // Request final data and stop recording
    log(`Requesting final data... (state: ${mediaRecorder.state})`);
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.requestData(); // Flush any pending data
      await new Promise(resolve => setTimeout(resolve, 100)); // Give it time to flush
      log('Stopping recorder...');
      mediaRecorder.stop();
    } else {
      log(`WARNING: Recorder not in recording state, current state: ${mediaRecorder.state}`);
    }

    // Stop audio context
    if (audioContext) {
      audioContext.close();
    }

  } catch (error) {
    console.error('[VideoExporter] MediaRecorder error:', error);
    updateStatus('Error: ' + error.message);
    log('ERROR: ' + error.message);
  }
}

// Render timeline as frames
async function renderTimeline() {
  if (!storyboard || !storyboard.timeline) {
    throw new Error('Storyboard or timeline is missing');
  }

  const timeline = storyboard.timeline;

  if (!timeline || timeline.length === 0) {
    throw new Error('Timeline has no events');
  }

  const totalDuration = timeline[timeline.length - 1]?.t || 10000;
  const frameRate = 30; // FPS
  const frameDuration = 1000 / frameRate; // ms per frame

  let currentTime = 0;
  let eventIndex = 0;
  let frameCount = 0;

  while (currentTime < totalDuration + 2000) { // Add 2s buffer at end
    // Find current event
    while (eventIndex < timeline.length && timeline[eventIndex].t <= currentTime) {
      eventIndex++;
    }

    const currentEvent = eventIndex > 0 ? timeline[eventIndex - 1] : null;

    // Render frame
    await renderFrame(currentTime, currentEvent, eventIndex - 1, timeline.length);

    // Update progress
    const progress = 30 + ((currentTime / totalDuration) * 60); // 30-90%
    updateProgress(Math.min(progress, 90));
    processedEventsEl.textContent = Math.min(eventIndex, timeline.length);

    // Next frame
    currentTime += frameDuration;
    frameCount++;

    // CRITICAL: Wait for real-time to allow MediaRecorder to capture
    // This ensures the recorder has time to collect stream data
    await new Promise(resolve => setTimeout(resolve, frameDuration));
  }

  log(`Rendered ${frameCount} frames`);
}

// Render a single frame
async function renderFrame(time, event, eventIndex, totalEvents) {
  // Clear canvas with gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw title area
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(0, 0, canvas.width, 120);

  // Draw title
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 36px Space Grotesk';
  ctx.fillText(storyboard.meta?.title || 'Web Replay Recording', 40, 55);

  // Draw subtitle with timestamp
  ctx.fillStyle = '#6b7280';
  ctx.font = '20px Space Grotesk';
  ctx.fillText(`Time: ${formatTime(time)} | Event ${eventIndex + 1}/${totalEvents}`, 40, 95);

  // Draw event visualization
  if (event) {
    drawEventVisualization(event, eventIndex);
  }

  // Draw subtitles if active
  if (storyboard.subtitles) {
    for (const subtitle of storyboard.subtitles) {
      if (time >= subtitle.time && time < subtitle.time + subtitle.duration) {
        drawSubtitle(subtitle);
        break;
      }
    }
  }

  // Draw progress bar
  const progress = (time / (storyboard.timeline[storyboard.timeline.length - 1]?.t || 1)) * 100;
  drawProgressBar(progress);
}

// Draw event visualization
function drawEventVisualization(event, index) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 + 50;

  // Draw event type icon and details
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(centerX - 300, centerY - 100, 600, 200);

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3;
  ctx.strokeRect(centerX - 300, centerY - 100, 600, 200);

  // Event type
  ctx.fillStyle = '#2563eb';
  ctx.font = 'bold 32px Space Grotesk';
  const eventIcon = getEventIcon(event.type);
  ctx.fillText(`${eventIcon} ${event.type.toUpperCase()}`, centerX - 280, centerY - 50);

  // Event details
  ctx.fillStyle = '#374151';
  ctx.font = '20px Space Grotesk';

  let detailY = centerY;
  switch (event.type) {
    case 'click':
      ctx.fillText(`Position: (${event.position?.x || 0}, ${event.position?.y || 0})`, centerX - 280, detailY);
      if (event.target?.selectors?.[0]) {
        ctx.font = '16px Space Grotesk';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(`Target: ${event.target.selectors[0].substring(0, 50)}`, centerX - 280, detailY + 30);
      }
      break;

    case 'type':
      ctx.fillText(`Text: "${(event.text || '').substring(0, 40)}${event.text?.length > 40 ? '...' : ''}"`, centerX - 280, detailY);
      break;

    case 'navigate':
      ctx.font = '16px Space Grotesk';
      ctx.fillText(`URL: ${(event.url || '').substring(0, 60)}`, centerX - 280, detailY);
      break;

    case 'scroll':
      ctx.fillText(`Scroll to: (${event.position?.x || 0}, ${event.position?.y || 0})`, centerX - 280, detailY);
      break;

    default:
      ctx.fillText(`Event #${index + 1}`, centerX - 280, detailY);
  }
}

// Draw subtitle
function drawSubtitle(subtitle) {
  const text = subtitle.text;
  const fontSize = subtitle.fontSize || 32;
  const color = subtitle.color || '#ffffff';
  const position = subtitle.position || 'bottom';

  ctx.font = `bold ${fontSize}px Space Grotesk`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Add background for readability
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.5;

  let y;
  if (position === 'top') {
    y = 180;
  } else if (position === 'middle') {
    y = canvas.height / 2;
  } else {
    y = canvas.height - 100;
  }

  // Draw semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(
    canvas.width / 2 - textWidth / 2 - 30,
    y - textHeight / 2 - 10,
    textWidth + 60,
    textHeight + 20
  );

  // Draw text
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, y);
  ctx.textAlign = 'left';
}

// Draw progress bar
function drawProgressBar(progress) {
  const barWidth = canvas.width - 80;
  const barHeight = 8;
  const x = 40;
  const y = canvas.height - 40;

  // Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(x, y, barWidth, barHeight);

  // Progress
  ctx.fillStyle = '#10b981';
  ctx.fillRect(x, y, (barWidth * progress) / 100, barHeight);
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
    blur: '💨',
    upload: '📎',
    keypress: '⌨️'
  };
  return icons[type] || '📍';
}

// UI Helper functions
function updateStatus(text) {
  statusText.textContent = text;
  log(text);
}

function updateProgress(percent) {
  progressBar.style.width = percent + '%';
  progressBar.textContent = Math.round(percent) + '%';
}

function log(message) {
  const logLine = document.createElement('div');
  logLine.className = 'log-line';
  const timestamp = new Date().toLocaleTimeString();
  logLine.textContent = `[${timestamp}] ${message}`;
  logEl.appendChild(logLine);
  logEl.scrollTop = logEl.scrollHeight;
  logEl.style.display = 'block';
  console.log('[VideoExporter]', message);
}

function startTimeCounter() {
  setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timeElapsed.textContent = elapsed + 's';
  }, 1000);
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

console.log('[VideoExporter] Script loaded');
