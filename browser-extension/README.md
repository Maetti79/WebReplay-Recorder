# WebReplay Recorder

A Chrome extension for recording, editing, and replaying web interactions with AI-powered voiceovers and professional video export.

## Features

### 🎬 Recording
- **Automatic Event Capture**: Records clicks, typing, hover, focus/blur, scrolling, keyboard shortcuts, and file uploads
- **Screen & Audio Recording**: Captures tab audio and optional webcam video
- **Robust Element Selectors**: Uses multiple fallback strategies (ID, data-testid, aria-label, CSS path, position)
- **Cross-Page Support**: Seamlessly tracks user actions across page navigations

### ✏️ Timeline Editor
- **Visual Timeline**: Drag-and-drop interface for editing recorded events
- **Event Management**: Add, edit, delete, and reorder events
- **Subtitle System**: Create and position subtitles (top/middle/bottom) with customizable styling
- **AI Voiceovers**: Generate natural-sounding voiceovers using ElevenLabs API
- **Audio/Video Sync**: Adjust timing offsets for perfect synchronization

### 🎥 Export Options

#### 1. Direct Video Export (NEW!)
Export video directly from browser - **no ffmpeg or screen capture required!**

**How it works:**
- Renders video on HTML5 canvas (no screenshots needed)
- Mixes audio tracks automatically (original + voiceovers)
- Burns subtitles directly into video frames
- Exports as WebM using MediaRecorder API
- **100% automated - just click and wait!**

**Features:**
- Quality presets: 1080p, 720p, 480p
- Visualizes events with icons and descriptions
- Professional gradient backgrounds
- Progress tracking with live preview
- Downloads automatically when complete
- Works within browser security (no special permissions)

**Usage:**
1. Click "Export" in editor
2. Select "1. Export as Video (MP4)"
3. Choose "1. Automated" (recommended)
4. Select quality preset
5. Wait for export to complete
6. Video downloads automatically

**What you'll see:**
- Elegant export window with progress bars
- Live canvas preview of video being rendered
- Real-time stats (events processed, video size, time elapsed)
- Automatic download when complete

#### 2. ZIP Package Export
Export a complete package containing:
- `timeline.json` - Full storyboard data
- `audio.webm` - Original tab audio
- `webcam.webm` - Webcam recording (if enabled)
- `voiceovers/` - All generated voiceover files
- `subtitles.srt` - Subtitles in SRT format
- `render.sh` / `render.bat` - Ready-to-run ffmpeg scripts
- `README.md` - Rendering instructions

**Use case**: Create professional videos manually using ffmpeg outside the browser.

#### 2. Replay in Tab
Replay recorded interactions directly on any website, bypassing iframe restrictions:
- No X-Frame-Options or CORS limitations
- Works on all websites (Google, Facebook, banking sites, etc.)
- Visual overlays: animated cursor, click markers, subtitles
- Survives page navigations with automatic script re-injection
- Real-time status indicator

**Use case**: Demonstrate workflows, test applications, create tutorials on live websites.

#### 3. Preview in Iframe
Quick preview of replays within the editor:
- Fast iteration for testing
- Works for most websites
- Displays warnings for blocked sites

## Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store](#) (link pending)
2. Click "Add to Chrome"
3. Follow the installation prompts

### From Source (Developer Mode)
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/browser-extension.git
   cd browser-extension
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top-right corner)

4. Click "Load unpacked" and select the `browser-extension` directory

5. The extension icon should appear in your toolbar

## Usage

### Recording a Session

1. Click the extension icon in your toolbar
2. Click "Start Recording"
3. Perform your actions on the webpage
4. Click "Stop Recording" when finished
5. The recording will appear in your recordings list

### Editing a Recording

1. Click "Edit" on any recording in the popup
2. The Timeline Editor opens with your recording
3. Edit events:
   - **Add Event**: Click "➕ Add Event" and select type
   - **Edit Event**: Click on any event in the timeline
   - **Delete Event**: Select event and click delete button
   - **Reorder**: Drag events to rearrange timing
4. Add subtitles:
   - Click "➕ Add Subtitle"
   - Enter text, duration, position, and styling
   - Optionally generate voiceover with ElevenLabs API
5. Adjust timing:
   - Use offset controls to sync audio/video
6. Save changes automatically

### Replaying a Recording

#### Option 1: Preview in Iframe
1. In the Timeline Editor, click "Preview"
2. Click "▶️ Start" to begin replay
3. Watch events execute in the embedded iframe
4. Use "⏹️ Stop" to halt playback

#### Option 2: Replay in Tab
1. In the Timeline Editor, click "Preview"
2. Click "🚀 Replay in Tab"
3. A new tab opens and replay begins automatically
4. Watch the visual overlays guide the replay
5. Replay continues across page navigations

### Exporting a Recording

1. In the Timeline Editor, click "Export"
2. Choose export option:
   - **Option 1**: Export as ZIP package (for manual rendering)
   - **Option 2**: [Future] Direct video export
3. For ZIP export:
   - Download the package
   - Extract files
   - Run `render.sh` (macOS/Linux) or `render.bat` (Windows)
   - Requires ffmpeg installed on your system

## Configuration

### ElevenLabs API (Optional)
To use AI voiceovers:
1. Sign up at [ElevenLabs](https://elevenlabs.io/)
2. Get your API key from the dashboard
3. In the Timeline Editor, click "Generate Voiceover"
4. Enter your API key when prompted
5. Key is stored securely in browser storage

### Recording Settings
- **Screen Recording**: Always enabled for tab content
- **Webcam**: Optional, toggle in recording interface
- **Audio**: Automatically captures tab audio

## Architecture

### File Structure
```
browser-extension/
├── manifest.json              # Extension manifest (V3)
├── scripts/
│   ├── background.js          # Service worker, manages recording state
│   ├── content.js             # Captures user interactions
│   └── replay.js              # Tab replay execution
├── ui/
│   ├── popup.html/js          # Extension popup interface
│   ├── editor.html/js         # Timeline editor
│   ├── preview.html/js        # Replay preview
│   └── modal.js               # Custom modal system
└── icons/                     # Extension icons
```

### Data Flow

**Recording:**
1. User clicks "Start Recording" in popup
2. Background script tracks recording state
3. Content script injected into active tab
4. Events captured and synced to background every 2s
5. MediaRecorder captures audio/video
6. On stop, data saved to IndexedDB

**Editing:**
1. Editor loads storyboard from chrome.storage.local
2. Audio/video loaded from IndexedDB
3. User edits timeline, subtitles, offsets
4. Changes auto-saved to storage
5. Voiceovers generated on-demand via API

**Replay (Tab):**
1. User clicks "Replay in Tab"
2. Preview page creates new tab with target URL
3. Background script tracks tab for navigations
4. Replay script injected once tab loads
5. Storyboard sent to tab via message passing
6. Replay executes with visual overlays
7. On navigation:
   - State saved to sessionStorage
   - Background re-injects script after page loads
   - Script auto-resumes from saved state

## Event Types

The extension captures and replays these interaction types:

| Event | Recording | Replay | Notes |
|-------|-----------|--------|-------|
| Click | ✅ | ✅ | Left, right, middle clicks |
| Type | ✅ | ✅ | Character-by-character with configurable speed |
| Hover | ✅ | ✅ | Debounced (200ms) to reduce noise |
| Focus | ✅ | ✅ | Element focus events |
| Blur | ✅ | ✅ | Element blur events |
| Scroll | ✅ | ✅ | Smooth scrolling |
| Keypress | ✅ | ✅ | With modifiers (Ctrl, Alt, Shift, Meta) |
| Navigate | ✅ | ✅ | Cross-page navigation with script persistence |
| Upload | ✅ | ✅ | Files stored as Base64, reconstructed on replay |

## Browser Compatibility

- **Chrome**: 88+ (Manifest V3 required)
- **Edge**: 88+ (Chromium-based)
- **Other browsers**: Not currently supported

## Permissions

The extension requires these permissions:

- `activeTab`: Interact with the current tab
- `tabCapture`: Record audio/video
- `storage`: Save recordings and settings
- `scripting`: Inject content scripts
- `tabs`: Create and manage tabs
- `downloads`: Export files
- `offscreen`: Background media processing
- `webNavigation`: Track page navigations
- `<all_urls>`: Record on any website

## Known Limitations

1. **Iframe Restrictions**: Iframe preview cannot access cross-origin content. Use "Replay in Tab" instead.
2. **Shadow DOM**: Elements inside closed shadow roots may not be accessible.
3. **Dynamic Selectors**: Highly dynamic sites (e.g., random class names) may have less reliable selectors.
4. **File Size**: Very large files in upload events may exceed storage limits.
5. **Voiceover Costs**: ElevenLabs API usage incurs costs based on your plan.

## Troubleshooting

### Recording Not Starting
- Check if content script is blocked by site policy
- Reload the page and try again
- Check browser console for errors

### Replay Not Working in Tab
- Ensure the target website is accessible (not chrome:// URLs)
- Check if JavaScript is enabled
- Look for errors in the browser console

### Export Fails
- Ensure sufficient disk space
- Check if downloads are blocked by browser settings
- Verify IndexedDB data is not corrupted

### Voiceover Generation Fails
- Verify API key is correct
- Check ElevenLabs account status and quota
- Ensure text length is within API limits

## Development

### Setup
1. Clone the repository and open in Chrome via `chrome://extensions/` in Developer mode
2. Click "Load unpacked" and select the project directory
3. Make changes to files - reload extension to see updates

### Project Structure
- `manifest.json` - Extension configuration (Manifest V3)
- `scripts/background.js` - Service worker managing recording/replay state
- `scripts/content.js` - Captures user interactions on pages
- `scripts/replay.js` - Executes replay directly in tabs
- `ui/` - HTML/JS for popup, editor, and preview interfaces
- `icons/` - Extension icons

### Debugging

**Access Consoles:**
- Background: `chrome://extensions/` → "service worker" link
- Content/Replay: DevTools (F12) on target page
- UI Pages: Right-click UI → "Inspect"

**Common Commands:**
```javascript
// Check recording state (background console)
console.log(currentRecording);

// Check storage
chrome.storage.local.get(null, console.log);

// Check replay state (page console during tab replay)
console.log(JSON.parse(sessionStorage.getItem('webReplayState')));
```

**Troubleshooting:**
- Recording not starting → Check page console for content script injection
- Replay not working → Try "Replay in Tab" instead of iframe
- Events not executing → Check element selectors in console
- Navigation breaks replay → Verify background script re-injection

## Privacy

- All data stored locally in browser (IndexedDB, chrome.storage.local)
- No data sent to external servers except:
  - ElevenLabs API (only when generating voiceovers)
- Recordings never leave your device unless you explicitly export them

## License

[Your License Here]

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/browser-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/browser-extension/discussions)
- **Email**: support@example.com

## Changelog

### v1.0.3 (Current - 2026-01-12)
- 🐛 **Fixed**: Automated video export not working (missing recordingId variable)
- ✨ **Improved UX**: "Render Video" button now directly exports video
- ✨ **Improved UX**: "Export ZIP" button simplified (no menu)
- 🎨 Updated button labels and tooltips for clarity

### v1.0.2 (2026-01-12)
- ✨ **Direct Video Export** - Export videos without ffmpeg! (Automated & Manual methods)
- ✨ **Speed Control** - Replay at 0.25x-8x speed (iframe & tab replay)
- ✨ Added "Replay in Tab" feature with navigation persistence
- ✨ Added fake cursor animation for visual feedback
- ✨ Added custom modal system replacing native alerts
- ✨ Implemented ZIP export with ffmpeg scripts
- ✨ Added hover, focus, blur event recording
- ✨ Added file upload recording and replay
- 🎨 Updated UI with Space Grotesk font and modern design
- 🐛 Fixed iframe cross-origin access handling
- 🐛 Fixed navigation handling in tab replay

### v1.0.1
- Initial release with basic recording and replay

---

Made with ❤️ by Dennis
