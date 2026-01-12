# Permissions Audit - WebReplay v1.0.2

**Date:** 2026-01-09
**Status:** ✅ VERIFIED

---

## Manifest Permissions (manifest.json)

### Currently Declared:
```json
{
  "permissions": [
    "activeTab",      // ✅ Access current tab
    "tabCapture",     // ✅ Capture screen/audio from tabs
    "storage",        // ✅ Save recordings in chrome.storage
    "scripting",      // ✅ Inject content scripts
    "tabs",           // ✅ Manage tabs
    "downloads"       // ✅ Download files (JUST ADDED)
  ],
  "host_permissions": [
    "<all_urls>"      // ✅ Access all websites
  ]
}
```

### All Required? YES ✅

| Permission | Purpose | Required? | Used In |
|------------|---------|-----------|---------|
| activeTab | Access current tab for recording | ✅ Yes | background.js |
| tabCapture | Capture screen/audio streams | ✅ Yes | background.js |
| storage | Save storyboards & settings | ✅ Yes | background.js, popup.js |
| scripting | Inject content.js into pages | ✅ Yes | background.js |
| tabs | Query and message tabs | ✅ Yes | background.js |
| downloads | Download storyboard files | ✅ Yes | background.js |
| <all_urls> | Record on any website | ✅ Yes | content.js |

---

## Runtime Permissions (Requested During Use)

### Microphone Access 🎤

**How It Works:**
- NOT a manifest permission
- Requested at runtime via `navigator.mediaDevices.getUserMedia()`
- Browser shows permission prompt to user
- Permission persists per-origin after user accepts

**Code Location:**
`browser-extension/scripts/background.js` lines ~168-234

```javascript
const mediaConstraints = {};

if (recordingSettings.audioEnabled) {
  mediaConstraints.audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };
}

const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
```

**When Prompted:**
- User clicks "Start Recording" for the first time
- Only if audio toggle is ON in settings
- Browser shows: "WebReplay Recorder wants to use your microphone"
- User clicks "Allow" or "Block"

**Status:** ✅ Properly implemented

---

### Webcam Access 📹

**How It Works:**
- NOT a manifest permission
- Requested at runtime via `navigator.mediaDevices.getUserMedia()`
- Browser shows permission prompt to user
- Permission persists per-origin after user accepts

**Code Location:**
`browser-extension/scripts/background.js` lines ~168-234

```javascript
if (recordingSettings.webcamEnabled) {
  mediaConstraints.video = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user'
  };
}

const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
```

**When Prompted:**
- User clicks "Start Recording" for the first time
- Only if webcam toggle is ON in settings
- Browser shows: "WebReplay Recorder wants to use your camera"
- User clicks "Allow" or "Block"

**Status:** ✅ Properly implemented

---

## Permission Flow Diagram

```
User clicks "Start Recording"
           ↓
Check settings: audio ON? webcam ON?
           ↓
Build mediaConstraints object
           ↓
Call navigator.mediaDevices.getUserMedia()
           ↓
[First Time Only] Browser shows permission prompt:
  "WebReplay Recorder wants to use your:"
  - 🎤 Microphone (if audio ON)
  - 📹 Camera (if webcam ON)
           ↓
User clicks "Allow" or "Block"
           ↓
If Allow: Start recording ✅
If Block: Show error, fallback to screen-only
```

---

## Error Handling

### If User Denies Microphone:
```javascript
// Line ~209 in background.js
} catch (mediaError) {
  console.warn('[Background] Could not start media recording:', mediaError);
  
  // Fallback: Try audio-only
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // ... continue with audio only
  } catch (audioError) {
    console.warn('[Background] Could not start audio recording:', audioError);
    // Continue with screen recording only
  }
}
```

**Behavior:**
- Extension continues to work
- Records screen interactions only
- No audio/webcam in output
- User can still download JSON storyboard

**Status:** ✅ Graceful degradation implemented

---

## Checking Current Permissions

### Check Manifest Permissions:
```javascript
// In browser console:
chrome.permissions.getAll(console.log);

// Should show:
// permissions: ["activeTab", "tabCapture", "storage", "scripting", "tabs", "downloads"]
// origins: ["<all_urls>"]
```

### Check Media Permissions:
```javascript
// Check microphone permission:
navigator.permissions.query({ name: 'microphone' }).then(console.log);
// state: "granted" | "denied" | "prompt"

// Check camera permission:
navigator.permissions.query({ name: 'camera' }).then(console.log);
// state: "granted" | "denied" | "prompt"
```

### Via Chrome Settings:
```
1. Go to: chrome://settings/content/microphone
2. Check: Should see chrome-extension://[your-extension-id]
3. Status: "Allow" or "Block"

Same for camera: chrome://settings/content/camera
```

---

## Common Issues & Solutions

### Issue: "Permission denied" when recording

**Cause:** User previously blocked microphone/camera access

**Solution:**
```
1. Go to chrome://settings/content/microphone
2. Find the extension in "Block" list
3. Click remove (X) or move to "Allow"
4. Same for chrome://settings/content/camera
5. Try recording again (will prompt again)
```

### Issue: No permission prompt appears

**Cause:** Extension already has permission OR user blocked it

**Check:**
```javascript
// In console:
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('✅ Has permission'))
  .catch(err => console.log('❌', err.name, err.message));
```

**Common error names:**
- `NotAllowedError` - User denied permission
- `NotFoundError` - No microphone/camera available
- `NotReadableError` - Hardware in use by another app

### Issue: Settings toggles don't affect permissions

**Expected Behavior:**
- Toggles control whether to REQUEST permissions
- If toggled OFF, no permission request is made
- If toggled ON, permission IS requested
- User still needs to click "Allow" in browser prompt

**Not a Bug:**
- Settings don't grant permissions automatically
- They only control whether to ask for them

---

## Best Practices (Currently Followed ✅)

1. **Only request when needed:**
   - ✅ Only request audio if audioEnabled: true
   - ✅ Only request video if webcamEnabled: true
   - ✅ Don't request unnecessarily

2. **Handle denials gracefully:**
   - ✅ Try-catch around getUserMedia
   - ✅ Fallback to partial recording
   - ✅ Continue with available streams

3. **Respect user choice:**
   - ✅ Settings persist via chrome.storage
   - ✅ User can disable audio/video anytime
   - ✅ No forced permissions

4. **Clear communication:**
   - ✅ Settings UI shows what will be recorded
   - ✅ Console logs explain what's happening
   - ✅ Errors are descriptive

---

## Security Considerations

### What We Record:
- ✅ Only when user clicks "Start Recording"
- ✅ Only on the active tab
- ✅ Only with user-approved settings
- ✅ Visual recording indicator (browser shows red dot)

### What We DON'T Record:
- ❌ Other tabs
- ❌ Desktop (only tab content)
- ❌ System audio (only microphone)
- ❌ When recording is stopped

### Data Storage:
- ✅ Everything stored locally (IndexedDB + chrome.storage)
- ✅ No external servers (except optional TTS API)
- ✅ User controls deletion
- ✅ No telemetry or tracking

---

## Permission Summary

| Permission Type | Location | Status | User Prompt? |
|----------------|----------|--------|--------------|
| downloads | manifest.json | ✅ Added | No - auto-granted |
| activeTab | manifest.json | ✅ Present | No - auto-granted |
| tabCapture | manifest.json | ✅ Present | No - auto-granted |
| storage | manifest.json | ✅ Present | No - auto-granted |
| scripting | manifest.json | ✅ Present | No - auto-granted |
| tabs | manifest.json | ✅ Present | No - auto-granted |
| <all_urls> | manifest.json | ✅ Present | No - auto-granted |
| Microphone | Runtime (getUserMedia) | ✅ Requested | YES - browser prompt |
| Camera | Runtime (getUserMedia) | ✅ Requested | YES - browser prompt |

**Total Permissions:** 7 manifest + 2 runtime = 9 total
**User Prompts Required:** 2 (microphone + camera, first time only)

---

## Conclusion

### Status: ✅ ALL PERMISSIONS CORRECT

**Manifest Permissions:**
- All 7 required permissions present
- downloads permission added in v1.0.2
- No unnecessary permissions

**Runtime Permissions:**
- Microphone and camera properly requested via getUserMedia
- Graceful error handling if denied
- Settings control whether to request them

**Action Required:**
- User must reload extension (for downloads permission)
- User must click "Allow" when prompted for mic/camera (first time only)

**No Permission Issues Found!**

---

*Permissions Audit Report*
*WebReplay v1.0.2*
*All Permissions Verified*
