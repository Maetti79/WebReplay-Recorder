# Quick Start Guide

Get up and running with WebReplay in 5 minutes!

## Step 1: Install Dependencies

```bash
cd replay-engine
npm install
```

This will install Playwright and all necessary dependencies (may take a few minutes).

## Step 2: Load Browser Extension

1. Open Chrome or Edge
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `browser-extension` folder
6. You should see the WebReplay icon in your toolbar

## Step 3: Test Recording

### Option A: Use the Test Page

1. Open `examples/test-page.html` in your browser
2. Click the WebReplay extension icon
3. Click **Start Recording**
4. Fill out the form on the test page
5. Click **Submit Form**
6. Click the extension icon again
7. Click **Stop Recording**
8. Click **Download** to save your storyboard

### Option B: Record Any Website

1. Navigate to any website (e.g., google.com)
2. Click the WebReplay extension icon
3. Click **Start Recording**
4. Perform some actions (click, type, navigate)
5. Click **Stop Recording**
6. Download your storyboard

## Step 4: Replay Your Recording

Navigate to the replay-engine directory and run:

```bash
cd replay-engine
node src/replay.js ~/Downloads/storyboard_*.json
```

**Note:** Replace the path with your actual downloaded storyboard file.

You'll see a browser window open and your actions replayed automatically!

## Step 5: Record Video (Optional)

To capture video during replay:

```bash
node src/replay.js ~/Downloads/storyboard_*.json --record-video
```

The video will be saved in `replay-engine/videos/` directory.

## Try the Example

We've included a pre-made example storyboard:

```bash
cd replay-engine
node src/replay.js ../examples/example-storyboard.json
```

This will navigate to Google and perform a search.

## Troubleshooting

### Extension won't load

- Make sure you selected the `browser-extension` folder (not the parent folder)
- Check that `manifest.json` is present
- Look for errors in the extensions page

### Recording doesn't start

- Refresh the webpage and try again
- Check browser console for errors (F12)
- Ensure you granted microphone permissions (if using audio)

### Replay fails

- Verify the storyboard JSON is valid: `node src/index.js validate storyboard.json`
- Check that selectors still exist on the target website
- Try running with `--headless=false` to see what's happening

### Elements not found during replay

The website may have changed. You can:
- Edit the storyboard JSON to update selectors
- Add `data-testid` attributes to your app for stable targeting
- Re-record the session

## What's Next?

- Read the full [README.md](README.md) for detailed documentation
- Explore the storyboard JSON format
- Try editing timing and typing speed in the storyboard
- Add `data-testid` attributes to your app for better replay reliability

## Getting Help

- Check the [README.md](README.md) for detailed docs
- Look at the example storyboard in `examples/`
- Use the validation tool: `node src/index.js validate storyboard.json`
- Check the browser console for error messages

## Key Commands

```bash
# Validate a storyboard
node src/index.js validate storyboard.json

# Get storyboard info
node src/index.js info storyboard.json

# Replay with video
node src/replay.js storyboard.json --record-video

# Replay with custom assets
node src/replay.js storyboard.json --assets-dir=./my-assets
```

Happy recording! 🎥
