import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { learningModuleTitle, text } = body;

    if (!learningModuleTitle || !text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing learningModuleTitle or text' })
      };
    }

    const prompt = `You are a Fijian language educator and curriculum writer. Analyze the following material scanned from a Fijian grammar book and extract as much useful content as possible for learners.

Return a JSON object with a single key "modules": an array of modules, each with:
- "title": the topic
- "summary": a helpful summary of usage
- "examples": a list of objects with "fijian", "english", and "notes"

Text:
${text}`;

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const response = await bedrock.send(command);
    const rawBody = Buffer.from(response.body).toString('utf-8');
    const textBody = JSON.parse(rawBody).content?.[0]?.text || '';

    const jsonMatch = textBody.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    const item = {
      id: { S: uuidv4() },
      type: { S: 'module' },
      source: { S: 'Claude' },
      verified: { BOOL: false },
      learningModuleTitle: { S: learningModuleTitle },
      createdAt: { S: new Date().toISOString() },
      fullText: { S: text },
      rawJson: { S: JSON.stringify(parsed.modules || []) }
    };

    await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${learningModuleTitle}/module.json`,
      Body: JSON.stringify({ fullText: text, claudeResponse: textBody }),
      ContentType: 'application/json'
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Module generated and stored' })
    };
  } catch (err) {
    console.error('ClaudeModuleGenerator error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Internal server error', error: String(err) })
    };
  }
};