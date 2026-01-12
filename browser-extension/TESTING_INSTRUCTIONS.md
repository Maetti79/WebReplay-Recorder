# Testing Instructions for Media Recording Fix

## What Was Fixed:

### 1. Scope Issue (CRITICAL)
- **Problem**: Audio/webcam chunks arrays were local variables, getting garbage collected
- **Fix**: Moved to module scope in offscreen.js

### 2. Buffered Data Loss
- **Problem**: Short recordings had no time to collect data
- **Fix**: Added `requestData()` before stopping to flush buffers

### 3. Race Condition
- **Problem**: Media data arrived after recording was finalized (500ms timeout)
- **Fix**: Increased timeout to 2000ms and added comprehensive logging

### 4. Enhanced Logging
- Added detailed logs at every step to track data flow

## How to Test:

1. **Reload the Extension**
   ```
   - Go to chrome://extensions
   - Click the refresh icon on "WebReplay"
   - This loads all the fixes
   ```

2. **Open Two Console Windows**
   
   **Service Worker Console:**
   - In chrome://extensions
   - Click "Inspect views: service worker"
   
   **Offscreen Console (appears during recording):**
   - Start a recording
   - In chrome://extensions, click "Inspect views: offscreen.html"

3. **Make a Test Recording**
   - Record for at least 3-5 seconds
   - Speak into mic and look at webcam
   - Stop recording

4. **Check Logs**
   
   **Offscreen console should show:**
   ```
   [Offscreen] Audio data available: XXXX bytes (multiple times)
   [Offscreen] Webcam data available: XXXX bytes (multiple times)
   [Offscreen] Audio recording stopped. Total chunks: X
   [Offscreen] Audio blob size: XXXXX bytes
   [Offscreen] Sending audio data to background: XXXXX bytes
   ```

   **Service worker console should show:**
   ```
   [Background] ✅ Received audio data: XXXXX bytes
   [Background] Created audio blob: XXXXX bytes
   [Background] Audio chunks updated, length: 1
   [Background] Checking media chunks - Audio: 1, Webcam: 1
   [Background] Audio blob created: XXXXX bytes
   ```

5. **Download and Check Files**
   - Click download
   - Check file sizes:
     - `recording_*.webm` should be > 10KB (not 15 bytes!)
     - `webcam_*.webm` should be > 10KB

## Expected Results:

✅ Audio file: Multiple KB (depends on recording length)
✅ Webcam file: Multiple KB (depends on recording length)
✅ Both files should be playable

## If Still Not Working:

Send me the console output from both windows, especially:
- How many "data available" events fired
- The blob sizes shown
- Any error messages
