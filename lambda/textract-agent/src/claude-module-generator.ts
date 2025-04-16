import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event;
  const { title, fullText } = body;

  const prompt = `You are an AI language tutor. Based on the following Fijian language text, create a learning module with:
1. Title
2. Summary (2-3 sentences)
3. 3–5 examples with:
   - Fijian phrase
   - English translation
   - Brief notes or explanation

Return your result in JSON like this:
{
  "modules": [
    {
      "title": "...",
      "summary": "...",
      "examples": [
        { "fijian": "...", "english": "...", "notes": "..." },
        ...
      ]
    }
  ]
}

Source text:
\n\n${fullText}`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const result = await bedrock.send(command);
  const raw = Buffer.from(result.body!).toString('utf-8');
  console.log('Claude raw output:', raw);
  
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('❌ Failed to parse Claude response body:', err);
    throw new Error('Claude returned malformed response');
  }
  
  const textBody = parsed?.content?.[0]?.text || '';
  console.log('Extracted Claude content:', textBody);
  
  // Optional cleanup: extract JSON if wrapped in markdown
  const jsonMatch = textBody.match(/```json[\\s\\n]*({[\\s\\S]+})[\\s\\n]*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : textBody;
  
  let parsedModule;
  try {
    parsedModule = JSON.parse(jsonStr);
  } catch (err) {
    console.error('❌ Failed to parse Claude JSON block:', err);
    throw new Error('Claude returned invalid JSON module structure');
  }
  

  const item = {
    id: { S: uuidv4() },
    type: { S: 'module' },
    source: { S: 'Claude' },
    verified: { BOOL: false },
    learningModuleTitle: { S: title },
    createdAt: { S: new Date().toISOString() },
    rawJson: { S: JSON.stringify(parsedModule) },
    fullText: { S: fullText }
  };

  // Save to DynamoDB
  await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));

  // Save to S3 for audit/archive
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `${title}/module.json`,
    Body: JSON.stringify(parsedModule, null, 2),
    ContentType: 'application/json'
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Module generated and saved', title })
  };
};