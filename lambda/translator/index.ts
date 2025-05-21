import { APIGatewayProxyHandler } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ParagraphTranslation } from '../shared/types';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || '';

function buildMessagePrompt(paragraph: string) {
  return `
You are a Fijian language linguist.
Take this Fijian paragraph and do the following:
1. Translate the entire paragraph to English.
2. Extract atomic Fijian phrase pairs and translate each.
3. Extract Fijian vocabulary words with part of speech and English meaning.

Paragraph: ${paragraph}

Respond ONLY in this exact JSON format:
{
  "translatedParagraph": "...",
  "atomicPhrases": [
    { "fijian": "...", "english": "..." }
  ],
  "vocabulary": [
    { "word": "...", "type": "...", "meaning": "..." }
  ]
}
Do not include explanations or markdown. Strictly return valid JSON.
`.trim();
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('[translator] Received event:', event.body);

  if (!event.body) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      body: JSON.stringify({ error: 'Missing request body' })
    };
  }

  const { articleId, paragraphs } = JSON.parse(event.body);
  if (!Array.isArray(paragraphs)) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      body: JSON.stringify({ error: 'Invalid paragraphs array' })
    };
  }

  const results: ParagraphTranslation[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const paragraphId = `p${i}`;
    const messagePrompt = buildMessagePrompt(paragraph);

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        messages: [
          {
            role: 'user',
            content: messagePrompt
          }
        ],
        max_tokens: 1000
      })
    });

    const response = await bedrock.send(command);
    const rawBody = Buffer.from(response.body).toString('utf-8');
    console.log('[translator] Bedrock raw response:', rawBody);

    let parsed;
    try {
      parsed = JSON.parse(rawBody).content[0].text; // Claude returns `content` array
      parsed = JSON.parse(parsed);
    } catch (err) {
      console.error('[translator] Failed to parse Claude response:', err);
      console.error('[translator] Raw response:', rawBody);
      continue;
    }

    const paragraphTranslation: ParagraphTranslation = {
      originalText: paragraph,
      translatedText: parsed.translatedParagraph || '',
      originalLanguage: 'fijian',
      verified: false,
      paragraphId,
      atomicPhrases: parsed.atomicPhrases || [],
      vocabulary: parsed.vocabulary || []
    };

    results.push(paragraphTranslation);

    // Store paragraph
    await ddb.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        dataType: { S: `article#${articleId}` },
        dataKey: { S: `paragraph#${paragraphId}` },
        articleId: { S: articleId },
        paragraphId: { S: paragraphId },
        originalText: { S: paragraph },
        translatedText: { S: paragraphTranslation.translatedText },
        originalLanguage: { S: 'fijian' },
        verified: { S: 'false' }
      }
    }));

    // Store atomic phrases
    for (let j = 0; j < paragraphTranslation.atomicPhrases.length; j++) {
      const phrase = paragraphTranslation.atomicPhrases[j];
      await ddb.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          dataType: { S: `article#${articleId}` },
          dataKey: { S: `phrase#${paragraphId}_${j}` },
          articleId: { S: articleId },
          paragraphId: { S: paragraphId },
          type: { S: 'atomicPhrase' },
          fijian: { S: phrase.fijian },
          english: { S: phrase.english },
          verified: { S: 'false' }
        }
      }));
    }

    // Store vocabulary
    for (let k = 0; k < paragraphTranslation.vocabulary.length; k++) {
      const vocab = paragraphTranslation.vocabulary[k];
      await ddb.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          dataType: { S: `article#${articleId}` },
          dataKey: { S: `vocab#${paragraphId}_${k}` },
          articleId: { S: articleId },
          paragraphId: { S: paragraphId },
          type: { S: 'vocabulary' },
          word: { S: vocab.word },
          partOfSpeech: { S: vocab.type },
          meaning: { S: vocab.meaning },
          verified: { S: 'false' }
        }
      }));
    }
  }

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
    body: JSON.stringify({ articleId, translations: results })
  };
};
