import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { generateEmbedding } from '../shared/bedrock/generateEmbedding';
import { indexTranslation } from '../shared/opensearch/indexOpenSearch';
import { generateModuleFromText } from '../shared/bedrock/callClaude';
import { extractTranslationPairsFromText } from './helpers/extractTranslationPairsFromText';
import { extractPeaceCorpsPhrases } from './helpers/extractPeaceCorpsPhrases';
import { indexToOpenSearch } from '../shared/opensearch/indexLearningModule';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { 
  CONTENT_BUCKET_NAME, 
  DDB_LEARNING_MODULES_TABLE, 
  CLAUDE_3_5_SONNET_V2, 
  FIJI_RAG_REGION 
} from '../shared/constants.ts';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';


const s3 = new S3Client({ region: FIJI_RAG_REGION });
const ddb = new DynamoDBClient({ region: FIJI_RAG_REGION });
const bedrock = new BedrockRuntimeClient({ region: FIJI_RAG_REGION });

export const handler = async (event: any) => {
  try {
    const chapterText = JSON.parse(event.body || '{}').chapterText || '';

    if (!chapterText) {
      throw new Error('No chapterText provided.');
    }

    console.log('Received chapter text:', chapterText.substring(0, 200) + '...');

    // 1. Create the prompt
    const prompt = createLessonPlanPrompt(chapterText);

    // 2. Send to Claude
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: CLAUDE_3_5_SONNET_V2.modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31", // required field
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3,
        top_k: 250,
        top_p: 0.9,
        stop_sequences: []
      })
    }));

    const bedrockOutput = JSON.parse(Buffer.from(response.body).toString('utf8'));
    const rawCompletion = bedrockOutput.completion.trim();

    console.log('Claude raw response:', rawCompletion.substring(0, 200) + '...');

    // 3. Parse Claude's JSON
    const moduleData = JSON.parse(rawCompletion);

    if (!moduleData.moduleId || !moduleData.steps) {
      throw new Error('Claude output missing moduleId or steps.');
    }

    // 4. Store in DynamoDB
    const command = new PutItemCommand({
      TableName: DDB_LEARNING_MODULES_TABLE,
      Item: {
        moduleId: { S: moduleData.moduleId },
        title: { S: moduleData.title },
        description: { S: moduleData.description || '' },
        steps: { S: JSON.stringify(moduleData.steps) }
      }
    });

    const ddbPutResp = await ddb.send(command);
    console.log('DynamoDB response:', ddbPutResp);

    console.log(`Module ${moduleData.moduleId} inserted successfully.`);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: `Module ${moduleData.moduleId} inserted.` })
    };

  } catch (error) {
    console.error('Error in Aggregator Lambda:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Error generating lesson module.', error: error.message })
    };
  }
};

// --- Helper function to create the Claude prompt
function createLessonPlanPrompt(chapterText: string): string {
  return `
You are a Fijian language instructor designing lessons for an interactive learning app.

Given the following textbook chapter content, generate a complete structured lesson plan.

Follow this structure:

- Friendly introduction
- 3 to 6 teaching steps (explain key points, grammar, examples)
- 2 to 4 guided practice questions (student must answer)
- 2 to 3 short quiz questions
- 2 to 3 anticipated freeform student questions

Format the output as JSON using this schema:

{
  "moduleId": "string",
  "title": "string",
  "description": "string",
  "steps": [...]
}

Rules:
- Generate a clean, lowercase, hyphenated moduleId based on topic.
- Steps must logically guide the student through learning.
- Teaching steps should introduce vocabulary, grammar, and examples.
- Practice questions must directly match the teaching points.
- Return only the JSON, no commentary.

Input Chapter:
""" 
${chapterText}
"""
---
Return only the JSON.
  `.trim();
}
