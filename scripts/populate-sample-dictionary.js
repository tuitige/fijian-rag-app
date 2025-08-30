/**
 * Script to populate sample dictionary data for testing vocabulary processing
 * Run after CDK deployment to add test data to DynamoDB
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const ddbClient = new DynamoDBClient({});

// Sample Fijian dictionary entries for testing
const SAMPLE_ENTRIES = [
  {
    word: 'bula',
    language: 'fijian',
    english_translation: 'hello, life, health, greetings',
    part_of_speech: 'noun/interjection',
    example_sentences: ['Bula vinaka! - Good hello!', 'Au bula vinaka - I am well/healthy'],
    pronunciation: 'boo-lah',
    related_words: ['vinaka', 'bulabula']
  },
  {
    word: 'vinaka',
    language: 'fijian',
    english_translation: 'good, thank you',
    part_of_speech: 'adjective/interjection',
    example_sentences: ['Vinaka vaka levu - Thank you very much', 'Edua na ka vinaka - It is a good thing'],
    pronunciation: 'vee-nah-kah',
    related_words: ['bula', 'levu']
  },
  {
    word: 'levu',
    language: 'fijian', 
    english_translation: 'big, large, much, very',
    part_of_speech: 'adjective/adverb',
    example_sentences: ['Vale levu - big house', 'Vinaka vaka levu - thank you very much'],
    pronunciation: 'leh-voo',
    related_words: ['lailai', 'vinaka']
  },
  {
    word: 'lailai',
    language: 'fijian',
    english_translation: 'small, little',
    part_of_speech: 'adjective',
    example_sentences: ['Vale lailai - small house', 'Gone lailai - small child'],
    pronunciation: 'lie-lie',
    related_words: ['levu', 'gone']
  },
  {
    word: 'vale',
    language: 'fijian',
    english_translation: 'house, home, building',
    part_of_speech: 'noun',
    example_sentences: ['Au curu ki vale - I go into the house', 'Vale levu - big house'],
    pronunciation: 'vah-leh',
    related_words: ['curu', 'levu', 'lailai']
  },
  {
    word: 'gone',
    language: 'fijian',
    english_translation: 'child, children',
    part_of_speech: 'noun',
    example_sentences: ['Gone lailai - small child', 'Na gone qo - this child'],
    pronunciation: 'go-neh',
    related_words: ['lailai', 'tamana', 'tinana']
  },
  {
    word: 'curu',
    language: 'fijian',
    english_translation: 'to enter, go into',
    part_of_speech: 'verb',
    example_sentences: ['Au curu ki vale - I enter the house', 'Era curu mai - They come in'],
    pronunciation: 'tsoo-roo',
    related_words: ['vale', 'lako']
  },
  {
    word: 'lako',
    language: 'fijian',
    english_translation: 'to go, to walk',
    part_of_speech: 'verb',
    example_sentences: ['Au lako ki suva - I go to Suva', 'Era lako mai - They come here'],
    pronunciation: 'lah-ko',
    related_words: ['curu', 'mai']
  },
  {
    word: 'mai',
    language: 'fijian',
    english_translation: 'come, towards speaker',
    part_of_speech: 'directional particle',
    example_sentences: ['Era lako mai - They come here', 'Yaco mai - Come here'],
    pronunciation: 'my',
    related_words: ['lako', 'yaco']
  },
  {
    word: 'kava',
    language: 'fijian',
    english_translation: 'traditional ceremonial drink, pepper plant (Piper methysticum)',
    part_of_speech: 'noun',
    example_sentences: ['Na kava sa yawa - The kava is bitter', 'Era gunu kava - They drink kava'],
    pronunciation: 'kah-vah',
    related_words: ['gunu', 'yawa']
  },
  {
    word: 'yawa',
    language: 'fijian',
    english_translation: 'bitter, bad, terrible',
    part_of_speech: 'adjective',
    example_sentences: ['Na kava sa yawa - The kava is bitter', 'Yawa sara! - Very bad!'],
    pronunciation: 'yah-wah',
    related_words: ['kava', 'sara']
  },
  {
    word: 'sara',
    language: 'fijian',
    english_translation: 'very, extremely, indeed',
    part_of_speech: 'adverb',
    example_sentences: ['Yawa sara! - Very bad!', 'Vinaka sara - Very good'],
    pronunciation: 'sah-rah',
    related_words: ['yawa', 'vinaka']
  },
  {
    word: 'vakacava',
    language: 'fijian',
    english_translation: 'how, what way',
    part_of_speech: 'interrogative',
    example_sentences: ['Vakacava? - How?', 'Vakacava o cakava? - How do you do it?'],
    pronunciation: 'vah-kah-tsah-vah',
    related_words: ['cakava']
  },
  {
    word: 'na',
    language: 'fijian',
    english_translation: 'the (definite article)',
    part_of_speech: 'article',
    example_sentences: ['Na vale - The house', 'Na gone - The child'],
    pronunciation: 'nah',
    related_words: ['e', 'edua']
  },
  {
    word: 'sa',
    language: 'fijian',
    english_translation: 'aspect marker (perfective/stative)',
    part_of_speech: 'particle',
    example_sentences: ['Sa bera - It is good', 'Sa caka - It is done'],
    pronunciation: 'sah',
    related_words: ['era', 'e']
  }
];

async function populateSampleDictionary() {
  const tableName = process.env.DICTIONARY_TABLE || 'DictionaryTable';
  
  console.log(`Populating ${SAMPLE_ENTRIES.length} sample entries to ${tableName}...`);
  
  for (const entry of SAMPLE_ENTRIES) {
    try {
      const item = marshall({
        ...entry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      await ddbClient.send(new PutItemCommand({
        TableName: tableName,
        Item: item
      }));
      
      console.log(`✓ Added: ${entry.word}`);
    } catch (error) {
      console.error(`✗ Error adding ${entry.word}:`, error);
    }
  }
  
  console.log('Sample dictionary population complete!');
}

// Run if called directly
if (require.main === module) {
  populateSampleDictionary().catch(console.error);
}

module.exports = { populateSampleDictionary, SAMPLE_ENTRIES };