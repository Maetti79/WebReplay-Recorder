# WebReplay MVP - Setup Guide

This guide will help you set up WebReplay from scratch in under 10 minutes.

---

## Prerequisites

Make sure you have these installed:
- **Chrome or Edge browser** (latest version)
- **Node.js** v18 or higher ([download](https://nodejs.org))
- **npm** v8 or higher (comes with Node.js)
- **Git** (optional, for cloning)

Check your versions:
```bash
node --version  # Should be v18+
npm --version   # Should be v8+
```

---

## Step 1: Install the Browser Extension

### Option A: Load Unpacked (Development)

1. Open Chrome/Edge and navigate to:
   - **Chrome:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`

2. Enable **Developer Mode** (toggle in top-right)

3. Click **Load unpacked**

4. Navigate to and select the `browser-extension/` folder

5. The extension should now appear with a red dot icon

### Option B: Fix "Extension not found" Errors

If you see the error: **"Failed to start recording: Could not establish connection"**

**Solution:** Reload the page you want to record on. The content script needs to be injected into the page.

**Why?** Pages that were open BEFORE you installed the extension don't have the content script loaded. Reloading fixes this.

---

## Step 2: Install the Replay Engine

1. Open a terminal and navigate to the replay engine folder:
```bash
cd replay-engine
```

2. Install dependencies:
```bash
npm install
```

This will install:
- Playwright (~200MB - browser automation)
- ffmpeg bindings (video processing)
- dotenv (environment variables)

3. Install Playwright browsers:
```bash
npx playwright install chromium
```

This downloads Chromium (~160MB) for deterministic replay.

4. Verify installation:
```bash
npm run validate examples/simple-demo.json
```

Should output: `✓ Storyboard is valid`

---

## Step 3: Configure API Keys (Optional - For TTS)

If you want to use text-to-speech narration, you'll need an ElevenLabs API key.

### Get an API Key

1. Sign up at [ElevenLabs](https://elevenlabs.io)
2. Go to **Settings → API Keys**
3. Create a new API key

### Configure the Key

**Option A: Environment Variable (Recommended)**

1. Copy the example env file:
```bash
cd replay-engine
cp .env.example .env
```

2. Edit `.env` and add your key:
```bash
ELEVENLABS_API_KEY=sk_your_actual_key_here
```

3. The `.env` file is in `.gitignore` so it won't be committed.

**Option B: Export (Temporary)**

```bash
export ELEVENLABS_API_KEY="sk_your_key_here"
```

This only works for the current terminal session.

### Test TTS

```bash
npm run tts:voices
```

Should list available voices like "Rachel", "Domi", "Bella", etc.

---

## Step 4: Test the Complete Workflow

### A. Record a Session

1. Click the extension icon in Chrome
2. Configure settings:
   - Toggle audio on/off
   - Toggle webcam on/off
   - Select webcam position (if enabled)
3. Click **Start Recording**
4. Interact with the page (clicks, typing, navigation)
5. Click **Stop Recording**
6. Wait for "Recording saved!"
7. Click **Download** to save the storyboard

You'll get these files:
- `storyboard_xxx.json` - The event timeline
- `recording_xxx.webm` - Audio recording (if enabled)
- `webcam_xxx.webm` - Webcam video (if enabled)

### B. Replay the Recording

1. Move the downloaded files to a folder:
```bash
mkdir my-recording
mv ~/Downloads/storyboard_*.json my-recording/
mv ~/Downloads/recording_*.webm my-recording/
mv ~/Downloads/webcam_*.webm my-recording/
```

2. Replay with video output:
```bash
cd replay-engine
node src/replay.js ../my-recording/storyboard_xxx.json --video
```

3. Watch the magic! Playwright will:
   - Open a browser
   - Navigate to the original URL
   - Replay all your interactions
   - Record everything as MP4 video

4. Find your video:
```bash
ls -la recordings/
```

### C. Try the Example Files

Test with the included example:

```bash
# Validate example
npm run validate ../examples/simple-demo.json

# Show info
npm run info ../examples/simple-demo.json

# Replay (no video)
node src/replay.js ../examples/simple-demo.json

# Replay with video
node src/replay.js ../examples/simple-demo.json --video
```

---

## Troubleshooting

### Extension Issues

**Error: "Could not establish connection"**
- **Fix:** Reload the page you want to record on
- **Why:** Content script needs to be injected

**Error: "Recording not found"**
- **Fix:** The extension service worker may have restarted. Recordings should persist in IndexedDB, but try reloading the extension if the issue persists.

**Webcam not working**
- **Fix:** Grant camera permission when Chrome asks
- **Check:** Open `chrome://settings/content/camera` and ensure the extension has access

**Audio not recording**
- **Fix:** Grant microphone permission
- **Check:** Open `chrome://settings/content/microphone`

### Replay Engine Issues

**Error: "Executable doesn't exist"**
- **Fix:** Install Playwright browsers:
```bash
npx playwright install chromium
```

**Error: "Cannot find module"**
- **Fix:** Install dependencies:
```bash
npm install
```

**Replay fails on certain sites**
- **Why:** Some sites detect automation (bot detection)
- **Solution:** Use on sites you control, or local test pages

**Selectors not found**
- **Why:** The page structure changed since recording
- **Solution:** Add `data-testid` attributes to important elements for stable selectors

### TTS Issues

**Error: "API error: 401"**
- **Fix:** Check your API key is correct
- **Check:** `echo $ELEVENLABS_API_KEY` or look in `.env`

**Error: "API error: 429"**
- **Why:** Rate limit or quota exceeded
- **Solution:** Wait a few minutes or check your ElevenLabs account

---

## Next Steps

Now that everything is set up:

1. **Try recording your own workflows**
   - Create product demos
   - Record bug reports
   - Build tutorial videos

2. **Edit timelines**
   - Open the timeline editor: `browser-extension/ui/editor.html`
   - Load your storyboard JSON
   - Adjust timing, edit text, rearrange events

3. **Add narration**
   - Generate auto-narration:
   ```bash
   npm run tts:narrate ../my-recording/storyboard_xxx.json
   ```

4. **Read the docs**
   - `README.md` - Complete feature documentation
   - `QUICK_REFERENCE.md` - Command cheatsheet
   - `WEBCAM_CONFIG.md` - Webcam positioning guide
   - `TESTING_GUIDE.md` - Full test suite

---

## Icon Customization (Optional)

The extension currently uses placeholder icons (red dot). To use custom icons:

1. Create 3 PNG files:
   - `browser-extension/icons/icon16.png` (16x16)
   - `browser-extension/icons/icon48.png` (48x48)
   - `browser-extension/icons/icon128.png` (128x128)

2. Reload the extension in `chrome://extensions/`

Recommended icon design:
- Camera or video recorder symbol
- Red dot to indicate "recording"
- Simple, recognizable at small sizes

---

## Production Checklist

Before deploying or sharing:

- [ ] Replace placeholder icons with proper designs
- [ ] Set `ELEVENLABS_API_KEY` via environment variable (not hardcoded)
- [ ] Test on clean Chrome profile
- [ ] Verify all permissions are necessary
- [ ] Review privacy policy (data stays local)
- [ ] Test on multiple websites
- [ ] Update extension description in manifest.json
- [ ] Add your name/organization to package.json author field

---

## Getting Help

- **Documentation:** See all `.md` files in project root
- **Examples:** Check `examples/` folder
- **Issues:** The code is well-commented - check source files

---

**Setup complete! 🎉 You're ready to record and replay!**

*WebReplay MVP v1.0 - Setup Guide*
