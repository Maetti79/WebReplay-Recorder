# Quick Test - v1.0.2 Bug Fixes

**Time Required:** 2 minutes
**Tests:** Connection Error + Download Error

---

## Step 1: Reload Extension

```
1. Open Chrome/Edge
2. Go to: chrome://extensions/
3. Find "WebReplay Recorder"
4. Click the reload button (circular arrow icon)
```

---

## Step 2: Test Connection Fix (30 seconds)

This tests: **"Could not establish connection" bug**

```
1. Open a NEW tab: https://example.com
   (Do NOT reload the page)

2. Click the extension icon (red dot in toolbar)

3. Click "Start Recording" button

✅ EXPECTED: Recording starts immediately
❌ PREVIOUS: "Could not establish connection" error

4. Type something on the page

5. Click "Stop Recording"

6. Wait for "Recording saved!" message
```

**What to check:**
- No error message appears
- Recording starts immediately
- Event count increases as you interact

---

## Step 3: Test Download Fix - Immediate (15 seconds)

```
1. After recording stops, popup shows the recording

2. Click "Download" button

✅ EXPECTED: Files download successfully
❌ PREVIOUS: Might work (simple case)

3. Check Downloads folder for:
   - storyboard_[id].json
   - recording_[id].webm (if audio was on)
```

---

## Step 4: Test Download Fix - After Restart (1 minute)

This tests: **"Cannot read properties of undefined" bug**

```
1. Record another session (Steps 2.1-2.6 above)

2. After "Recording saved!", CLOSE the popup
   (Do not download yet)

3. Force service worker restart:
   - Go to chrome://extensions/
   - Click "Details" on WebReplay
   - Click "Inspect views: service worker"
   - In DevTools, look for and click "Stop" button
   - Close DevTools
   - Wait 10 seconds

4. Click extension icon to reopen popup

5. Recording should still be listed

6. Click "Download" button

✅ EXPECTED: Files download successfully
❌ PREVIOUS: "Cannot read properties of undefined (reading 'success')" error

7. Check browser console (F12):
   - Should see: "[Background] Downloaded audio from IndexedDB"
   - Should NOT see: "Cannot read properties of undefined"
```

---

## Results

Fill in your test results:

```
[ ] Test 2 - Connection Fix: Recording started on fresh tab
[ ] Test 3 - Download Fix: Immediate download worked
[ ] Test 4 - Download Fix: Download after restart worked

Overall: [ PASS / FAIL ]
```

---

## If Tests PASS ✅

Both critical bugs are fixed! The extension is ready to use.

---

## If Tests FAIL ❌

### Connection Error Still Occurs:

Check browser console (F12) for:
```
[Background] Content script not found, injecting...
```

If you see this but still get an error, the page might be restricted (chrome://, file://, etc.)

**Solution:** Try on a regular website (not chrome:// or edge:// pages)

### Download Error Still Occurs:

1. Open DevTools (F12) on the popup
2. Click Download
3. Check Console tab for actual error
4. Check Application tab > IndexedDB > WebReplayDB
   - Should have entries in audioRecordings and webcamRecordings

**If IndexedDB is empty:** Recording didn't save properly - this is a different issue

**If error shows undefined:** The fix didn't apply - verify you reloaded the extension

---

## Debug Commands

Run these in browser console to check status:

```javascript
// Check if background script is running:
chrome.runtime.sendMessage({type: 'GET_STATUS'}, console.log);

// Should return: {isRecording: false, recordingId: null, eventCount: 0}
```

```javascript
// List all stored recordings:
chrome.storage.local.get(null, console.log);

// Should see keys like: storyboard_recording_xxx, lastRecordingId
```

---

## Alternative: Simple Smoke Test (30 seconds)

Just want to verify it works quickly?

```
1. Reload extension
2. Open new tab
3. Click extension → "Start Recording"
   ✅ Should work (no error)
4. Click "Stop Recording"
5. Click "Download"
   ✅ Should work (no error)

If both work = fixes successful!
```

---

*Quick Test Guide*
*WebReplay v1.0.2*
*Focus: Critical Bug Fixes*
