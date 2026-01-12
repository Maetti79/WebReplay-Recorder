# Diagnostic Guide - No Events Being Captured

**Issue:** Recording shows no clicks, typing, audio, or webcam
**Priority:** CRITICAL

---

## Step-by-Step Diagnostic

### Step 1: Verify Extension Loaded

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for: `[Recorder] Content script loaded`

**✅ If you see it:** Content script is loaded
**❌ If you don't:** Content script failed to inject

---

### Step 2: Check Recording Started

After clicking "Start Recording":

**Check Popup Console:**
1. Right-click extension icon → Inspect popup
2. Look for errors in Console

**Check Background Console:**
1. Go to chrome://extensions/
2. Click "Inspect views: service worker"
3. Look for:
   - `[Background] Content script not found, injecting...` (expected)
   - `[Background] Recording started for tab: [id]`
   - Any errors?

**Check Page Console:**
1. F12 on the page you're recording
2. Look for:
   - `[Recorder] Recording started`
   - `[Recorder] Click recorded` (after you click)
   - `[Recorder] Input recorded` (after you type)

---

### Step 3: Test Event Capture

1. With recording active, click something
2. Check page console immediately
3. Should see: `[Recorder] Click recorded: {type: 'click', ...}`

**✅ If you see events:** Capture is working
**❌ If you don't:** Events aren't being captured

---

### Step 4: Check Media Recording

**Check Background Console for:**
- `[Background] Audio recording started`
- `[Background] Webcam recording started`

**If missing:**
- Did you approve mic/camera permissions?
- Check chrome://settings/content/microphone
- Check chrome://settings/content/camera

---

## Common Issues & Fixes

### Issue 1: Content Script Not Injecting

**Symptoms:**
- No "[Recorder] Content script loaded" in console
- No events captured

**Diagnosis:**
```javascript
// In page console:
chrome.runtime.sendMessage({type: 'GET_STATUS'}, console.log);
// Should return: {isRecording: false, ...}
// If error: Content script not present
```

**Fix:**
- Reload the page (Ctrl+R or Cmd+R)
- If still failing, check manifest.json content_scripts section

---

### Issue 2: Recording State Not Set

**Symptoms:**
- "[Recorder] Content script loaded" shows
- "[Recorder] Recording started" does NOT show
- No events captured

**Diagnosis:**
```javascript
// In page console after starting recording:
window.isRecording
// Should be undefined (it's in closure)

// Try this instead:
chrome.runtime.sendMessage({type: 'GET_STATUS'}, console.log);
// Should show isRecording: true
```

**Fix:**
This means the START_RECORDING message isn't reaching content script.

Check background console for:
- `[Background] Recording started for tab: [id]`

---

### Issue 3: Events Captured But Not Saved

**Symptoms:**
- Events show in console: "[Recorder] Click recorded"
- But download shows empty timeline

**Diagnosis:**
Check background console when stopping:
- `[Background] Processing recorded events: X` (X should be > 0)
- `[Background] Storyboard saved: recording_xxx`

**Fix:**
- Events are captured but not sent to background
- Check RECORDING_COMPLETE message in content.js

---

### Issue 4: Media Permissions Denied

**Symptoms:**
- No audio in downloaded files
- No webcam in downloaded files
- But clicks/typing work

**Diagnosis:**
Check background console for:
- `[Background] Could not start media recording: NotAllowedError`

**Fix:**
1. Go to chrome://settings/content/microphone
2. Find extension, set to "Allow"
3. Same for chrome://settings/content/camera
4. Try recording again

---

## Quick Diagnostic Script

Run this in the page console to check everything:

```javascript
// Diagnostic Script
(async () => {
  console.log('=== WebReplay Diagnostic ===');
  
  // 1. Check if content script is present
  try {
    const status = await chrome.runtime.sendMessage({type: 'GET_STATUS'});
    console.log('✅ Content script present');
    console.log('   Recording:', status.isRecording);
    console.log('   Events:', status.eventCount);
  } catch (e) {
    console.log('❌ Content script ERROR:', e.message);
  }
  
  // 2. Check permissions
  try {
    const perms = await chrome.permissions.getAll();
    console.log('✅ Manifest permissions:', perms.permissions);
  } catch (e) {
    console.log('❌ Permissions ERROR:', e.message);
  }
  
  // 3. Check media permissions
  try {
    const mic = await navigator.permissions.query({name: 'microphone'});
    console.log('🎤 Microphone:', mic.state);
    
    const cam = await navigator.permissions.query({name: 'camera'});
    console.log('📹 Camera:', cam.state);
  } catch (e) {
    console.log('⚠️  Media permissions check failed:', e.message);
  }
  
  console.log('=== Diagnostic Complete ===');
})();
```

---

## Debugging Steps

### Enable Verbose Logging

Add this to content.js temporarily (line 200):

```javascript
function startRecording() {
  console.log('[Recorder] startRecording() called'); // ADD THIS
  isRecording = true;
  startTime = Date.now();
  recordedEvents = [];
  
  console.log('[Recorder] isRecording:', isRecording); // ADD THIS
  console.log('[Recorder] startTime:', startTime); // ADD THIS
  
  // ... rest of function
}
```

### Test Click Capture

Add this to recordClick() temporarily (line 80):

```javascript
function recordClick(event) {
  console.log('[DEBUG] recordClick called, isRecording:', isRecording); // ADD THIS
  
  if (!isRecording) return;
  
  // ... rest of function
}
```

---

## Expected Console Output

### When Page Loads:
```
[Recorder] Content script loaded
```

### When Starting Recording:
```
[Background] Recording started for tab: 123
[Recorder] Recording started
```

### When Clicking:
```
[Recorder] Click recorded: {t: 1234, type: 'click', ...}
```

### When Typing:
```
[Recorder] Input recorded: {t: 2345, type: 'type', text: '...', ...}
```

### When Stopping:
```
[Recorder] Recording stopped. Total events: 5
[Background] Processing recorded events: 5
[Background] Audio blob created: 12345 bytes
[Background] Webcam blob created: 67890 bytes
[Background] Storyboard saved: recording_xxx
```

---

## If Nothing Works

### Nuclear Option: Reinstall Extension

1. Go to chrome://extensions/
2. Click "Remove" on WebReplay Recorder
3. Restart Chrome
4. Load extension again (Load unpacked)
5. Grant all permissions when prompted
6. Test on a fresh page

---

## Report Results

Please run the diagnostic script and report:

1. What you see in page console
2. What you see in background console
3. What you see in popup console
4. Copy/paste any errors

This will help identify exactly where the problem is.

---

*Diagnostic Guide*
*WebReplay v1.0.2*
*Troubleshooting Event Capture Issues*
