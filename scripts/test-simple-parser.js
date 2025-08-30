/**
 * Test the simple dictionary parser
 */

import { parseDictionary, parseEntry } from './simple-dict-parser.js';
import fs from 'fs';

console.log('=== Testing Simple Dictionary Parser ===\n');

// Test individual entry parsing
console.log('Testing individual entry parsing:');
const testLines = [
  'bula n. life, health, greeting',
  'vinaka adj. good, thank you',
  'agelo (or) yagelo (Eng., Rom. Cath.) n. angel.',
  'ba 1. n. edible stalk of taro, considered a delicacy',
  'vale n. house, home, building',
  'sa particle aspect marker (perfective/stative)',
  'na art. the (definite article)',
  '123', // Should be filtered
  'FIJIAN DICTIONARY', // Should be filtered
];

testLines.forEach((line, i) => {
  const result = parseEntry(line);
  if (result) {
    console.log(`${i + 1}. "${line}" -> ${result.length} entries:`);
    result.forEach(entry => {
      console.log(`   "${entry.word}" (${entry.part_of_speech}) -> "${entry.english_translation}"`);
    });
  } else {
    console.log(`${i + 1}. "${line}" -> FILTERED/INVALID`);
  }
});

// Test with actual dictionary file
const dictPath = '/tmp/fijian-dict-preprocessed-easy.txt';
if (fs.existsSync(dictPath)) {
  console.log('\n=== Testing with full dictionary file ===');
  
  const content = fs.readFileSync(dictPath, 'utf8');
  console.log(`File size: ${content.length} characters`);
  
  const entries = parseDictionary(content);
  console.log(`\nParsed ${entries.length} total entries`);
  
  // Check for common words
  const commonWords = ['bula', 'vinaka', 'vale', 'na', 'sa', 'kava', 'yawa'];
  console.log('\nLooking for common Fijian words:');
  commonWords.forEach(word => {
    const found = entries.find(e => e.word === word);
    if (found) {
      console.log(`✓ "${word}": ${found.english_translation} (${found.part_of_speech})`);
    } else {
      console.log(`✗ "${word}": not found`);
    }
  });
  
  // Show distribution by part of speech
  console.log('\nPart of speech distribution:');
  const posCount = {};
  entries.forEach(entry => {
    posCount[entry.part_of_speech] = (posCount[entry.part_of_speech] || 0) + 1;
  });
  Object.entries(posCount).sort((a, b) => b[1] - a[1]).forEach(([pos, count]) => {
    console.log(`  ${pos}: ${count} entries`);
  });
  
  // Show sample entries
  console.log('\nFirst 10 entries:');
  entries.slice(0, 10).forEach((entry, i) => {
    console.log(`${i + 1}. "${entry.word}" -> "${entry.english_translation}"`);
  });
  
} else {
  console.log('\nDictionary file not found at /tmp/fijian-dict-preprocessed-easy.txt');
}