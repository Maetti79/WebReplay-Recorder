# Debug Checklist for Media Recording

## Quick Test Steps:

### 1. Open Test Page
1. Open `test-media-recording.html` in Chrome
2. Click through each test in order
3. Watch console logs

### 2. Manual Test with Extension
1. Reload extension (chrome://extensions)
2. Open any webpage
3. Click extension icon
4. Click "Start Recording"
5. **Wait 5+ seconds** (important!)
6. Click "Stop Recording"
7. Click download buttons

### 3. Check Consoles (Critical!)

**Service Worker Console:**
1. Go to chrome://extensions
2. Click "Inspect views: service worker"
3. Look for these logs during recording:
   ```
   [Background] Recording started for tab: X
   [Background] ✅ Audio recording started
   [Background] ✅ Webcam recording started
   ```

**Offscreen Console:**
1. During recording, go to chrome://extensions
2. Click "Inspect views: offscreen.html" (only appears when recording!)
3. Look for these logs:
   ```
   [Offscreen] Audio chunk received: XXXX bytes - writing to IndexedDB
   [Offscreen] ✅ Audio chunk saved to IndexedDB
   [Offscreen] Webcam chunk received: XXXX bytes - writing to IndexedDB
   [Offscreen] ✅ Webcam chunk saved to IndexedDB
   ```
   Should see these every ~1 second!

**After Stopping:**
```
[Offscreen] Audio recording stopped. Total chunks: X
[Background] Requesting media chunks from offscreen document...
[Background] Media chunks result: { audioSize: XXXXX, webcamSize: XXXXX }
[Background] ✅ Audio blob created: XXXXX bytes
```

### 4. Check IndexedDB Directly

**During Recording:**
1. Open offscreen.html console
2. Go to Application tab → IndexedDB → WebReplayOffscreenDB
3. Expand audioChunks - should see entries being added in real-time!
4. Click on an entry to see chunk size

**After Recording:**
1. Check WebReplayDB → audioRecordings
2. Should see final blobs stored

## Common Issues:

### Issue: No offscreen.html in chrome://extensions
**Cause:** Recording hasn't started or offscreen doc failed to create
**Fix:** Check service worker console for errors

### Issue: No "data available" logs
**Cause:** MediaRecorder not starting or permissions denied
**Fix:** 
- Check if permissions were granted (look for browser permission prompts)
- Check offscreen console for getUserMedia errors

### Issue: Chunks saved but final blob is 15 bytes
**Cause:** Race condition - blobs created before chunks retrieved
**Fix:** This should be fixed now with 1000ms delay, but check timing

### Issue: No chunks in IndexedDB
**Cause:** 
- Recording too short (< 1 second)
- Offscreen document not created
- IndexedDB save failing

**Fix:**
- Record for at least 3 seconds
- Check offscreen console for errors
- Check browser console for IndexedDB quota errors

## What Should Happen (Timeline):

```
T+0s:   Click "Start Recording"
        → Background creates offscreen document
        → Offscreen requests getUserMedia
        → Browser shows permission prompt (first time)
        → MediaRecorder starts

T+1s:   First ondataavailable event
        → Chunk saved to IndexedDB
        → Log: "Audio chunk received"

T+2s:   Second ondataavailable event
        → Another chunk saved
        
T+3s:   Third ondataavailable event
        → Another chunk saved

T+5s:   Click "Stop Recording"
        → requestData() called (flushes buffer)
        → stop() called
        → onstop fires
        → Background requests chunks (1000ms delay)
        → All chunks retrieved from IndexedDB
        → Combined into blobs
        → Saved to background IndexedDB

T+7s:   Recording ready for download
```

## Test Command Sequence:

```javascript
// In test-media-recording.html console:

// 1. Test extension
await chrome.runtime.sendMessage({ type: 'GET_STATUS' })

// 2. Start recording
await chrome.runtime.sendMessage({ 
  type: 'START_RECORDING',
  settings: { audioEnabled: true, webcamEnabled: true }
})

// 3. Wait 5 seconds...

// 4. Stop recording
await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' })

// 5. Wait 2 seconds for finalization...

// 6. Check if data exists
const response = await chrome.runtime.sendMessage({
  type: 'DOWNLOAD_FILE',
  recordingId: 'recording_XXXXX', // use actual ID
  fileType: 'audio'
})
```

## Expected File Sizes (5-second recording):

- Audio: ~50-250 KB
- Webcam: ~250-1000 KB
- JSON: ~5-15 KB

If files are 15 bytes → chunks not being captured!
