#!/usr/bin/env node

import { ReplayEngine } from './replay.js';
import fs from 'fs';
import path from 'path';

console.log('WebReplay Engine v1.0.0');
console.log('========================\n');

const command = process.argv[2];

if (!command || command === 'help') {
  console.log('Commands:');
  console.log('  replay <storyboard.json>    Replay a storyboard');
  console.log('  validate <storyboard.json>  Validate storyboard format');
  console.log('  info <storyboard.json>      Show storyboard information');
  console.log('');
  console.log('Replay options:');
  console.log('  --record-video              Record video of the replay');
  console.log('  --video-dir=DIR             Directory to save video');
  console.log('  --assets-dir=DIR            Directory containing assets');
  console.log('');
  console.log('Examples:');
  console.log('  node src/index.js replay storyboard.json');
  console.log('  node src/index.js replay storyboard.json --record-video');
  process.exit(0);
}

if (command === 'replay') {
  // Pass to replay.js
  import('./replay.js');
} else if (command === 'validate') {
  const storyboardPath = process.argv[3];

  if (!storyboardPath) {
    console.error('Error: Missing storyboard file path');
    process.exit(1);
  }

  if (!fs.existsSync(storyboardPath)) {
    console.error(`Error: File not found: ${storyboardPath}`);
    process.exit(1);
  }

  try {
    const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf-8'));

    console.log('Validating storyboard...\n');

    // Basic validation
    const errors = [];
    const warnings = [];

    if (!storyboard.version) errors.push('Missing version field');
    if (!storyboard.meta) errors.push('Missing meta field');
    if (!storyboard.timeline) errors.push('Missing timeline field');
    if (!Array.isArray(storyboard.timeline)) errors.push('Timeline must be an array');

    if (storyboard.timeline) {
      storyboard.timeline.forEach((event, index) => {
        if (typeof event.t !== 'number') {
          errors.push(`Event ${index}: missing or invalid 't' (timestamp)`);
        }
        if (!event.type) {
          errors.push(`Event ${index}: missing 'type' field`);
        }
      });
    }

    // Check for selector quality
    if (storyboard.timeline) {
      storyboard.timeline.forEach((event, index) => {
        if (event.target && event.target.selectors) {
          if (event.target.selectors.length === 0) {
            warnings.push(`Event ${index}: no selectors defined`);
          } else if (event.target.selectors.length === 1) {
            warnings.push(`Event ${index}: only one selector (recommend multiple fallbacks)`);
          }
        }
      });
    }

    if (errors.length > 0) {
      console.log('ERRORS:');
      errors.forEach(err => console.log(`  ✗ ${err}`));
      console.log('');
    }

    if (warnings.length > 0) {
      console.log('WARNINGS:');
      warnings.forEach(warn => console.log(`  ! ${warn}`));
      console.log('');
    }

    if (errors.length === 0) {
      console.log('✓ Storyboard is valid!');
      console.log(`  Events: ${storyboard.timeline.length}`);
      console.log(`  Duration: ${Math.max(...storyboard.timeline.map(e => e.t)) / 1000}s`);
    } else {
      console.log('✗ Storyboard has errors');
      process.exit(1);
    }

  } catch (error) {
    console.error('Error parsing storyboard:', error.message);
    process.exit(1);
  }

} else if (command === 'info') {
  const storyboardPath = process.argv[3];

  if (!storyboardPath) {
    console.error('Error: Missing storyboard file path');
    process.exit(1);
  }

  if (!fs.existsSync(storyboardPath)) {
    console.error(`Error: File not found: ${storyboardPath}`);
    process.exit(1);
  }

  try {
    const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf-8'));

    console.log('Storyboard Information');
    console.log('======================\n');
    console.log(`Title:       ${storyboard.meta.title || 'Untitled'}`);
    console.log(`Created:     ${storyboard.meta.createdAt || 'Unknown'}`);
    console.log(`Base URL:    ${storyboard.meta.baseUrl || 'None'}`);
    console.log(`Viewport:    ${storyboard.meta.viewport?.width}x${storyboard.meta.viewport?.height}`);
    console.log(`Events:      ${storyboard.timeline.length}`);

    const duration = storyboard.timeline.length > 0
      ? Math.max(...storyboard.timeline.map(e => e.t)) / 1000
      : 0;
    console.log(`Duration:    ${duration.toFixed(1)}s`);

    // Event type breakdown
    const eventTypes = {};
    storyboard.timeline.forEach(event => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });

    console.log('\nEvent Types:');
    Object.entries(eventTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    if (storyboard.audioTrack && storyboard.audioTrack.length > 0) {
      console.log(`\nAudio Tracks: ${storyboard.audioTrack.length}`);
    }

  } catch (error) {
    console.error('Error reading storyboard:', error.message);
    process.exit(1);
  }

} else {
  console.error(`Unknown command: ${command}`);
  console.log('Run "node src/index.js help" for usage information');
  process.exit(1);
}
