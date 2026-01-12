#!/bin/bash

echo "========================================"
echo "  WebReplay MVP Setup"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Install replay engine dependencies
echo "Installing replay engine dependencies..."
cd replay-engine

if npm install; then
    echo "✓ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Load browser extension:"
echo "   - Open chrome://extensions/"
echo "   - Enable Developer mode"
echo "   - Click 'Load unpacked'"
echo "   - Select: $(pwd)/../browser-extension"
echo ""
echo "2. Test the example:"
echo "   cd replay-engine"
echo "   node src/replay.js ../examples/example-storyboard.json"
echo ""
echo "3. Read the quick start guide:"
echo "   cat ../QUICKSTART.md"
echo ""
echo "Happy recording! 🎥"
