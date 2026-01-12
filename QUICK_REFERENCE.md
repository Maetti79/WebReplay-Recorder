# WebReplay Quick Reference Card

One-page reference for all commands and features.

## 🎬 Extension Controls

### Recording Settings
```
🎤 Audio Toggle       - Click to enable/disable mic
📹 Webcam Toggle      - Click to enable/disable camera
                      - Double-click for 3-sec preview
📍 Position Selector  - Choose webcam placement
```

### Recording Modes
```
Full:        Audio ✓  Webcam ✓
Voiceover:   Audio ✓  Webcam ✗
Silent Face: Audio ✗  Webcam ✓
Screen Only: Audio ✗  Webcam ✗
```

## ⌨️ Commands

### Replay Engine

**Basic Replay:**
```bash
node src/replay.js storyboard.json
```

**With Video Recording:**
```bash
node src/replay.js storyboard.json --record-video
```

**With Webcam Overlay:**
```bash
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm \
  --webcam-position=bottom-right
```

**All Options:**
```bash
node src/replay.js storyboard.json \
  --record-video \
  --video-dir=./output \
  --webcam=webcam.webm \
  --webcam-position=top-left \
  --assets-dir=./assets
```

### TTS (ElevenLabs)

**List Voices:**
```bash
node src/tts.js voices
```

**Generate Audio:**
```bash
node src/tts.js generate "Text here" output.mp3
```

**Auto-Generate Narration:**
```bash
node src/tts.js narrate storyboard.json
```

**From Custom Script:**
```bash
node src/tts.js script narration.json
```

### Validation Tools

**Validate Storyboard:**
```bash
node src/index.js validate storyboard.json
```

**Show Info:**
```bash
node src/index.js info storyboard.json
```

**Help:**
```bash
node src/index.js help
```

## 📍 Webcam Positions

| Position | Size | Location |
|----------|------|----------|
| `bottom-right` | 25% | Bottom right corner (default) |
| `bottom-left` | 25% | Bottom left corner |
| `top-right` | 20% | Top right corner |
| `top-left` | 20% | Top left corner |
| `sidebar-right` | 30% | Full height right sidebar |

## 🗂️ File Structure

### Extension Downloads
```
storyboard_XXXXX.json    - Timeline & events
recording_XXXXX.webm     - Audio (if enabled)
webcam_XXXXX.webm        - Webcam (if enabled)
```

### After Narration
```
storyboard_with_narration.json   - Updated storyboard
narration/
  ├── segment_0.mp3
  ├── segment_1.mp3
  └── manifest.json
```

### After Video Replay
```
videos/
  └── XXXXX.webm         - Final video
```

## 🔧 Storyboard JSON Format

```json
{
  "version": "1.0",
  "meta": {
    "title": "Recording Title",
    "viewport": { "width": 1440, "height": 900 }
  },
  "settings": {
    "cursor": { "smooth": 0.85 },
    "typing": { "charsPerSec": 12 },
    "webcam": {
      "enabled": true,
      "position": "bottom-right"
    }
  },
  "timeline": [
    { "t": 0, "type": "navigate", "url": "..." },
    { "t": 1000, "type": "click", "target": {...} },
    { "t": 2000, "type": "type", "text": "..." }
  ],
  "audioTrack": [...]
}
```

## 🎯 Common Workflows

### 1. Quick Screen Recording
```bash
# Configure: Audio ✗ Webcam ✗
# Record → Download → Replay
node src/replay.js storyboard.json --record-video
```

### 2. Tutorial Video
```bash
# Configure: Audio ✓ Webcam ✓ Position: Bottom Right
# Record → Download → Replay with webcam
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm
```

### 3. Professional Demo
```bash
# Record with audio+webcam
# Edit in timeline editor
# Generate narration
node src/tts.js narrate storyboard.json
# Final replay
node src/replay.js storyboard_with_narration.json \
  --record-video \
  --webcam=webcam.webm \
  --assets-dir=./narration
```

### 4. Bug Report
```bash
# Configure: Audio ✗ Webcam ✗
# Record bug reproduction
# Replay and share video
node src/replay.js storyboard.json --record-video
```

## 🎨 Timeline Editor

**Open:**
```bash
open browser-extension/ui/editor.html
```

**Features:**
- Load storyboard JSON
- Drag events to adjust timing
- Edit properties (timing, speed, text)
- Delete events
- Play/pause preview
- Zoom timeline
- Save edited version

**Keyboard:**
- `Space` - Play/Pause
- `Delete` - Delete selected event

## 🔑 Environment Variables

**ElevenLabs API Key:**
```bash
export ELEVENLABS_API_KEY="sk_..."
```

Already configured in `src/tts.js` for this project.

## 🎤 Popular TTS Voices

```
Sarah:  EXAVITQu4vr4xnSDxMaL  (Expressive, professional)
Adam:   pNInz6obpgDQGcFmaJgB  (Deep, authoritative)
Rachel: 21m00Tcm4TlvDq8ikWAM  (Clear, friendly)
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Recording won't start | Reload extension, check permissions |
| Webcam not recording | Enable in settings, grant permissions |
| TTS fails | Check API key, account balance |
| Replay selector fails | Add data-testid attributes |
| Download fails | Reload extension (service worker restart) |
| Video not saving | Check --video-dir path exists |

## 📊 Performance Tips

**Recording:**
- Shorter sessions = smaller files
- Disable webcam if not needed
- Close unnecessary tabs

**Replay:**
- Use headless mode for faster processing
- Limit video resolution for smaller files
- Use --record-video only when needed

**TTS:**
- Batch multiple segments
- Keep text concise
- Monitor API costs

## 🔗 File Locations

```
browser-extension/
  ├── manifest.json           # Extension config
  ├── scripts/
  │   ├── content.js          # Event capture
  │   └── background.js       # Recording logic
  └── ui/
      ├── popup.html          # Main UI
      ├── popup.js            # Settings controller
      └── editor.html         # Timeline editor

replay-engine/
  ├── src/
  │   ├── replay.js           # Main replay engine
  │   ├── tts.js              # TTS CLI
  │   └── index.js            # Validation tools
  └── lib/
      ├── webcam-overlay.js   # PiP positioning
      └── tts-service.js      # ElevenLabs API

examples/
  ├── test-page.html          # Test form
  └── example-storyboard.json # Sample recording
```

## 📚 Documentation

```
README.md              - Main documentation
QUICKSTART.md          - 5-minute setup
NEW_FEATURES.md        - Feature overview
WEBCAM_CONFIG.md       - Configuration guide
TESTING_GUIDE.md       - Complete test suite
STRUCTURE.md           - Architecture details
```

## 💡 Tips & Tricks

**Extension:**
- Double-click webcam toggle for preview
- Settings auto-save, no need to click save
- Recordings persist even if popup closes

**Replay:**
- Add pauses in timeline editor for better pacing
- Use slower typing speeds for clarity
- Test selectors with validate command first

**TTS:**
- Edit generated text before converting
- Use different voices for different speakers
- Align narration pauses with actions

**Video:**
- Record at 1920x1080 for best quality
- Use bottom corners for less intrusion
- Test webcam lighting before recording

---

## 🚀 Quick Start (30 seconds)

```bash
# 1. Install extension (chrome://extensions/ → Load unpacked)
# 2. Install dependencies
cd replay-engine && npm install

# 3. Record
# Open test page → Click extension → Start Recording → Perform actions → Stop

# 4. Replay
node src/replay.js ~/Downloads/storyboard_*.json

# Done! 🎉
```

---

**Print this page for quick reference! 📄**
