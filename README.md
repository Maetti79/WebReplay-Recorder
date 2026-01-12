# WebReplay - Screen Recording with Deterministic Replay

A Loom-like screen recording tool that captures web interactions as semantic actions (not just pixels), allowing for reliable replay and editing before generating the final video.

## Overview

WebReplay consists of two main components:

1. **Browser Extension** - Records user interactions, audio, and generates editable storyboard files
2. **Replay Engine** - Replays storyboards using Playwright with cursor smoothing and video rendering

## Features

- ✅ Record clicks, typing, navigation, scrolling as semantic actions
- ✅ Robust element targeting with multiple fallback selectors
- ✅ Audio recording (microphone)
- ✅ **Webcam recording with PiP overlay**
- ✅ Editable storyboard JSON format
- ✅ Deterministic replay with Playwright
- ✅ Smooth cursor movement with easing
- ✅ Human-like typing simulation
- ✅ Video recording during replay
- ✅ **Visual timeline editor UI**
- ✅ **TTS integration (ElevenLabs)**
- ✅ **Multiple webcam overlay positions**

## Quick Start

### 1. Install Browser Extension

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `browser-extension` directory
5. The extension icon should appear in your toolbar

### 2. Configure & Record

1. Click the WebReplay extension icon
2. **Configure settings (optional):**
   - Toggle audio recording on/off
   - Toggle webcam recording on/off
   - Select webcam position (5 presets available)
   - Double-click webcam toggle for 3-second preview
3. Click "Start Recording"
4. Perform your actions on the webpage
5. Click "Stop Recording"
6. Click "Download" to save storyboard JSON, audio, and webcam files

**Note:** Settings are automatically saved for future recordings.

### 3. Set Up Replay Engine

```bash
cd replay-engine
npm install
```

This will install Playwright and required dependencies.

### 4. Replay Your Recording

```bash
cd replay-engine
node src/replay.js path/to/storyboard.json
```

With video recording:

```bash
node src/replay.js path/to/storyboard.json --record-video --video-dir=./output
```

## Architecture

### Browser Extension

**Files:**
- `manifest.json` - Extension configuration
- `scripts/content.js` - Captures user interactions on web pages
- `scripts/background.js` - Manages recording state and builds storyboards
- `ui/popup.html` & `ui/popup.js` - User interface for controlling recordings

**Key Features:**
- Captures semantic actions (not raw mouse coordinates)
- Generates robust element selectors with multiple fallbacks
- Records audio from microphone
- Exports storyboard JSON with timeline

### Replay Engine

**Files:**
- `src/replay.js` - Main replay engine using Playwright
- `src/index.js` - CLI interface
- `package.json` - Dependencies

**Key Features:**
- Deterministic replay using Playwright
- Smooth cursor movement with easing functions
- Human-like typing simulation
- Video recording via Playwright's built-in recorder
- Robust element resolution with fallback strategies

## Storyboard Format

The storyboard JSON format captures all interaction data:

```json
{
  "version": "1.0",
  "meta": {
    "title": "Demo Recording",
    "createdAt": "2026-01-09T20:00:00Z",
    "viewport": { "width": 1440, "height": 900 },
    "baseUrl": "https://example.com"
  },
  "settings": {
    "cursor": {
      "smooth": 0.85,
      "minMoveDurationMs": 120,
      "maxSpeedPxPerSec": 1600
    },
    "typing": {
      "charsPerSec": 12,
      "randomize": 0.15
    }
  },
  "timeline": [
    {
      "t": 0,
      "type": "navigate",
      "url": "https://example.com"
    },
    {
      "t": 1000,
      "type": "click",
      "target": {
        "selectors": ["#login-btn", "button[type='submit']"],
        "textHint": "Login"
      }
    },
    {
      "t": 1500,
      "type": "type",
      "target": {
        "selectors": ["input[name='email']"]
      },
      "text": "user@example.com"
    }
  ]
}
```

### Event Types

- `navigate` - Navigate to URL
- `click` - Click element
- `type` - Type text into element
- `keypress` - Press keyboard key
- `scroll` - Scroll to position
- `pause` - Wait for duration
- `upload` - Upload file to input

## Replay Engine Commands

### Replay a Storyboard

```bash
node src/replay.js storyboard.json [options]
```

Options:
- `--record-video` - Record video during replay
- `--video-dir=DIR` - Directory to save video (default: ./videos)
- `--assets-dir=DIR` - Directory containing upload files

### Validate a Storyboard

```bash
node src/index.js validate storyboard.json
```

### Show Storyboard Info

```bash
node src/index.js info storyboard.json
```

## Development Roadmap

### MVP 1 (✅ Complete)
- [x] Browser extension for recording
- [x] Capture clicks, typing, navigation
- [x] Audio recording
- [x] Storyboard JSON export
- [x] Playwright-based replay
- [x] Cursor smoothing
- [x] Video recording

### MVP 2 (Future)
- [ ] Timeline editor UI
- [ ] Adjust timing, pauses, typing speed
- [ ] Visual selector inspector
- [ ] Wait condition editor

### MVP 3 (Future)
- [ ] STT (Speech-to-Text) integration
- [ ] Text editing UI
- [ ] TTS (Text-to-Speech) with ElevenLabs
- [ ] Audio timeline alignment

### MVP 4 (Future)
- [ ] Webcam recording
- [ ] Picture-in-picture layout
- [ ] Multiple layout presets
- [ ] Redaction zones

## Tips for Better Recordings

1. **Add test IDs to your app** - Use `data-testid` attributes for rock-solid element targeting
2. **Avoid password fields** - Recordings capture typed values; use token-based auth for demos
3. **Keep actions deliberate** - Pause between major actions for cleaner recordings
4. **Test your selectors** - Validate storyboards before replay to catch selector issues

## Troubleshooting

### Extension Issues

**Recording won't start:**
- Check browser permissions
- Ensure you're on a web page (not chrome:// URLs)
- Check console for errors

**No events captured:**
- Verify content script is loaded (check console for "[Recorder] Content script loaded")
- Try reloading the page

### Replay Issues

**Element not found:**
- Selector may have changed
- Add more fallback selectors
- Use `data-testid` attributes

**Timing issues:**
- Adjust wait conditions in storyboard
- Add pause events between actions
- Increase timeout values

**Video not recording:**
- Ensure Playwright is installed (`npm install`)
- Check `--video-dir` path exists or can be created
- Verify disk space available

## Technical Details

### Element Selector Strategy

The extension generates multiple selectors for each element:

1. Stable attributes (`id`, `data-testid`, `name`, `aria-label`)
2. CSS path (limited depth)
3. Type-specific selectors (input type, placeholder)
4. Text content hints

The replay engine tries selectors in order until one succeeds.

### Cursor Smoothing

Cursor movement uses cubic easing with configurable:
- Maximum speed (pixels per second)
- Minimum duration (milliseconds)
- Smoothing factor (0-1)

### Typing Simulation

Typing uses character-by-character delays with:
- Configurable characters per second
- Random variance for natural feel
- Auto-paste for long text

## License

MIT

## Contributing

This is an MVP implementation. Contributions welcome for:
- Timeline editor UI
- Better selector generation
- STT/TTS integration
- Webcam support
- Bug fixes and improvements
