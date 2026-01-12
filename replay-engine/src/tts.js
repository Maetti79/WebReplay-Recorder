#!/usr/bin/env node

/**
 * TTS CLI Tool - Generate narration for storyboards
 */

import { config } from 'dotenv';
import { TTSService } from '../lib/tts-service.js';
import fs from 'fs';
import path from 'path';

// Load .env file if it exists
config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_ffe3ed156bbd42bac900058ff6fb3c14b144b2ff8aa48b0a';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    console.log('TTS CLI Tool - ElevenLabs Integration');
    console.log('=====================================\n');
    console.log('Commands:');
    console.log('  voices                          List available voices');
    console.log('  generate <text> [output.mp3]    Generate TTS from text');
    console.log('  narrate <storyboard.json>       Add narration to storyboard');
    console.log('  script <script.json>            Generate from narration script');
    console.log('');
    console.log('Environment:');
    console.log('  ELEVENLABS_API_KEY             Your ElevenLabs API key');
    console.log('');
    console.log('Examples:');
    console.log('  node src/tts.js voices');
    console.log('  node src/tts.js generate "Hello world" output.mp3');
    console.log('  node src/tts.js narrate storyboard.json');
    process.exit(0);
  }

  const tts = new TTSService(ELEVENLABS_API_KEY);

  try {
    if (command === 'voices') {
      console.log('Fetching available voices...\n');
      const voices = await tts.getVoices();

      console.log(`Found ${voices.length} voices:\n`);
      voices.forEach(voice => {
        console.log(`ID: ${voice.voice_id}`);
        console.log(`Name: ${voice.name}`);
        console.log(`Category: ${voice.category || 'N/A'}`);
        console.log(`Description: ${voice.description || 'N/A'}`);
        console.log('---');
      });

    } else if (command === 'generate') {
      const text = args[1];
      const output = args[2] || 'output.mp3';

      if (!text) {
        console.error('Error: Missing text argument');
        process.exit(1);
      }

      console.log(`Generating TTS for: "${text}"\n`);

      const cost = tts.getEstimatedCost(text);
      console.log(`Characters: ${cost.characters}`);
      console.log(`Estimated cost: $${cost.cost}\n`);

      await tts.generateSpeechToFile(text, output);
      console.log(`✓ Audio saved to: ${output}`);

    } else if (command === 'narrate') {
      const storyboardPath = args[1];

      if (!storyboardPath || !fs.existsSync(storyboardPath)) {
        console.error('Error: Storyboard file not found');
        process.exit(1);
      }

      const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf-8'));

      console.log('Narration Generator');
      console.log('===================\n');
      console.log('This will help you generate narration for your storyboard.\n');

      // Interactive narration script builder
      const narrationScript = [];

      console.log('Enter narration text for events (press Enter to skip, "done" to finish):\n');

      for (let i = 0; i < Math.min(storyboard.timeline.length, 10); i++) {
        const event = storyboard.timeline[i];
        console.log(`\n[${i}] ${event.type} at ${event.t}ms`);

        // For demo purposes, auto-generate simple narration
        let narrationText = '';
        switch (event.type) {
          case 'navigate':
            narrationText = `We're navigating to ${new URL(event.url).hostname}`;
            break;
          case 'click':
            narrationText = `Now I'll click on this button`;
            break;
          case 'type':
            narrationText = `Let me type in ${event.text?.split(' ').slice(0, 3).join(' ')}`;
            break;
          default:
            narrationText = '';
        }

        if (narrationText) {
          narrationScript.push({
            startTime: event.t,
            text: narrationText,
            voiceId: 'EXAVITQu4vr4xnSDxMaL' // Sarah voice
          });

          console.log(`  → Generated: "${narrationText}"`);
        }
      }

      if (narrationScript.length === 0) {
        console.log('\nNo narration generated. Exiting.');
        process.exit(0);
      }

      console.log(`\nGenerating TTS for ${narrationScript.length} segments...\n`);

      const outputDir = path.join(path.dirname(storyboardPath), 'narration');
      const updatedStoryboard = await tts.generateNarrationFromStoryboard(
        storyboard,
        narrationScript,
        outputDir
      );

      // Save updated storyboard
      const outputPath = storyboardPath.replace('.json', '_with_narration.json');
      fs.writeFileSync(outputPath, JSON.stringify(updatedStoryboard, null, 2));

      console.log(`\n✓ Narration generated!`);
      console.log(`✓ Audio files saved to: ${outputDir}`);
      console.log(`✓ Updated storyboard: ${outputPath}`);

    } else if (command === 'script') {
      const scriptPath = args[1];

      if (!scriptPath || !fs.existsSync(scriptPath)) {
        console.error('Error: Script file not found');
        process.exit(1);
      }

      const script = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));

      console.log('Processing narration script...\n');

      const outputDir = path.join(path.dirname(scriptPath), 'audio');
      const segments = await tts.processNarrationScript(script, outputDir);

      console.log(`\n✓ Generated ${segments.length} audio segments`);
      console.log(`✓ Total duration: ${(segments[segments.length - 1].startTime + segments[segments.length - 1].duration) / 1000}s`);

      // Save manifest
      const manifestPath = path.join(outputDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(segments, null, 2));
      console.log(`✓ Manifest saved: ${manifestPath}`);

    } else {
      console.error(`Unknown command: ${command}`);
      console.log('Run "node src/tts.js help" for usage information');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
