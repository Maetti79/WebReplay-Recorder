// Timeline Editor - Main controller

let storyboard = null;
let recordingId = null; // Current recording ID for media/export
let selectedEvent = null;
let zoom = 1;
let isDragging = false;
let draggedEvent = null;
let playhead = 0;
let isPlaying = false;
let playInterval = null;

// DOM elements
const fileInput = document.getElementById('fileInput');
const loadBtn = document.getElementById('loadBtn');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const renderBtn = document.getElementById('renderBtn');
const projectTitle = document.getElementById('projectTitle');
const eventList = document.getElementById('eventList');
const timelineCanvas = document.getElementById('timelineCanvas');
const timelineContent = document.getElementById('timelineContent');
const properties = document.getElementById('properties');
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const timeDisplay = document.getElementById('timeDisplay');
const addEventBtn = document.getElementById('addEventBtn');
const addEventType = document.getElementById('addEventType');

// Info displays
const infoDuration = document.getElementById('infoDuration');
const infoEvents = document.getElementById('infoEvents');
const infoViewport = document.getElementById('infoViewport');

// Load storyboard
loadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      storyboard = JSON.parse(event.target.result);
      loadStoryboard();
      saveBtn.disabled = false;
      exportBtn.disabled = false;

      // Try to load audio/video if recordingId is available
      recordingId = storyboard?.meta?.recordingId; // Set global recordingId
      if (recordingId) {
        console.log('[Timeline Editor] Found recordingId, loading media:', recordingId);

        let hasMedia = false;

        // Load audio from IndexedDB if available
        try {
          audioBlob = await getAudioFromDB(recordingId);
          if (audioBlob) {
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;
            console.log('[Timeline Editor] ✅ Audio loaded:', audioBlob.size, 'bytes');
            hasMedia = true;
            updateRenderButtonState(); // Enable render button
          }
        } catch (error) {
          console.log('[Timeline Editor] No audio available for this recording');
        }

        // Load webcam from IndexedDB if available
        try {
          webcamBlob = await getWebcamFromDB(recordingId);
          if (webcamBlob) {
            const webcamUrl = URL.createObjectURL(webcamBlob);
            webcamPlayer.src = webcamUrl;
            console.log('[Timeline Editor] ✅ Webcam loaded:', webcamBlob.size, 'bytes');
            hasMedia = true;
          }
        } catch (error) {
          console.log('[Timeline Editor] No webcam available for this recording');
        }

        // Media players are now shown in right panel when clicked
        if (hasMedia) {
          console.log('[Timeline Editor] Media loaded - players available in right panel');
          // Update timeline to show audio/video tracks
          setTimeout(() => {
            renderTimeline();
          }, 200);
        }
      } else {
        console.log('[Timeline Editor] No recordingId found in storyboard metadata');
      }
    } catch (error) {
      showModal('Failed to load storyboard: ' + error.message);
    }
  };
  reader.readAsText(file);
});

// Zoom control
zoomSlider.addEventListener('input', (e) => {
  zoom = parseFloat(e.target.value);
  zoomValue.textContent = Math.round(zoom * 100) + '%';
  if (storyboard) renderTimeline();
});

// Playback controls
playBtn.addEventListener('click', () => {
  if (!storyboard) return;

  if (!isPlaying) {
    startPlayback();
  } else {
    pausePlayback();
  }
});

stopBtn.addEventListener('click', () => {
  stopPlayback();
});

// Add event manually
addEventBtn.addEventListener('click', () => {
  const eventType = addEventType.value;

  // Handle text block separately
  if (eventType === 'text') {
    const newTextBlock = {
      id: generateId(),
      time: playhead || 0,
      duration: 3000, // Default 3 seconds
      text: 'New text block',
      voiceId: '21m00Tcm4TlvDq8ikWAM', // Default voice
      voiceover: null,
      // Styling defaults
      fontFamily: 'Arial, sans-serif',
      fontSize: 32,
      fontColor: '#ffffff',
      position: 'bottom'
    };

    subtitles.push(newTextBlock);
    subtitles.sort((a, b) => a.time - b.time);

    // Select the new text block for editing
    selectSubtitle(newTextBlock.id);

    // Update UI
    renderTimeline();
    updateSubtitlesList();

    console.log('[Editor] Added new text block:', newTextBlock.id);
    return;
  }

  // Handle events
  if (!storyboard) {
    showModal('Please load a storyboard first');
    return;
  }

  const time = playhead || 0; // Use current playhead position or start at 0

  // Create new event based on type
  let newEvent = {
    t: time,
    type: eventType,
    durationMs: 1000
  };

  // Add type-specific properties
  switch (eventType) {
    case 'navigate':
      newEvent.url = 'https://example.com';
      break;
    case 'click':
      newEvent.position = { x: 100, y: 100 };
      newEvent.target = {
        selectors: ['button'],
        text: 'Click me'
      };
      break;
    case 'type':
      newEvent.text = 'Type text here';
      newEvent.typing = { charsPerSec: 12 };
      break;
    case 'scroll':
      newEvent.position = { x: 0, y: 500 };
      break;
    case 'keypress':
      newEvent.key = 'Enter';
      break;
    case 'upload':
      newEvent.files = [{
        name: 'example.txt',
        type: 'text/plain',
        size: 1024
      }];
      newEvent.target = {
        selectors: ['input[type="file"]']
      };
      break;
    case 'hover':
      newEvent.target = {
        selectors: ['button'],
        tag: 'button'
      };
      newEvent.position = { x: 100, y: 100 };
      break;
    case 'focus':
      newEvent.target = {
        selectors: ['input'],
        tag: 'input'
      };
      break;
    case 'blur':
      newEvent.target = {
        selectors: ['input'],
        tag: 'input'
      };
      break;
    case 'pause':
      newEvent.reason = 'Manual pause';
      newEvent.durationMs = 2000;
      break;
  }

  // Add event to timeline
  storyboard.timeline.push(newEvent);

  // Sort by time
  storyboard.timeline.sort((a, b) => a.t - b.t);

  // Find index of newly added event
  const newIndex = storyboard.timeline.findIndex(e => e.t === time && e.type === eventType);

  // Update UI
  renderEventList();
  renderTimeline();

  // Select the new event for editing
  if (newIndex !== -1) {
    selectEvent(newIndex);
  }

  console.log('[Editor] Added new', eventType, 'event at', time, 'ms');
});

function startPlayback() {
  isPlaying = true;
  playBtn.textContent = '⏸️';

  const startTime = Date.now() - playhead;

  playInterval = setInterval(() => {
    playhead = Date.now() - startTime;
    updatePlayhead();

    const duration = getStoryboardDuration();
    if (playhead >= duration) {
      stopPlayback();
    }
  }, 16); // ~60fps
}

function pausePlayback() {
  isPlaying = false;
  playBtn.textContent = '▶️';
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

function stopPlayback() {
  pausePlayback();
  playhead = 0;
  updatePlayhead();
}

function updatePlayhead() {
  const seconds = Math.floor(playhead / 1000);
  const ms = playhead % 1000;
  timeDisplay.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;

  // Move visual playhead
  const playheadEl = document.querySelector('.playhead');
  if (playheadEl) {
    playheadEl.style.left = (playhead * zoom * 0.1) + 'px';
  }
}

// Load and render storyboard
function loadStoryboard() {
  projectTitle.textContent = storyboard.meta?.title || 'Untitled';

  // Update info
  const duration = getStoryboardDuration();
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  infoDuration.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
  infoEvents.textContent = storyboard.timeline?.length || 0;

  if (storyboard.meta?.viewport) {
    infoViewport.textContent = `${storyboard.meta.viewport.width}×${storyboard.meta.viewport.height}`;
  }

  renderEventList();
  renderTimeline();
  updateRenderButtonState();
}

// Update render button state based on available audio/voiceovers
function updateRenderButtonState() {
  // Enable render button as long as we have a storyboard
  // Audio/voiceovers are optional for video export
  if (storyboard) {
    renderBtn.disabled = false;

    const hasVoiceovers = subtitles.some(sub => sub.voiceover && sub.voiceover.audioBlob);
    const hasAudio = audioBlob !== null;

    if (hasVoiceovers || hasAudio) {
      renderBtn.title = 'Export video directly in browser - fully automated!';
    } else {
      renderBtn.title = 'Export video directly in browser (silent - no audio recorded)';
    }

    console.log('[Editor] Render button enabled (hasAudio:', hasAudio, ', hasVoiceovers:', hasVoiceovers, ')');
  } else {
    renderBtn.disabled = true;
    renderBtn.title = 'Load a storyboard first';
    console.log('[Editor] Render button disabled (no storyboard)');
  }
}

function getStoryboardDuration() {
  if (!storyboard?.timeline || storyboard.timeline.length === 0) return 0;

  const lastEvent = storyboard.timeline[storyboard.timeline.length - 1];
  return lastEvent.t + (lastEvent.durationMs || 1000);
}

// Render event list
function renderEventList() {
  eventList.innerHTML = '';

  if (!storyboard?.timeline) return;

  storyboard.timeline.forEach((event, index) => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.dataset.index = index;

    const header = document.createElement('div');
    header.className = 'event-header';

    const type = document.createElement('div');
    type.className = 'event-type';
    type.textContent = event.type;

    const time = document.createElement('div');
    time.className = 'event-time';
    time.textContent = formatTime(event.t);

    header.appendChild(type);
    header.appendChild(time);

    const details = document.createElement('div');
    details.className = 'event-details';
    details.textContent = getEventDescription(event);

    item.appendChild(header);
    item.appendChild(details);

    item.addEventListener('click', () => selectEvent(index));

    eventList.appendChild(item);
  });
}

function getEventDescription(event) {
  switch (event.type) {
    case 'navigate':
      return event.url;
    case 'click':
      return event.target?.selectors?.[0] || 'Element';
    case 'type':
      return `"${event.text?.substring(0, 30)}${event.text?.length > 30 ? '...' : ''}"`;
    case 'keypress':
      return event.key;
    case 'pause':
      return `Wait ${event.durationMs}ms`;
    case 'scroll':
      return `${event.position?.x || 0}, ${event.position?.y || 0}`;
    case 'upload':
      const fileCount = event.files?.length || 0;
      const fileName = event.files?.[0]?.name || 'file';
      return fileCount === 1 ? fileName : `${fileCount} files`;
    default:
      return event.type;
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${seconds}.${String(millis).padStart(3, '0')}s`;
}

// Render timeline
function renderTimeline() {
  if (!storyboard?.timeline) return;

  const duration = getStoryboardDuration();
  const width = Math.max(1200, duration * zoom * 0.1); // 100ms = 10px at 1x zoom

  timelineContent.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'timeline-container';
  container.style.width = width + 'px';

  // Add playhead
  const playheadEl = document.createElement('div');
  playheadEl.className = 'playhead';
  playheadEl.style.left = (playhead * zoom * 0.1) + 'px';
  container.appendChild(playheadEl);

  // Ruler
  const ruler = document.createElement('div');
  ruler.className = 'timeline-ruler';
  container.appendChild(ruler);

  // Group events by type into tracks
  const tracks = {
    navigation: [],
    interaction: [],
    input: [],
    control: []
  };

  storyboard.timeline.forEach((event, index) => {
    if (event.type === 'navigate') {
      tracks.navigation.push({ event, index });
    } else if (event.type === 'click' || event.type === 'scroll') {
      tracks.interaction.push({ event, index });
    } else if (event.type === 'type') {
      tracks.input.push({ event, index });
    } else {
      tracks.control.push({ event, index });
    }
  });

  // Render tracks
  Object.entries(tracks).forEach(([trackName, events]) => {
    if (events.length === 0) return;

    const track = document.createElement('div');
    track.className = 'timeline-track';

    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = trackName;
    track.appendChild(label);

    events.forEach(({ event, index }) => {
      const eventEl = createTimelineEvent(event, index);
      track.appendChild(eventEl);
    });

    container.appendChild(track);
  });

  // Render Original Audio Track
  if (audioBlob) {
    const audioTrack = document.createElement('div');
    audioTrack.className = 'timeline-track';
    audioTrack.style.height = '80px';

    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = '🎤 Original Audio';
    audioTrack.appendChild(label);

    const audioEl = document.createElement('div');
    audioEl.className = 'timeline-event timeline-audio';
    audioEl.style.left = (originalAudioOffset * zoom * 0.1) + 'px';
    audioEl.style.height = '60px';
    audioEl.style.cursor = 'move';
    audioEl.title = `Original audio offset: ${(originalAudioOffset / 1000).toFixed(2)}s`;

    // Apply muted styling if muted
    if (originalAudioMuted) {
      audioEl.style.background = 'rgba(100, 100, 100, 0.3)';
      audioEl.style.borderColor = 'rgba(150, 150, 150, 0.4)';
      audioEl.style.opacity = '0.6';
    } else {
      audioEl.style.background = 'rgba(59, 130, 246, 0.4)';
      audioEl.style.borderColor = 'rgba(59, 130, 246, 0.6)';
    }

    // Highlight if selected
    if (selectedAudioElement === 'original') {
      audioEl.style.borderWidth = '3px';
      audioEl.style.borderColor = '#fff';
      audioEl.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.5)';
    }

    // Calculate audio duration
    const audioDuration = audioPlayer.duration ? audioPlayer.duration * 1000 : 10000;
    audioEl.style.width = (audioDuration * zoom * 0.1) + 'px';

    const audioLabel = document.createElement('span');
    audioLabel.textContent = originalAudioMuted ? '🔇 Muted' : '🎤 Recording';
    audioLabel.style.display = 'flex';
    audioLabel.style.alignItems = 'center';
    audioLabel.style.gap = '8px';

    // Add play button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶️';
    playBtn.className = 'btn-icon btn-small';
    playBtn.style.marginLeft = '8px';
    playBtn.title = 'Play original audio';
    playBtn.onclick = (e) => {
      e.stopPropagation();
      if (audioPlayer.paused) {
        audioPlayer.play();
        playBtn.innerHTML = '⏸️';
      } else {
        audioPlayer.pause();
        playBtn.innerHTML = '▶️';
      }
    };
    audioLabel.appendChild(playBtn);

    // Add mute/unmute button
    const muteBtn = document.createElement('button');
    muteBtn.innerHTML = originalAudioMuted ? '🔊' : '🔇';
    muteBtn.className = 'btn-icon btn-small';
    muteBtn.style.marginLeft = '4px';
    muteBtn.title = originalAudioMuted ? 'Unmute for rendering' : 'Mute for rendering';
    muteBtn.onclick = (e) => {
      e.stopPropagation();
      originalAudioMuted = !originalAudioMuted;
      renderTimeline(); // Re-render to update visual
      console.log('[Timeline] Original audio', originalAudioMuted ? 'muted' : 'unmuted', 'for rendering');
    };
    audioLabel.appendChild(muteBtn);

    audioEl.appendChild(audioLabel);

    // Drag to adjust start position
    audioEl.addEventListener('mousedown', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        startDragOriginalAudio(e, audioEl);
      }
    });

    // Click to show audio details in properties panel
    audioEl.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        e.stopPropagation();
        selectOriginalAudio();
      }
    });

    audioTrack.appendChild(audioEl);
    container.appendChild(audioTrack);
  }

  // Render Webcam Video Track
  if (webcamBlob) {
    const webcamTrack = document.createElement('div');
    webcamTrack.className = 'timeline-track';
    webcamTrack.style.height = '80px';

    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = '📹 Webcam';
    webcamTrack.appendChild(label);

    const webcamEl = document.createElement('div');
    webcamEl.className = 'timeline-event timeline-video';
    webcamEl.style.left = (webcamOffset * zoom * 0.1) + 'px';
    webcamEl.style.height = '60px';
    webcamEl.style.cursor = 'move';
    webcamEl.title = `Webcam offset: ${(webcamOffset / 1000).toFixed(2)}s`;

    // Apply disabled styling if muted
    if (webcamMuted) {
      webcamEl.style.background = 'rgba(100, 100, 100, 0.3)';
      webcamEl.style.borderColor = 'rgba(150, 150, 150, 0.4)';
      webcamEl.style.opacity = '0.6';
    } else {
      webcamEl.style.background = 'rgba(139, 92, 246, 0.4)';
      webcamEl.style.borderColor = 'rgba(139, 92, 246, 0.6)';
    }

    // Highlight if selected
    if (selectedAudioElement === 'webcam') {
      webcamEl.style.borderWidth = '3px';
      webcamEl.style.borderColor = '#fff';
      webcamEl.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.5)';
    }

    // Calculate webcam duration
    const webcamDuration = webcamPlayer.duration ? webcamPlayer.duration * 1000 : 10000;
    webcamEl.style.width = (webcamDuration * zoom * 0.1) + 'px';

    const webcamLabel = document.createElement('span');
    webcamLabel.textContent = webcamMuted ? '🚫 Disabled' : '📹 Video';
    webcamLabel.style.display = 'flex';
    webcamLabel.style.alignItems = 'center';
    webcamLabel.style.gap = '8px';

    // Add play button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶️';
    playBtn.className = 'btn-icon btn-small';
    playBtn.style.marginLeft = '8px';
    playBtn.title = 'Play webcam video';
    playBtn.onclick = (e) => {
      e.stopPropagation();
      if (webcamPlayer.paused) {
        webcamPlayer.play();
        playBtn.innerHTML = '⏸️';
      } else {
        webcamPlayer.pause();
        playBtn.innerHTML = '▶️';
      }
    };
    webcamLabel.appendChild(playBtn);

    // Add enable/disable button for rendering
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = webcamMuted ? '✅' : '🚫';
    toggleBtn.className = 'btn-icon btn-small';
    toggleBtn.style.marginLeft = '4px';
    toggleBtn.title = webcamMuted ? 'Enable in render' : 'Disable in render';
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      webcamMuted = !webcamMuted;
      renderTimeline(); // Re-render to update visual
      console.log('[Timeline] Webcam video', webcamMuted ? 'disabled' : 'enabled', 'for rendering');
    };
    webcamLabel.appendChild(toggleBtn);

    webcamEl.appendChild(webcamLabel);

    // Drag to adjust start position
    webcamEl.addEventListener('mousedown', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        startDragWebcam(e, webcamEl);
      }
    });

    // Click to show webcam details in properties panel
    webcamEl.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        e.stopPropagation();
        selectWebcam();
      }
    });

    webcamTrack.appendChild(webcamEl);
    container.appendChild(webcamTrack);
  }

  // Render Voiceover Track
  if (voiceoverAudio) {
    const voiceoverTrack = document.createElement('div');
    voiceoverTrack.className = 'timeline-track';
    voiceoverTrack.style.height = '80px';

    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = '🎙️ Voiceover';
    voiceoverTrack.appendChild(label);

    const voiceoverEl = document.createElement('div');
    voiceoverEl.className = 'timeline-event timeline-audio';
    voiceoverEl.style.left = (audioOffset * zoom * 0.1) + 'px';
    voiceoverEl.style.background = 'rgba(16, 185, 129, 0.4)';
    voiceoverEl.style.borderColor = 'rgba(16, 185, 129, 0.6)';
    voiceoverEl.style.height = '60px';
    voiceoverEl.title = `Voiceover offset: ${(audioOffset / 1000).toFixed(2)}s`;

    // Highlight if selected
    if (selectedAudioElement === 'voiceover') {
      voiceoverEl.style.borderWidth = '3px';
      voiceoverEl.style.borderColor = '#fff';
      voiceoverEl.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.5)';
    }

    // Get voiceover duration from voiceover player
    const voiceoverDuration = voiceoverPlayer.duration ? voiceoverPlayer.duration * 1000 : 10000;
    voiceoverEl.style.width = (voiceoverDuration * zoom * 0.1) + 'px';

    const voiceoverLabel = document.createElement('span');
    voiceoverLabel.textContent = '🎙️ Voiceover';
    voiceoverLabel.style.display = 'flex';
    voiceoverLabel.style.alignItems = 'center';
    voiceoverLabel.style.gap = '8px';

    // Add play button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶️';
    playBtn.className = 'btn-icon btn-small';
    playBtn.style.marginLeft = '8px';
    playBtn.title = 'Play voiceover';
    playBtn.onclick = (e) => {
      e.stopPropagation();
      if (voiceoverPlayer.paused) {
        voiceoverPlayer.play();
        playBtn.innerHTML = '⏸️';
      } else {
        voiceoverPlayer.pause();
        playBtn.innerHTML = '▶️';
      }
    };
    voiceoverLabel.appendChild(playBtn);
    voiceoverEl.appendChild(voiceoverLabel);

    // Click to show voiceover details in properties panel
    voiceoverEl.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        e.stopPropagation();
        selectOldVoiceover();
      }
    });
    voiceoverEl.style.cursor = 'pointer';

    // Make voiceover draggable
    voiceoverEl.addEventListener('mousedown', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        startDragAudio(e, voiceoverEl);
      }
    });

    voiceoverTrack.appendChild(voiceoverEl);
    container.appendChild(voiceoverTrack);
  }

  // Render Subtitles Track
  if (subtitles.length > 0) {
    const subsTrack = document.createElement('div');
    subsTrack.className = 'timeline-track';

    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = '📝 Text Blocks';
    subsTrack.appendChild(label);

    subtitles.forEach((subtitle, index) => {
      const subEl = document.createElement('div');
      subEl.className = 'timeline-event timeline-subtitle';
      subEl.dataset.subtitleId = subtitle.id;
      subEl.dataset.subtitleIndex = index;
      subEl.style.left = (subtitle.time * zoom * 0.1) + 'px';
      subEl.style.width = Math.max(80, subtitle.duration * zoom * 0.1) + 'px';
      subEl.style.cursor = 'pointer';

      // Highlight if selected
      if (subtitle.id === selectedSubtitleId) {
        subEl.style.background = 'rgba(168, 85, 247, 0.7)';
        subEl.style.borderColor = 'rgba(168, 85, 247, 1)';
        subEl.style.borderWidth = '2px';
      } else {
        subEl.style.background = 'rgba(168, 85, 247, 0.4)';
        subEl.style.borderColor = 'rgba(168, 85, 247, 0.6)';
      }

      subEl.style.whiteSpace = 'nowrap';
      subEl.style.overflow = 'hidden';
      subEl.style.textOverflow = 'ellipsis';
      subEl.style.padding = '4px 8px';

      const subLabel = document.createElement('span');
      subLabel.textContent = `💬 ${subtitle.text}`;
      subLabel.style.fontSize = '10px';
      subEl.appendChild(subLabel);

      // Click to select for editing
      subEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectSubtitle(subtitle.id);
      });

      // Make subtitle draggable
      subEl.addEventListener('mousedown', (e) => {
        if (!e.shiftKey) { // Only drag if not holding shift (shift = select)
          startDragSubtitle(e, subEl, index);
        }
      });

      subsTrack.appendChild(subEl);
    });

    container.appendChild(subsTrack);
  }

  // Render Voiceover Track (separate from subtitles)
  const hasVoiceovers = subtitles.some(sub => sub.voiceover && sub.voiceover.audioBlob);
  if (hasVoiceovers) {
    const voTrack = document.createElement('div');
    voTrack.className = 'timeline-track';

    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = '🎙️ Voiceovers';
    voTrack.appendChild(label);

    subtitles.forEach((subtitle, index) => {
      if (!subtitle.voiceover || !subtitle.voiceover.audioBlob) return;

      const voEl = document.createElement('div');
      voEl.className = 'timeline-event timeline-voiceover';
      voEl.dataset.subtitleId = subtitle.id;

      // Position voiceover relative to subtitle time + offset
      const voiceoverTime = subtitle.time + (subtitle.voiceover.offset || 0);
      voEl.style.left = (voiceoverTime * zoom * 0.1) + 'px';
      voEl.style.width = Math.max(60, subtitle.voiceover.duration * zoom * 0.1) + 'px';
      voEl.style.background = 'rgba(16, 185, 129, 0.4)';
      voEl.style.borderColor = 'rgba(16, 185, 129, 0.6)';
      voEl.style.cursor = 'move';
      voEl.style.padding = '4px 8px';

      const voLabel = document.createElement('span');
      voLabel.textContent = `🎤 ${subtitle.text.substring(0, 20)}...`;
      voLabel.style.fontSize = '10px';
      voEl.appendChild(voLabel);

      // Play button
      const playBtn = document.createElement('button');
      playBtn.innerHTML = '▶️';
      playBtn.className = 'btn-icon btn-small';
      playBtn.style.marginLeft = '4px';
      playBtn.onclick = (e) => {
        e.stopPropagation();
        playVoiceover(subtitle.id);
      };
      voEl.appendChild(playBtn);

      // Click to select parent text block
      voEl.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
          e.stopPropagation();
          selectSubtitle(subtitle.id);
        }
      });

      // Make voiceover draggable independently
      voEl.addEventListener('mousedown', (e) => {
        if (e.target.tagName !== 'BUTTON') {
          startDragVoiceover(e, voEl, subtitle.id);
        }
      });

      voTrack.appendChild(voEl);
    });

    container.appendChild(voTrack);
  }

  timelineContent.appendChild(container);
}

function createTimelineEvent(event, index) {
  const el = document.createElement('div');
  el.className = `timeline-event type-${event.type}`;
  el.dataset.index = index;
  el.style.left = (event.t * zoom * 0.1) + 'px';

  const duration = event.durationMs || 500;
  el.style.width = Math.max(60, duration * zoom * 0.1) + 'px';
  el.style.cursor = 'pointer';

  // Highlight if selected
  if (selectedEvent === index) {
    el.style.borderWidth = '2px';
    el.style.borderColor = '#fff';
    el.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.5)';
    el.style.transform = 'scale(1.05)';
    el.style.zIndex = '100';
  }

  const icon = getEventIcon(event.type);
  const label = document.createElement('span');
  label.textContent = `${icon} ${event.type}`;
  el.appendChild(label);

  // Drag handlers
  el.addEventListener('mousedown', (e) => startDrag(e, index));
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    selectEvent(index);
  });

  return el;
}

function getEventIcon(type) {
  const icons = {
    navigate: '🌐',
    click: '👆',
    type: '⌨️',
    keypress: '🔑',
    pause: '⏸️',
    scroll: '📜',
    upload: '📎'
  };
  return icons[type] || '•';
}

// Drag and drop
function startDrag(e, index) {
  // Don't start drag immediately - wait for mouse movement
  const el = e.target.closest('.timeline-event');
  const startX = e.clientX;
  const startTime = storyboard.timeline[index].t;
  let hasMoved = false;
  const DRAG_THRESHOLD = 5; // pixels

  function onMouseMove(e) {
    const deltaX = Math.abs(e.clientX - startX);

    // Only start dragging if mouse moved beyond threshold
    if (!hasMoved && deltaX < DRAG_THRESHOLD) {
      return;
    }

    if (!hasMoved) {
      hasMoved = true;
      isDragging = true;
      draggedEvent = index;
      el.classList.add('dragging');
    }

    const deltaTime = (e.clientX - startX) / (zoom * 0.1);
    const newTime = Math.max(0, startTime + deltaTime);

    el.style.left = (newTime * zoom * 0.1) + 'px';
  }

  function onMouseUp(e) {
    // If we didn't move, this was a click, not a drag
    if (!hasMoved) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      return; // Let click handler take over
    }

    isDragging = false;
    el.classList.remove('dragging');

    const deltaX = e.clientX - startX;
    const deltaTime = deltaX / (zoom * 0.1);
    const newTime = Math.max(0, startTime + deltaTime);

    // Update storyboard
    storyboard.timeline[draggedEvent].t = Math.round(newTime);

    // Re-sort timeline
    storyboard.timeline.sort((a, b) => a.t - b.t);

    // Re-render
    renderEventList();
    renderTimeline();

    if (selectedEvent === draggedEvent) {
      selectEvent(draggedEvent);
    }

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// Drag original audio track
function startDragOriginalAudio(e, el) {
  const startX = e.clientX;
  const startOffset = originalAudioOffset;
  let hasMoved = false;
  let isDragging = false;
  const DRAG_THRESHOLD = 5; // pixels

  function onMouseMove(e) {
    const deltaX = Math.abs(e.clientX - startX);

    // Only start dragging if mouse moved beyond threshold
    if (!hasMoved && deltaX < DRAG_THRESHOLD) {
      return;
    }

    if (!hasMoved) {
      hasMoved = true;
      isDragging = true;
      el.classList.add('dragging');
    }

    const deltaTime = (e.clientX - startX) / (zoom * 0.1);
    const newOffset = Math.max(0, startOffset + deltaTime);

    el.style.left = (newOffset * zoom * 0.1) + 'px';
  }

  function onMouseUp(e) {
    // If we didn't move, this was a click, not a drag
    if (!hasMoved) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      return; // Let click handler take over
    }

    isDragging = false;
    el.classList.remove('dragging');

    const deltaX = e.clientX - startX;
    const deltaTime = deltaX / (zoom * 0.1);
    originalAudioOffset = Math.max(0, Math.round(startOffset + deltaTime));

    console.log('[Timeline] Original audio offset updated to:', originalAudioOffset, 'ms');

    // Re-render
    renderTimeline();

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  e.stopPropagation();
}

// Drag webcam video track
function startDragWebcam(e, el) {
  const startX = e.clientX;
  const startOffset = webcamOffset;
  let hasMoved = false;
  let isDragging = false;
  const DRAG_THRESHOLD = 5; // pixels

  function onMouseMove(e) {
    const deltaX = Math.abs(e.clientX - startX);

    // Only start dragging if mouse moved beyond threshold
    if (!hasMoved && deltaX < DRAG_THRESHOLD) {
      return;
    }

    if (!hasMoved) {
      hasMoved = true;
      isDragging = true;
      el.classList.add('dragging');
    }

    const deltaTime = (e.clientX - startX) / (zoom * 0.1);
    const newOffset = Math.max(0, startOffset + deltaTime);

    el.style.left = (newOffset * zoom * 0.1) + 'px';
  }

  function onMouseUp(e) {
    // If we didn't move, this was a click, not a drag
    if (!hasMoved) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      return; // Let click handler take over
    }

    isDragging = false;
    el.classList.remove('dragging');

    const deltaX = e.clientX - startX;
    const deltaTime = deltaX / (zoom * 0.1);
    webcamOffset = Math.max(0, Math.round(startOffset + deltaTime));

    console.log('[Timeline] Webcam offset updated to:', webcamOffset, 'ms');

    // Re-render
    renderTimeline();

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  e.stopPropagation();
}

// Drag old voiceover audio track
let audioOffset = 0; // Audio start time offset in ms

function startDragAudio(e, el) {
  const startX = e.clientX;
  const startOffset = audioOffset;
  let hasMoved = false;
  let isDragging = false;
  const DRAG_THRESHOLD = 5; // pixels

  function onMouseMove(e) {
    const deltaX = Math.abs(e.clientX - startX);

    // Only start dragging if mouse moved beyond threshold
    if (!hasMoved && deltaX < DRAG_THRESHOLD) {
      return;
    }

    if (!hasMoved) {
      hasMoved = true;
      isDragging = true;
      el.classList.add('dragging');
    }

    const deltaTime = (e.clientX - startX) / (zoom * 0.1);
    const newOffset = Math.max(0, startOffset + deltaTime);

    el.style.left = (newOffset * zoom * 0.1) + 'px';
  }

  function onMouseUp(e) {
    // If we didn't move, this was a click, not a drag
    if (!hasMoved) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      return; // Let click handler take over
    }

    isDragging = false;
    el.classList.remove('dragging');

    const deltaX = e.clientX - startX;
    const deltaTime = deltaX / (zoom * 0.1);
    audioOffset = Math.max(0, Math.round(startOffset + deltaTime));

    console.log('[Timeline] Audio offset updated to:', audioOffset, 'ms');

    // Re-render
    renderTimeline();

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  e.stopPropagation();
}

// Drag subtitle
function startDragSubtitle(e, el, index) {
  const startX = e.clientX;
  const startTime = subtitles[index].time;
  let hasMoved = false;
  let isDragging = false;
  const DRAG_THRESHOLD = 5; // pixels

  function onMouseMove(e) {
    const deltaX = Math.abs(e.clientX - startX);

    // Only start dragging if mouse moved beyond threshold
    if (!hasMoved && deltaX < DRAG_THRESHOLD) {
      return;
    }

    if (!hasMoved) {
      hasMoved = true;
      isDragging = true;
      el.classList.add('dragging');
    }

    const deltaTime = (e.clientX - startX) / (zoom * 0.1);
    const newTime = Math.max(0, startTime + deltaTime);

    el.style.left = (newTime * zoom * 0.1) + 'px';
  }

  function onMouseUp(e) {
    // If we didn't move, this was a click, not a drag
    if (!hasMoved) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      return; // Let click handler take over
    }

    isDragging = false;
    el.classList.remove('dragging');

    const deltaX = e.clientX - startX;
    const deltaTime = deltaX / (zoom * 0.1);
    const newTime = Math.max(0, startTime + deltaTime);

    // Update subtitle time
    subtitles[index].time = Math.round(newTime);

    console.log('[Timeline] Subtitle', index, 'moved to:', subtitles[index].time, 'ms');

    // Re-sort subtitles
    subtitles.sort((a, b) => a.time - b.time);

    // Re-render
    renderTimeline();
    updateSubtitlesList();

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  e.stopPropagation();
}

// Select event
function selectEvent(index) {
  selectedEvent = index;
  selectedSubtitleId = null; // Deselect subtitle
  selectedAudioElement = null; // Deselect audio element

  // Update UI
  document.querySelectorAll('.event-item').forEach((item, i) => {
    item.classList.toggle('selected', i === index);
  });

  renderTimeline();
  renderProperties();
}

// Select subtitle for editing
function selectSubtitle(subtitleId) {
  selectedSubtitleId = subtitleId;
  selectedEvent = null; // Deselect event
  selectedAudioElement = null; // Deselect audio element

  renderTimeline(); // Re-render to show selection
  renderProperties(); // Show subtitle editor

  console.log('[Editor] Subtitle selected for editing:', subtitleId);
}

// Track selection state for audio elements
let selectedAudioElement = null; // 'original' or 'voiceover'

// Select original audio
function selectOriginalAudio() {
  selectedEvent = null;
  selectedSubtitleId = null;
  selectedAudioElement = 'original';

  renderTimeline();
  renderOriginalAudioDetails();

  console.log('[Editor] Original audio selected');
}

// Select old voiceover track
function selectOldVoiceover() {
  selectedEvent = null;
  selectedSubtitleId = null;
  selectedAudioElement = 'voiceover';

  renderTimeline();
  renderOldVoiceoverDetails();

  console.log('[Editor] Old voiceover selected');
}

// Select webcam video track
function selectWebcam() {
  selectedEvent = null;
  selectedSubtitleId = null;
  selectedAudioElement = 'webcam';

  renderTimeline();
  renderWebcamDetails();

  console.log('[Editor] Webcam video selected');
}

// Drag voiceover independently
function startDragVoiceover(e, el, subtitleId) {
  const subtitle = subtitles.find(s => s.id === subtitleId);
  if (!subtitle || !subtitle.voiceover) return;

  const startX = e.clientX;
  const startOffset = subtitle.voiceover.offset || 0;
  let hasMoved = false;
  let isDragging = false;
  const DRAG_THRESHOLD = 5; // pixels

  function onMouseMove(e) {
    const deltaX = Math.abs(e.clientX - startX);

    // Only start dragging if mouse moved beyond threshold
    if (!hasMoved && deltaX < DRAG_THRESHOLD) {
      return;
    }

    if (!hasMoved) {
      hasMoved = true;
      isDragging = true;
      el.classList.add('dragging');
    }

    const deltaTime = (e.clientX - startX) / (zoom * 0.1);
    const newOffset = startOffset + deltaTime;

    // Update visual position
    const voiceoverTime = subtitle.time + newOffset;
    el.style.left = (voiceoverTime * zoom * 0.1) + 'px';
  }

  function onMouseUp(e) {
    // If we didn't move, this was a click, not a drag
    if (!hasMoved) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      return; // Let click handler take over
    }

    isDragging = false;
    el.classList.remove('dragging');

    const deltaX = e.clientX - startX;
    const deltaTime = deltaX / (zoom * 0.1);
    const newOffset = Math.round(startOffset + deltaTime);

    // Update voiceover offset
    subtitle.voiceover.offset = newOffset;

    console.log('[Timeline] Voiceover offset for', subtitleId, 'updated to:', newOffset, 'ms');

    // Re-render
    renderTimeline();

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  e.stopPropagation();
}

// Play voiceover for a subtitle
function playVoiceover(subtitleId) {
  const subtitle = subtitles.find(s => s.id === subtitleId);
  if (!subtitle || !subtitle.voiceover || !subtitle.voiceover.audioBlob) {
    console.warn('[Editor] No voiceover found for subtitle:', subtitleId);
    return;
  }

  // Create temporary audio element
  const audio = new Audio();
  audio.src = URL.createObjectURL(subtitle.voiceover.audioBlob);
  audio.play();

  // Clean up URL after playing
  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(audio.src);
  });

  console.log('[Editor] Playing voiceover for:', subtitleId);
}

// Render properties panel
function renderProperties() {
  // Check if subtitle is selected
  if (selectedSubtitleId) {
    renderSubtitleEditor();
    return;
  }

  if (selectedEvent === null || !storyboard?.timeline?.[selectedEvent]) {
    properties.innerHTML = '<h3>Properties</h3><p style="color: #666; font-size: 13px;">Select an event or text block to edit</p>';
    return;
  }

  const event = storyboard.timeline[selectedEvent];

  properties.innerHTML = `
    <h3>Event Properties</h3>

    <div class="property-group">
      <label>Type</label>
      <input type="text" value="${event.type}" disabled>
    </div>

    <div class="property-group">
      <label>Time (ms)</label>
      <input type="number" id="propTime" value="${event.t}" min="0" step="100">
    </div>

    ${event.type === 'type' ? `
      <div class="property-group">
        <label>Text</label>
        <textarea id="propText">${event.text || ''}</textarea>
      </div>

      <div class="property-group">
        <label>Typing Speed (chars/sec)</label>
        <input type="number" id="propTypingSpeed" value="${event.typing?.charsPerSec || 12}" min="1" max="50">
      </div>
    ` : ''}

    ${event.type === 'pause' ? `
      <div class="property-group">
        <label>Duration (ms)</label>
        <input type="number" id="propDuration" value="${event.durationMs || 1000}" min="0" step="100">
      </div>

      <div class="property-group">
        <label>Reason</label>
        <input type="text" id="propReason" value="${event.reason || ''}">
      </div>
    ` : ''}

    ${event.type === 'navigate' ? `
      <div class="property-group">
        <label>URL</label>
        <input type="text" id="propUrl" value="${event.url || ''}">
      </div>
    ` : ''}

    ${event.target ? `
      <div class="property-group">
        <label>Selectors</label>
        <textarea id="propSelectors" style="font-family: monospace; font-size: 11px;">${event.target.selectors?.join('\n') || ''}</textarea>
      </div>
    ` : ''}

    <button class="btn-danger" id="deleteEventBtn" style="width: 100%; margin-top: 12px;">
      🗑️ Delete Event
    </button>
  `;

  // Add change listeners
  const deleteEventBtn = document.getElementById('deleteEventBtn');
  if (deleteEventBtn) {
    deleteEventBtn.addEventListener('click', () => {
      deleteEvent();
    });
  }

  const propTime = document.getElementById('propTime');
  if (propTime) {
    propTime.addEventListener('change', () => {
      event.t = parseInt(propTime.value);
      storyboard.timeline.sort((a, b) => a.t - b.t);
      renderEventList();
      renderTimeline();
    });
  }

  const propText = document.getElementById('propText');
  if (propText) {
    propText.addEventListener('change', () => {
      event.text = propText.value;
      renderEventList();
    });
  }

  const propTypingSpeed = document.getElementById('propTypingSpeed');
  if (propTypingSpeed) {
    propTypingSpeed.addEventListener('change', () => {
      if (!event.typing) event.typing = {};
      event.typing.charsPerSec = parseInt(propTypingSpeed.value);
    });
  }

  const propDuration = document.getElementById('propDuration');
  if (propDuration) {
    propDuration.addEventListener('change', () => {
      event.durationMs = parseInt(propDuration.value);
      renderTimeline();
    });
  }

  const propReason = document.getElementById('propReason');
  if (propReason) {
    propReason.addEventListener('change', () => {
      event.reason = propReason.value;
    });
  }

  const propUrl = document.getElementById('propUrl');
  if (propUrl) {
    propUrl.addEventListener('change', () => {
      event.url = propUrl.value;
      renderEventList();
    });
  }

  const propSelectors = document.getElementById('propSelectors');
  if (propSelectors) {
    propSelectors.addEventListener('change', () => {
      event.target.selectors = propSelectors.value.split('\n').filter(s => s.trim());
    });
  }
}

// Render subtitle editor in properties panel
function renderSubtitleEditor() {
  const subtitle = subtitles.find(s => s.id === selectedSubtitleId);
  if (!subtitle) {
    properties.innerHTML = '<h3>Text Block Editor</h3><p style="color: #c62828;">Text block not found</p>';
    return;
  }

  properties.innerHTML = `
    <h3>📝 Text Block Editor</h3>

    <div class="property-group">
      <label>Text</label>
      <textarea id="subText" rows="4" style="resize: vertical;">${subtitle.text}</textarea>
    </div>

    <div class="property-group">
      <label>Time (ms)</label>
      <input type="number" id="subTime" value="${subtitle.time}" min="0" step="100">
    </div>

    <div class="property-group">
      <label>Duration (ms)</label>
      <input type="number" id="subDuration" value="${subtitle.duration}" min="100" step="100">
    </div>

    <h3 style="margin-top: 20px; font-size: 14px; color: rgba(255, 255, 255, 0.9);">🎨 Subtitle Styling</h3>

    <div class="property-group">
      <label>Font Family</label>
      <select id="subFontFamily" style="width: 100%;">
        <option value="Arial, sans-serif" ${(subtitle.fontFamily || 'Arial, sans-serif') === 'Arial, sans-serif' ? 'selected' : ''}>Arial</option>
        <option value="'Helvetica Neue', Helvetica, sans-serif" ${subtitle.fontFamily === "'Helvetica Neue', Helvetica, sans-serif" ? 'selected' : ''}>Helvetica</option>
        <option value="'Times New Roman', Times, serif" ${subtitle.fontFamily === "'Times New Roman', Times, serif" ? 'selected' : ''}>Times New Roman</option>
        <option value="'Courier New', Courier, monospace" ${subtitle.fontFamily === "'Courier New', Courier, monospace" ? 'selected' : ''}>Courier New</option>
        <option value="Georgia, serif" ${subtitle.fontFamily === 'Georgia, serif' ? 'selected' : ''}>Georgia</option>
        <option value="Verdana, sans-serif" ${subtitle.fontFamily === 'Verdana, sans-serif' ? 'selected' : ''}>Verdana</option>
        <option value="'Trebuchet MS', sans-serif" ${subtitle.fontFamily === "'Trebuchet MS', sans-serif" ? 'selected' : ''}>Trebuchet MS</option>
        <option value="Impact, sans-serif" ${subtitle.fontFamily === 'Impact, sans-serif' ? 'selected' : ''}>Impact</option>
        <option value="'Comic Sans MS', cursive" ${subtitle.fontFamily === "'Comic Sans MS', cursive" ? 'selected' : ''}>Comic Sans MS</option>
      </select>
    </div>

    <div class="property-group">
      <label>Font Size (px)</label>
      <input type="number" id="subFontSize" value="${subtitle.fontSize || 32}" min="12" max="120" step="2">
    </div>

    <div class="property-group">
      <label>Font Color</label>
      <input type="color" id="subFontColor" value="${subtitle.fontColor || '#ffffff'}" style="width: 100%; height: 40px; cursor: pointer;">
    </div>

    <div class="property-group">
      <label>Position</label>
      <select id="subPosition" style="width: 100%;">
        <option value="bottom" ${(subtitle.position || 'bottom') === 'bottom' ? 'selected' : ''}>Bottom</option>
        <option value="middle" ${subtitle.position === 'middle' ? 'selected' : ''}>Middle</option>
        <option value="top" ${subtitle.position === 'top' ? 'selected' : ''}>Top</option>
      </select>
    </div>

    <h3 style="margin-top: 20px; font-size: 14px; color: rgba(255, 255, 255, 0.9);">🎙️ Voiceover</h3>

    <div class="property-group">
      <label>Voice for Voiceover</label>
      <select id="subVoiceId" style="width: 100%;">
        <option value="21m00Tcm4TlvDq8ikWAM" ${subtitle.voiceId === '21m00Tcm4TlvDq8ikWAM' ? 'selected' : ''}>Rachel (Female)</option>
        <option value="AZnzlk1XvdvUeBnXmlld" ${subtitle.voiceId === 'AZnzlk1XvdvUeBnXmlld' ? 'selected' : ''}>Domi (Female)</option>
        <option value="EXAVITQu4vr4xnSDxMaL" ${subtitle.voiceId === 'EXAVITQu4vr4xnSDxMaL' ? 'selected' : ''}>Bella (Female)</option>
        <option value="ErXwobaYiN019PkySvjV" ${subtitle.voiceId === 'ErXwobaYiN019PkySvjV' ? 'selected' : ''}>Antoni (Male)</option>
        <option value="MF3mGyEYCl7XYWbV9V6O" ${subtitle.voiceId === 'MF3mGyEYCl7XYWbV9V6O' ? 'selected' : ''}>Elli (Female)</option>
        <option value="TxGEqnHWrfWFTfGW9XjX" ${subtitle.voiceId === 'TxGEqnHWrfWFTfGW9XjX' ? 'selected' : ''}>Josh (Male)</option>
        <option value="VR6AewLTigWG4xSOukaG" ${subtitle.voiceId === 'VR6AewLTigWG4xSOukaG' ? 'selected' : ''}>Arnold (Male)</option>
        <option value="pNInz6obpgDQGcFmaJgB" ${subtitle.voiceId === 'pNInz6obpgDQGcFmaJgB' ? 'selected' : ''}>Adam (Male)</option>
        <option value="yoZ06aMxZJJ28mfd3POQ" ${subtitle.voiceId === 'yoZ06aMxZJJ28mfd3POQ' ? 'selected' : ''}>Sam (Male)</option>
        <option value="onwK4e9ZLuTAKqWW03F9" ${subtitle.voiceId === 'onwK4e9ZLuTAKqWW03F9' ? 'selected' : ''}>Daniel (Male)</option>
      </select>
    </div>

    ${subtitle.voiceover ? `
      <div class="property-group">
        <label>Voiceover Status</label>
        <div style="padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; color: #10b981; font-size: 12px;">
          ✅ Voiceover generated (${Math.round(subtitle.voiceover.duration / 1000)}s)
        </div>
      </div>
    ` : ''}

    <button class="btn-primary" id="generateSubVoiceoverBtn" style="width: 100%; margin-top: 8px;">
      🎙️ Generate Voiceover for This Text
    </button>

    <button class="btn-danger" id="deleteSubBtn" style="width: 100%; margin-top: 8px;">
      🗑️ Delete Text Block
    </button>
  `;

  // Add event listeners
  const subText = document.getElementById('subText');
  subText.addEventListener('change', () => {
    subtitle.text = subText.value;
    renderTimeline();
    updateSubtitlesList();
  });

  const subTime = document.getElementById('subTime');
  subTime.addEventListener('change', () => {
    subtitle.time = parseInt(subTime.value);
    subtitles.sort((a, b) => a.time - b.time);
    renderTimeline();
    updateSubtitlesList();
  });

  const subDuration = document.getElementById('subDuration');
  subDuration.addEventListener('change', () => {
    subtitle.duration = parseInt(subDuration.value);
    renderTimeline();
    updateSubtitlesList();
  });

  // Styling event listeners
  const subFontFamily = document.getElementById('subFontFamily');
  subFontFamily.addEventListener('change', () => {
    subtitle.fontFamily = subFontFamily.value;
    console.log('[Editor] Font family changed to:', subFontFamily.value);
  });

  const subFontSize = document.getElementById('subFontSize');
  subFontSize.addEventListener('change', () => {
    subtitle.fontSize = parseInt(subFontSize.value);
    console.log('[Editor] Font size changed to:', subFontSize.value);
  });

  const subFontColor = document.getElementById('subFontColor');
  subFontColor.addEventListener('change', () => {
    subtitle.fontColor = subFontColor.value;
    console.log('[Editor] Font color changed to:', subFontColor.value);
  });

  const subPosition = document.getElementById('subPosition');
  subPosition.addEventListener('change', () => {
    subtitle.position = subPosition.value;
    console.log('[Editor] Position changed to:', subPosition.value);
  });

  const subVoiceId = document.getElementById('subVoiceId');
  subVoiceId.addEventListener('change', () => {
    subtitle.voiceId = subVoiceId.value;
    console.log('[Editor] Voice changed to:', subVoiceId.value);
  });

  const generateSubVoiceoverBtn = document.getElementById('generateSubVoiceoverBtn');
  generateSubVoiceoverBtn.addEventListener('click', () => {
    generateVoiceoverForSubtitle(subtitle.id);
  });

  const deleteSubBtn = document.getElementById('deleteSubBtn');
  deleteSubBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('Delete this text block?', {
      title: 'Delete Subtitle',
      icon: '🗑️',
      danger: true
    });
    if (confirmed) {
      const index = subtitles.findIndex(s => s.id === subtitle.id);
      if (index !== -1) {
        subtitles.splice(index, 1);
        selectedSubtitleId = null;
        renderTimeline();
        updateSubtitlesList();
        renderProperties();
      }
    }
  });
}

// Render original audio details in properties panel
function renderOriginalAudioDetails() {
  if (!audioBlob) {
    properties.innerHTML = '<h3>Original Audio</h3><p style="color: #c62828;">No audio available</p>';
    return;
  }

  const audioDuration = audioPlayer.duration ? audioPlayer.duration.toFixed(2) : 'Unknown';
  const audioSize = (audioBlob.size / 1024 / 1024).toFixed(2);

  properties.innerHTML = `
    <h3>🎤 Original Audio</h3>

    <div class="property-group">
      <label>Audio Player</label>
      <div id="audioPlayerContainer" style="width: 100%;"></div>
    </div>

    <div class="property-group">
      <label>Status</label>
      <div style="padding: 8px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; color: #3b82f6; font-size: 12px;">
        ${originalAudioMuted ? '🔇 Muted (will not be included in render)' : '🔊 Active (will be included in render)'}
      </div>
    </div>

    <div class="property-group">
      <label>Duration</label>
      <input type="text" value="${audioDuration}s" disabled>
    </div>

    <div class="property-group">
      <label>File Size</label>
      <input type="text" value="${audioSize} MB" disabled>
    </div>

    <div class="property-group">
      <label>Transcription</label>
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <select id="transcriptionProviderPanel" style="flex: 0 0 auto; padding: 6px 8px; background: rgba(45, 45, 45, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #e0e0e0; font-size: 11px; cursor: pointer;">
          <option value="openai">OpenAI Whisper</option>
          <option value="elevenlabs">ElevenLabs</option>
        </select>
        <button class="btn-secondary btn-small" id="transcribeBtnPanel" style="flex: 1;">
          🗣️ Generate Subtitles
        </button>
      </div>
      <div id="transcriptionStatusPanel" style="font-size: 11px; color: #888;"></div>
    </div>

    <button class="btn-${originalAudioMuted ? 'success' : 'secondary'}" id="toggleMuteBtn" style="width: 100%; margin-top: 8px;">
      ${originalAudioMuted ? '🔊 Unmute Audio' : '🔇 Mute Audio'}
    </button>
  `;

  // Move audio player to the panel
  const audioPlayerContainer = document.getElementById('audioPlayerContainer');
  if (audioPlayerContainer && audioPlayer) {
    audioPlayer.style.width = '100%';
    audioPlayer.controls = true;
    audioPlayerContainer.appendChild(audioPlayer);
  }

  // Toggle mute button
  const toggleMuteBtn = document.getElementById('toggleMuteBtn');
  toggleMuteBtn.addEventListener('click', () => {
    originalAudioMuted = !originalAudioMuted;
    renderTimeline();
    renderOriginalAudioDetails();
    console.log('[Editor] Original audio', originalAudioMuted ? 'muted' : 'unmuted');
  });

  // Transcription functions
  async function transcribeWithOpenAI() {
    // Get API key
    let apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
      apiKey = await showPrompt('Enter your OpenAI API key:\n\nGet one at: https://platform.openai.com/api-keys\n\n(Your key will be stored locally in your browser)', '', {
        title: 'OpenAI API Key Required',
        icon: '🔑'
      });
      if (!apiKey) throw new Error('API key required');
      localStorage.setItem('openai_api_key', apiKey);
    }

    console.log('[OpenAI] Transcribing audio:', audioBlob.size, 'bytes');

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.error?.message?.includes('API key')) {
        localStorage.removeItem('openai_api_key');
      }
      throw new Error(error.error?.message || 'Transcription failed');
    }

    const result = await response.json();
    console.log('[OpenAI] Transcription result:', result);

    // Clear existing subtitles
    subtitles = [];

    // Process OpenAI format
    if (result.segments && result.segments.length > 0) {
      result.segments.forEach(segment => {
        subtitles.push({
          id: generateId(),
          time: Math.round(segment.start * 1000),
          text: segment.text.trim(),
          duration: Math.round((segment.end - segment.start) * 1000),
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          voiceover: null,
          fontFamily: 'Arial, sans-serif',
          fontSize: 32,
          fontColor: '#ffffff',
          position: 'bottom'
        });
      });
    } else if (result.text) {
      subtitles.push({
        id: generateId(),
        time: 0,
        text: result.text.trim(),
        duration: 5000,
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        voiceover: null,
        fontFamily: 'Arial, sans-serif',
        fontSize: 32,
        fontColor: '#ffffff',
        position: 'bottom'
      });
    }

    console.log('[OpenAI] Generated', subtitles.length, 'subtitles');
    renderTimeline();
    updateSubtitlesList();
    updateRenderButtonState();
  }

  async function transcribeWithElevenLabs() {
    // Get API key
    let apiKey = localStorage.getItem('elevenlabs_api_key');
    if (!apiKey) {
      apiKey = await showPrompt('Enter your ElevenLabs API key:\n\nGet one at: https://elevenlabs.io/app/speech-synthesis\n\n(Your key will be stored locally in your browser)', '', {
        title: 'ElevenLabs API Key Required',
        icon: '🔑'
      });
      if (!apiKey) throw new Error('API key required');
      localStorage.setItem('elevenlabs_api_key', apiKey);
    }

    console.log('[ElevenLabs] Transcribing audio:', audioBlob.size, 'bytes');

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model_id', 'scribe_v1');
    formData.append('timestamps_granularity', 'word');
    formData.append('language_code', 'en');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.detail?.message?.includes('API key') || error.detail?.message?.includes('unauthorized')) {
        localStorage.removeItem('elevenlabs_api_key');
      }
      throw new Error(error.detail?.message || error.message || 'Transcription failed');
    }

    const result = await response.json();
    console.log('[ElevenLabs] Transcription result:', result);

    // Clear existing subtitles
    subtitles = [];

    // Process ElevenLabs format - create segments from words
    if (result.words && result.words.length > 0) {
      const wordsPerSegment = 10;
      for (let i = 0; i < result.words.length; i += wordsPerSegment) {
        const segmentWords = result.words.slice(i, i + wordsPerSegment);
        const startWord = segmentWords[0];
        const endWord = segmentWords[segmentWords.length - 1];

        subtitles.push({
          id: generateId(),
          time: Math.round(startWord.start * 1000),
          text: segmentWords.map(w => w.text).join(' '),
          duration: Math.round((endWord.end - startWord.start) * 1000),
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          voiceover: null,
          fontFamily: 'Arial, sans-serif',
          fontSize: 32,
          fontColor: '#ffffff',
          position: 'bottom'
        });
      }
    } else if (result.text) {
      subtitles.push({
        id: generateId(),
        time: 0,
        text: result.text.trim(),
        duration: 5000,
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        voiceover: null,
        fontFamily: 'Arial, sans-serif',
        fontSize: 32,
        fontColor: '#ffffff',
        position: 'bottom'
      });
    }

    console.log('[ElevenLabs] Generated', subtitles.length, 'subtitles');
    renderTimeline();
    updateSubtitlesList();
    updateRenderButtonState();
  }

  // Transcription button
  const transcribeBtnPanel = document.getElementById('transcribeBtnPanel');
  const transcriptionProviderPanel = document.getElementById('transcriptionProviderPanel');
  const transcriptionStatusPanel = document.getElementById('transcriptionStatusPanel');

  if (transcribeBtnPanel) {
    transcribeBtnPanel.addEventListener('click', async () => {
      if (!audioBlob) {
        showModal('No audio available to transcribe');
        return;
      }

      const provider = transcriptionProviderPanel.value;
      transcribeBtnPanel.disabled = true;
      transcribeBtnPanel.innerHTML = '⏳ Transcribing...';
      transcriptionStatusPanel.textContent = 'Processing audio...';

      try {
        if (provider === 'openai') {
          await transcribeWithOpenAI();
        } else {
          await transcribeWithElevenLabs();
        }
        transcriptionStatusPanel.textContent = '✅ Transcription complete!';
      } catch (error) {
        transcriptionStatusPanel.textContent = '❌ Error: ' + error.message;
        console.error('[Transcription] Error:', error);
      } finally {
        transcribeBtnPanel.disabled = false;
        transcribeBtnPanel.innerHTML = '🗣️ Generate Subtitles';
      }
    });
  }
}

// Render old voiceover details in properties panel
function renderOldVoiceoverDetails() {
  if (!voiceoverAudio) {
    properties.innerHTML = '<h3>Voiceover</h3><p style="color: #c62828;">No voiceover available</p>';
    return;
  }

  const voiceoverDuration = voiceoverPlayer.duration ? voiceoverPlayer.duration.toFixed(2) : 'Unknown';
  const voiceoverSize = (voiceoverAudio.size / 1024 / 1024).toFixed(2);
  const offsetSeconds = (audioOffset / 1000).toFixed(2);

  properties.innerHTML = `
    <h3>🎙️ Voiceover (Legacy)</h3>

    <div class="property-group">
      <label>Status</label>
      <div style="padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; color: #10b981; font-size: 12px;">
        ✅ Generated from all subtitles
      </div>
    </div>

    <div class="property-group">
      <label>Duration</label>
      <input type="text" value="${voiceoverDuration}s" disabled>
    </div>

    <div class="property-group">
      <label>File Size</label>
      <input type="text" value="${voiceoverSize} MB" disabled>
    </div>

    <div class="property-group">
      <label>Time Offset (ms)</label>
      <input type="number" id="voiceoverOffset" value="${audioOffset}" min="0" step="100">
    </div>

    <button class="btn-primary" id="playVoiceoverBtn" style="width: 100%; margin-top: 8px;">
      ${voiceoverPlayer.paused ? '▶️ Play Voiceover' : '⏸️ Pause Voiceover'}
    </button>

    <p style="color: #666; font-size: 12px; margin-top: 12px;">
      💡 Tip: Use per-text-block voiceovers for better control. This is a legacy all-in-one voiceover.
    </p>
  `;

  // Offset input
  const voiceoverOffsetInput = document.getElementById('voiceoverOffset');
  voiceoverOffsetInput.addEventListener('change', () => {
    audioOffset = parseInt(voiceoverOffsetInput.value);
    renderTimeline();
    console.log('[Editor] Voiceover offset changed to:', audioOffset, 'ms');
  });

  // Play/pause button
  const playVoiceoverBtn = document.getElementById('playVoiceoverBtn');
  playVoiceoverBtn.addEventListener('click', () => {
    if (voiceoverPlayer.paused) {
      voiceoverPlayer.play();
    } else {
      voiceoverPlayer.pause();
    }
    playVoiceoverBtn.innerHTML = voiceoverPlayer.paused ? '▶️ Play Voiceover' : '⏸️ Pause Voiceover';
  });

  // Update button text when voiceover plays/pauses
  voiceoverPlayer.addEventListener('play', () => {
    const btn = document.getElementById('playVoiceoverBtn');
    if (btn) btn.innerHTML = '⏸️ Pause Voiceover';
  });
  voiceoverPlayer.addEventListener('pause', () => {
    const btn = document.getElementById('playVoiceoverBtn');
    if (btn) btn.innerHTML = '▶️ Play Voiceover';
  });
}

// Render webcam details in properties panel
function renderWebcamDetails() {
  if (!webcamBlob) {
    properties.innerHTML = '<h3>Webcam Video</h3><p style="color: #c62828;">No webcam video available</p>';
    return;
  }

  const webcamDuration = webcamPlayer.duration ? webcamPlayer.duration.toFixed(2) : 'Unknown';
  const webcamSize = (webcamBlob.size / 1024 / 1024).toFixed(2);

  properties.innerHTML = `
    <h3>📹 Webcam Video</h3>

    <div class="property-group">
      <label>Video Player</label>
      <div id="webcamPlayerContainer" style="width: 100%;"></div>
    </div>

    <div class="property-group">
      <label>Status</label>
      <div style="padding: 8px; background: rgba(139, 92, 246, 0.1); border-radius: 6px; color: #8b5cf6; font-size: 12px;">
        ${webcamMuted ? '🚫 Disabled (will not be included in render)' : '✅ Enabled (will be included in render)'}
      </div>
    </div>

    <div class="property-group">
      <label>Duration</label>
      <input type="text" value="${webcamDuration}s" disabled>
    </div>

    <div class="property-group">
      <label>File Size</label>
      <input type="text" value="${webcamSize} MB" disabled>
    </div>

    <button class="btn-${webcamMuted ? 'success' : 'secondary'}" id="toggleWebcamBtn" style="width: 100%; margin-top: 8px;">
      ${webcamMuted ? '✅ Enable Video' : '🚫 Disable Video'}
    </button>

    <p style="color: #666; font-size: 12px; margin-top: 12px;">
      💡 Tip: Disable the webcam video if you want to render only the screen recording with audio.
    </p>
  `;

  // Move webcam player to the panel
  const webcamPlayerContainer = document.getElementById('webcamPlayerContainer');
  if (webcamPlayerContainer && webcamPlayer) {
    webcamPlayer.style.width = '100%';
    webcamPlayer.style.maxHeight = '300px';
    webcamPlayer.style.background = 'rgba(0, 0, 0, 0.4)';
    webcamPlayer.style.borderRadius = '8px';
    webcamPlayer.controls = true;
    webcamPlayerContainer.appendChild(webcamPlayer);
  }

  // Toggle enable/disable button
  const toggleWebcamBtn = document.getElementById('toggleWebcamBtn');
  toggleWebcamBtn.addEventListener('click', () => {
    webcamMuted = !webcamMuted;
    renderTimeline();
    renderWebcamDetails();
    console.log('[Editor] Webcam video', webcamMuted ? 'disabled' : 'enabled');
  });
}

// Delete event
async function deleteEvent() {
  if (selectedEvent === null) return;

  const confirmed = await showConfirm('Delete this event?', {
    title: 'Delete Event',
    icon: '🗑️',
    danger: true
  });
  if (confirmed) {
    storyboard.timeline.splice(selectedEvent, 1);
    selectedEvent = null;
    renderEventList();
    renderTimeline();
    renderProperties();
  }
}

// Save changes
saveBtn.addEventListener('click', async () => {
  if (!storyboard) return;

  try {
    // Prepare subtitles for saving (remove audioBlob, keep only blobId)
    const subtitlesForSave = subtitles.map(sub => {
      const subtitleCopy = { ...sub };
      if (subtitleCopy.voiceover && subtitleCopy.voiceover.audioBlob) {
        // Remove audioBlob before saving, keep only blobId
        const { audioBlob, ...voiceoverWithoutBlob } = subtitleCopy.voiceover;
        subtitleCopy.voiceover = voiceoverWithoutBlob;
      }
      return subtitleCopy;
    });

    // Update storyboard with current state
    storyboard.subtitles = subtitlesForSave;
    storyboard.originalAudioOffset = originalAudioOffset;
    storyboard.webcamOffset = webcamOffset;

    // Save to chrome.storage if we have a recordingId (use global)
    if (recordingId) {
      await chrome.storage.local.set({
        [`storyboard_${recordingId}`]: JSON.stringify(storyboard)
      });
      console.log('[Editor] Saved storyboard to storage:', {
        subtitles: subtitlesForSave.length,
        audioOffset: originalAudioOffset,
        webcamOffset: webcamOffset
      });
    }

    // Also download as JSON file
    const blob = new Blob([JSON.stringify(storyboard, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${storyboard.meta?.title || 'storyboard'}_edited.json`;
    a.click();

    URL.revokeObjectURL(url);

    // Show confirmation
    alert(`✅ Saved successfully!\n\n- Subtitles: ${subtitlesForSave.length}\n- Voiceovers in IndexedDB\n- Downloaded JSON file\n\nYour changes have been saved and will persist.`);
  } catch (error) {
    console.error('[Editor] Save error:', error);
    showModal('❌ Error saving: ' + error.message);
  }
});

// Export
// Export as ZIP - Package for manual rendering with ffmpeg
exportBtn.addEventListener('click', async () => {
  if (!storyboard) {
    await showModal('❌ No storyboard loaded.\n\nPlease load a recording first.', {
      title: 'No Recording',
      icon: '⚠️'
    });
    return;
  }

  // Directly export as ZIP
  await exportAsZip();
});

// Export everything as ZIP for manual rendering
async function exportAsZip() {
  try {
    // Show loading message
    showModal('📦 Preparing export package...\n\nThis may take a moment depending on file sizes.');

    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library not loaded');
    }

    const zip = new JSZip();
    // Use global recordingId
    const projectName = storyboard?.meta?.title || 'recording';

    // 1. Add timeline JSON
    const storyboardCopy = JSON.parse(JSON.stringify(storyboard));
    // Clean up subtitles (remove audioBlob, keep only blobId)
    if (storyboardCopy.subtitles) {
      storyboardCopy.subtitles = storyboardCopy.subtitles.map(sub => {
        const copy = { ...sub };
        if (copy.voiceover && copy.voiceover.audioBlob) {
          delete copy.voiceover.audioBlob;
        }
        return copy;
      });
    }
    storyboardCopy.originalAudioOffset = originalAudioOffset;
    storyboardCopy.webcamOffset = webcamOffset;

    zip.file('timeline.json', JSON.stringify(storyboardCopy, null, 2));
    console.log('[Export] Added timeline.json');

    // 2. Add original audio
    if (audioBlob) {
      zip.file('audio.webm', audioBlob);
      console.log('[Export] Added audio.webm');
    } else if (recordingId) {
      // Try to load from IndexedDB
      try {
        const blob = await getAudioFromDB(recordingId);
        if (blob) {
          zip.file('audio.webm', blob);
          console.log('[Export] Added audio.webm from IndexedDB');
        }
      } catch (error) {
        console.warn('[Export] No audio found');
      }
    }

    // 3. Add webcam video
    if (webcamBlob) {
      zip.file('webcam.webm', webcamBlob);
      console.log('[Export] Added webcam.webm');
    } else if (recordingId) {
      // Try to load from IndexedDB
      try {
        const blob = await getWebcamFromDB(recordingId);
        if (blob) {
          zip.file('webcam.webm', blob);
          console.log('[Export] Added webcam.webm from IndexedDB');
        }
      } catch (error) {
        console.warn('[Export] No webcam found');
      }
    }

    // 4. Add voiceovers
    const voiceoversFolder = zip.folder('voiceovers');
    for (const subtitle of subtitles) {
      if (subtitle.voiceover) {
        let voiceoverBlob = subtitle.voiceover.audioBlob;

        // Try to load from IndexedDB if not in memory
        if (!voiceoverBlob && subtitle.voiceover.blobId) {
          try {
            voiceoverBlob = await getVoiceoverFromDB(subtitle.voiceover.blobId);
          } catch (error) {
            console.warn('[Export] Failed to load voiceover:', subtitle.voiceover.blobId);
          }
        }

        if (voiceoverBlob) {
          const filename = `${subtitle.id}.webm`;
          voiceoversFolder.file(filename, voiceoverBlob);
          console.log('[Export] Added voiceover:', filename);
        }
      }
    }

    // 5. Add subtitles as SRT
    if (subtitles.length > 0) {
      const srtContent = generateSRT(subtitles);
      zip.file('subtitles.srt', srtContent);
      console.log('[Export] Added subtitles.srt');
    }

    // 6. Add render script
    const renderScript = generateRenderScript(storyboardCopy, subtitles);
    zip.file('render.sh', renderScript);
    zip.file('render.bat', renderScript.replace(/\\/g, '/').replace(/\n/g, '\r\n'));
    console.log('[Export] Added render scripts');

    // 7. Add README
    const readme = generateReadme(storyboardCopy, subtitles);
    zip.file('README.md', readme);
    console.log('[Export] Added README.md');

    // Generate ZIP file
    console.log('[Export] Generating ZIP file...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // Download ZIP
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_export.zip`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`✅ Export complete!\n\nDownloaded: ${projectName}_export.zip\n\nContents:\n- timeline.json (storyboard data)\n- audio.webm (original audio)\n- webcam.webm (webcam video)\n- voiceovers/ (generated voiceovers)\n- subtitles.srt\n- render.sh (rendering script)\n- README.md (instructions)\n\nSee README.md for rendering instructions.`);
  } catch (error) {
    console.error('[Export] Error:', error);
    showModal('❌ Export failed: ' + error.message);
  }
}

// Export as video directly (no ffmpeg needed!)
async function exportAsVideo() {
  console.log('[Export] exportAsVideo() called');
  try {
    // Check browser support
    if (!('MediaRecorder' in window)) {
      console.error('[Export] MediaRecorder not supported');
      await showModal('❌ Video export not supported in this browser.\n\nPlease use Chrome 49+ or Edge 79+.', {
        title: 'Not Supported',
        icon: '❌'
      });
      return;
    }

    console.log('[Export] MediaRecorder supported');

    // Ask which type of video
    const videoTypeOptions = [
      '1. Actual Website Replay - Records the real website (Recommended)',
      '2. Storyboard Visualization - Canvas animation with event details'
    ];

    const videoTypeChoice = await showPrompt(
      `What type of video do you want to create?\n\n${videoTypeOptions.join('\n')}\n\nEnter 1 or 2:`,
      '1',
      { title: 'Video Type', icon: '🎬' }
    );

    console.log('[Export] Video type choice:', videoTypeChoice);

    if (videoTypeChoice === '1') {
      console.log('[Export] Starting actual website replay capture...');
      await exportVideoActualReplay();
    } else if (videoTypeChoice === '2') {
      console.log('[Export] Starting storyboard visualization...');
      await exportVideoAutomated();
    } else {
      console.log('[Export] No valid video type selected');
    }

  } catch (error) {
    console.error('[Export] Video export error:', error);
    console.error('[Export] Error stack:', error.stack);
    await showModal('❌ Video export failed:\n\n' + error.message, {
      title: 'Export Failed',
      icon: '❌'
    });
  } finally {
    console.log('[Export] exportAsVideo() finished');
  }
}

// Actual website replay video export
async function exportVideoActualReplay() {
  console.log('[Export] exportVideoActualReplay() called - Two-tab approach');
  console.log('[Export] Storyboard metadata:', storyboard.meta);
  console.log('[Export] Timeline events:', storyboard.timeline.length);

  try {
    // Find the starting URL from timeline events or metadata
    let startUrl = null;

    // Check metadata first
    if (storyboard.meta?.url) {
      startUrl = storyboard.meta.url;
      console.log('[Export] Found URL in metadata:', startUrl);
    }
    // Look for first navigate event
    else {
      const firstNavigate = storyboard.timeline.find(event => event.type === 'navigate' && event.url);
      if (firstNavigate) {
        startUrl = firstNavigate.url;
        console.log('[Export] Found URL in first navigate event:', startUrl);
      }
    }

    // Fallback: check any event with a url property
    if (!startUrl) {
      const eventWithUrl = storyboard.timeline.find(event => event.url);
      if (eventWithUrl) {
        startUrl = eventWithUrl.url;
        console.log('[Export] Found URL in event:', startUrl);
      }
    }

    if (!startUrl) {
      console.error('[Export] Storyboard:', storyboard);
      throw new Error('No starting URL found in recording. Cannot replay actual website.\n\nPlease ensure your recording captured the page URL.');
    }

    console.log('[Export] Starting URL:', startUrl);

    // Video quality preset (720p default)
    const qualityPresets = {
      '1': { width: 1920, height: 1080, videoBitsPerSecond: 8000000, label: '1080p' },
      '2': { width: 1280, height: 720, videoBitsPerSecond: 5000000, label: '720p' },
      '3': { width: 854, height: 480, videoBitsPerSecond: 2500000, label: '480p' }
    };

    const preset = qualityPresets['2']; // Default to 720p
    console.log('[Export] Using preset:', preset);

    // Filter out the first navigate event if it matches the starting URL
    let filteredTimeline = [...storyboard.timeline];
    if (filteredTimeline.length > 0 && filteredTimeline[0].type === 'navigate' && filteredTimeline[0].url === startUrl) {
      console.log('[Export] Removing duplicate first navigate event');
      filteredTimeline = filteredTimeline.slice(1);
    }

    // Prepare storyboard with voiceover audioBlobs converted to base64 for message passing
    const subtitlesWithAudio = storyboard.subtitles ? await Promise.all(storyboard.subtitles.map(async sub => {
      const subtitleCopy = { ...sub };
      // If this subtitle has a voiceover in the editor's memory, convert to base64
      const editorSubtitle = subtitles.find(s => s.id === sub.id);
      if (editorSubtitle && editorSubtitle.voiceover && editorSubtitle.voiceover.audioBlob) {
        console.log('[Export] Converting audioBlob to base64 for subtitle:', sub.id);
        const audioBlob = editorSubtitle.voiceover.audioBlob;

        // Convert Blob to base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        subtitleCopy.voiceover = {
          ...editorSubtitle.voiceover,
          audioBase64: base64, // Pass as base64
          audioType: audioBlob.type // Pass the MIME type
        };

        console.log('[Export] Converted audioBlob:', audioBlob.size, 'bytes ->', base64.length, 'chars');
      }
      return subtitleCopy;
    })) : [];

    const modifiedStoryboard = {
      ...storyboard,
      timeline: filteredTimeline,
      subtitles: subtitlesWithAudio // Use subtitles with base64 audio
    };

    console.log('[Export] Subtitles with voiceover audio (base64):',
      subtitlesWithAudio.filter(s => s.voiceover?.audioBase64).length);

    // Save modified storyboard to storage (for replay tab persistence across navigation)
    const storyboardForStorage = {
      ...modifiedStoryboard,
      subtitles: subtitlesWithAudio.map(sub => {
        // Remove audioBase64 for storage (too large, keep only blobId)
        if (sub.voiceover && sub.voiceover.audioBase64) {
          const { audioBase64, audioType, ...voiceoverWithoutAudio } = sub.voiceover;
          return { ...sub, voiceover: voiceoverWithoutAudio };
        }
        return sub;
      })
    };

    await chrome.storage.local.set({
      [`storyboard_${recordingId}`]: JSON.stringify(storyboardForStorage)
    });

    console.log('[Export] Saved storyboard to storage (without base64 audio)');

    console.log('[Export] ========================================');
    console.log('[Export] STEP 1: Opening replay tab...');
    console.log('[Export] ========================================');

    // STEP 1: Open replay tab with the actual website
    const replayTab = await chrome.tabs.create({
      url: startUrl,
      active: false // Don't focus yet
    });

    console.log('[Export] Replay tab created:', replayTab.id);

    // Wait for replay tab to load
    await new Promise((resolve) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === replayTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    console.log('[Export] Replay tab loaded');

    // Register replay tab with background for navigation handling
    await chrome.runtime.sendMessage({
      type: 'REGISTER_REPLAY_TAB',
      tabId: replayTab.id
    });

    // Inject replay script
    await chrome.scripting.executeScript({
      target: { tabId: replayTab.id },
      files: ['scripts/replay.js']
    });

    console.log('[Export] Replay script injected');

    console.log('[Export] ========================================');
    console.log('[Export] STEP 2: Opening recording control tab...');
    console.log('[Export] ========================================');

    // STEP 2: Open recording control tab
    const controlUrl = chrome.runtime.getURL('ui/recording-control.html') +
      `?replayTabId=${replayTab.id}&recordingId=${recordingId}`;

    const controlTab = await chrome.tabs.create({
      url: controlUrl,
      active: true // Focus this one
    });

    console.log('[Export] Recording control tab created:', controlTab.id);

    // Wait for control tab to load
    await new Promise((resolve) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === controlTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    console.log('[Export] Recording control tab loaded');

    console.log('[Export] ========================================');
    console.log('[Export] STEP 3: Sending configuration...');
    console.log('[Export] ========================================');

    // STEP 3: Send storyboard and config to recording control tab
    console.log('[Export] Sending storyboard with', modifiedStoryboard.subtitles?.length || 0, 'subtitles');
    const voiceoverCount = modifiedStoryboard.subtitles?.filter(s => s.voiceover?.audioBase64).length || 0;
    console.log('[Export] Subtitles with voiceover audio (base64):', voiceoverCount);

    await chrome.tabs.sendMessage(controlTab.id, {
      type: 'INIT_RECORDING_CONTROL',
      storyboard: modifiedStoryboard, // Includes audioBlobs in memory
      videoConfig: preset,
      replayTabId: replayTab.id,
      recordingId: recordingId
    });

    console.log('[Export] Configuration sent to recording control tab');

    console.log('[Export] ========================================');
    console.log('[Export] ✅ Setup complete!');
    console.log('[Export] ========================================');
    console.log('[Export] Replay tab ID:', replayTab.id);
    console.log('[Export] Control tab ID:', controlTab.id);
    console.log('[Export] Timeline events:', modifiedStoryboard.timeline.length);
    console.log('[Export] User should now click "Start Recording" in control tab');

  } catch (error) {
    console.error('[Export] Export error:', error);
    console.error('[Export] Error stack:', error.stack);
    alert('❌ Export failed:\n\n' + error.message);
  }
}

// Automated video export using canvas renderer
async function exportVideoAutomated() {
  console.log('[Export] exportVideoAutomated() called');
  try {
    // Ask for quality preset
    console.log('[Export] Showing quality selection...');
    const qualityOptions = [
      '1. 1080p (1920x1080) - High quality',
      '2. 720p (1280x720) - Good quality (Recommended)',
      '3. 480p (854x480) - Fast export'
    ];

    const qualityChoice = await showPrompt(
      `Select video quality:\n\n${qualityOptions.join('\n')}\n\nEnter 1, 2, or 3:`,
      '2',
      { title: 'Video Quality', icon: '🎥' }
    );

    console.log('[Export] Quality choice:', qualityChoice);

    const qualityPresets = {
      '1': { width: 1920, height: 1080, videoBitsPerSecond: 8000000, label: '1080p' },
      '2': { width: 1280, height: 720, videoBitsPerSecond: 5000000, label: '720p' },
      '3': { width: 854, height: 480, videoBitsPerSecond: 2500000, label: '480p' }
    };

    const preset = qualityPresets[qualityChoice] || qualityPresets['2'];
    console.log('[Export] Using automated export with preset:', preset);

    // Validate recordingId
    if (!recordingId) {
      throw new Error('No recording ID available. Please ensure the recording was loaded correctly.');
    }

    console.log('[Export] Recording ID:', recordingId);

    // Open video exporter window
    const exporterUrl = chrome.runtime.getURL('ui/video-exporter.html') +
      `?id=${recordingId}&width=${preset.width}&height=${preset.height}&bitrate=${preset.videoBitsPerSecond}`;

    console.log('[Export] Opening automated exporter:', exporterUrl);

    console.log('[Export] Opening window with URL:', exporterUrl);

    const exporterWindow = window.open(
      exporterUrl,
      'videoExporter',
      `width=900,height=700`
    );

    console.log('[Export] Window opened:', exporterWindow ? 'success' : 'BLOCKED');

    if (!exporterWindow) {
      console.error('[Export] Window blocked by popup blocker');
      await showModal(
        '❌ Failed to open exporter window.\n\nPlease allow popups for this extension.',
        { title: 'Export Failed', icon: '❌' }
      );
      return;
    }

    console.log('[Export] Showing success modal...');
    await showModal(
      `✅ Video export started!\n\n` +
      `Quality: ${preset.label} (${preset.width}x${preset.height})\n\n` +
      `The export window will guide you through the process.\n` +
      `Your video will download automatically when complete.\n\n` +
      `No screen capture needed - fully automated!`,
      { title: 'Export Started', icon: '🎬' }
    );

    console.log('[Export] Success modal shown');

  } catch (error) {
    console.error('[Export] Automated export error:', error);
    await showModal('❌ Automated export failed: ' + error.message, {
      title: 'Export Failed',
      icon: '❌'
    });
  }
}

// Manual video export using screen capture
async function exportVideoManual() {
  try {
    // Ask for quality preset
    const qualityOptions = [
      '1. 1080p (1920x1080) - High quality',
      '2. 720p (1280x720) - Good quality (Recommended)',
      '3. 480p (854x480) - Fast export'
    ];

    const qualityChoice = await showPrompt(
      `Select video quality:\n\n${qualityOptions.join('\n')}\n\nEnter 1, 2, or 3:`,
      '2',
      { title: 'Video Quality', icon: '🎥' }
    );

    const qualityPresets = {
      '1': { width: 1920, height: 1080, videoBitsPerSecond: 8000000, label: '1080p' },
      '2': { width: 1280, height: 720, videoBitsPerSecond: 5000000, label: '720p' },
      '3': { width: 854, height: 480, videoBitsPerSecond: 2500000, label: '480p' }
    };

    const preset = qualityPresets[qualityChoice] || qualityPresets['2'];
    console.log('[Export] Using manual export with preset:', preset);

    // Show progress modal
    const progressModal = document.createElement('div');
    progressModal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      z-index: 100000;
      min-width: 400px;
      font-family: 'Space Grotesk', sans-serif;
    `;
    progressModal.innerHTML = `
      <h3 style="margin: 0 0 20px 0; font-size: 20px;">🎥 Exporting Video</h3>
      <div style="margin-bottom: 10px;">
        <strong>Quality:</strong> ${preset.label} (${preset.width}x${preset.height})
      </div>
      <div style="margin-bottom: 20px;">
        <strong>Status:</strong> <span id="exportStatus">Preparing...</span>
      </div>
      <div style="background: #f3f4f6; border-radius: 8px; height: 20px; overflow: hidden;">
        <div id="exportProgress" style="background: linear-gradient(90deg, #2563eb, #1d4ed8); height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
      <div style="margin-top: 10px; font-size: 14px; color: #6b7280;">
        <span id="exportPercentage">0%</span> - <span id="exportTime">Estimating...</span>
      </div>
    `;
    document.body.appendChild(progressModal);

    const updateProgress = (percent, status, timeLeft) => {
      const progressBar = document.getElementById('exportProgress');
      const progressText = document.getElementById('exportPercentage');
      const statusText = document.getElementById('exportStatus');
      const timeText = document.getElementById('exportTime');

      if (progressBar) progressBar.style.width = percent + '%';
      if (progressText) progressText.textContent = Math.round(percent) + '%';
      if (statusText) statusText.textContent = status;
      if (timeText && timeLeft) timeText.textContent = timeLeft;
    };

    // Open preview window for rendering
    updateProgress(5, 'Opening preview window...', null);

    const previewUrl = chrome.runtime.getURL('ui/preview.html') + '?id=' + recordingId;
    const previewWindow = window.open(previewUrl, 'videoExport', `width=${preset.width},height=${preset.height}`);

    if (!previewWindow) {
      document.body.removeChild(progressModal);
      await showModal('❌ Failed to open preview window.\n\nPlease allow popups for this extension.', {
        title: 'Export Failed',
        icon: '❌'
      });
      return;
    }

    // Wait for preview to load
    updateProgress(10, 'Loading preview...', null);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send storyboard with base64 audio via postMessage
    console.log('[Export] Sending storyboard with base64 audio to preview window...');
    try {
      // Prepare subtitles with base64 audio
      const subtitlesWithBase64 = await Promise.all(subtitles.map(async sub => {
        const subtitleCopy = { ...sub };
        if (sub.voiceover && sub.voiceover.audioBlob) {
          const arrayBuffer = await sub.voiceover.audioBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          subtitleCopy.voiceover = {
            ...sub.voiceover,
            audioBase64: base64,
            audioType: sub.voiceover.audioBlob.type
          };
        }
        return subtitleCopy;
      }));

      const storyboardWithAudio = {
        ...storyboard,
        subtitles: subtitlesWithBase64
      };

      previewWindow.postMessage({
        type: 'LOAD_STORYBOARD',
        storyboard: storyboardWithAudio
      }, '*');

      console.log('[Export] Storyboard sent with', subtitlesWithBase64.filter(s => s.voiceover?.audioBase64).length, 'voiceovers');
    } catch (error) {
      console.error('[Export] Error sending storyboard to preview:', error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start capturing
    updateProgress(20, 'Starting video capture...', null);

    try {
      const stream = await previewWindow.navigator.mediaDevices.getDisplayMedia({
        video: {
          width: preset.width,
          height: preset.height,
          frameRate: 30
        },
        audio: true
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: preset.videoBitsPerSecond
      });

      const chunks = [];
      let startTime = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[Export] Recording stopped, processing video...');
        updateProgress(90, 'Processing video...', null);

        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        // Download
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${recordingId}-${preset.label}-${Date.now()}.webm`;
        a.click();

        URL.revokeObjectURL(url);
        previewWindow.close();

        updateProgress(100, 'Complete!', 'Done');

        // Remove progress modal
        setTimeout(() => {
          document.body.removeChild(progressModal);
          showModal('✅ Video exported successfully!\n\nFile saved to your Downloads folder.', {
            title: 'Export Complete',
            icon: '✅'
          });
        }, 1000);
      };

      // Start recording
      mediaRecorder.start();
      updateProgress(30, 'Recording in progress...', 'Please start replay in preview window');

      // Monitor progress
      const totalEvents = storyboard.timeline.length;
      let checkInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        updateProgress(
          30 + ((mediaRecorder.state === 'recording' ? 50 : 0)),
          `Recording... (${Math.floor(elapsed)}s elapsed)`,
          'Recording...'
        );
      }, 1000);

      // Listen for preview window close
      const windowCheckInterval = setInterval(() => {
        if (previewWindow.closed) {
          clearInterval(checkInterval);
          clearInterval(windowCheckInterval);
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            stream.getTracks().forEach(track => track.stop());
          }
        }
      }, 500);

      // Auto-stop after reasonable time (fallback)
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('[Export] Auto-stopping recording after timeout');
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
        }
        clearInterval(checkInterval);
        clearInterval(windowCheckInterval);
      }, 300000); // 5 minutes max

    } catch (captureError) {
      console.error('[Export] Capture error:', captureError);
      document.body.removeChild(progressModal);
      previewWindow.close();

      await showModal(
        '❌ Screen capture failed.\n\nPlease select the preview window when prompted to share your screen.',
        { title: 'Capture Failed', icon: '❌' }
      );
    }

  } catch (error) {
    console.error('[Export] Video export error:', error);
    await showModal('❌ Video export failed: ' + error.message, {
      title: 'Export Failed',
      icon: '❌'
    });
  }
}

// Generate SRT format subtitles
function generateSRT(subtitles) {
  let srt = '';
  subtitles.forEach((subtitle, index) => {
    const startTime = formatSRTTime(subtitle.time);
    const endTime = formatSRTTime(subtitle.time + subtitle.duration);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${subtitle.text}\n\n`;
  });
  return srt;
}

function formatSRTTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// Generate render script (ffmpeg commands)
function generateRenderScript(storyboard, subtitles) {
  const hasAudio = audioBlob || storyboard.meta?.hasAudio;
  const hasWebcam = webcamBlob || storyboard.meta?.hasWebcam;
  const hasVoiceovers = subtitles.some(s => s.voiceover);
  const audioOffset = originalAudioOffset || 0;
  const webcamOffset = this.webcamOffset || 0;

  let script = `#!/bin/bash
# Auto-generated render script
# This script uses ffmpeg to combine all media files

echo "🎬 Starting video render..."

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: ffmpeg is not installed"
    echo "Install: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)"
    exit 1
fi

`;

  // Concat all voiceovers into one audio track
  if (hasVoiceovers) {
    script += `# Step 1: Combine voiceovers with proper timing\n`;
    script += `echo "📝 Processing voiceovers..."\n\n`;

    // Create filter complex for voiceover audio mixing
    script += `# Create silence base track\n`;
    const totalDuration = Math.max(...subtitles.map(s => s.time + s.duration)) / 1000;
    script += `ffmpeg -f lavfi -i anullsrc=r=48000:cl=stereo -t ${totalDuration} -y voiceover_base.wav\n\n`;

    subtitles.forEach((subtitle, idx) => {
      if (subtitle.voiceover) {
        const delaySeconds = subtitle.time / 1000;
        script += `# Add voiceover ${idx + 1} at ${delaySeconds}s\n`;
        script += `ffmpeg -i voiceover_base.wav -i voiceovers/${subtitle.id}.webm -filter_complex "[1]adelay=${Math.round(delaySeconds * 1000)}|${Math.round(delaySeconds * 1000)}[delayed];[0][delayed]amix=inputs=2:duration=longest" -y voiceover_temp_${idx}.wav\n`;
        script += `mv voiceover_temp_${idx}.wav voiceover_base.wav\n\n`;
      }
    });

    script += `mv voiceover_base.wav voiceover_final.wav\n\n`;
  }

  // Main render command
  script += `# Step 2: Combine all tracks\n`;
  script += `echo "🎥 Rendering final video..."\n\n`;

  let inputs = '';
  let filterComplex = '';
  let maps = '';
  let inputIdx = 0;

  // Add webcam as base video
  if (hasWebcam) {
    inputs += `-itsoffset ${webcamOffset / 1000} -i webcam.webm `;
    filterComplex = `[0:v]`;
    maps = `-map 0:v `;
    inputIdx++;
  } else {
    // Create blank video
    inputs += `-f lavfi -i color=c=black:s=1280x720:r=30 -t ${totalDuration || 10} `;
    filterComplex = `[0:v]`;
    maps = `-map 0:v `;
    inputIdx++;
  }

  // Add audio tracks
  const audioTracks = [];
  if (hasAudio) {
    inputs += `-itsoffset ${audioOffset / 1000} -i audio.webm `;
    audioTracks.push(`[${inputIdx}:a]`);
    inputIdx++;
  }

  if (hasVoiceovers) {
    inputs += `-i voiceover_final.wav `;
    audioTracks.push(`[${inputIdx}:a]`);
    inputIdx++;
  }

  // Mix audio tracks
  if (audioTracks.length > 0) {
    filterComplex += `${audioTracks.join('')}amix=inputs=${audioTracks.length}:duration=longest[aout]`;
    maps += `-map "[aout]" `;
  }

  script += `ffmpeg ${inputs}`;

  if (filterComplex) {
    script += `-filter_complex "${filterComplex}" `;
  }

  script += `${maps}`;

  // Add subtitles
  if (subtitles.length > 0) {
    script += `-vf "subtitles=subtitles.srt:force_style='FontName=Space Grotesk,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1'" `;
  }

  script += `-c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -y output.mp4\n\n`;

  script += `echo "✅ Render complete: output.mp4"\n`;
  script += `echo "📊 File size: $(du -h output.mp4 | cut -f1)"\n`;

  // Cleanup
  if (hasVoiceovers) {
    script += `\n# Cleanup temporary files\nrm -f voiceover_final.wav\n`;
  }

  return script;
}

// Generate README with instructions
function generateReadme(storyboard, subtitles) {
  const hasAudio = audioBlob || storyboard.meta?.hasAudio;
  const hasWebcam = webcamBlob || storyboard.meta?.hasWebcam;
  const hasVoiceovers = subtitles.some(s => s.voiceover);

  return `# Video Render Package

## Contents

- **timeline.json** - Complete storyboard data with events and timing
- **audio.webm** - Original recorded audio ${hasAudio ? '✅' : '❌'}
- **webcam.webm** - Webcam video recording ${hasWebcam ? '✅' : '❌'}
- **voiceovers/** - Generated voiceover audio files ${hasVoiceovers ? `✅ (${subtitles.filter(s => s.voiceover).length} files)` : '❌'}
- **subtitles.srt** - Subtitles in SRT format ${subtitles.length > 0 ? `✅ (${subtitles.length} subtitles)` : '❌'}
- **render.sh** - Automated rendering script (Unix/Mac)
- **render.bat** - Automated rendering script (Windows)

## Project Info

- **Title**: ${storyboard.meta?.title || 'Untitled'}
- **Duration**: ${formatTime(Math.max(...(storyboard.events || []).map(e => e.time || 0)))}
- **Events**: ${(storyboard.events || []).length}
- **Subtitles**: ${subtitles.length}
- **Original Audio Offset**: ${originalAudioOffset}ms
- **Webcam Offset**: ${webcamOffset}ms

## Requirements

Install ffmpeg:
\`\`\`bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
\`\`\`

## Quick Start

### Option 1: Automated Rendering (Recommended)

**Unix/Mac:**
\`\`\`bash
chmod +x render.sh
./render.sh
\`\`\`

**Windows:**
\`\`\`cmd
render.bat
\`\`\`

Output: **output.mp4**

### Option 2: Manual Rendering

**Basic video with subtitles:**
\`\`\`bash
ffmpeg -i webcam.webm -vf "subtitles=subtitles.srt" output.mp4
\`\`\`

**Video + audio + subtitles:**
\`\`\`bash
ffmpeg -i webcam.webm -i audio.webm -c:v copy -c:a aac -vf "subtitles=subtitles.srt" output.mp4
\`\`\`

**Video + audio + voiceovers + subtitles:**
See render.sh for the complete command chain.

## Customization

Edit **render.sh** to customize:
- Video quality (change \`-crf 23\` to 18-28)
- Audio bitrate (change \`-b:a 128k\`)
- Subtitle styling (edit \`force_style\` parameters)
- Output resolution

## Subtitle Styling

Current style in render.sh:
- Font: Space Grotesk
- Size: 24
- Color: White
- Outline: Black (2px)
- Shadow: Enabled

Edit the \`force_style\` parameter to customize.

## Troubleshooting

**"command not found: ffmpeg"**
- Install ffmpeg (see Requirements above)

**"No such file or directory"**
- Make sure all files are in the same directory
- Check that voiceovers folder exists

**Audio out of sync**
- Check audio/webcam offsets in timeline.json
- Adjust \`-itsoffset\` values in render script

**Subtitles not showing**
- Verify subtitles.srt exists
- Check subtitle timing in SRT file

## Support

For issues with:
- **Rendering**: Check ffmpeg documentation
- **Timeline data**: Open timeline.json to inspect
- **Export**: Re-export from browser extension

---

Generated by WebReplay Browser Extension
`;
}

// ========================================
// Media Player & Subtitles Features
// ========================================

const mediaPreview = document.getElementById('mediaPreview');
const webcamPlayer = document.getElementById('webcamPlayer');
const audioPlayer = document.getElementById('audioPlayer');

// Create separate audio element for voiceover playback
const voiceoverPlayer = document.createElement('audio');
voiceoverPlayer.id = 'voiceoverPlayer';

// Store audio blobs globally
let audioBlob = null; // Original recorded audio
let webcamBlob = null; // Original recorded webcam
let originalAudioMuted = false; // Track if original audio is muted for rendering
let webcamMuted = false; // Track if webcam video is disabled for rendering
let originalAudioOffset = 0; // Original audio start time offset in ms
let webcamOffset = 0; // Webcam video start time offset in ms

const transcribeBtn = document.getElementById('transcribeBtn');
const transcriptionProvider = document.getElementById('transcriptionProvider');
const transcriptionStatus = document.getElementById('transcriptionStatus');
const subtitlesPanel = document.getElementById('subtitlesPanel');
const subtitlesList = document.getElementById('subtitlesList');
const exportSubsBtn = document.getElementById('exportSubsBtn');
const clearSubsBtn = document.getElementById('clearSubsBtn');
const manualTranscribeBtn = document.getElementById('manualTranscribeBtn');
const changeApiKeyBtn = document.getElementById('changeApiKeyBtn');

let subtitles = []; // New structure: { id, time, duration, text, voiceId, voiceover: { audioBlob, offset } }
let selectedSubtitleId = null; // Currently selected subtitle for editing
let mediaFiles = { audio: null, webcam: null };

// Helper function to generate unique IDs
function generateId() {
  return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Add load media button to header
const loadMediaBtn = document.createElement('button');
loadMediaBtn.className = 'btn-secondary';
loadMediaBtn.innerHTML = '🎬 Load Media';
loadMediaBtn.addEventListener('click', loadMediaFiles);
document.querySelector('.header-actions').insertBefore(loadMediaBtn, loadBtn);

// Load media files (audio/webcam)
function loadMediaFiles() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'audio/*,video/*';

  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);

    for (const file of files) {
      const url = URL.createObjectURL(file);

      if (file.type.startsWith('audio/')) {
        mediaFiles.audio = file;
        audioBlob = file; // Set global audioBlob
        audioPlayer.src = url;
        console.log('[Editor] Audio loaded:', file.name);
      } else if (file.type.startsWith('video/')) {
        mediaFiles.webcam = file;
        webcamBlob = file; // Set global webcamBlob
        webcamPlayer.src = url;
        console.log('[Editor] Webcam loaded:', file.name);
      }
    }

    if (mediaFiles.audio || mediaFiles.webcam) {
      // Media players now shown in right panel when clicked
      updateRenderButtonState(); // Enable render button if needed
      renderTimeline(); // Update timeline to show tracks
    }
  });

  input.click();
}

// Generate subtitles using OpenAI Whisper or ElevenLabs API (old button - now in panel)
if (transcribeBtn) {
  transcribeBtn.addEventListener('click', async () => {
  if (!mediaFiles.audio && !audioPlayer.src) {
    showModal('Please load an audio file first.\n\nYou can load audio by:\n1. Recording with audio enabled, or\n2. Using "Load Media" button to upload an audio file');
    return;
  }

  const provider = transcriptionProvider.value;
  const isOpenAI = provider === 'openai';
  const storageKey = isOpenAI ? 'openai_api_key' : 'elevenlabs_stt_api_key';
  const providerName = isOpenAI ? 'OpenAI Whisper' : 'ElevenLabs';
  const apiKeyUrl = isOpenAI ? 'https://platform.openai.com/api-keys' : 'https://elevenlabs.io/app/speech-synthesis';

  // Check for API key
  let apiKey = localStorage.getItem(storageKey);
  if (!apiKey) {
    apiKey = await showPrompt(`Enter your ${providerName} API key:\n\nGet one at: ${apiKeyUrl}\n\n(Your key will be stored locally in your browser)`, '', {
      title: `${providerName} API Key Required`,
      icon: '🔑'
    });
    if (!apiKey) return;
    localStorage.setItem(storageKey, apiKey);
  }

  transcriptionStatus.textContent = `🎤 Transcribing audio with ${providerName}...`;
  transcriptionStatus.style.color = '#1976d2';
  transcribeBtn.disabled = true;

  try {
    // Get audio blob (assign to global variable)
    if (mediaFiles.audio) {
      audioBlob = mediaFiles.audio;
    } else if (audioPlayer.src) {
      const response = await fetch(audioPlayer.src);
      audioBlob = await response.blob();
    }

    if (!audioBlob) {
      throw new Error('No audio available to transcribe');
    }

    console.log(`[Editor] Transcribing audio blob with ${providerName}:`, audioBlob.size, 'bytes');

    let result;

    if (isOpenAI) {
      // OpenAI Whisper API
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Transcription failed');
      }

      result = await response.json();
    } else {
      // ElevenLabs Speech-to-Text API
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model_id', 'scribe_v1');
      formData.append('timestamps_granularity', 'word');
      formData.append('language_code', 'en');

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.message || error.message || 'Transcription failed');
      }

      result = await response.json();
    }

    console.log('[Editor] Transcription result:', result);

    // Clear existing subtitles
    subtitles = [];

    // Process results based on provider
    if (isOpenAI) {
      // OpenAI format
      if (result.segments && result.segments.length > 0) {
        result.segments.forEach(segment => {
          subtitles.push({
            id: generateId(),
            time: Math.round(segment.start * 1000),
            text: segment.text.trim(),
            duration: Math.round((segment.end - segment.start) * 1000),
            voiceId: '21m00Tcm4TlvDq8ikWAM', // Default: Rachel
            voiceover: null // Will be populated when generated
          });
        });
      } else if (result.text) {
        subtitles.push({
          id: generateId(),
          time: 0,
          text: result.text.trim(),
          duration: 5000,
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          voiceover: null
        });
      }
    } else {
      // ElevenLabs format - create segments from words
      if (result.words && result.words.length > 0) {
        // Group words into sentences (approx 10 words per segment)
        const wordsPerSegment = 10;
        for (let i = 0; i < result.words.length; i += wordsPerSegment) {
          const segmentWords = result.words.slice(i, i + wordsPerSegment);
          const startWord = segmentWords[0];
          const endWord = segmentWords[segmentWords.length - 1];

          subtitles.push({
            id: generateId(),
            time: Math.round(startWord.start * 1000),
            text: segmentWords.map(w => w.text).join(' '),
            duration: Math.round((endWord.end - startWord.start) * 1000),
            voiceId: '21m00Tcm4TlvDq8ikWAM',
            voiceover: null
          });
        }
      } else if (result.text) {
        subtitles.push({
          id: generateId(),
          time: 0,
          text: result.text.trim(),
          duration: 5000,
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          voiceover: null
        });
      }
    }

    transcriptionStatus.textContent = `✅ Transcription complete! ${subtitles.length} segments generated.`;
    transcriptionStatus.style.color = '#2e7d32';

    // Show subtitles panel
    subtitlesPanel.style.display = 'block';
    renderSubtitles();
    renderTimeline(); // Update timeline to show subtitles
    updateRenderButtonState(); // Update render button state

    console.log('[Editor] Generated', subtitles.length, 'subtitles');

  } catch (error) {
    console.error('[Editor] Transcription error:', error);
    transcriptionStatus.textContent = '❌ Transcription failed: ' + error.message;
    transcriptionStatus.style.color = '#c62828';

    if (error.message.includes('API key') || error.message.includes('invalid') || error.message.includes('unauthorized')) {
      localStorage.removeItem(storageKey);
      alert(`Invalid API key. Please try again with a valid ${providerName} API key.`);
    }
  } finally {
    transcribeBtn.disabled = false;
  }
  });
}

// Manual transcription interface
function showManualTranscriptionUI() {
  subtitlesPanel.style.display = 'block';

  // Add "Add Subtitle" button if not exists
  if (!document.getElementById('addSubtitleBtn')) {
    const addBtn = document.createElement('button');
    addBtn.id = 'addSubtitleBtn';
    addBtn.className = 'btn-primary btn-small';
    addBtn.innerHTML = '➕ Add Subtitle at Current Time';
    addBtn.style.margin = '8px 12px';
    addBtn.addEventListener('click', async () => {
      const time = audioPlayer.currentTime * 1000; // Convert to ms
      const text = await showPrompt('Enter subtitle text:', '', {
        title: 'Add Subtitle',
        icon: '📝'
      });

      if (text) {
        addSubtitle(time, text);
      }
    });

    subtitlesPanel.insertBefore(addBtn, subtitlesList);
  }

  renderSubtitles();
}

// Add a subtitle
function addSubtitle(time, text, duration = 3000) {
  subtitles.push({
    time: Math.round(time),
    text: text,
    duration: duration
  });

  // Sort by time
  subtitles.sort((a, b) => a.time - b.time);

  renderSubtitles();
  renderTimeline(); // Update timeline to show new subtitle
}

// Render subtitles list
function renderSubtitles() {
  subtitlesList.innerHTML = '';

  if (subtitles.length === 0) {
    subtitlesList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No subtitles yet. Play audio and add subtitles.</p>';
    return;
  }

  subtitles.forEach((sub, index) => {
    const item = document.createElement('div');
    item.className = 'subtitle-item';

    const timeSpan = document.createElement('div');
    timeSpan.className = 'subtitle-time';
    timeSpan.textContent = formatTime(sub.time) + ' → ' + formatTime(sub.time + sub.duration);

    const textSpan = document.createElement('div');
    textSpan.className = 'subtitle-text';
    textSpan.textContent = sub.text;
    textSpan.contentEditable = true;
    textSpan.addEventListener('blur', () => {
      subtitles[index].text = textSpan.textContent;
    });

    const actions = document.createElement('div');
    actions.style.marginTop = '6px';
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const seekBtn = document.createElement('button');
    seekBtn.className = 'btn-icon btn-small';
    seekBtn.textContent = '▶️';
    seekBtn.title = 'Seek to this time';
    seekBtn.addEventListener('click', () => {
      if (audioPlayer.src) audioPlayer.currentTime = sub.time / 1000;
      if (webcamPlayer.src) webcamPlayer.currentTime = sub.time / 1000;
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-small';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete subtitle';
    deleteBtn.addEventListener('click', () => {
      subtitles.splice(index, 1);
      renderSubtitles();
      renderTimeline(); // Update timeline after deletion
    });

    actions.appendChild(seekBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(timeSpan);
    item.appendChild(textSpan);
    item.appendChild(actions);

    subtitlesList.appendChild(item);
  });
}

// Alias for updating subtitles list from timeline
const updateSubtitlesList = renderSubtitles;

// Export subtitles as SRT
exportSubsBtn.addEventListener('click', () => {
  if (subtitles.length === 0) {
    showModal('No subtitles to export');
    return;
  }

  const srt = generateSRT(subtitles);

  const blob = new Blob([srt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subtitles.srt';
  a.click();

  URL.revokeObjectURL(url);

  showModal('Subtitles exported as SRT file!');
});

// Clear subtitles
clearSubsBtn.addEventListener('click', async () => {
  const confirmed = await showConfirm('Clear all subtitles?', {
    title: 'Clear Subtitles',
    icon: '⚠️',
    danger: true,
    confirmText: 'Clear All'
  });
  if (confirmed) {
    subtitles = [];
    renderSubtitles();
  }
});

// Add text block manually (now handled by addEventBtn dropdown)

// Manual transcription button
manualTranscribeBtn.addEventListener('click', () => {
  showManualTranscriptionUI();
  transcriptionStatus.textContent = '✏️ Manual transcription mode. Play audio and add subtitles at current time.';
  transcriptionStatus.style.color = '#888';
});

// Change transcription API key button
changeApiKeyBtn.addEventListener('click', async () => {
  const provider = transcriptionProvider.value;
  const isOpenAI = provider === 'openai';
  const storageKey = isOpenAI ? 'openai_api_key' : 'elevenlabs_stt_api_key';
  const providerName = isOpenAI ? 'OpenAI Whisper' : 'ElevenLabs Speech-to-Text';

  const currentKey = localStorage.getItem(storageKey);
  const newKey = await showPrompt(
    `Change ${providerName} API Key:\n\nCurrent: ` + (currentKey ? currentKey.substring(0, 10) + '...' : 'Not set') + '\n\nEnter new API key (or leave blank to remove):',
    '',
    {
      title: `Change ${providerName} Key`,
      icon: '🔑'
    }
  );

  if (newKey === null) return; // Cancelled

  if (newKey.trim() === '') {
    localStorage.removeItem(storageKey);
    showModal(`${providerName} API key removed. You will be prompted for a new key on next transcription.`, {
      title: 'API Key Removed',
      icon: '✅'
    });
  } else {
    localStorage.setItem(storageKey, newKey.trim());
    showModal(`${providerName} API key updated successfully!`, {
      title: 'API Key Updated',
      icon: '✅'
    });
  }
});

// Generate SRT format
function generateSRT(subs) {
  let srt = '';

  subs.forEach((sub, index) => {
    const startTime = formatSRTTime(sub.time);
    const endTime = formatSRTTime(sub.time + sub.duration);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${sub.text}\n\n`;
  });

  return srt;
}

// Format time for SRT (HH:MM:SS,mmm)
function formatSRTTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// Helper: Format time as MM:SS
function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Sync media playback with timeline
function syncMediaWithTimeline(currentTime) {
  if (audioPlayer.src && !audioPlayer.paused) {
    // Audio is playing, update timeline to match
    playhead = audioPlayer.currentTime * 1000;
  } else if (webcamPlayer.src && !webcamPlayer.paused) {
    // Webcam is playing, update timeline to match
    playhead = webcamPlayer.currentTime * 1000;
  }

  // Show current subtitle
  const currentSubtitle = subtitles.find(sub =>
    currentTime >= sub.time && currentTime < (sub.time + sub.duration)
  );

  if (currentSubtitle) {
    // Highlight current subtitle in list
    const items = subtitlesList.querySelectorAll('.subtitle-item');
    items.forEach((item, index) => {
      if (subtitles[index] === currentSubtitle) {
        item.style.background = '#2a4a6a';
        item.style.borderColor = '#1976d2';
      } else {
        item.style.background = '#1e1e1e';
        item.style.borderColor = '#3d3d3d';
      }
    });
  }
}

// Update media playback listeners
if (audioPlayer) {
  audioPlayer.addEventListener('timeupdate', () => {
    syncMediaWithTimeline(audioPlayer.currentTime * 1000);
  });
}

if (webcamPlayer) {
  webcamPlayer.addEventListener('timeupdate', () => {
    syncMediaWithTimeline(webcamPlayer.currentTime * 1000);
  });
}

// ========================================
// ElevenLabs Text-to-Speech Integration
// ========================================

const generateVoiceoverBtn = document.getElementById('generateVoiceoverBtn');
const elevenlabsVoiceSelect = document.getElementById('elevenlabsVoiceSelect');
let elevenlabsApiKey = localStorage.getItem('elevenlabs_api_key') || '';
let voiceoverAudio = null;

generateVoiceoverBtn.addEventListener('click', async () => {
  if (subtitles.length === 0) {
    showModal('No subtitles to generate voiceover from');
    return;
  }

  // Prompt for API key if not set
  if (!elevenlabsApiKey) {
    elevenlabsApiKey = await showPrompt('Enter your ElevenLabs API key:', '', {
      title: 'ElevenLabs API Key Required',
      icon: '🔑'
    });
    if (!elevenlabsApiKey) return;
    localStorage.setItem('elevenlabs_api_key', elevenlabsApiKey);
  }

  generateVoiceoverBtn.disabled = true;
  generateVoiceoverBtn.innerHTML = '⏳ Generating...';

  try {
    // Combine all subtitles into a single script with timing markers
    const script = subtitles.map((sub, idx) => sub.text).join('. ');

    // Get selected voice from dropdown
    const voiceId = elevenlabsVoiceSelect.value;
    console.log('[ElevenLabs] Using voice:', elevenlabsVoiceSelect.options[elevenlabsVoiceSelect.selectedIndex].text);

    // Call ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsApiKey
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || 'Failed to generate voiceover');
    }

    // Convert response to blob and create audio URL
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Set voiceover as separate audio source
    voiceoverPlayer.src = audioUrl;
    voiceoverAudio = audioBlob;

    // Update timeline to show audio track
    setTimeout(() => {
      renderTimeline();
      updateRenderButtonState(); // Enable render button
    }, 100);

    showModal('Voiceover generated successfully! ✅\n\nYou can now see the voiceover track on the timeline.');

  } catch (error) {
    console.error('[ElevenLabs] Error:', error);
    showModal('Failed to generate voiceover: ' + error.message + '\n\nPlease check your API key and try again.');

    // Clear saved API key on auth error
    if (error.message.includes('unauthorized') || error.message.includes('invalid')) {
      localStorage.removeItem('elevenlabs_api_key');
      elevenlabsApiKey = '';
    }
  } finally {
    generateVoiceoverBtn.disabled = false;
    generateVoiceoverBtn.innerHTML = '🎙️ Generate Voiceover';
  }
});

// Generate voiceover for a specific subtitle
async function generateVoiceoverForSubtitle(subtitleId) {
  const subtitle = subtitles.find(s => s.id === subtitleId);
  if (!subtitle) {
    showModal('Text block not found');
    return;
  }

  // Prompt for API key if not set
  if (!elevenlabsApiKey) {
    elevenlabsApiKey = await showPrompt('Enter your ElevenLabs API key:\n\nGet one at: https://elevenlabs.io/app/speech-synthesis\n\n(Your key will be stored locally in your browser)', '', {
      title: 'ElevenLabs API Key Required',
      icon: '🔑'
    });
    if (!elevenlabsApiKey) return;
    localStorage.setItem('elevenlabs_api_key', elevenlabsApiKey);
  }

  const generateSubVoiceoverBtn = document.getElementById('generateSubVoiceoverBtn');
  if (generateSubVoiceoverBtn) {
    generateSubVoiceoverBtn.disabled = true;
    generateSubVoiceoverBtn.innerHTML = '⏳ Generating...';
  }

  try {
    console.log('[ElevenLabs] Generating voiceover for subtitle:', subtitleId);
    console.log('[ElevenLabs] Text:', subtitle.text);
    console.log('[ElevenLabs] Voice:', subtitle.voiceId);

    // Call ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${subtitle.voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsApiKey
      },
      body: JSON.stringify({
        text: subtitle.text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || 'Failed to generate voiceover');
    }

    // Convert response to blob
    const audioBlob = await response.blob();

    // Get audio duration
    const audioDuration = await getAudioDuration(audioBlob);

    // Generate unique blob ID
    const blobId = `voiceover_${subtitle.id}_${Date.now()}`;

    // Save to IndexedDB
    try {
      await saveVoiceoverToDB(blobId, audioBlob);
      console.log('[ElevenLabs] Voiceover saved to IndexedDB:', blobId);

      // Verify it was actually saved
      const verified = await getVoiceoverFromDB(blobId);
      if (verified) {
        console.log('[ElevenLabs] ✅ Verified voiceover in IndexedDB:', verified.size, 'bytes');
      } else {
        console.error('[ElevenLabs] ❌ Failed to verify voiceover in IndexedDB!');
      }
    } catch (error) {
      console.error('[ElevenLabs] Failed to save voiceover to IndexedDB:', error);
      alert('⚠️ Warning: Voiceover audio could not be saved to database.\n\nIt will work in the editor but may not be available for video export.');
    }

    // Store voiceover in subtitle
    subtitle.voiceover = {
      blobId: blobId, // Store ID for persistence
      audioBlob: audioBlob, // Keep blob in memory for editor playback
      offset: 0, // Default offset (can be adjusted by dragging on timeline)
      duration: Math.round(audioDuration * 1000) // Convert to ms
    };

    console.log('[ElevenLabs] Voiceover generated successfully:', audioDuration, 'seconds');

    // Update timeline and properties panel
    renderTimeline();
    renderSubtitleEditor(); // Refresh editor to show voiceover status
    updateRenderButtonState(); // Enable render button if needed

    showModal('Voiceover generated successfully! ✅\n\nYou can now see it on the voiceover track and adjust its timing by dragging.');

  } catch (error) {
    console.error('[ElevenLabs] Error:', error);
    showModal('Failed to generate voiceover: ' + error.message + '\n\nPlease check your API key and try again.');

    // Clear saved API key on auth error
    if (error.message.includes('unauthorized') || error.message.includes('invalid')) {
      localStorage.removeItem('elevenlabs_api_key');
      elevenlabsApiKey = '';
    }
  } finally {
    if (generateSubVoiceoverBtn) {
      generateSubVoiceoverBtn.disabled = false;
      generateSubVoiceoverBtn.innerHTML = '🎙️ Generate Voiceover for This Text';
    }
  }
}

// Helper function to get audio duration from blob
function getAudioDuration(audioBlob) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(audioBlob);

    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    });

    audio.addEventListener('error', (e) => {
      URL.revokeObjectURL(audio.src);
      reject(new Error('Failed to load audio metadata'));
    });
  });
}

// ========================================
// Render Video with Voiceover
// ========================================

let renderWindow = null;
let mediaRecorder = null;
let recordedChunks = [];

// Render Video - Automated video export
renderBtn.addEventListener('click', async () => {
  console.log('[Editor] Render Video button clicked');
  console.log('[Editor] Storyboard:', storyboard ? 'loaded' : 'not loaded');
  console.log('[Editor] RecordingId:', recordingId);

  if (!storyboard) {
    console.error('[Editor] No storyboard loaded');
    await showModal('❌ No storyboard loaded.\n\nPlease load a recording first.', {
      title: 'No Recording',
      icon: '⚠️'
    });
    return;
  }

  console.log('[Editor] Calling exportAsVideo()...');

  try {
    // Call the automated video export
    await exportAsVideo();
    console.log('[Editor] exportAsVideo() completed');
  } catch (error) {
    console.error('[Editor] Error in exportAsVideo():', error);
    await showModal('❌ Export failed: ' + error.message, {
      title: 'Error',
      icon: '❌'
    });
  }
});

/* OLD RENDER CODE - Now handled by background script
renderBtn.addEventListener('click', async () => {
  if (!storyboard) {
    showModal('No storyboard loaded');
    return;
  }

  // Check if any subtitles have voiceovers
  const hasVoiceovers = subtitles.some(sub => sub.voiceover && sub.voiceover.audioBlob);
  if (!hasVoiceovers && !audioBlob) {
    showModal('No voiceovers or audio to render.\n\nPlease either:\n1. Generate voiceovers for your text blocks, or\n2. Record with audio enabled');
    return;
  }

  try {
    renderBtn.disabled = true;
    renderBtn.innerHTML = '⏳ Rendering...';

    // Build preview URL with recordingId query parameter (use global recordingId)
    let previewUrl = chrome.runtime.getURL('ui/preview.html');
    if (recordingId) {
      previewUrl += `?id=${encodeURIComponent(recordingId)}`;
      console.log('[Render] Opening preview with recordingId:', recordingId);
    } else {
      console.warn('[Render] No recordingId found, will use postMessage fallback');
    }

    const renderTab = await chrome.tabs.create({ url: previewUrl, active: true });

    // Wait for tab to fully load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        listener && chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, 10000);

      const listener = (tabId, changeInfo, updatedTab) => {
        if (tabId === renderTab.id && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });

    // Small additional delay to ensure scripts are ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // If no recordingId, fallback to postMessage
    if (!recordingId) {
      await chrome.scripting.executeScript({
        target: { tabId: renderTab.id },
        func: (sb) => {
          window.postMessage({ type: 'LOAD_STORYBOARD', storyboard: sb }, '*');
        },
        args: [storyboard]
      });
    }

    // Calculate total duration
    const totalDuration = storyboard.timeline.length > 0
      ? storyboard.timeline[storyboard.timeline.length - 1].t + 5000
      : 10000;

    // Request tab capture stream from the render tab
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture(
        {
          audio: false,
          video: true,
          videoConstraints: {
            mandatory: {
              minWidth: 1280,
              minHeight: 720,
              maxWidth: 1920,
              maxHeight: 1080,
              maxFrameRate: 30
            }
          }
        },
        (stream) => {
          if (chrome.runtime.lastError || !stream) {
            reject(new Error(chrome.runtime.lastError?.message || 'Failed to capture tab'));
          } else {
            resolve(stream);
          }
        }
      );
    });

    // Create audio context for mixing
    const audioContext = new AudioContext();

    // Create media stream destination for audio
    const audioDestination = audioContext.createMediaStreamDestination();

    // Create gain node for mixing
    const mixerGain = audioContext.createGain();
    mixerGain.gain.value = 1.0;
    mixerGain.connect(audioDestination);

    // Add original audio if not muted
    let originalAudioSource = null;
    if (!originalAudioMuted && audioBlob) {
      try {
        const originalAudioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
        originalAudioSource = audioContext.createBufferSource();
        originalAudioSource.buffer = originalAudioBuffer;
        originalAudioSource.connect(mixerGain);
        console.log('[Render] Including original audio in render (not muted)');
      } catch (e) {
        console.warn('[Render] Failed to load original audio:', e);
      }
    } else {
      console.log('[Render] Original audio', originalAudioMuted ? 'muted' : 'not available', '- excluding from render');
    }

    // Load and schedule all subtitle voiceovers
    const voiceoverSources = [];
    for (const subtitle of subtitles) {
      if (subtitle.voiceover && subtitle.voiceover.audioBlob) {
        try {
          const voBuffer = await audioContext.decodeAudioData(await subtitle.voiceover.audioBlob.arrayBuffer());
          const voSource = audioContext.createBufferSource();
          voSource.buffer = voBuffer;
          voSource.connect(mixerGain);

          // Calculate when this voiceover should start (in seconds)
          const startTime = (subtitle.time + (subtitle.voiceover.offset || 0)) / 1000;

          voiceoverSources.push({ source: voSource, startTime, text: subtitle.text });
          console.log('[Render] Loaded voiceover for:', subtitle.text.substring(0, 30), '- starts at', startTime, 's');
        } catch (e) {
          console.warn('[Render] Failed to load voiceover for subtitle:', subtitle.id, e);
        }
      }
    }

    console.log('[Render] Total voiceover sources:', voiceoverSources.length);

    // Combine video stream with audio stream
    const videoTrack = streamId.getVideoTracks()[0];
    const audioTrack = audioDestination.stream.getAudioTracks()[0];

    const combinedStream = new MediaStream([videoTrack, audioTrack]);

    // Setup MediaRecorder
    recordedChunks = [];
    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000
    };

    mediaRecorder = new MediaRecorder(combinedStream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Create video blob
      const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });

      // Download the video
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webreplay-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Cleanup
      streamId.getTracks().forEach(track => track.stop());
      audioContext.close();

      // Close the render tab
      try {
        await chrome.tabs.remove(renderTab.id);
      } catch (e) {
        console.error('Failed to close render tab:', e);
      }

      renderBtn.disabled = false;
      renderBtn.innerHTML = '🎥 Render Video';

      showModal('Video rendered successfully! ✅\n\nThe video has been downloaded to your downloads folder.');
    };

    // Start recording
    mediaRecorder.start(100);

    // Start original audio immediately if it exists and not muted
    if (originalAudioSource) {
      originalAudioSource.start(0);
      console.log('[Render] Started original audio playback');
    }

    // Start all voiceover audio sources at their scheduled times
    voiceoverSources.forEach((vo) => {
      if (vo.startTime > 0) {
        setTimeout(() => {
          vo.source.start(0);
          console.log('[Render] Started voiceover at', vo.startTime, 's:', vo.text.substring(0, 30));
        }, vo.startTime * 1000);
      } else {
        vo.source.start(0);
        console.log('[Render] Started voiceover immediately:', vo.text.substring(0, 30));
      }
    });

    // Start replay in the tab (wait a moment for everything to be ready)
    setTimeout(async () => {
      await chrome.scripting.executeScript({
        target: { tabId: renderTab.id },
        func: () => {
          window.postMessage({ type: 'START_REPLAY' }, '*');
        }
      });
    }, 500);

    // Calculate total render duration
    let maxAudioDuration = 0;

    // Consider original audio duration
    if (originalAudioSource && originalAudioSource.buffer) {
      maxAudioDuration = originalAudioSource.buffer.duration * 1000;
    }

    // Consider all voiceover durations + their start times
    voiceoverSources.forEach(vo => {
      const voEndTime = (vo.startTime * 1000) + (vo.source.buffer.duration * 1000);
      maxAudioDuration = Math.max(maxAudioDuration, voEndTime);
    });

    // Consider last subtitle end time
    if (subtitles.length > 0) {
      const lastSub = subtitles[subtitles.length - 1];
      const lastSubEnd = lastSub.time + lastSub.duration;
      maxAudioDuration = Math.max(maxAudioDuration, lastSubEnd);
    }

    const renderDuration = Math.max(
      totalDuration,
      maxAudioDuration + 2000 // Add 2 second buffer
    );

    console.log('[Render] Total render duration:', renderDuration, 'ms');
    console.log('[Render] Max audio duration:', maxAudioDuration, 'ms');

    // Stop recording after duration
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }, renderDuration);

  } catch (error) {
    console.error('[Render] Error:', error);
    showModal('Failed to render video: ' + error.message);

    renderBtn.disabled = false;
    renderBtn.innerHTML = '🎥 Render Video';
  }
});
*/ // End of old render code

// ========================================
// Replay Preview in Iframe
// ========================================

const previewBtn = document.getElementById('previewBtn');
const replayPreview = document.getElementById('replayPreview');
const replayIframe = document.getElementById('replayIframe');
const startPreviewBtn = document.getElementById('startPreviewBtn');
const stopPreviewBtn = document.getElementById('stopPreviewBtn');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const popOutPreviewBtn = document.getElementById('popOutPreviewBtn');

let previewTabId = null;

previewBtn.addEventListener('click', async () => {
  if (!storyboard) return;

  try {
    // Build preview URL with recordingId query parameter (use global recordingId)
    let previewUrl = chrome.runtime.getURL('ui/preview.html');
    if (recordingId) {
      previewUrl += `?id=${encodeURIComponent(recordingId)}`;
      console.log('[Preview] Opening with recordingId:', recordingId);
    } else {
      console.warn('[Preview] No recordingId found, will use postMessage fallback');
    }

    const tab = await chrome.tabs.create({ url: previewUrl, active: true });
    previewTabId = tab.id;

    // Wait for tab to fully load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        listener && chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, 10000);

      const listener = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });

    // Small additional delay to ensure scripts are ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Prepare storyboard with base64 audio
    console.log('[Preview] Preparing storyboard with base64 audio...');
    const subtitlesWithBase64 = await Promise.all(subtitles.map(async sub => {
      const subtitleCopy = { ...sub };
      if (sub.voiceover && sub.voiceover.audioBlob) {
        const arrayBuffer = await sub.voiceover.audioBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        subtitleCopy.voiceover = {
          ...sub.voiceover,
          audioBase64: base64,
          audioType: sub.voiceover.audioBlob.type
        };
        delete subtitleCopy.voiceover.audioBlob; // Remove the Blob
      }
      return subtitleCopy;
    }));

    const storyboardWithAudio = {
      ...storyboard,
      subtitles: subtitlesWithBase64
    };

    console.log('[Preview] Sending storyboard with', subtitlesWithBase64.filter(s => s.voiceover?.audioBase64).length, 'voiceovers');

    // Send storyboard with base64 audio to the tab
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sb) => {
        window.postMessage({ type: 'LOAD_STORYBOARD', storyboard: sb }, '*');
      },
      args: [storyboardWithAudio]
    });

    console.log('[Preview] Opened in new tab:', tab.id);

  } catch (error) {
    console.error('[Preview] Error opening tab:', error);
    showModal('Failed to open preview in new tab: ' + error.message + '\n\nPlease try again.');
  }
});

closePreviewBtn.addEventListener('click', () => {
  // Stop any running preview
  replayIframe.contentWindow.postMessage({ type: 'STOP_REPLAY' }, '*');

  // Hide preview panel
  replayPreview.style.display = 'none';
});

startPreviewBtn.addEventListener('click', () => {
  replayIframe.contentWindow.postMessage({ type: 'START_REPLAY' }, '*');
});

stopPreviewBtn.addEventListener('click', () => {
  replayIframe.contentWindow.postMessage({ type: 'STOP_REPLAY' }, '*');
});

// Pop out preview in new tab
popOutPreviewBtn.addEventListener('click', async () => {
  if (!storyboard) return;

  try {
    console.log('[Preview] Current subtitles array:', subtitles);
    console.log('[Preview] Subtitles count:', subtitles.length);

    // Prepare subtitles with base64 audio for preview
    const subtitlesWithBase64 = await Promise.all(subtitles.map(async sub => {
      const subtitleCopy = { ...sub };
      if (sub.voiceover && sub.voiceover.audioBlob) {
        const arrayBuffer = await sub.voiceover.audioBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        subtitleCopy.voiceover = {
          ...sub.voiceover,
          audioBase64: base64,
          audioType: sub.voiceover.audioBlob.type
        };
        delete subtitleCopy.voiceover.audioBlob; // Remove the Blob
      }
      return subtitleCopy;
    }));

    console.log('[Preview] Subtitles with base64 audio:', subtitlesWithBase64.filter(s => s.voiceover?.audioBase64).length);

    // Add subtitles and media offsets to storyboard before previewing
    storyboard.subtitles = subtitlesWithBase64;
    storyboard.originalAudioOffset = originalAudioOffset;
    storyboard.webcamOffset = webcamOffset;

    console.log('[Preview] Storyboard with subtitles:', {
      subtitlesCount: storyboard.subtitles.length,
      audioOffset: storyboard.originalAudioOffset,
      webcamOffset: storyboard.webcamOffset
    });

    // Save updated storyboard to storage so preview can load it (use global recordingId)
    if (recordingId) {
      await chrome.storage.local.set({
        [`storyboard_${recordingId}`]: JSON.stringify(storyboard)
      });
      console.log('[Preview] Saved updated storyboard with', subtitles.length, 'subtitles to storage');
      console.log('[Preview] Saved audio offset:', originalAudioOffset, 'ms, webcam offset:', webcamOffset, 'ms');
    }

    // Build preview URL with recordingId query parameter
    let previewUrl = chrome.runtime.getURL('ui/preview.html');
    if (recordingId) {
      previewUrl += `?id=${encodeURIComponent(recordingId)}`;
      console.log('[Preview] Opening with recordingId:', recordingId);
    } else {
      console.warn('[Preview] No recordingId found, will use postMessage fallback');
    }

    const tab = await chrome.tabs.create({ url: previewUrl, active: true });
    previewTabId = tab.id;

    // Always send storyboard with base64 audio via postMessage
    // Wait for tab to fully load using chrome.tabs.onUpdated
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        listener && chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, 10000);

      const listener = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });

    // Small additional delay to ensure scripts are ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send storyboard with base64 audio to the tab
    console.log('[Preview] Sending storyboard with base64 audio via postMessage');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sb) => {
        window.postMessage({ type: 'LOAD_STORYBOARD', storyboard: sb }, '*');
      },
      args: [storyboard]
    });

    // Auto-start replay after a short delay
    setTimeout(async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            window.postMessage({ type: 'START_REPLAY' }, '*');
          }
        });
      } catch (error) {
        console.error('[Preview] Failed to start replay:', error);
      }
    }, 1000);

    console.log('[Preview] Opened in new tab:', tab.id);

  } catch (error) {
    console.error('[Preview] Error opening tab:', error);
    showModal('Failed to open preview in new tab: ' + error.message + '\n\nPlease try again.');
  }
});

// Enable preview button when storyboard is loaded
const originalLoadStoryboard = loadStoryboard;
loadStoryboard = function() {
  originalLoadStoryboard();
  previewBtn.disabled = false;
};

console.log('[Timeline Editor] Ready (with Media, Subtitles, TTS & Preview support)');

// Check for recordingId in URL parameter and auto-load
(async function autoLoadRecording() {
  const urlParams = new URLSearchParams(window.location.search);
  recordingId = urlParams.get('recordingId'); // Set global recordingId

  if (recordingId) {
    console.log('[Timeline Editor] Auto-loading recording:', recordingId);

    try {
      // Load storyboard from chrome.storage
      const result = await chrome.storage.local.get([`storyboard_${recordingId}`]);

      if (result[`storyboard_${recordingId}`]) {
        storyboard = JSON.parse(result[`storyboard_${recordingId}`]);
        console.log('[Timeline Editor] Storyboard loaded from storage');

        // Load subtitles if available
        if (storyboard.subtitles && Array.isArray(storyboard.subtitles)) {
          subtitles = storyboard.subtitles;
          console.log('[Timeline Editor] Loaded', subtitles.length, 'subtitles');
        }

        // Load media offsets if available
        if (typeof storyboard.originalAudioOffset === 'number') {
          originalAudioOffset = storyboard.originalAudioOffset;
          console.log('[Timeline Editor] Loaded audio offset:', originalAudioOffset, 'ms');
        }
        if (typeof storyboard.webcamOffset === 'number') {
          webcamOffset = storyboard.webcamOffset;
          console.log('[Timeline Editor] Loaded webcam offset:', webcamOffset, 'ms');
        }

        let hasMedia = false;

        // Load audio from IndexedDB if available
        try {
          audioBlob = await getAudioFromDB(recordingId);
          if (audioBlob) {
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;
            console.log('[Timeline Editor] Audio loaded:', audioBlob.size, 'bytes');
            hasMedia = true;
            updateRenderButtonState(); // Enable render button
          }
        } catch (error) {
          console.warn('[Timeline Editor] No audio available:', error);
        }

        // Load webcam from IndexedDB if available
        try {
          webcamBlob = await getWebcamFromDB(recordingId);
          if (webcamBlob) {
            const webcamUrl = URL.createObjectURL(webcamBlob);
            webcamPlayer.src = webcamUrl;
            console.log('[Timeline Editor] Webcam loaded:', webcamBlob.size, 'bytes');
            hasMedia = true;
          }
        } catch (error) {
          console.warn('[Timeline Editor] No webcam available:', error);
        }

        // Media players now shown in right panel when clicked
        if (hasMedia) {
          console.log('[Timeline Editor] Media loaded - players available in right panel');
        }

        // Render the timeline
        loadStoryboard();
        saveBtn.disabled = false;
        exportBtn.disabled = false;

        // Wait for audio metadata to load, then re-render timeline
        if (audioBlob) {
          audioPlayer.addEventListener('loadedmetadata', () => {
            setTimeout(() => renderTimeline(), 100);
          }, { once: true });
        }

        // Load voiceover blobs asynchronously (don't block rendering)
        if (subtitles.length > 0) {
          (async () => {
            for (const subtitle of subtitles) {
              if (subtitle.voiceover && subtitle.voiceover.blobId) {
                try {
                  const audioBlob = await getVoiceoverFromDB(subtitle.voiceover.blobId);
                  subtitle.voiceover.audioBlob = audioBlob;
                  console.log('[Timeline Editor] Loaded voiceover blob:', subtitle.voiceover.blobId);
                } catch (error) {
                  console.warn('[Timeline Editor] Failed to load voiceover blob:', subtitle.voiceover.blobId, error);
                }
              }
            }
            // Re-render timeline after voiceovers are loaded
            renderTimeline();
          })();
        }

        console.log('[Timeline Editor] Recording loaded successfully');
      } else {
        console.error('[Timeline Editor] Recording not found:', recordingId);
        showModal('Recording not found: ' + recordingId);
      }
    } catch (error) {
      console.error('[Timeline Editor] Error auto-loading recording:', error);
      showModal('Failed to load recording: ' + error.message);
    }
  }
})();

// Helper functions to load media from IndexedDB
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

// Save voiceover blob to IndexedDB
async function saveVoiceoverToDB(blobId, audioBlob) {
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
      const transaction = db.transaction(['voiceovers'], 'readwrite');
      const store = transaction.objectStore('voiceovers');
      const putRequest = store.put(audioBlob, blobId);

      putRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      putRequest.onerror = () => {
        db.close();
        reject(putRequest.error);
      };
    };
  });
}

// Get voiceover blob from IndexedDB
async function getVoiceoverFromDB(blobId) {
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

      // Check if voiceovers store exists
      if (!db.objectStoreNames.contains('voiceovers')) {
        db.close();
        reject(new Error('Voiceovers store not found'));
        return;
      }

      const transaction = db.transaction(['voiceovers'], 'readonly');
      const store = transaction.objectStore('voiceovers');
      const getRequest = store.get(blobId);

      getRequest.onsuccess = () => {
        db.close();
        if (getRequest.result) {
          resolve(getRequest.result);
        } else {
          reject(new Error('Voiceover not found'));
        }
      };
      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };
  });
}

// Panel toggle functionality
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const propertiesToggle = document.getElementById('propertiesToggle');

// Toggle left sidebar
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');

  // Update arrow direction
  if (sidebar.classList.contains('collapsed')) {
    sidebarToggle.textContent = '▶';
  } else {
    sidebarToggle.textContent = '◀';
  }

  console.log('[Timeline Editor] Sidebar toggled:', sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
});

// Toggle right properties panel
propertiesToggle.addEventListener('click', () => {
  properties.classList.toggle('collapsed');

  // Update arrow direction
  if (properties.classList.contains('collapsed')) {
    propertiesToggle.textContent = '◀';
  } else {
    propertiesToggle.textContent = '▶';
  }

  console.log('[Timeline Editor] Properties panel toggled:', properties.classList.contains('collapsed') ? 'collapsed' : 'expanded');
});

console.log('[Timeline Editor] Panel toggle controls initialized');
