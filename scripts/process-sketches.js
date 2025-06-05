#!/usr/bin/env node

/**
 * Script to process saved sketches JSON file and generate bank files with 16 random sketches each
 * Output format matches default-extension-pack.json structure
 * Usage: node scripts/process-sketches.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const INPUT_FILE = 'public/assets/banks/saved_sketches_glitch_editor_30_2021.json';
const OUTPUT_DIR = 'public/assets/banks/random';
const SKETCHES_PER_FILE = 16;
const MAX_FILES = 30;

function hasAttribution(decodedCode) {
  console.log('ATTTTR in ?', decodedCode);
  // Check for common attribution patterns in comments
  const attributionPatterns = [
    /\/\/.*by\s+[a-zA-Z]/i,
      /\/\/.*CC.*/i,
    /\/\/.*@[a-zA-Z]/i,
    /\/\/.*author/i,
    /\/\/.*created?\s+by/i,
    /\/\/.*made?\s+by/i,
    /\/\*.*by\s+[a-zA-Z]/i,
    /\/\*.*@[a-zA-Z]/i,
    /\/\*.*author/i,
    /\/\*.*created?\s+by/i,
    /\/\*.*made?\s+by/i
  ];
  
  return attributionPatterns.some(pattern => pattern.test(decodedCode));
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function main() {
  try {
    console.log('Reading saved sketches file...');
    
    // Read the input JSON file
    const rawData = readFileSync(INPUT_FILE, 'utf8');
    const sketches = JSON.parse(rawData);
    
    console.log(`Found ${sketches.length} sketches in the file`);
    
    // Filter sketches with attribution
    const sketchesWithAttribution = [];
    
    for (const sketch of sketches) {
      // Decode the Base64-encoded code, then URL-decode it
      let decodedCode = '';
      try {
        const base64Decoded = Buffer.from(sketch.code, 'base64').toString('utf8');
        decodedCode = decodeURIComponent(base64Decoded);
      } catch (error) {
        console.warn(`Warning: Could not decode code for sketch ${sketch._id}, skipping`);
        continue;
      }
      
      // Check for attribution
      if (hasAttribution(decodedCode)) {
        sketchesWithAttribution.push({
          ...sketch,
          decodedCode
        });
      }
    }
    
    console.log(`Found ${sketchesWithAttribution.length} sketches with attribution`);
    
    if (sketchesWithAttribution.length < SKETCHES_PER_FILE) {
      console.error(`❌ Not enough sketches with attribution (need at least ${SKETCHES_PER_FILE})`);
      process.exit(1);
    }
    
    // Shuffle sketches to randomize selection
    const shuffledSketches = shuffleArray(sketchesWithAttribution);
    
    // Determine how many files to create
    const maxPossibleFiles = Math.floor(shuffledSketches.length / SKETCHES_PER_FILE);
    const filesToCreate = Math.min(maxPossibleFiles, MAX_FILES);
    
    console.log(`Creating ${filesToCreate} bank files with ${SKETCHES_PER_FILE} sketches each...`);
    
    // Process sketches in groups
    for (let fileIndex = 0; fileIndex < filesToCreate; fileIndex++) {
      const startIndex = fileIndex * SKETCHES_PER_FILE;
      const endIndex = startIndex + SKETCHES_PER_FILE;
      const fileSketchs = shuffledSketches.slice(startIndex, endIndex);
      
      // Create slots array
      const slots = fileSketchs.map((sketch, slotIndex) => ({
        slotIndex,
        code: sketch.code, // Use original encoded code for output
        thumbnail: "" // Empty thumbnail - would need to be generated separately
      }));
      
      // Create bank structure matching default-extension-pack.json format
      const bankData = {
        version: 1,
        banks: [
          {
            bankIndex: 0,
            slots
          }
        ]
      };
      
      // Generate filename
      const filename = `bank-${fileIndex.toString().padStart(2, '0')}.json`;
      const filepath = join(OUTPUT_DIR, filename);
      
      // Write the JSON file
      writeFileSync(filepath, JSON.stringify(bankData, null, 2), 'utf8');
      
      console.log(`Created ${filename} with ${slots.length} sketches`);
    }
    
    console.log(`\n✅ Successfully created ${filesToCreate} bank files in ${OUTPUT_DIR}/`);
    console.log(`Each file contains ${SKETCHES_PER_FILE} random sketches with attribution`);
    console.log(`Total sketches used: ${filesToCreate * SKETCHES_PER_FILE} out of ${sketchesWithAttribution.length} with attribution`);
    
  } catch (error) {
    console.error('❌ Error processing sketches:', error.message);
    process.exit(1);
  }
}

main();