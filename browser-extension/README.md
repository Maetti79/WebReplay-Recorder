# WebReplay Recorder

A Chrome extension for recording, editing, and replaying web interactions with AI-powered voiceovers and professional video export.

## Features

### 🎬 Recording
- **Automatic Event Capture**: Records clicks, typing, hover, focus/blur, scrolling, keyboard shortcuts, and file uploads
- **Screen & Audio Recording**: Captures tab audio and optional webcam video
- **Robust Element Selectors**: Uses multiple fallback strategies (ID, data-testid, aria-label, CSS path, position)
- **Cross-Page Support**: Seamlessly tracks user actions across page navigations
- **Real-Time Side Panel**: Live event monitoring during recording with pause/resume controls
- **Native Resolution**: Records at actual screen resolution to prevent video blurring
- **Configurable Settings**: Toggle audio, webcam, and adjust webcam position before recording

### ✏️ Timeline Editor
- **Visual Timeline**: Drag-and-drop interface for editing recorded events
- **Event Management**: Add, edit, delete, and reorder events
- **Subtitle System**: Create and position subtitles (top/middle/bottom) with customizable styling
- **AI Voiceovers**: Generate natural-sounding voiceovers using ElevenLabs or OpenAI APIs
- **Audio/Video Sync**: Adjust timing offsets for perfect synchronization
- **API Key Management**: Built-in configuration dialog for OpenAI and ElevenLabs API keys
- **Project Import/Export**: Load recordings from JSON or ZIP files

### 🎥 Replay & Export Options

#### 1. Render Video (Recommended)
Record a high-quality video of your replay - **no ffmpeg required!**

- Opens side panel for recording control + replay tab
- Uses browser's screen capture at native resolution (no blurring!)
- **Supports page navigation during recording**
- Captures tab audio including voiceovers
- Automatically stops and downloads when replay completes
- Professional side panel with progress tracking

**How to use:**
1. Click "Render Video" in editor
2. Replay tab opens with side panel control
3. Click "Start Recording" in side panel
4. Select the **replay tab** in screen picker
5. **✅ Check "Share tab audio"** to include voiceovers
6. Recording starts automatically, replay begins
7. Video downloads when complete
8. Track progress in real-time via side panel

#### 2. Dry Run (Testing)
Test your replay without recording - perfect for debugging and fine-tuning.

- Opens replay tab without video recording
- Visual overlays: animated cursor, click markers, subtitles
- Supports page navigation with automatic script re-injection
- Real-time status indicator
- No video output - just for testing

**How to use:**
1. Click "Dry Run" in editor
2. Replay tab opens and execution begins
3. Watch events execute with visual feedback
4. Check console for debugging info

#### 3. ZIP Package Export (Advanced)
Export a complete package for manual video rendering with ffmpeg.

**Package contents:**
- `timeline.json` - Full storyboard data
- `audio.webm` - Original tab audio
- `webcam.webm` - Webcam recording (if enabled)
- `voiceovers/` - All generated voiceover files
- `subtitles.srt` - Subtitles in SRT format
- `render.sh` / `render.bat` - Ready-to-run ffmpeg scripts
- `README.md` - Rendering instructions

**How to use:**
1. Click "Export ZIP" in editor
2. Download and extract the package
3. Run `render.sh` (macOS/Linux) or `render.bat` (Windows)
4. Requires ffmpeg installed on your system

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
2. Configure settings (optional):
   - Toggle audio recording
   - Toggle webcam recording
   - Select webcam position
3. Click "Start Recording"
4. Side panel opens showing real-time event capture
5. Perform your actions on the webpage
6. Use pause/resume controls as needed
7. Click "Finish" when done
8. The recording will appear in your recordings list

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

### Testing & Exporting Recordings

#### Option 1: Dry Run (Test Only)
Perfect for testing your replay before recording video.

1. In the Timeline Editor, click "Dry Run"
2. Replay tab opens and execution begins automatically
3. Watch events execute with visual overlays
4. Check timing, event execution, and navigation
5. Tab closes automatically when complete

**Use case**: Test and debug your recording before creating the final video.

#### Option 2: Render Video (Final Export)
Record a professional video of your replay.

1. In the Timeline Editor, click "Render Video"
2. Replay tab opens with side panel control
3. Click "Start Recording" in side panel
4. Select the replay tab in screen picker
5. **✅ Check "Share tab audio"** to include voiceovers
6. Recording starts, replay begins automatically
7. Watch progress in side panel
8. Video downloads when complete
9. Tabs close after 3-second countdown

**Use case**: Create the final video for sharing, documentation, or tutorials.

### Quick Actions

The Timeline Editor provides three main action buttons:

1. **🎬 Render Video** - Record a video of your replay (recommended)
2. **🏃 Dry Run** - Test replay without recording video
3. **📦 Export ZIP** - Export package for manual ffmpeg rendering (advanced users)

Choose "Render Video" for the final output, "Dry Run" for testing, or "Export ZIP" if you need manual control over video rendering.

## Configuration

### API Keys (Optional)
To use AI voiceovers and speech-to-text:

**Configure via Settings:**
1. In the Timeline Editor, click the ⚙️ config button
2. Enter your API keys:
   - **OpenAI API Key**: For Whisper speech-to-text
   - **ElevenLabs API Key (TTS)**: For text-to-speech voiceovers
   - **ElevenLabs API Key (STT)**: For speech-to-text subtitles
3. Keys are stored securely in browser's localStorage

**Get API Keys:**
- OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- ElevenLabs: [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)

### Recording Settings
- **Audio**: Toggle microphone/tab audio recording
- **Webcam**: Optional webcam recording with preview
- **Webcam Position**: Bottom-right, bottom-left, top-right, top-left, or sidebar-right
- **Resolution**: Automatically uses native screen resolution for crisp videos

## Architecture

### File Structure
```
browser-extension/
├── manifest.json                    # Extension manifest (V3)
├── scripts/
│   ├── background.js                # Service worker, manages recording state
│   ├── content.js                   # Captures user interactions
│   └── replay.js                    # Tab replay execution
├── ui/
│   ├── popup.html/js                # Extension popup interface
│   ├── editor.html/js               # Timeline editor with API config
│   ├── sidepanel.html/js            # Video recording control panel
│   ├── recording-sidepanel.html/js  # Real-time event recording panel
│   └── modal.js                     # Custom modal/confirm system
├── offscreen.js                     # Media capture worker
└── icons/                           # Extension icons
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

**Replay with Video Export:**
1. User clicks "Render Video" in editor
2. Replay tab opens with target URL
3. Background script tracks tab for navigations
4. Replay script injected once tab loads
5. Storyboard sent to tab via message passing (voiceovers as base64)
6. User initiates screen capture via side panel
7. Replay executes with visual overlays
8. On navigation:
   - State saved to sessionStorage
   - Background re-injects script after page loads
   - Script auto-resumes from saved state

**Video Recording (Screen Capture):**
1. User clicks "Render Video" in editor
2. Two tabs open: recording control + replay tab
3. Recording control tab captures replay tab using getDisplayMedia()
4. User selects replay tab in screen picker + checks "Share tab audio"
5. MediaRecorder captures video + audio (including voiceovers)
6. Replay starts automatically in replay tab
7. On replay complete:
   - Message sent to recording control tab
   - Recording stops after 1 second delay
   - Video processed and downloaded via background script
   - Tabs auto-close after 3-second countdown
8. Base64 encoding used for voiceovers (Blob objects can't pass through Chrome messages)

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

1. **Shadow DOM**: Elements inside closed shadow roots may not be accessible.
2. **Dynamic Selectors**: Highly dynamic sites (e.g., random class names) may have less reliable selectors.
3. **File Size**: Very large files in upload events may exceed storage limits.
4. **API Costs**: ElevenLabs and OpenAI API usage incurs costs based on your plan.
5. **Chrome Message Passing**: Blob objects cannot be sent through Chrome's message passing API, requiring base64 encoding for voiceovers (handled automatically).
6. **Screen Capture**: Requires manual selection of the correct tab in the screen picker dialog.

## Troubleshooting

### Recording Not Starting
- Check if content script is blocked by site policy
- Reload the page and try again
- Check browser console for errors

### Replay Not Working
- Ensure the target website is accessible (not chrome:// URLs)
- Check if JavaScript is enabled
- Look for errors in the browser console
- Make sure you selected the correct tab in the screen picker

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
- `ui/` - HTML/JS for popup, editor, and side panel interfaces
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
- Replay not working → Check if correct tab was selected in screen picker
- Events not executing → Check element selectors in console
- Navigation breaks replay → Verify background script re-injection
- Video recording fails → Ensure "Share tab audio" is checked in screen picker

## Privacy

- All data stored locally in browser (IndexedDB, chrome.storage.local, localStorage)
- No data sent to external servers except:
  - OpenAI API (only when using Whisper speech-to-text)
  - ElevenLabs API (only when generating voiceovers or transcribing audio)
- API keys stored in localStorage (never transmitted except to respective APIs)
- Recordings never leave your device unless you explicitly export them

## License

[Your License Here]

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/browser-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/browser-extension/discussions)
- **Email**: support@example.com

## Changelog

### v1.0.5 (Current - 2026-01-13)
- 🎨 **NEW: Modern UI Design** - Complete redesign with clean white backgrounds
  - Professional Material Design-inspired color scheme
  - Consistent styling across all pages (popup, editor, sidepanels)
  - Improved readability with proper color contrast (#202124, #5f6368)
  - Smooth animations and transitions
  - Google-style buttons and form elements
- ✨ **NEW: Real-Time Recording Panel** - Side panel during event recording
  - Live event feed showing captured interactions with icons
  - Pause/Resume toggle for recording control
  - Live stats (event count, duration timer)
  - Finish button to complete recording
  - Elegant event list with animations
- ✨ **NEW: API Key Configuration** - Built-in settings dialog
  - ⚙️ Config button in editor toolbar
  - Manage OpenAI and ElevenLabs API keys
  - Secure localStorage storage
  - Helper links to get API keys
  - Password-protected input fields
- 🎥 **IMPROVED: Native Resolution Recording** - No more blurry videos!
  - Automatically detects actual window/screen dimensions
  - Dynamic bitrate calculation based on resolution
  - Records at true screen resolution (1920x1080, 2560x1440, etc.)
  - Removes fixed 720p constraint
- 🐛 **Fixed**: "No starting URL found" error in video rendering
  - Editor now checks both `meta.baseUrl` and `meta.url` fields
  - Better URL detection fallbacks
  - Clear error messages when URL missing
- 🐛 **Fixed**: Wrong sidepanel opening during video render
  - Explicitly sets correct sidepanel path before opening
  - Separates recording panel from playback panel
- 🐛 **Fixed**: White text on white background visibility issues
  - Updated all text colors for proper contrast
  - Dark gray text (#5f6368) for secondary content
  - Black text (#202124) for primary content
- 🎨 **UI Polish**: Added dark gray color for all `<p>` elements across all pages

### v1.0.4 (2026-01-13)
- ✨ **NEW: Two-Tab Screen Capture Recording** - Record replays with page navigation support
- 🐛 **Fixed**: Voiceover audio not playing during video recording
- ✨ **Improved**: Recording control UI with instructions and status updates

### v1.0.3 (2026-01-12)
- 🐛 **Fixed**: Automated video export not working (missing recordingId variable)
- ✨ **Improved UX**: "Render Video" button now directly exports video
- ✨ **Improved UX**: "Export ZIP" button simplified (no menu)
- 🎨 Updated button labels and tooltips for clarity

### v1.0.2 (2026-01-12)
- ✨ **Direct Video Export** - Export videos without ffmpeg using screen capture
- ✨ **Speed Control** - Replay at 0.25x-8x speed during video recording
- ✨ Added tab-based replay with navigation persistence
- ✨ Added animated cursor for visual feedback during replay
- ✨ Added custom modal system replacing native alerts
- ✨ Implemented ZIP export with ffmpeg scripts
- ✨ Added hover, focus, blur event recording
- ✨ Added file upload recording and replay
- 🎨 Updated UI with Space Grotesk font and modern design
- 🐛 Fixed navigation handling during replay

### v1.0.1
- Initial release with basic recording and replay

---

Made with ❤️ by Dennis
