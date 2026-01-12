# Debug Media Recording Issue

## Steps to Debug:

### 1. Check Offscreen Document Console

The offscreen document runs in a separate context. To view its logs:

1. Open Chrome and go to `chrome://extensions`
2. Find "WebReplay" extension
3. Click "Inspect views: offscreen.html" (appears when recording is active)
4. Check the console for these logs:
   - `[Offscreen] Webcam data available: X bytes`
   - `[Offscreen] Audio data available: X bytes`
   - `[Offscreen] Audio recording stopped. Total chunks: X`
   - `[Offscreen] Audio blob size: X bytes`

### 2. Check Background Service Worker Console

1. In `chrome://extensions`
2. Click "Inspect views: service worker"
3. Look for:
   - `[Background] Media capture result:`
   - `[Background] Received audio/webcam data: X bytes`
   - `[Background] Audio blob created: X bytes`

### 3. Common Issues:

**Issue A: No ondataavailable events**
- Recording might be too short (< 1 second)
- Solution: Record for at least 2-3 seconds

**Issue B: Permissions not granted**
- Browser didn't allow camera/mic access
- Check for permission prompts

**Issue C: MediaRecorder not collecting data**
- Some browsers/codecs don't work with timeslice
- Try different approach

## Quick Test:

Record for at least 5 seconds and check if you see multiple "data available" logs.
