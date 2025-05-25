import { APIGatewayProxyHandler } from 'aws-lambda';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { isDuplicate } from './dedupUtils';
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { TextBlock } from '@anthropic-ai/sdk/resources';

const bedrock = new BedrockRuntimeClient({});
const ddb = new DynamoDBClient({});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TRANSLATIONS_REVIEW_TABLE_NAME = process.env.TRANSLATIONS_REVIEW_TABLE_NAME || '';
const VERIFIED_TRANSLATIONS_TABLE = process.env.VERIFIED_TRANSLATIONS_TABLE || '';
const VERIFIED_VOCAB_TABLE = process.env.VERIFIED_VOCAB_TABLE || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { type, url } = JSON.parse(event.body || '{}');
    if (type !== 'article' || !url) {
      return { statusCode: 400, body: 'Missing or invalid type/url' };
    }

    const html = (await axios.get(url)).data;
    const $ = cheerio.load(html);
    const paragraphs = $('.entry-content p').map((i, el) => $(el).text()).get();

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const compositeKey = generateDataKey(url, i);

const msg = await anthropic.messages.create({
  model: 'claude-3-haiku-20240307',
  max_tokens: 1200,
  temperature: 0.2,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `
You are a Fijian linguist.

Translate the following paragraph and extract:
1. A translated English paragraph.
2. Atomic phrase pairs (Fijian → English) in an array of { source, target } objects.
   - Only include meaningful phrases of **at least 3 words** in Fijian.
   - Avoid overly short or generic expressions (e.g. one-word or two-word fragments).
3. Vocabulary items with fields: word, partOfSpeech, and meaning.
   - Only include vocabulary if the **partOfSpeech is one of**: *noun*, *verb*, *adjective*, *adverb*, or *pronoun*.
   - Exclude articles, prepositions, and similar function words (e.g. “sa”, “na”, “o”, “e”).

⚠️ Respond ONLY with valid JSON. Do NOT include any explanation or commentary.

Your response MUST match this exact JSON shape:
{
  "translatedParagraph": string,
  "atomicPhrases": [ { "source": string, "target": string } ],
  "vocabulary": [ { "word": string, "partOfSpeech": string, "meaning": string } ]
}

Here is the paragraph:
${p}
          `.trim()
        }
      ]
    }
  ]
});


      // ✅ Extract and parse Claude response
      let parsed;
      try {
        const textContent = msg.content
          .filter((block): block is TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n');

        console.log('[Claude] Raw Text:', textContent);
        parsed = JSON.parse(textContent);

        if (!parsed || !parsed.translatedParagraph) throw new Error('Invalid response structure');
      } catch (e) {
        console.error('[Claude] JSON parsing failed:', e);
        console.error('[Claude] Raw content:', JSON.stringify(msg.content, null, 2));
        continue;
      }

      const { translatedParagraph, atomicPhrases = [], vocabulary = [] } = parsed;

      await storeItem('paragraph', compositeKey, {
        articleUrl: url,
        originalText: p,
        translatedText: translatedParagraph,
      });

      let phraseInserted = 0;
      let phraseSkipped = 0;
      for (let j = 0; j < atomicPhrases.length; j++) {
        const phrase = atomicPhrases[j];
        const isDup = await isDuplicate('translation', phrase.source, phrase.target);
        if (isDup) {
          phraseSkipped++;
          continue;
        }
        await storeItem('phrase', `${compositeKey}_${j}`, phrase);
        phraseInserted++;
      }

      let vocabInserted = 0;
      let vocabSkipped = 0;
      for (let k = 0; k < vocabulary.length; k++) {
        const vocab = vocabulary[k];
        const isDup = await isDuplicate('vocab', vocab.word, vocab.meaning);
        if (isDup) {
          vocabSkipped++;
          continue;
        }
        await storeItem('vocab', `${compositeKey}_${k}`, vocab);
        vocabInserted++;
      }

      console.log(`[summary] Paragraph p${i} — phrases: ${phraseInserted} stored, ${phraseSkipped} skipped | vocab: ${vocabInserted} stored, ${vocabSkipped} skipped`);
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'OK', paragraphs: paragraphs.length }),
    };
  } catch (err) {
    console.error('[ERROR]', err);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function storeItem(dataType: string, dataKey: string, fields: Record<string, string>) {
  const item: Record<string, { S: string }> = {
    dataType: { S: dataType },
    dataKey: { S: dataKey },
    verified: { S: 'false' }
  };

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) {
      item[k] = { S: v };
    } else {
      console.warn(`[storeItem] Skipped undefined/null field "${k}"`);
    }
  }

  await ddb.send(new PutItemCommand({
    TableName: TRANSLATIONS_REVIEW_TABLE_NAME,
    Item: item
  }));
}

function generateDataKey(articleUrl: string, paragraphIndex: number) {
  const articleId = createHash('md5').update(articleUrl).digest('hex');
  return `${articleId}#p${paragraphIndex}`;
}
