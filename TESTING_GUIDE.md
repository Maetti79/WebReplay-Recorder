# WebReplay Testing Guide

Complete testing guide for all features in the MVP.

## 🧪 Test Setup

### Prerequisites

1. **Extension Installed**
   ```bash
   # Navigate to chrome://extensions/
   # Enable Developer Mode
   # Load unpacked: browser-extension/
   ```

2. **Replay Engine Ready**
   ```bash
   cd replay-engine
   npm install  # Already done
   ```

3. **Test Page Available**
   ```bash
   # Use: examples/test-page.html
   open /Users/dennismittmann/Projects/examples/test-page.html
   ```

## 📋 Feature Test Matrix

### ✅ Test 1: Basic Recording & Replay

**Objective:** Verify core recording and replay functionality

**Steps:**
1. Open test-page.html in browser
2. Click extension icon → Start Recording
3. Fill in name: "John Doe"
4. Fill in email: "test@example.com"
5. Select role: "Developer"
6. Type message: "This is a test"
7. Check newsletter box
8. Click Submit
9. Stop recording
10. Download files

**Expected Results:**
- ✅ Storyboard JSON downloaded
- ✅ Audio file downloaded (if enabled)
- ✅ Webcam file downloaded (if enabled)

**Replay:**
```bash
cd replay-engine
node src/replay.js ~/Downloads/storyboard_*.json
```

**Expected:**
- ✅ Browser opens
- ✅ Form fills automatically
- ✅ Smooth cursor movement
- ✅ Human-like typing
- ✅ Form submits
- ✅ Success message appears

**Status:** [ ] Pass [ ] Fail

---

### ✅ Test 2: Webcam Configuration

**Objective:** Verify all webcam settings work correctly

#### 2.1: Toggle Audio On/Off

**Steps:**
1. Open extension popup
2. Click audio toggle (turn OFF)
3. Verify toggle is gray/left position
4. Start recording
5. Perform actions
6. Stop recording
7. Download files

**Expected:**
- ✅ Only storyboard.json and webcam.webm downloaded
- ✅ No recording.webm file
- ✅ Setting saved (reopen popup to verify)

**Status:** [ ] Pass [ ] Fail

#### 2.2: Toggle Webcam On/Off

**Steps:**
1. Open extension popup
2. Click webcam toggle (turn OFF)
3. Verify toggle is gray/left position
4. Verify position dropdown is disabled
5. Start recording
6. Perform actions
7. Stop recording
8. Download files

**Expected:**
- ✅ Only storyboard.json and recording.webm downloaded
- ✅ No webcam.webm file
- ✅ Setting saved

**Status:** [ ] Pass [ ] Fail

#### 2.3: Both Toggles Off

**Steps:**
1. Turn off audio toggle
2. Turn off webcam toggle
3. Verify button text: "Start Recording (Screen Only)"
4. Start recording
5. Perform actions
6. Stop recording
7. Download files

**Expected:**
- ✅ Only storyboard.json downloaded
- ✅ No audio or webcam files
- ✅ Recording still works

**Status:** [ ] Pass [ ] Fail

#### 2.4: Webcam Preview

**Steps:**
1. Enable webcam toggle
2. Double-click webcam toggle
3. Wait 3 seconds

**Expected:**
- ✅ Preview video appears
- ✅ Shows live webcam feed
- ✅ Automatically stops after 3 seconds
- ✅ Preview disappears

**Status:** [ ] Pass [ ] Fail

#### 2.5: Position Selection

**Test each position:**

**Bottom Right:**
```bash
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm \
  --webcam-position=bottom-right
```
**Expected:** Small overlay in bottom-right corner

**Bottom Left:**
```bash
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm \
  --webcam-position=bottom-left
```
**Expected:** Small overlay in bottom-left corner

**Top Right:**
```bash
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm \
  --webcam-position=top-right
```
**Expected:** Smaller overlay in top-right corner

**Top Left:**
```bash
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm \
  --webcam-position=top-left
```
**Expected:** Smaller overlay in top-left corner

**Sidebar Right:**
```bash
node src/replay.js storyboard.json \
  --record-video \
  --webcam=webcam.webm \
  --webcam-position=sidebar-right
```
**Expected:** Full-height sidebar on right (30% width)

**Status:** [ ] Pass [ ] Fail

---

### ✅ Test 3: Timeline Editor

**Objective:** Verify timeline editor loads and edits storyboards

**Steps:**
1. Open editor: `open browser-extension/ui/editor.html`
2. Click "Load Storyboard"
3. Select a recorded storyboard.json
4. Verify timeline renders
5. Verify event list shows all events
6. Click an event to select it
7. Drag event to new position on timeline
8. Edit event properties in right panel
9. Change timing value
10. Click "Save Changes"

**Expected:**
- ✅ Storyboard loads without errors
- ✅ Timeline visualizes all events
- ✅ Events grouped into tracks
- ✅ Drag and drop works smoothly
- ✅ Properties panel updates
- ✅ Changes save to new JSON file
- ✅ Playhead animates during playback

**Status:** [ ] Pass [ ] Fail

---

### ✅ Test 4: TTS Integration

**Objective:** Verify TTS generation with ElevenLabs API

#### 4.1: List Voices

```bash
cd replay-engine
node src/tts.js voices
```

**Expected:**
- ✅ Lists available voices
- ✅ Shows voice IDs
- ✅ Shows voice names
- ✅ No errors

**Status:** [ ] Pass [ ] Fail

#### 4.2: Generate Simple TTS

```bash
node src/tts.js generate "Hello, this is a test recording" test-output.mp3
```

**Expected:**
- ✅ Shows character count
- ✅ Shows estimated cost
- ✅ Creates test-output.mp3
- ✅ Audio plays correctly

**Status:** [ ] Pass [ ] Fail

#### 4.3: Auto-Generate Narration

```bash
node src/tts.js narrate ~/Downloads/storyboard_*.json
```

**Expected:**
- ✅ Analyzes events
- ✅ Generates narration text
- ✅ Creates audio segments
- ✅ Creates narration/ directory
- ✅ Creates *_with_narration.json
- ✅ Audio files in narration/ folder

**Status:** [ ] Pass [ ] Fail

---

### ✅ Test 5: Complete Workflow

**Objective:** Test entire workflow from recording to final video

**Steps:**

1. **Configure Settings**
   - Open extension popup
   - Enable audio ✓
   - Enable webcam ✓
   - Select position: Bottom Right
   - Double-click webcam to preview

2. **Record**
   - Open test-page.html
   - Click Start Recording
   - Fill entire form
   - Submit form
   - Wait 2 seconds
   - Stop Recording
   - Download all files

3. **Edit Timeline**
   - Open editor.html
   - Load storyboard.json
   - Adjust timing of type events (slower)
   - Add 1 second pause before submit
   - Save as storyboard_edited.json

4. **Generate Narration**
   ```bash
   cd replay-engine
   node src/tts.js narrate ~/Downloads/storyboard_edited.json
   ```

5. **Final Replay**
   ```bash
   node src/replay.js ~/Downloads/storyboard_edited_with_narration.json \
     --record-video \
     --webcam=~/Downloads/webcam_*.webm \
     --assets-dir=~/Downloads/narration
   ```

**Expected Final Video:**
- ✅ Smooth cursor movement
- ✅ Human-like typing
- ✅ Webcam in bottom-right corner
- ✅ AI narration synchronized
- ✅ All timing adjustments applied
- ✅ Professional looking result

**Status:** [ ] Pass [ ] Fail

---

### ✅ Test 6: Edge Cases

#### 6.1: Recording Without Permissions

**Steps:**
1. Deny microphone permission
2. Try to start recording

**Expected:**
- ✅ Falls back to webcam only
- ✅ Recording continues
- ✅ No error shown to user

**Status:** [ ] Pass [ ] Fail

#### 6.2: Extension Reload During Recording

**Steps:**
1. Start recording
2. Go to chrome://extensions/
3. Reload extension
4. Return to popup

**Expected:**
- ✅ Recording stops gracefully
- ✅ Data not lost (IndexedDB)
- ✅ Can download from storage

**Status:** [ ] Pass [ ] Fail

#### 6.3: Large Webcam File

**Steps:**
1. Record for 5+ minutes with webcam
2. Stop and download
3. Try to replay

**Expected:**
- ✅ Files download successfully
- ✅ Replay handles large webcam file
- ✅ (May be slow but should work)

**Status:** [ ] Pass [ ] Fail

#### 6.4: Invalid Storyboard

**Steps:**
1. Create invalid JSON file
2. Try to load in editor
3. Try to replay

**Expected:**
- ✅ Editor shows error message
- ✅ Replay shows error message
- ✅ No crashes

**Status:** [ ] Pass [ ] Fail

---

### ✅ Test 7: Settings Persistence

**Objective:** Verify settings persist correctly

**Steps:**
1. Open extension popup
2. Configure:
   - Audio: OFF
   - Webcam: ON
   - Position: Top Left
3. Close popup
4. Close browser
5. Reopen browser
6. Open extension popup

**Expected:**
- ✅ Audio toggle is OFF
- ✅ Webcam toggle is ON
- ✅ Position is "Top Left"

**Status:** [ ] Pass [ ] Fail

---

### ✅ Test 8: Validation Tools

#### 8.1: Validate Storyboard

```bash
node src/index.js validate storyboard.json
```

**Expected:**
- ✅ Shows validation results
- ✅ Lists any errors
- ✅ Lists warnings
- ✅ Shows event count and duration

**Status:** [ ] Pass [ ] Fail

#### 8.2: Show Info

```bash
node src/index.js info storyboard.json
```

**Expected:**
- ✅ Shows title, created date
- ✅ Shows viewport size
- ✅ Shows event count and types
- ✅ Shows duration
- ✅ Shows audio tracks info

**Status:** [ ] Pass [ ] Fail

---

## 🐛 Bug Tracking

### Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| Large webcam files may timeout on data URL | Low | Documented |
| Service worker restart loses in-memory data | Fixed | IndexedDB fallback |
| - | - | - |

### Found Bugs

Use this section to track bugs found during testing:

| # | Description | Steps to Reproduce | Severity | Status |
|---|-------------|-------------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## 📊 Test Results Summary

### Test Completion

- [ ] Test 1: Basic Recording & Replay
- [ ] Test 2: Webcam Configuration (all sub-tests)
- [ ] Test 3: Timeline Editor
- [ ] Test 4: TTS Integration (all sub-tests)
- [ ] Test 5: Complete Workflow
- [ ] Test 6: Edge Cases (all sub-tests)
- [ ] Test 7: Settings Persistence
- [ ] Test 8: Validation Tools

### Overall Status

**Total Tests:** 8 major tests + sub-tests
**Passed:** ___ / ___
**Failed:** ___ / ___
**Completion:** ___%

### Sign-off

**Tester:** _______________
**Date:** _______________
**Version:** MVP 1.0
**Status:** [ ] Approved [ ] Needs Work

---

## 🚀 Quick Test Commands

### Record & Replay (Quick Test)

```bash
# 1. Open test page
open examples/test-page.html

# 2. Record using extension (with default settings)

# 3. Quick replay
cd replay-engine
node src/replay.js ~/Downloads/storyboard_*.json
```

### Full Feature Test

```bash
# 1. Record with all features enabled

# 2. Edit timeline
open browser-extension/ui/editor.html
# Load, edit, save

# 3. Add narration
node src/tts.js narrate storyboard.json

# 4. Final replay with everything
node src/replay.js storyboard_with_narration.json \
  --record-video \
  --webcam=webcam.webm
```

### Validation

```bash
# Validate storyboard
node src/index.js validate storyboard.json

# Show info
node src/index.js info storyboard.json

# List TTS voices
node src/tts.js voices
```

---

## 📝 Testing Notes

Add any additional observations here:

```
[Your notes here]
```

---

**Happy Testing! 🧪**
