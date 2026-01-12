// Video Renderer - Automated video export without screen capture
console.log('[VideoRenderer] Initializing...');

let storyboard = null;
let videoConfig = null;
let canvas = null;
let ctx = null;
let mediaRecorder = null;
let videoChunks = [];

// Initialize
window.addEventListener('load', async () => {
  canvas = document.getElementById('renderCanvas');
  ctx = canvas.getContext('2d');

  // Get parameters from URL
  const params = new URLSearchParams(window.location.search);
  const recordingId = params.get('id');
  const width = parseInt(params.get('width')) || 1280;
  const height = parseInt(params.get('height')) || 720;
  const bitrate = parseInt(params.get('bitrate')) || 5000000;

  videoConfig = { width, height, bitrate };

  // Set canvas size
  canvas.width = width;
  canvas.height = height;

  updateStatus('Loading storyboard...');

  try {
    // Load storyboard from storage
    storyboard = await loadStoryboard(recordingId);
    console.log('[VideoRenderer] Storyboard loaded:', storyboard);

    updateStatus('Ready to render');

    // Auto-start rendering
    await startRendering();

  } catch (error) {
    console.error('[VideoRenderer] Error:', error);
    updateStatus('Error: ' + error.message);
  }
});

// Load storyboard from chrome.storage
function loadStoryboard(recordingId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([`storyboard_${recordingId}`], (result) => {
      const key = `storyboard_${recordingId}`;
      if (result[key]) {
        try {
          const data = typeof result[key] === 'string' ? JSON.parse(result[key]) : result[key];
          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse storyboard: ' + error.message));
        }
      } else {
        reject(new Error('Storyboard not found'));
      }
    });
  });
}

// Update status indicator
function updateStatus(text) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = text;
  }
}

// Start rendering video
async function startRendering() {
  updateStatus('Setting up video encoder...');

  // Create canvas stream
  const canvasStream = canvas.captureStream(30); // 30 FPS

  // TODO: Mix audio tracks here
  // For now, we'll capture without audio
  // In a full implementation, we'd use Web Audio API to mix:
  // - Original audio
  // - Voiceover tracks
  // - And sync them with the video

  // Setup MediaRecorder
  try {
    mediaRecorder = new MediaRecorder(canvasStream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: videoConfig.bitrate
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        videoChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[VideoRenderer] Recording stopped, creating video file...');
      updateStatus('Creating video file...');

      const blob = new Blob(videoChunks, { type: 'video/webm' });

      // Send back to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'VIDEO_EXPORT_COMPLETE',
          videoBlob: blob,
          size: blob.size
        }, '*');
      }

      updateStatus('Complete! Video ready for download.');

      // Also offer direct download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rendered-video-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    // Start recording
    mediaRecorder.start();
    updateStatus('Recording started');

    // Render the replay
    await renderReplay();

    // Stop recording
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 1000); // Give it a second after replay completes

  } catch (error) {
    console.error('[VideoRenderer] MediaRecorder error:', error);
    updateStatus('Error: ' + error.message);
  }
}

// Render the replay frame by frame
async function renderReplay() {
  if (!storyboard || !storyboard.timeline) {
    console.error('[VideoRenderer] No timeline to replay');
    return;
  }

  updateStatus('Rendering replay...');

  const timeline = storyboard.timeline;
  const startTime = Date.now();

  for (let i = 0; i < timeline.length; i++) {
    const event = timeline[i];
    const nextEvent = timeline[i + 1];

    // Render current frame
    await renderFrame(event, i, timeline.length);

    // Calculate delay until next event
    let delay = 0;
    if (nextEvent) {
      delay = nextEvent.t - event.t;
    } else {
      delay = 1000; // 1 second for last event
    }

    // Wait for the delay (this maintains timing)
    await new Promise(resolve => setTimeout(resolve, delay));

    updateStatus(`Rendering: ${i + 1}/${timeline.length} events`);
  }

  updateStatus('Rendering complete');
  console.log('[VideoRenderer] Replay rendering complete');
}

// Render a single frame
async function renderFrame(event, index, total) {
  // Clear canvas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw event information
  ctx.fillStyle = '#000000';
  ctx.font = '24px Space Grotesk';
  ctx.fillText(`Event ${index + 1}/${total}: ${event.type}`, 50, 50);

  // Draw event details based on type
  ctx.font = '16px Space Grotesk';
  ctx.fillStyle = '#6b7280';

  switch (event.type) {
    case 'click':
      ctx.fillText(`Click at (${event.position?.x || 0}, ${event.position?.y || 0})`, 50, 90);
      if (event.position) {
        showCursor(event.position.x, event.position.y);
        showClickMarker(event.position.x, event.position.y);
      }
      break;

    case 'type':
      ctx.fillText(`Type: "${event.text || ''}"`, 50, 90);
      break;

    case 'navigate':
      ctx.fillText(`Navigate to: ${event.url || ''}`, 50, 90);
      break;

    case 'scroll':
      ctx.fillText(`Scroll to (${event.position?.x || 0}, ${event.position?.y || 0})`, 50, 90);
      break;

    case 'hover':
      ctx.fillText(`Hover over element`, 50, 90);
      if (event.position) {
        showCursor(event.position.x, event.position.y);
      }
      break;

    default:
      ctx.fillText(`${event.type} event`, 50, 90);
  }

  // Check for matching subtitle
  if (storyboard.subtitles) {
    for (const subtitle of storyboard.subtitles) {
      // Simple timing check - is current event time within subtitle time range?
      if (event.t >= subtitle.time && event.t < subtitle.time + subtitle.duration) {
        showSubtitle(subtitle.text);
      }
    }
  }

  // Draw timestamp
  ctx.fillStyle = '#9ca3af';
  ctx.font = '14px Space Grotesk';
  ctx.fillText(`Time: ${event.t}ms`, 50, canvas.height - 30);
}

// Show cursor on canvas
function showCursor(x, y) {
  const cursor = document.getElementById('cursor');
  if (cursor) {
    // Scale position to canvas
    const scaleX = canvas.width / 1920; // Assume recorded at 1920x1080
    const scaleY = canvas.height / 1080;
    cursor.style.left = (x * scaleX) + 'px';
    cursor.style.top = (y * scaleY) + 'px';
    cursor.style.display = 'block';

    setTimeout(() => {
      cursor.style.display = 'none';
    }, 500);
  }
}

// Show click marker
function showClickMarker(x, y) {
  const marker = document.getElementById('clickMarker');
  if (marker) {
    const scaleX = canvas.width / 1920;
    const scaleY = canvas.height / 1080;
    marker.style.left = (x * scaleX) + 'px';
    marker.style.top = (y * scaleY) + 'px';
    marker.style.display = 'block';
    marker.style.animation = 'clickPulse 0.6s ease-out';

    setTimeout(() => {
      marker.style.display = 'none';
    }, 600);
  }
}

// Show subtitle
function showSubtitle(text) {
  const subtitle = document.getElementById('subtitle');
  if (subtitle) {
    subtitle.textContent = text;
    subtitle.style.display = 'block';

    // Auto-hide after a bit (subtitle duration is managed by timeline)
    setTimeout(() => {
      subtitle.style.display = 'none';
    }, 2000);
  }
}

console.log('[VideoRenderer] Script loaded');
