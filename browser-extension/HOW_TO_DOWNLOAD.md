# How to Download Video/Audio Recordings

## Quick Steps

1. **Make a Recording**
   - Open the extension popup (click the extension icon)
   - Click "Start Recording"
   - Allow webcam/microphone permissions if prompted
   - Record for at least 3-5 seconds
   - Click "Stop Recording"

2. **Download Files**
   - After recording stops, you'll see the recording ID in the popup
   - Click the "💾 Download" button
   - You'll get **3 files** downloaded:
     - `storyboard_[ID].json` - Timeline with all events
     - `recording_[ID].webm` - Audio file
     - `webcam_[ID].webm` - Video file

3. **Play the Files**
   - Open `recording_[ID].webm` in any media player (VLC, Chrome, etc.)
   - Open `webcam_[ID].webm` in any media player
   - Both files should now be full recordings, not 15 bytes!

## Popup UI

```
┌─────────────────────────────────┐
│      WebReplay Recorder         │
├─────────────────────────────────┤
│  [Start Recording]              │ ← Click to start
│                                 │
│  Status: Recording...           │ ← Shows status
│                                 │
│  [Stop Recording]               │ ← Click to stop
├─────────────────────────────────┤
│  Recent Recordings:             │
│                                 │
│  recording_123456789_abc        │
│  [💾 Download] [🗑️ Delete]     │ ← Click download here
└─────────────────────────────────┘
```

## What Each File Contains

### 1. `storyboard_[ID].json`
- Timeline of all user interactions
- Click events with selectors
- Typing events with text
- Navigation events with URLs
- Timing information
- Can be used with the Timeline Editor or Replay Engine

### 2. `recording_[ID].webm`
- Your microphone audio
- Can include voiceover or narration
- WebM format (widely supported)
- Size depends on recording length (~10-50KB per second)

### 3. `webcam_[ID].webm`
- Your webcam video
- Shows you while recording
- WebM format
- Size depends on recording length (~50-200KB per second)

## Troubleshooting

### "No download happens"
- Check that you have the "downloads" permission enabled
- Check Chrome's downloads bar (Ctrl+J)
- Check Console for error messages

### "Files are still 15 bytes"
**Solution**: You need to reload the extension first!
1. Go to `chrome://extensions`
2. Find "WebReplay"
3. Click the refresh button 🔄
4. Make a new recording
5. Download again

### "Download button is missing"
- Make sure you've stopped the recording
- The button appears in the "Recent Recordings" section
- Refresh the popup (close and reopen)

### "Audio/video files won't play"
- Try VLC Media Player (it supports all formats)
- Check file size - should be > 10KB
- Check console logs during recording

## Check Recordings in DevTools

You can verify recordings are saved properly:

1. **Right-click the extension icon** → "Inspect popup"
2. **Go to Application tab** → IndexedDB → WebReplayDB
3. You should see:
   - `audioRecordings` - Contains your audio blobs
   - `webcamRecordings` - Contains your video blobs
4. Click on a recording to see the blob size

## Where Files Are Saved

By default, Chrome saves downloads to:
- **Windows**: `C:\Users\[YourName]\Downloads\`
- **Mac**: `/Users/[YourName]/Downloads/`
- **Linux**: `/home/[YourName]/Downloads/`

You can change this in Chrome settings:
- Settings → Downloads → Location

## File Sizes

Expected sizes for a **10-second recording**:
- Audio: ~100-500 KB
- Webcam: ~500-2000 KB
- JSON: ~5-20 KB

If files are much smaller (like 15 bytes), the recording didn't work properly.

## Using the Timeline Editor

1. **Open editor.html** in Chrome
2. **Click "Load Storyboard"**
3. **Select** the `storyboard_[ID].json` file
4. **Click "Load Media"**
5. **Select** both `recording_[ID].webm` and `webcam_[ID].webm`
6. Now you can:
   - Preview the replay
   - Edit events
   - Add subtitles
   - Generate voiceover with ElevenLabs
   - Export everything
