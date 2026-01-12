# WebReplay Recorder - Complete Documentation

**Version:** 1.0.3
**Last Updated:** 2026-01-12
**Status:** Production Ready

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Features Overview](#features-overview)
3. [Installation](#installation)
4. [Usage Guide](#usage-guide)
5. [Speed Control](#speed-control)
6. [Technical Architecture](#technical-architecture)
7. [Development](#development)
8. [Troubleshooting](#troubleshooting)
9. [Changelog](#changelog)

---

## Quick Start

### Installation
1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `/Users/dennismittmann/Projects/browser-extension`

### Basic Workflow
1. **Record**: Click extension icon → "Start Recording" → perform actions → "Stop Recording"
2. **Edit**: Click "Edit" on recording → adjust timeline, add subtitles, generate voiceovers
3. **Replay**: Choose replay method:
   - **Preview (Iframe)**: Quick preview in editor
   - **Replay in Tab**: Full replay on actual website (works on ALL sites)
   - **Export (ZIP)**: Generate video manually with ffmpeg

---

## Features Overview

### Recording Capabilities
- ✅ **All Event Types**: Click, type, hover, focus, blur, scroll, keypress, file upload
- ✅ **Screen & Audio**: Captures tab audio and optional webcam
- ✅ **Cross-Page**: Tracks actions across navigation
- ✅ **Robust Selectors**: Multiple fallback strategies for element identification

### Editing Tools
- ✅ **Visual Timeline**: Drag-and-drop event management
- ✅ **Subtitle System**: Position subtitles with custom styling (top/middle/bottom)
- ✅ **AI Voiceovers**: ElevenLabs integration for natural-sounding narration
- ✅ **Timing Adjustment**: Sync audio/video with offset controls

### Replay Methods

#### 1. Iframe Preview (Fast)
- Quick iteration for testing
- Works for most websites
- Shows warnings for blocked sites

#### 2. Tab Replay (Universal)
- **Works on ALL websites** (no iframe restrictions)
- Visual overlays: animated cursor, click markers, subtitles
- Survives page navigations with automatic script re-injection
- **Speed control**: 0.25x - 8x playback speed
- Real-time status indicator

#### 3. Direct Video Export (NEW - Fully Automated!)
Export video directly in browser - **no screen capture or ffmpeg needed!**:

**Automated Mode** (Recommended):
- 100% automated canvas-based rendering
- No screen sharing permissions required
- Mixes audio tracks automatically (Web Audio API)
- Burns subtitles directly into video frames
- Quality presets: 1080p (8Mbps), 720p (5Mbps), 480p (2.5Mbps)
- Visualizes events with professional UI
- Progress tracking with live preview
- Downloads as WebM when complete
- Works within all browser security restrictions

**Manual Mode**:
- Uses browser screen capture API
- Opens preview window for recording
- You control start/stop
- Good for custom needs

#### 4. ZIP Export (Professional)
Package includes:
- `timeline.json` - Complete storyboard
- `audio.webm` - Original tab audio
- `webcam.webm` - Webcam recording
- `voiceovers/` - All generated voiceover files
- `subtitles.srt` - Standard subtitle format
- `render.sh` / `render.bat` - Ready-to-run ffmpeg scripts
- `README.md` - Rendering instructions

---

## Installation

### From Source
```bash
cd /Users/dennismittmann/Projects/browser-extension
# Load in Chrome via chrome://extensions/ → "Load unpacked"
```

### Verify Installation
- Extension icon appears in toolbar
- Click icon to open popup
- No console errors

---

## Usage Guide

### Recording

1. **Start Recording**:
   - Click extension icon
   - Click "Start Recording"
   - Tab will show recording indicator

2. **Perform Actions**:
   - Click buttons, links
   - Fill forms, type text
   - Upload files
   - Navigate pages
   - All interactions captured automatically

3. **Stop Recording**:
   - Click extension icon
   - Click "Stop Recording"
   - Recording saved to IndexedDB

### Editing

1. **Open Editor**:
   - Click "Edit" on any recording in popup
   - Timeline loads with all events

2. **Edit Events**:
   - **Add**: Click "➕ Add Event", select type
   - **Edit**: Click event in timeline to modify
   - **Delete**: Select event, click delete button
   - **Reorder**: Drag events to adjust timing

3. **Add Subtitles**:
   - Click "➕ Add Subtitle"
   - Enter text, duration (ms), position
   - Choose font size and color
   - Optional: Generate AI voiceover

4. **Generate Voiceover**:
   - Click "Generate Voiceover" on subtitle
   - Enter ElevenLabs API key (first time)
   - Choose voice
   - Generated audio auto-attached

5. **Adjust Timing**:
   - Use "Audio Offset" to sync original audio
   - Use "Webcam Offset" to sync video
   - All changes auto-saved

### Replay Options

#### Iframe Preview
1. Click "Preview" in editor
2. Adjust speed (0.25x - 8x) in sidebar
3. Click "▶️ Start"
4. Watch replay in embedded iframe
5. "⏹️ Stop" to halt

**Limitations**:
- Cross-origin sites may block iframe
- Some sites (Google, banks) show security warnings
- Use "Replay in Tab" for these sites

#### Tab Replay (Recommended)
1. Click "Preview" in editor
2. Select speed (0.25x - 8x)
3. Click "🚀 Replay in Tab"
4. New tab opens with target URL
5. Replay executes with visual overlays:
   - Animated cursor follows interactions
   - Click pulse animations
   - Subtitles with fade effects
   - Status indicator in top-right

**Advantages**:
- ✅ Works on ALL websites
- ✅ No cross-origin restrictions
- ✅ Survives page navigations
- ✅ Variable speed playback
- ✅ Professional visual feedback

#### Direct Video Export (Recommended!)
1. Click "Export" in editor
2. Choose "1. Export as Video (MP4)"
3. Select export method:
   - **Automated** (recommended): Fully automatic
   - **Manual**: Control recording yourself
4. Choose quality preset (1080p/720p/480p)
5. Wait for export to complete
6. Video downloads automatically

**Automated Mode**:
- Opens video renderer window
- Renders replay automatically
- Creates video with subtitles
- No user interaction needed

**Manual Mode**:
- Opens preview window
- Prompts for screen sharing permission
- Select the preview window
- Start replay manually
- Recording stops automatically

**No Requirements** - Works in any modern browser!

#### Export to ZIP
1. Click "Export" in editor
2. Choose "2. Export as ZIP"
3. Download `recording-export.zip`
4. Extract files
5. Run render script:
   ```bash
   # macOS/Linux
   chmod +x render.sh
   ./render.sh

   # Windows
   render.bat
   ```
6. Output: `final-video.mp4`

**Requirements**:
- ffmpeg installed and in PATH
- Sufficient disk space

---

## Speed Control

### Overview
Control replay speed from 0.25x (slower) to 8x (ultra fast) for both iframe and tab replay.

### How It Works
- Speed multiplier divides all event delays
- Example: 1000ms delay at 2x speed = 500ms
- Typing speed also affected by multiplier
- Subtitles display duration unchanged

### Available Speeds
- **0.25x**: Very slow (detailed demonstrations)
- **0.5x**: Slow (training/teaching)
- **1x**: Normal (default, real-time)
- **1.5x**: Fast (quick review)
- **2x**: Faster (efficient testing)
- **4x**: Very Fast (rapid testing)
- **8x**: Ultra Fast (smoke testing)

### Usage
1. Open Preview or prepare Tab Replay
2. Select speed from dropdown
3. Start replay
4. Speed persists across navigation (Tab Replay)

---

## Technical Architecture

### File Structure
```
browser-extension/
├── manifest.json          # Manifest V3 config
├── scripts/
│   ├── background.js      # Service worker (827 lines)
│   │   - Recording state management
│   │   - MediaRecorder coordination
│   │   - Replay tab tracking
│   │   - Navigation detection
│   ├── content.js         # Event capture (470 lines)
│   │   - Click, type, hover, focus, blur, scroll, keypress
│   │   - File upload handling
│   │   - Element selector generation
│   │   - Event syncing (every 2s)
│   └── replay.js          # Tab replay (720 lines)
│       - Visual overlay rendering
│       - Event execution
│       - State persistence (sessionStorage)
│       - Auto-resume after navigation
│       - Speed control
├── ui/
│   ├── popup.html/js      # Extension popup
│   ├── editor.html/js     # Timeline editor (2500+ lines)
│   ├── preview.html/js    # Replay preview (900+ lines)
│   └── modal.js           # Custom dialogs
└── icons/                 # 16, 48, 128px
```

### Data Flow

**Recording:**
```
User Action
  ↓
content.js captures event
  ↓
Generates selectors (ID, data-testid, aria-label, CSS path, position)
  ↓
Syncs to background.js (every 2s)
  ↓
On navigation: re-injects content script
  ↓
On stop: saves to IndexedDB + chrome.storage
```

**Tab Replay:**
```
User clicks "Replay in Tab"
  ↓
preview.js creates tab with speed parameter
  ↓
background.js registers tab for tracking
  ↓
replay.js injected on page load
  ↓
Storyboard + speed sent to tab
  ↓
Events execute with speed multiplier applied
  ↓
On navigation:
  - State saved to sessionStorage (includes speed)
  - background.js detects via webNavigation
  - replay.js re-injected
  - Auto-resumes from saved state
```

### Storage

**chrome.storage.local** (5MB):
- Recording metadata
- Timeline JSON
- Settings (API keys)

**IndexedDB** (unlimited):
- Audio blobs (webm)
- Webcam blobs (webm)
- Voiceover blobs (webm)

**sessionStorage** (tab-scoped):
- Active replay state
- Current event index
- Replay speed
- Used for persistence across navigations

### Permissions
- `activeTab` - Interact with current tab
- `tabCapture` - Record audio/video
- `storage` - Save recordings
- `scripting` - Inject content scripts
- `tabs` - Create and manage tabs
- `downloads` - Export files
- `offscreen` - Background media processing
- `webNavigation` - Track navigations
- `<all_urls>` - Record on any website

---

## Development

### Setup
```bash
cd /Users/dennismittmann/Projects/browser-extension
# Edit files - reload extension to see changes
```

### Debug Consoles
| Component | Access | Prefix |
|-----------|--------|--------|
| Background | chrome://extensions/ → "service worker" | `[Background]` |
| Content | F12 on page | `[Recorder]` |
| Replay | F12 on replay tab | `[Replay]` |
| Editor | Right-click editor → "Inspect" | `[Editor]` |
| Preview | Right-click preview → "Inspect" | `[Preview]` |

### Common Commands
```javascript
// Background console - check recording
console.log(currentRecording);

// Background console - check replay tabs
console.log(replayTabs);

// Page console - check replay state
console.log(JSON.parse(sessionStorage.getItem('webReplayState')));

// Any console - check storage
chrome.storage.local.get(null, console.log);
```

### Event Schema
```javascript
{
  t: number,              // Timestamp (ms)
  type: string,           // Event type
  target: {               // Element info
    selectors: string[],  // Fallback selectors
    tag: string,
    textHint: string
  },
  position: {x, y},       // Mouse position
  text: string,           // For 'type' events
  url: string,            // For 'navigate' events
  key: string,            // For 'keypress' events
  files: []               // For 'upload' events
}
```

---

## Troubleshooting

### Recording Not Starting
**Symptoms**: No `[Recorder]` logs in console

**Solutions**:
- Reload page and try again
- Check if site blocks extensions
- Verify manifest content_scripts config
- Not all sites allow content scripts (chrome:// URLs)

### Replay Doesn't Work (Iframe)
**Symptoms**: CORS warnings, blank iframe

**Solutions**:
- This is expected for some sites (X-Frame-Options blocking)
- Use "Replay in Tab" instead
- Check for errors in preview console

### Replay Stops After Navigation
**Symptoms**: Tab replay halts on first page change

**Solutions**:
- Check if background navigation listener is working
- Verify sessionStorage has saved state
- Look for script injection errors in background console
- This should work automatically - file a bug if not

### Events Don't Execute
**Symptoms**: Replay runs but nothing happens

**Solutions**:
- Check element selectors in console
- Verify target elements exist on page
- Increase wait times for dynamic content
- Use position-based fallback

### Speed Control Not Working
**Symptoms**: Speed changes don't affect replay

**Solutions**:
- Ensure speed is selected before starting replay
- Check if `replaySpeed` variable is set correctly
- Verify console shows correct speed in status
- Try reloading extension

---

## Changelog

### v1.0.3 (Current - 2026-01-12)
- 🐛 **Fixed**: Automated video export not working (missing recordingId variable)
- ✨ **Improved UX**: "Render Video" button now directly exports video
- ✨ **Improved UX**: "Export ZIP" button simplified (no menu, direct export)
- 🎨 **Updated**: Button labels and tooltips for better clarity

### v1.0.2 (2026-01-12)
- ✨ **Direct Video Export**: Export videos without ffmpeg! Automated & manual modes
  - Automated: Fully automatic rendering and export
  - Manual: Screen capture with user control
  - Quality presets: 1080p, 720p, 480p
  - No external tools required
- ✨ **Speed Control**: Added 0.25x - 8x replay speed (iframe & tab)
- ✨ **Tab Replay**: Replay on any website, survives navigation
- ✨ **Fake Cursor**: Animated cursor shows interaction points
- ✨ **Custom Modals**: Replaced native alerts with styled dialogs
- ✨ **ZIP Export**: Package with ffmpeg scripts for manual rendering
- ✨ **Hover/Focus/Blur**: Added event recording and replay
- ✨ **File Uploads**: Record and replay file uploads with Base64 storage
- 🎨 **Design Update**: Space Grotesk font, white/blue theme
- 🐛 **Fixed**: Cross-origin iframe handling
- 🐛 **Fixed**: Navigation persistence in tab replay
- 🐛 **Fixed**: Replay script re-injection after navigation

### v1.0.1
- Initial release with basic recording and replay

---

## Project Structure

```
/Users/dennismittmann/Projects/
├── browser-extension/       # Main extension code
│   ├── manifest.json
│   ├── scripts/
│   │   ├── background.js
│   │   ├── content.js
│   │   └── replay.js
│   ├── ui/
│   │   ├── popup.html/js
│   │   ├── editor.html/js
│   │   ├── preview.html/js
│   │   └── modal.js
│   ├── icons/
│   └── README.md           # User-facing documentation
└── DOCS.md                 # This file - comprehensive docs
```

---

## Support & Contributing

### Issues
Report bugs and feature requests on GitHub.

### Development
1. Fork repository
2. Create feature branch
3. Make changes with clear commits
4. Test thoroughly
5. Submit pull request

### Code Style
- camelCase for variables
- Descriptive comments
- Always prefix logs with component name
- Never silently swallow errors

---

**Made with ❤️ by Dennis**

Last updated: 2026-01-12
