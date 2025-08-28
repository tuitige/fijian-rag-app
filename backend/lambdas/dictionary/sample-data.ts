/**
 * Sample Fijian dictionary data for testing the RAG pipeline
 * This provides sample entries to populate the dictionary tables and OpenSearch index
 */

import { DictionaryEntry } from './processor';

export const SAMPLE_DICTIONARY_ENTRIES: DictionaryEntry[] = [
  {
    fijian: 'bula',
    english: 'hello, life, health, greetings',
    pos: 'noun/interjection',
    examples: [
      'Bula vinaka! - Good hello!',
      'Au bula vinaka - I am well/healthy'
    ],
    pronunciation: 'boo-lah',
    related: ['vinaka', 'bulabula']
  },
  {
    fijian: 'vinaka',
    english: 'good, thank you',
    pos: 'adjective/interjection',
    examples: [
      'Vinaka vaka levu - Thank you very much',
      'Edua na ka vinaka - It is a good thing'
    ],
    pronunciation: 'vee-nah-kah',
    related: ['bula', 'levu']
  },
  {
    fijian: 'levu',
    english: 'big, large, much, very',
    pos: 'adjective/adverb',
    examples: [
      'Vale levu - big house',
      'Vinaka vaka levu - thank you very much'
    ],
    pronunciation: 'leh-voo',
    related: ['lailai', 'vinaka']
  },
  {
    fijian: 'lailai',
    english: 'small, little',
    pos: 'adjective',
    examples: [
      'Vale lailai - small house',
      'Gone lailai - small child'
    ],
    pronunciation: 'lie-lie',
    related: ['levu', 'gone']
  },
  {
    fijian: 'vale',
    english: 'house, home, building',
    pos: 'noun',
    examples: [
      'Au curu ki vale - I go into the house',
      'Vale levu - big house'
    ],
    pronunciation: 'vah-leh',
    related: ['curu', 'levu', 'lailai']
  },
  {
    fijian: 'gone',
    english: 'child, children',
    pos: 'noun',
    examples: [
      'Gone lailai - small child',
      'Na gone qo - this child'
    ],
    pronunciation: 'go-neh',
    related: ['lailai', 'tamana', 'tinana']
  },
  {
    fijian: 'curu',
    english: 'to enter, go into',
    pos: 'verb',
    examples: [
      'Au curu ki vale - I enter the house',
      'Era curu mai - They come in'
    ],
    pronunciation: 'tsoo-roo',
    related: ['vale', 'lako']
  },
  {
    fijian: 'lako',
    english: 'to go, to walk',
    pos: 'verb',
    examples: [
      'Au lako ki suva - I go to Suva',
      'Era lako mai - They come here'
    ],
    pronunciation: 'lah-ko',
    related: ['curu', 'mai']
  },
  {
    fijian: 'mai',
    english: 'come, towards speaker',
    pos: 'directional particle',
    examples: [
      'Lako mai! - Come here!',
      'Era curu mai - They come in'
    ],
    pronunciation: 'my',
    related: ['lako', 'yani']
  },
  {
    fijian: 'yani',
    english: 'go, away from speaker',
    pos: 'directional particle',
    examples: [
      'Lako yani! - Go away!',
      'Au lako yani - I go away'
    ],
    pronunciation: 'yah-nee',
    related: ['lako', 'mai']
  },
  {
    fijian: 'moce',
    english: 'goodbye, goodnight, sleep',
    pos: 'interjection/verb',
    examples: [
      'Moce mada! - Goodbye!',
      'Au moce - I sleep'
    ],
    pronunciation: 'mo-theh',
    related: ['mada', 'bula']
  },
  {
    fijian: 'mada',
    english: 'just, only, first (particle)',
    pos: 'particle',
    examples: [
      'Moce mada - just goodbye',
      'Au kana mada - I just eat'
    ],
    pronunciation: 'mah-dah',
    related: ['moce', 'ga']
  },
  {
    fijian: 'kana',
    english: 'to eat, food',
    pos: 'verb/noun',
    examples: [
      'Au kana - I eat',
      'Na kana - the food'
    ],
    pronunciation: 'kah-nah',
    related: ['gunu', 'kakana']
  },
  {
    fijian: 'gunu',
    english: 'to drink',
    pos: 'verb',
    examples: [
      'Au gunu wai - I drink water',
      'Era gunu yaqona - They drink kava'
    ],
    pronunciation: 'goo-noo',
    related: ['kana', 'wai', 'yaqona']
  },
  {
    fijian: 'wai',
    english: 'water',
    pos: 'noun',
    examples: [
      'Wai bose - cold water',
      'Au gunu wai - I drink water'
    ],
    pronunciation: 'why',
    related: ['gunu', 'bose']
  },
  {
    fijian: 'yaqona',
    english: 'kava (traditional drink)',
    pos: 'noun',
    examples: [
      'Era gunu yaqona - They drink kava',
      'Sevusevu yaqona - kava ceremony'
    ],
    pronunciation: 'yah-go-nah',
    related: ['gunu', 'sevusevu']
  },
  {
    fijian: 'sevusevu',
    english: 'traditional presentation ceremony',
    pos: 'noun',
    examples: [
      'Sevusevu yaqona - kava ceremony',
      'Na sevusevu qo - this ceremony'
    ],
    pronunciation: 'seh-voo-seh-voo',
    related: ['yaqona', 'bose']
  },
  {
    fijian: 'bose',
    english: 'cold, meeting, assembly',
    pos: 'adjective/noun',
    examples: [
      'Wai bose - cold water',
      'Na bose - the meeting'
    ],
    pronunciation: 'bo-seh',
    related: ['wai', 'sevusevu']
  },
  {
    fijian: 'tamana',
    english: 'father, dad',
    pos: 'noun',
    examples: [
      'Noqu tamana - my father',
      'Na tamana - the father'
    ],
    pronunciation: 'tah-mah-nah',
    related: ['tinana', 'gone']
  },
  {
    fijian: 'tinana',
    english: 'mother, mom',
    pos: 'noun',
    examples: [
      'Noqu tinana - my mother',
      'Na tinana - the mother'
    ],
    pronunciation: 'tee-nah-nah',
    related: ['tamana', 'gone']
  }
];