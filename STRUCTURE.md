# Project Structure

```
Projects/
├── README.md                      # Main documentation
├── QUICKSTART.md                  # Quick start guide
├── STRUCTURE.md                   # This file
├── project.md                     # Original specification
├── setup.sh                       # Setup script
│
├── browser-extension/             # Chrome/Edge extension
│   ├── manifest.json              # Extension configuration
│   ├── icons/                     # Extension icons
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   ├── scripts/
│   │   ├── content.js             # Captures interactions on pages
│   │   └── background.js          # Manages recordings, builds storyboards
│   └── ui/
│       ├── popup.html             # Extension popup interface
│       └── popup.js               # Popup UI controller
│
├── replay-engine/                 # Playwright-based replay system
│   ├── package.json               # Node.js dependencies
│   ├── src/
│   │   ├── index.js               # CLI interface
│   │   └── replay.js              # Main replay engine
│   └── lib/                       # (Reserved for future modules)
│
└── examples/                      # Test files and examples
    ├── example-storyboard.json    # Sample storyboard (Google search)
    └── test-page.html             # Test page for recording
```

## Component Breakdown

### Browser Extension

**Purpose:** Record user interactions and generate storyboard files

**Key Files:**

- `manifest.json` - Defines extension permissions, scripts, and configuration
- `scripts/content.js` - Injected into web pages to capture clicks, typing, navigation
- `scripts/background.js` - Service worker that manages recording state and audio
- `ui/popup.html` + `popup.js` - User interface for start/stop recording

**Data Flow:**
1. User clicks "Start Recording" in popup
2. Popup sends message to background script
3. Background script sends message to content script
4. Content script captures interactions on page
5. On stop, content script sends events to background
6. Background script builds storyboard JSON
7. User downloads storyboard + audio files

### Replay Engine

**Purpose:** Replay storyboards using Playwright with video recording

**Key Files:**

- `package.json` - Defines dependencies (Playwright, ffmpeg)
- `src/replay.js` - Main replay engine with cursor smoothing
- `src/index.js` - CLI with validate/info/replay commands

**Data Flow:**
1. Load storyboard JSON file
2. Launch Playwright browser
3. Execute each timeline event in sequence
4. Resolve elements using selector strategies
5. Animate cursor with smooth movement
6. Record video frames (optional)
7. Save video to disk

### Examples

**test-page.html**
- A styled test page with various form elements
- Includes data-testid attributes for stable targeting
- Perfect for testing recording and replay

**example-storyboard.json**
- Pre-made storyboard that searches Google
- Demonstrates the storyboard format
- Can be replayed immediately

## Technology Stack

### Browser Extension
- **JavaScript** (ES6+)
- **Chrome Extension API** (Manifest V3)
  - `chrome.tabs` - Tab management
  - `chrome.runtime` - Messaging
  - `chrome.storage` - Data persistence
  - `chrome.tabCapture` - Screen/audio capture
  - `MediaRecorder API` - Audio recording

### Replay Engine
- **Node.js** (ES modules)
- **Playwright** - Browser automation
  - Chromium browser
  - Element locators
  - Video recording
  - Context/viewport management

### Data Format
- **JSON** - Storyboard format
- **WebM** - Audio recording
- **MP4** - Video output (via Playwright)

## Design Patterns

### Robust Element Targeting
Multiple selector fallbacks ensure replay reliability:
1. Stable attributes (data-testid, id, name)
2. CSS selectors
3. Text content hints
4. Visual position (last resort)

### Event Timeline
Events stored with absolute timestamps allow:
- Easy editing of timing
- Insertion of pauses
- Audio synchronization
- Deterministic replay

### Smooth Cursor Movement
Cubic easing function creates natural movement:
- Distance-based duration
- Configurable max speed
- Minimum duration threshold
- Frame-by-frame interpolation

### Human-like Typing
Character-by-character with variance:
- Configurable speed
- Random delay variance
- Auto-paste for long text
- Per-field overrides

## Extension Points

Places designed for future enhancement:

1. **Timeline Editor** (browser-extension/ui/)
   - Visual timeline with draggable events
   - Waveform display for audio
   - Timing adjustments

2. **STT/TTS** (replay-engine/lib/)
   - Speech-to-text transcription
   - Text editing interface
   - Text-to-speech synthesis (ElevenLabs)

3. **Webcam** (browser-extension/scripts/)
   - Webcam capture track
   - Picture-in-picture layout
   - Multiple layout presets

4. **Assets** (replay-engine/lib/)
   - File upload handling
   - Asset management
   - SHA-256 verification

## Configuration Files

### manifest.json
- Extension permissions
- Content script injection rules
- Background service worker
- Web accessible resources

### package.json
- Playwright for browser automation
- fluent-ffmpeg for video processing
- ES modules enabled

### Storyboard JSON
- Version (for format evolution)
- Meta (title, viewport, timestamps)
- Settings (cursor, typing, render)
- Timeline (events array)
- Audio track (voice/TTS segments)
- Assets (files, uploads)

## Key Algorithms

### Selector Generation (content.js)
1. Extract stable attributes (id, data-*, name)
2. Build CSS path (limited depth)
3. Add type-specific selectors
4. Include text hints

### Element Resolution (replay.js)
1. Try stable attribute selectors
2. Try CSS path selectors
3. Try text-based locators
4. Throw error if all fail

### Cursor Path Generation (replay.js)
1. Calculate distance between points
2. Compute duration (distance / speed)
3. Apply minimum duration
4. Generate interpolated points with easing
5. Return path with per-step durations

### Timing Execution (replay.js)
1. Sort events by timestamp
2. For each event:
   - Calculate wait time since last event
   - Sleep for wait duration
   - Execute event action
   - Handle wait conditions

## Security Considerations

### Sensitive Data
- Passwords are captured in plain text
- Recommendation: Use token-based auth for demos
- Future: Add field masking capability

### Permissions
- Extension requires broad permissions
- `<all_urls>` for content script injection
- `tabCapture` for screen recording
- User must grant microphone access

### Replay Safety
- Replays execute real browser actions
- No sandboxing in place
- Recommendation: Review storyboards before replay
- Future: Add redaction zones

## Performance Notes

### Recording
- Content script is lightweight
- Event debouncing for input
- Minimal memory footprint
- Audio chunks collected every 1s

### Replay
- Playwright overhead: ~100MB RAM
- Video recording: ~1MB per second
- Cursor smoothing: 60fps target
- Network wait conditions: configurable timeouts

## Future Enhancements

See project.md for MVP roadmap:
- MVP 2: Timeline editor
- MVP 3: STT/TTS integration
- MVP 4: Webcam support

Additional ideas:
- Export to various formats (GIF, WebM)
- Cloud storage integration
- Collaborative editing
- AI-generated narration
- Multi-language support
