# Webcam Configuration Guide

The browser extension now includes a full configuration UI for controlling webcam and audio recording settings.

## Features

### 📹 Webcam Toggle
- Enable/disable webcam recording
- Toggle on by default
- Double-click to preview webcam (3 second preview)

### 🎤 Audio Toggle
- Enable/disable audio recording
- Toggle on by default
- Independent of webcam setting

### 📍 Webcam Position
- Choose where webcam appears in final video
- **5 position presets:**
  - Bottom Right (default) - 25% width, bottom-right corner
  - Bottom Left - 25% width, bottom-left corner
  - Top Right - 20% width, top-right corner
  - Top Left - 20% width, top-left corner
  - Sidebar Right - 30% width, full-height sidebar
- Position is saved with the recording

## How to Use

### 1. Open Extension Popup

Click the WebReplay extension icon in your browser toolbar.

### 2. Configure Settings

Before recording, toggle the settings:

- **Audio** - Click the audio toggle to enable/disable microphone
- **Webcam** - Click the webcam toggle to enable/disable camera
- **Position** - Select webcam position from dropdown (only enabled when webcam is on)

**Settings are automatically saved** and will be remembered for future recordings.

### 3. Preview Webcam (Optional)

Double-click the webcam toggle to see a 3-second preview of your camera. This helps you:
- Check camera is working
- Adjust your position
- Verify lighting

### 4. Start Recording

Click "Start Recording" - the button text changes based on settings:
- **"Start Recording"** - Audio and/or webcam enabled
- **"Start Recording (Screen Only)"** - Both audio and webcam disabled

### 5. Record Your Session

Perform your actions. The extension captures:
- Screen interactions (always)
- Audio (if enabled)
- Webcam (if enabled)

### 6. Download Files

After stopping, click "Download" to get:
- `storyboard_*.json` - Timeline and metadata (includes webcam position)
- `recording_*.webm` - Audio file (if recorded)
- `webcam_*.webm` - Webcam video (if recorded)

## Replay with Configured Position

When replaying, the webcam position from your recording is automatically used:

```bash
# Uses position saved in storyboard
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm
```

Or override the position:

```bash
# Force different position
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm \
  --webcam-position=top-left
```

## Settings Persistence

Your settings are saved in Chrome storage and persist across:
- Browser sessions
- Extension reloads
- Page navigations

To reset settings to defaults:
1. Open extension popup
2. Toggle all settings to desired state
3. Settings save automatically

## Recording Scenarios

### Scenario 1: Full Featured Recording
**Settings:** Audio ✓ | Webcam ✓ | Position: Bottom Right

**Result:** Screen + audio narration + webcam in corner

**Use case:** Tutorial videos, product demos

### Scenario 2: Audio Commentary Only
**Settings:** Audio ✓ | Webcam ✗

**Result:** Screen + audio narration

**Use case:** Screen recordings with voiceover, privacy-focused demos

### Scenario 3: Silent with Webcam
**Settings:** Audio ✗ | Webcam ✓ | Position: Sidebar Right

**Result:** Screen + webcam (no audio)

**Use case:** Silent demonstrations, sign language videos

### Scenario 4: Screen Only
**Settings:** Audio ✗ | Webcam ✗

**Result:** Screen interactions only

**Use case:** Bug reports, documentation, automated testing

## UI Guide

### Extension Popup Layout

```
┌─────────────────────────┐
│ WebReplay Recorder      │
├─────────────────────────┤
│ ● Ready to record       │
├─────────────────────────┤
│ Recording Settings      │
│                         │
│ 🎤 Audio        [✓]     │
│ 📹 Webcam       [✓]     │
│ 📍 Position   [Bottom ▼]│
├─────────────────────────┤
│ [Start Recording]       │
├─────────────────────────┤
│ Recent Recordings       │
│ • recording_123... [DL] │
└─────────────────────────┘
```

### Toggle States

**Enabled (Blue):**
```
[====●] ← Toggle is on
```

**Disabled (Gray):**
```
[●====] ← Toggle is off
```

### Position Dropdown

```
┌──────────────────┐
│ Bottom Right  ✓  │ ← Current selection
│ Bottom Left      │
│ Top Right        │
│ Top Left         │
│ Sidebar Right    │
└──────────────────┘
```

## Advanced Usage

### Keyboard Shortcuts

Currently, there are no keyboard shortcuts. Interact via mouse/touch.

### Webcam Preview

**How to trigger:**
1. Ensure webcam toggle is enabled
2. Double-click the webcam toggle
3. Preview appears for 3 seconds
4. Camera automatically stops

**Preview features:**
- Real-time video feed
- Auto-stop after 3 seconds
- Uses same resolution as recording (640x480)

### Permission Handling

**First time recording:**
- Browser will request microphone permission (if audio enabled)
- Browser will request camera permission (if webcam enabled)

**Permission denied:**
- Extension gracefully falls back
- Audio disabled → Screen + webcam only
- Webcam disabled → Screen + audio only
- Both denied → Screen interactions only

**Re-granting permissions:**
1. Click the 🔒 icon in browser address bar
2. Reset permissions
3. Reload page
4. Try recording again

## Troubleshooting

### Webcam Toggle Not Working

**Problem:** Toggle doesn't respond
**Solution:** Reload extension
```
1. Go to chrome://extensions/
2. Find WebReplay Recorder
3. Click refresh icon
4. Reopen popup
```

### Settings Not Saving

**Problem:** Settings reset after closing popup
**Solution:** Check chrome.storage permissions
```
1. Go to chrome://extensions/
2. Click "Details" on WebReplay
3. Verify "Storage" permission is granted
4. Reload extension if needed
```

### Webcam Preview Shows Nothing

**Problem:** Preview window is black
**Solution:**
- Check camera is not in use by another app
- Verify camera permission granted
- Try closing other apps using camera
- Check camera privacy settings in OS

### Position Setting Not Applied

**Problem:** Replay uses wrong position
**Solution:**
- Verify storyboard.json contains webcam.position
- Check file was downloaded after configuration
- Try explicit --webcam-position flag

### Download Missing Files

**Problem:** Only JSON downloaded, no audio/webcam
**Solution:**
- Refresh extension (service worker may have restarted)
- Check IndexedDB in DevTools
- Try recording again with shorter session

## Best Practices

### 1. Test Before Important Recordings

Do a quick 10-second test recording to verify:
- Audio is clear
- Webcam is positioned correctly
- Lighting is good
- Camera angle is right

### 2. Choose Appropriate Settings

**High-quality demos:**
- Enable all (audio + webcam)
- Use bottom-right or bottom-left position
- Test audio levels first

**Documentation/bugs:**
- Disable webcam
- Keep audio for narration
- Or disable both for silent screen capture

**Training videos:**
- Enable webcam
- Use sidebar for more presence
- Ensure good lighting

### 3. Stable Camera Position

If using webcam:
- Secure your device/camera
- Avoid moving during recording
- Consistent background if possible

### 4. Audio Quality

- Use external microphone if possible
- Quiet environment
- Test levels before long recording

### 5. Position Selection

- **Bottom corners:** Less intrusive, industry standard
- **Top corners:** Keep bottom UI visible
- **Sidebar:** More presence, reduces screen real estate

## Technical Details

### Storage Location

Settings stored in `chrome.storage.local`:
```json
{
  "recordingSettings": {
    "audioEnabled": true,
    "webcamEnabled": true,
    "webcamPosition": "bottom-right"
  }
}
```

### Storyboard Format

Webcam configuration in JSON:
```json
{
  "settings": {
    "webcam": {
      "enabled": true,
      "position": "bottom-right"
    }
  },
  "assets": {
    "webcamMp4": "video/webcam.webm"
  }
}
```

### Recording Constraints

**Audio:**
```javascript
{
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
}
```

**Webcam:**
```javascript
{
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user'
  }
}
```

## Examples

### Example 1: Product Demo with Face

```bash
# 1. Configure in popup
Audio: ON
Webcam: ON
Position: Bottom Right

# 2. Record demo
# 3. Download files

# 4. Replay
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm
```

**Result:** Professional product demo with your face in corner

### Example 2: Bug Report (Screen Only)

```bash
# 1. Configure in popup
Audio: OFF
Webcam: OFF

# 2. Record bug
# 3. Download storyboard.json

# 4. Replay
node src/replay.js storyboard.json --record-video
```

**Result:** Clean screen recording showing the bug

### Example 3: Training Video (Sidebar)

```bash
# 1. Configure in popup
Audio: ON
Webcam: ON
Position: Sidebar Right

# 2. Record tutorial
# 3. Download files

# 4. Replay
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm
```

**Result:** Instructor in sidebar, content on main screen

## FAQ

**Q: Can I change position after recording?**
A: Yes! Either:
- Edit `settings.webcam.position` in storyboard.json
- Use `--webcam-position=X` flag during replay

**Q: Does position affect recording?**
A: No, position only affects replay. Recording captures raw webcam feed.

**Q: Can I use custom positions?**
A: Yes, edit `/replay-engine/lib/webcam-overlay.js` to add custom presets.

**Q: What if I lose the popup during recording?**
A: Recording continues. Click extension icon to reopen and stop.

**Q: Can I record without the extension popup?**
A: No, you must use the popup to start/stop recordings.

**Q: Are settings synced across devices?**
A: No, settings are local to each browser installation.

## Support

For issues or questions:
- Check main README.md
- Review NEW_FEATURES.md
- Open issue on GitHub

---

**Happy recording with full control over your webcam! 📹**
