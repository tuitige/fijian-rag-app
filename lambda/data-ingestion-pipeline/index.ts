import { APIGatewayProxyHandler } from 'aws-lambda';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, PutItemCommand, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { isDuplicate } from './dedupUtils';
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { TextBlock } from '@anthropic-ai/sdk/resources';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getAnthropicApiKey } from '../shared/utils';

const bedrock = new BedrockRuntimeClient({});
const ddb = new DynamoDBClient({});

const TRANSLATIONS_REVIEW_TABLE_NAME = process.env.TRANSLATIONS_REVIEW_TABLE_NAME || '';
const VERIFIED_TRANSLATIONS_TABLE = process.env.VERIFIED_TRANSLATIONS_TABLE || '';
const VERIFIED_VOCAB_TABLE = process.env.VERIFIED_VOCAB_TABLE || '';

const secretsClient = new SecretsManagerClient({});
const SECRET_ARN = process.env.ANTHROPIC_SECRET_ARN!;
const QUALITY_TABLE = process.env.TRANSLATION_QUALITY_TABLE || '';

async function chooseModel(): Promise<string> {
  if (!QUALITY_TABLE) return 'claude-3-haiku-20240307';
  try {
    const res = await ddb.send(
      new GetItemCommand({
        TableName: QUALITY_TABLE,
        Key: { metric: { S: 'averageQuality' } }
      })
    );
    const score = res.Item?.value?.N ? parseFloat(res.Item.value.N) : 1;
    return score < 0.85 ? 'claude-3-sonnet-20240229' : 'claude-3-haiku-20240307';
  } catch (err) {
    console.warn('[chooseModel] failed to fetch metric', err);
    return 'claude-3-haiku-20240307';
  }
}

/*
async function getAnthropicApiKey(): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: SECRET_ARN });
  const secret = await secretsClient.send(command);
  return secret.SecretString!;
}
*/

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log('[handler] Received event:', JSON.stringify(event, null, 2));

    const apiKey = await getAnthropicApiKey();
    const anthropic = new Anthropic({ apiKey });   

    const { type, url } = JSON.parse(event.body || '{}');
    if (type !== 'article' || !url) {
      return { statusCode: 400, body: 'Missing or invalid type/url' };
    }

    const html = (await axios.get(url)).data;
    const $ = cheerio.load(html);
    const paragraphs = $('.entry-content p').map((i, el) => $(el).text()).get();
    const model = await chooseModel();

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const compositeKey = generateDataKey(url, i);

const msg = await anthropic.messages.create({
  model,
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

Translate the paragraph below and extract three sets of results using this exact schema:

---

1. The full translated paragraph as an object named "paragraph" with:
   - "sourceText": the original Fijian paragraph
   - "aiTranslation": your best English translation

2. A list of phrase pairs as an array named "phrases". Each item must include:
   - "sourceText": a Fijian phrase (minimum **3 words**)
   - "aiTranslation": its English translation

3. A list of vocabulary items as an array named "vocabulary". Each item must include:
   - "sourceText": a single Fijian word
   - "partOfSpeech": one of: "noun", "verb", "adjective", "adverb", "pronoun"
   - "aiTranslation": the best English meaning for that word

---

⚠️ Follow these strict rules:
- Only include valid JSON
- Only include items with real translations — do NOT return placeholder values like "source", "target", or "word"
- Do NOT translate or change the key names: "sourceText", "aiTranslation", "partOfSpeech"
- Skip any fragments or function words like "na", "o", "e", "sa"

---

📦 Example response:

{
  "paragraph": {
    "sourceText": "Original Fijian paragraph here",
    "aiTranslation": "English translation of the paragraph"
  },
  "phrases": [
    { "sourceText": "Fijian phrase here", "aiTranslation": "English equivalent" }
  ],
  "vocabulary": [
    { "sourceText": "Fijian word", "partOfSpeech": "noun", "aiTranslation": "English meaning" }
  ]
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

        if (!parsed) throw new Error('Invalid response structure');
      } catch (e) {
        console.error('[Claude] JSON parsing failed:', e);
        console.error('[Claude] Raw content:', JSON.stringify(msg.content, null, 2));
        continue;
      }

      //const { translatedParagraph, atomicPhrases = [], vocabulary = [] } = parsed;
      const {
        paragraph,
        phrases = [],
        vocabulary = []
      } = parsed;

      if (!paragraph || !paragraph.sourceText || !paragraph.aiTranslation) {
        throw new Error('Missing paragraph translation');
      }

      await storeItem('paragraph', compositeKey, {
        articleUrl: url,
        sourceText: paragraph.sourceText,
        aiTranslation: paragraph.aiTranslation,
        finalTranslation: paragraph.aiTranslation
      });


      let phraseInserted = 0;
      let phraseSkipped = 0;
      for (let j = 0; j < phrases.length; j++) {
        const phrase = phrases[j];
        const isDup = await isDuplicate('translation', phrase.sourceText, phrase.aiTranslation);

        await storeItemWithCount('phrase', `${compositeKey}_${j}`, {
          sourceText: phrase.sourceText,
          aiTranslation: phrase.aiTranslation,
          finalTranslation: phrase.aiTranslation,
          dedupKey: `${phrase.sourceText.toLowerCase()}::${phrase.aiTranslation.toLowerCase()}`
        }, isDup);
        phraseInserted++;
      }

      let vocabInserted = 0;
      let vocabSkipped = 0;
      for (let k = 0; k < vocabulary.length; k++) {
        const vocab = vocabulary[k];
        const isDup = await isDuplicate('vocab', vocab.sourceText, vocab.aiTranslation);

        await storeItemWithCount('vocab', `${compositeKey}_${k}`, {
          sourceText: vocab.sourceText,
          aiTranslation: vocab.aiTranslation,
          finalTranslation: vocab.aiTranslation,
          dedupKey: `${vocab.sourceText.toLowerCase()}::${vocab.aiTranslation.toLowerCase()}`
        }, isDup);
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

async function storeItemWithCount(
  dataType: string,
  dataKey: string,
  fields: Record<string, string>,
  isDup: boolean
) {
  const key = {
    dataType: { S: dataType },
    dataKey: { S: dataKey }
  };

  if (isDup) {
    // Update frequency counter
    await ddb.send(new UpdateItemCommand({
      TableName: TRANSLATIONS_REVIEW_TABLE_NAME,
      Key: key,
      UpdateExpression: 'SET frequency = if_not_exists(frequency, :start) + :inc',
      ExpressionAttributeValues: {
        ':start': { N: '1' },
        ':inc': { N: '1' }
      }
    }));
  } else {
    // Insert with frequency = 1
    const item: Record<string, { S: string } | { N: string }> = {
      ...key,
      verified: { S: 'false' },
      frequency: { N: '1' }
    };

    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null) {
        item[k] = { S: v };
      } else {
        console.warn(`[storeItemWithCount] Skipped undefined/null field "${k}"`);
      }
    }

    await ddb.send(new PutItemCommand({
      TableName: TRANSLATIONS_REVIEW_TABLE_NAME,
      Item: item
    }));
  }
}

function generateDataKey(articleUrl: string, paragraphIndex: number) {
  const articleId = createHash('md5').update(articleUrl).digest('hex');
  return `${articleId}#p${paragraphIndex}`;
}
