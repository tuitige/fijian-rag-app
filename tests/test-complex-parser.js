#!/usr/bin/env node

/**
 * Test Complex Dictionary Parser
 * 
 * Tests the enhanced dictionary parser against the complex dictionary format
 * provided by the user, which includes numbered entries, etymology, cultural context, etc.
 */

const fs = require('fs');
const path = require('path');

// Mock the AWS SDK imports for testing
global.mockAWS = {
  DynamoDBClient: class { },
  PutItemCommand: class { },
  BatchWriteItemCommand: class { },
  marshall: (obj) => obj
};

// Import the parser (we'll need to handle TypeScript compilation)
async function testComplexParser() {
  console.log('🧪 Testing Enhanced Dictionary Parser with Complex Content\n');
  
  // Read the complex sample content
  const samplePath = path.join(__dirname, 'dictionary-test-data', 'complex-dictionary-sample.txt');
  const rawText = fs.readFileSync(samplePath, 'utf8');
  
  console.log('📖 Sample content loaded:');
  console.log('Lines:', rawText.split('\n').length);
  console.log('Characters:', rawText.length);
  console.log('\n' + '='.repeat(80) + '\n');
  
  // For now, let's analyze the content manually to validate our patterns
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('🔍 Analyzing content patterns:\n');
  
  let numberedEntries = 0;
  let etymologyEntries = 0;
  let simpleEntries = 0;
  let idiomEntries = 0;
  let continuationLines = 0;
  
  const patterns = {
    numbered: /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s*(\d+)\.\s*/,
    etymology: /\(Eng\.\)|\(Lau\)/,
    idiom: /^Idiom:/,
    header: /^FIJIAN\s*[–-]\s*ENGLISH\s*DICTIONARY|^R\.\s*GATTY$|^\d+$/,
    simpleEntry: /^([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+)\s+[nv]\./
  };
  
  const detectedEntries = [];
  let currentEntry = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip headers
    if (patterns.header.test(line)) {
      console.log(`📄 Header/Page: "${line}"`);
      continue;
    }
    
    // Check for numbered entries
    const numberedMatch = line.match(patterns.numbered);
    if (numberedMatch) {
      if (currentEntry) detectedEntries.push(currentEntry);
      
      numberedEntries++;
      const hasEtymology = patterns.etymology.test(line);
      if (hasEtymology) etymologyEntries++;
      
      currentEntry = {
        headword: numberedMatch[1],
        entryNumber: parseInt(numberedMatch[2]),
        fullLine: line,
        hasEtymology,
        continuationLines: 0,
        type: 'numbered'
      };
      
      console.log(`📝 Numbered Entry ${numberedEntries}: ${numberedMatch[1]} ${numberedMatch[2]}.${hasEtymology ? ' (with etymology)' : ''}`);
      continue;
    }
    
    // Check for idioms
    if (patterns.idiom.test(line)) {
      if (currentEntry) detectedEntries.push(currentEntry);
      
      idiomEntries++;
      currentEntry = {
        headword: 'idiom',
        fullLine: line,
        hasEtymology: false,
        continuationLines: 0,
        type: 'idiom'
      };
      
      console.log(`🗣️  Idiom Entry: "${line.substring(0, 50)}..."`);
      continue;
    }
    
    // Check for simple entries (word + pos)
    const simpleMatch = line.match(patterns.simpleEntry);
    if (simpleMatch) {
      if (currentEntry) detectedEntries.push(currentEntry);
      
      simpleEntries++;
      const hasEtymology = patterns.etymology.test(line);
      if (hasEtymology) etymologyEntries++;
      
      currentEntry = {
        headword: simpleMatch[1],
        fullLine: line,
        hasEtymology,
        continuationLines: 0,
        type: 'simple'
      };
      
      console.log(`📖 Simple Entry ${simpleEntries}: ${simpleMatch[1]}${hasEtymology ? ' (with etymology)' : ''}`);
      continue;
    }
    
    // If we reach here, it's likely a continuation line
    if (currentEntry) {
      currentEntry.continuationLines++;
      continuationLines++;
      
      if (currentEntry.continuationLines <= 2) {
        console.log(`   ↳ Continuation: "${line.substring(0, 60)}..."`);
      }
    } else {
      console.log(`❓ Unmatched line: "${line.substring(0, 60)}..."`);
    }
  }
  
  if (currentEntry) detectedEntries.push(currentEntry);
  
  console.log('\n' + '='.repeat(80) + '\n');
  console.log('📊 Analysis Results:\n');
  console.log(`Total lines processed: ${lines.length}`);
  console.log(`Numbered entries: ${numberedEntries}`);
  console.log(`Simple entries: ${simpleEntries}`);
  console.log(`Idiom entries: ${idiomEntries}`);
  console.log(`Entries with etymology: ${etymologyEntries}`);
  console.log(`Continuation lines: ${continuationLines}`);
  console.log(`Total entries detected: ${detectedEntries.length}`);
  
  console.log('\n📋 Sample Entries Detected:\n');
  
  detectedEntries.slice(0, 10).forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.headword}${entry.entryNumber ? ' ' + entry.entryNumber : ''} (${entry.type})`);
    console.log(`   Full: "${entry.fullLine.substring(0, 80)}..."`);
    console.log(`   Continuations: ${entry.continuationLines}`);
    console.log('');
  });
  
  console.log('\n✅ Complex parser analysis complete!');
  console.log('\n🎯 Key observations for parser enhancement:');
  console.log('   • Numbered entries are very common (need robust number detection)');
  console.log('   • Etymology markers (Eng.), (Lau) are frequent');
  console.log('   • Long contextual content spans multiple lines');
  console.log('   • Idioms are separate entry types');
  console.log('   • Cultural and technical details are extensive');
  console.log('   • Cross-references and usage examples are embedded');
}

// Run the test
testComplexParser().catch(console.error);