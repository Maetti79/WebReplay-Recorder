# Simple Debug Steps - No Extra Files Needed

## Test Recording Right Now:

### Step 1: Reload Extension
1. Go to `chrome://extensions`
2. Find "WebReplay"
3. Click the refresh button 🔄

### Step 2: Open Service Worker Console
1. Still on `chrome://extensions`
2. Find "WebReplay"
3. Click "**Inspect views: service worker**"
4. Keep this console open

### Step 3: Start Recording
1. Open ANY webpage (e.g., google.com)
2. Click the WebReplay extension icon
3. Click "**Start Recording**"
4. Watch the service worker console - you should see:
   ```
   [Background] Recording started for tab: X
   [Background] Starting media capture via offscreen document...
   [Background] Media capture result: {...}
   [Background] ✅ Audio recording started
   [Background] ✅ Webcam recording started
   ```

### Step 4: Open Offscreen Console (CRITICAL!)
**While recording is active:**
1. Go back to `chrome://extensions` (keep recording!)
2. Look for "**Inspect views: offscreen.html**" under WebReplay
   - ⚠️ This ONLY appears when recording is active!
3. Click it to open the offscreen console
4. You should see logs appearing every ~1 second:
   ```
   [Offscreen] Audio chunk received: XXXXX bytes - writing to IndexedDB
   [Offscreen] ✅ Audio chunk saved to IndexedDB
   [Offscreen] Webcam chunk received: XXXXX bytes - writing to IndexedDB
   [Offscreen] ✅ Webcam chunk saved to IndexedDB
   ```

### Step 5: Check IndexedDB (While Recording)
**In the offscreen.html DevTools window:**
1. Click the "**Application**" tab
2. Expand "**IndexedDB**" in the left sidebar
3. Expand "**WebReplayOffscreenDB**"
4. Click on "**audioChunks**"
5. Click the refresh button (↻) every second
6. **You should see entries being added in real-time!**
7. Click on one entry to see its size

### Step 6: Record for 5+ Seconds
Keep recording for at least 5 seconds so multiple chunks are saved.

### Step 7: Stop Recording
1. Go back to the webpage
2. Click "**Stop Recording**"
3. Watch BOTH consoles:

**Service Worker Console:**
```
[Background] Recording stopped
[Background] Requesting media chunks from offscreen document...
[Background] Media chunks result: { audioSize: XXXXX, webcamSize: XXXXX }
[Background] ✅ Audio blob created: XXXXX bytes
[Background] ✅ Webcam blob created: XXXXX bytes
```

**Offscreen Console:**
```
[Offscreen] Stopping media capture
[Offscreen] Audio recording stopped. Total chunks: X
[Offscreen] Getting media chunks for recording: recording_XXX
[Offscreen] Retrieved audio chunks: X
[Offscreen] Retrieved webcam chunks: X
[Offscreen] Audio blob size: XXXXX bytes
[Offscreen] Webcam blob size: XXXXX bytes
```

### Step 8: Try Download
1. Open the extension popup
2. Click "**💾 All**" to download
3. Check your Downloads folder
4. Check file sizes:
   - Audio should be > 50 KB
   - Webcam should be > 100 KB
   - JSON should be a few KB

## Common Problems & Solutions:

### Problem: "Inspect views: offscreen.html" never appears
**Cause:** Offscreen document not created
**Check:** Service worker console for offscreen creation errors
**Fix:** Look for error messages about offscreen document

### Problem: No permission prompts appear
**Cause:** Permissions already denied
**Fix:** 
1. Go to chrome://settings/content/camera
2. Check if site is blocked
3. Reset permissions

### Problem: Offscreen console shows getUserMedia errors
**Cause:** No camera/mic available or permissions denied
**Fix:**
- Make sure you have a camera and microphone
- Check system settings
- Grant permissions when prompted

### Problem: No "chunk received" logs
**Cause:** MediaRecorder not firing ondataavailable
**Possible reasons:**
- Recording is too short (< 1 second)
- MediaRecorder failed to start
- Codec not supported

**Fix:**
- Record for at least 3 seconds
- Check offscreen console for MediaRecorder errors

### Problem: Chunks saved but download is 15 bytes
**Cause:** Timing issue - chunks not retrieved properly
**Check:** 
- Service worker console - look for "Retrieved X chunks"
- If it says 0 chunks, the recordingId might be wrong

### Problem: "Cannot establish connection"
**Cause:** Content script not injected
**Fix:** Extension already handles this - reload the page and try again

## Quick Check Commands

**In Service Worker Console, run these:**

```javascript
// Check recording state
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, console.log)

// Check what databases exist
indexedDB.databases().then(console.log)
```

**In Offscreen Console, run these:**

```javascript
// Check if IndexedDB exists
indexedDB.databases().then(console.log)

// Open and check chunks manually
const request = indexedDB.open('WebReplayOffscreenDB');
request.onsuccess = () => {
  const db = request.result;
  const tx = db.transaction(['audioChunks'], 'readonly');
  const store = tx.objectStore('audioChunks');
  store.getAll().onsuccess = (e) => {
    console.log('Audio chunks:', e.target.result.length);
    console.log('First chunk size:', e.target.result[0]?.chunk?.size);
  };
};
```

## What You Should Report Back:

Please tell me:
1. ✅ or ❌ - Do you see "offscreen.html" link during recording?
2. ✅ or ❌ - Do you see "chunk received" logs?
3. ✅ or ❌ - Do chunks appear in IndexedDB?
4. What file sizes do you get when downloading?
5. Any error messages in either console?

Copy and paste the console logs if you see errors!
