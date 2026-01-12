# WebReplay v1.0.2 - Test Plan

**Date:** January 9, 2026
**Version:** 1.0.2
**Focus:** Recording and Download Bug Fixes

---

## Prerequisites

1. Chrome or Edge browser
2. Extension reloaded with latest changes
3. Clean test environment (or incognito window)

---

## Test 1: Connection Error Fix

### Objective
Verify that recording works on tabs opened BEFORE extension installation/reload (the "Could not establish connection" fix).

### Steps

1. **Open a fresh tab** (before reloading extension):
   ```
   1. Open Chrome
   2. Navigate to: chrome://newtab/ or any website
   3. Leave this tab open
   ```

2. **Reload the extension**:
   ```
   1. Go to chrome://extensions/
   2. Find "WebReplay Recorder"
   3. Click the reload button (circular arrow)
   4. Go back to your test tab (from step 1)
   ```

3. **Attempt to record** (this previously failed):
   ```
   1. Click the extension icon in toolbar
   2. Click "Start Recording" button
   3. Expected result: Recording starts successfully
   4. Previous result: "Could not establish connection" error
   ```

4. **Verify recording works**:
   ```
   1. Interact with the page (click buttons, type text)
   2. Wait 5-10 seconds
   3. Click extension icon
   4. Click "Stop Recording"
   5. Wait for "Recording saved!" message
   ```

### Expected Results

✅ **PASS Criteria:**
- No "Could not establish connection" error
- Recording starts immediately
- Extension icon shows recording status
- Events are captured (check event count in popup)

❌ **FAIL Criteria:**
- Any connection error
- Recording doesn't start
- No events captured

### Verification

Check browser console for confirmation:
```
1. Press F12 (Developer Tools)
2. Go to Console tab
3. Look for: "[Background] Content script not found, injecting..."
4. Should see: "[Background] Recording started for tab: [id]"
```

---

## Test 2: Download Error Fix

### Objective
Verify that downloading works reliably, especially after service worker restarts (the "undefined response" fix).

### Test 2A: Immediate Download (Simple Case)

1. **Record a session**:
   ```
   1. Open any website
   2. Click extension icon
   3. Click "Start Recording"
   4. Perform some actions (click, type)
   5. Click "Stop Recording"
   6. Wait for "Recording saved!"
   ```

2. **Download immediately**:
   ```
   1. Extension popup should show the recording
   2. Click "Download" button
   3. Expected result: Files download successfully
   4. Previous result: May have worked (simple case)
   ```

3. **Verify downloads**:
   ```
   Check Downloads folder for:
   - storyboard_[id].json
   - recording_[id].webm (if audio enabled)
   - webcam_[id].webm (if webcam enabled)
   ```

### Test 2B: Download After Service Worker Restart (Critical Test)

This is the scenario that previously failed!

1. **Record a session**:
   ```
   1. Open any website
   2. Record a session as in Test 2A
   3. Wait for "Recording saved!"
   4. Close the popup (do NOT download yet)
   ```

2. **Force service worker restart**:
   ```
   Method 1 - Wait naturally:
   - Wait 5+ minutes (Chrome restarts service workers)

   Method 2 - Force restart:
   - Go to chrome://extensions/
   - Click "Details" on WebReplay extension
   - Click "Inspect views: service worker"
   - In DevTools, click "Stop" button (stops service worker)
   - Close DevTools
   - Wait 10 seconds
   ```

3. **Try to download** (this previously failed):
   ```
   1. Click extension icon (reopens popup)
   2. Recording should still be listed
   3. Click "Download" button
   4. Expected result: Files download successfully
   5. Previous result: "Cannot read properties of undefined (reading 'success')"
   ```

4. **Verify downloads**:
   ```
   Check Downloads folder for:
   - storyboard_[id].json ✓
   - recording_[id].webm (if audio enabled) ✓
   - webcam_[id].webm (if webcam enabled) ✓
   ```

### Expected Results

✅ **PASS Criteria:**
- All files download successfully
- No error messages
- Files contain correct data (JSON is valid, audio/video playable)

❌ **FAIL Criteria:**
- "Cannot read properties of undefined" error
- "Recording not found" error
- No files downloaded
- Partial downloads (JSON but no audio/video)

### Verification

Check browser console:
```
1. Open DevTools (F12) on the popup
2. Look for: "[Background] Downloaded audio from IndexedDB"
3. Look for: "[Background] Downloaded webcam from IndexedDB"
4. Should NOT see: "Cannot read properties of undefined"
```

---

## Test 3: Combined Scenario (Real-World Test)

### Objective
Test both fixes in a realistic workflow.

### Steps

1. **Fresh start**:
   ```
   1. Close all browser tabs
   2. Go to chrome://extensions/
   3. Reload WebReplay extension
   4. Open a new tab: https://example.com
   ```

2. **Record without reload** (Connection fix):
   ```
   1. Click extension icon
   2. Configure settings (audio on, webcam on, position: bottom-right)
   3. Click "Start Recording"
   4. Should work without "connection" error ✓
   5. Type in a form field
   6. Click some links
   7. Click "Stop Recording"
   8. Wait for "Recording saved!"
   ```

3. **Wait and download** (Download fix):
   ```
   1. Close popup
   2. Wait 5+ minutes (or force service worker restart)
   3. Click extension icon to reopen
   4. Recording should be listed ✓
   5. Click "Download"
   6. All files should download ✓
   ```

4. **Verify files**:
   ```
   1. Open storyboard_[id].json in text editor
   2. Should see valid JSON with events ✓
   3. Play recording_[id].webm in video player
   4. Should hear audio ✓
   5. Play webcam_[id].webm in video player
   6. Should see webcam footage ✓
   ```

### Expected Results

✅ **PASS Criteria:**
- Complete workflow works without errors
- All recordings captured
- All files downloadable
- No manual page reloads needed

---

## Test 4: Error Handling (Edge Cases)

### Test 4A: Recording on Restricted Pages

1. **Try restricted pages**:
   ```
   1. Navigate to: chrome://extensions/
   2. Try to start recording
   3. Expected result: "Cannot inject content script on this page. Try reloading the page."
   4. This is correct behavior (Chrome security restriction)
   ```

2. **Verify graceful failure**:
   ```
   - Should NOT crash
   - Should show helpful error message
   - Should NOT leave recording in inconsistent state
   ```

### Test 4B: Download Non-Existent Recording

1. **Delete recording in storage**:
   ```
   1. Open DevTools (F12)
   2. Go to Application tab
   3. Storage > IndexedDB > WebReplayDB
   4. Delete all entries
   5. Also clear chrome.storage.local
   ```

2. **Try to download**:
   ```
   1. Click extension icon
   2. If recording still shown, click "Download"
   3. Expected result: "Failed to download: Recording not found"
   4. Should NOT crash or show undefined error
   ```

### Expected Results

✅ **PASS Criteria:**
- Helpful error messages
- No crashes
- No undefined errors

---

## Validation Checklist

After running all tests, verify:

### Code Fixes Present
- [ ] `ensureContentScript()` function in background.js (line ~115)
- [ ] Automatic content script injection on START_RECORDING
- [ ] DOWNLOAD_STORYBOARD handler uses async IIFE pattern (line ~513)
- [ ] Download handler uses `await chrome.storage.local.get()` instead of callback
- [ ] popup.js checks for `!response` before accessing `response.success`

### Functionality Working
- [ ] Recording starts on fresh tabs (no manual reload)
- [ ] Recording captures events correctly
- [ ] Download works immediately after recording
- [ ] Download works after service worker restart
- [ ] Audio files download from IndexedDB
- [ ] Webcam files download from IndexedDB
- [ ] Error messages are helpful and specific

### No Regressions
- [ ] Delete functionality still works
- [ ] Settings persist correctly
- [ ] Multiple recordings can be created
- [ ] Timeline editor still works (separate file)

---

## Debugging Tips

If tests fail, check:

### For Connection Errors:
```javascript
// In browser console:
chrome.runtime.sendMessage({type: 'GET_STATUS'}, console.log)
// Should return: {isRecording: false, recordingId: null, eventCount: 0}
```

### For Download Errors:
```javascript
// In DevTools > Application > Storage:
- IndexedDB > WebReplayDB > audioRecordings (should have entries)
- IndexedDB > WebReplayDB > webcamRecordings (should have entries)
- Local Storage > chrome-extension://[id] (should have storyboard_* keys)
```

### For Service Worker Status:
```
1. Go to chrome://extensions/
2. Click "Details" on WebReplay
3. Click "Inspect views: service worker"
4. Check console for errors
5. Look for "[Background] Service worker initialized"
```

---

## Test Results Template

```
Test 1 (Connection Fix): [ PASS / FAIL ]
  - Fresh tab recording: [ PASS / FAIL ]
  - Events captured: [ PASS / FAIL ]
  - Error messages: [ PASS / FAIL ]

Test 2A (Immediate Download): [ PASS / FAIL ]
  - JSON downloaded: [ PASS / FAIL ]
  - Audio downloaded: [ PASS / FAIL ]
  - Webcam downloaded: [ PASS / FAIL ]

Test 2B (Download After Restart): [ PASS / FAIL ]
  - JSON downloaded: [ PASS / FAIL ]
  - Audio from IndexedDB: [ PASS / FAIL ]
  - Webcam from IndexedDB: [ PASS / FAIL ]

Test 3 (Combined): [ PASS / FAIL ]
  - Complete workflow: [ PASS / FAIL ]

Test 4 (Error Handling): [ PASS / FAIL ]
  - Graceful failures: [ PASS / FAIL ]
  - Error messages: [ PASS / FAIL ]

Overall Status: [ ALL PASS / NEEDS FIXES ]
```

---

## Success Criteria

All tests must pass for v1.0.2 to be considered production-ready:

- ✅ No "Could not establish connection" errors
- ✅ No "undefined" errors in downloads
- ✅ Downloads work after service worker restarts
- ✅ Helpful error messages for restricted pages
- ✅ All data persists correctly in IndexedDB
- ✅ No regressions in existing functionality

---

## Quick Test (30 seconds)

If you want a quick smoke test:

1. Open a NEW tab (don't reload it)
2. Click extension icon
3. Click "Start Recording" - should work ✓
4. Click "Stop Recording"
5. Wait 30 seconds
6. Click "Download" - should work ✓

If both work, the critical fixes are functioning!

---

*Test Plan for WebReplay v1.0.2*
*Focus: Connection Error Fix + Download Error Fix*
*Status: Ready for Testing*
