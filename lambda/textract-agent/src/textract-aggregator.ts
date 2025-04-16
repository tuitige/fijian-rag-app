import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const lambda = new LambdaClient({ region: process.env.AWS_REGION });

const BUCKET_NAME = process.env.BUCKET_NAME!;
const CLAUDE_MODULE_GENERATOR_FN = process.env.CLAUDE_MODULE_GENERATOR_FN!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const prefix = event.queryStringParameters?.prefix;
  if (!prefix) {
    return { statusCode: 400, body: 'Missing ?prefix=chapter-folder' };
  }

  try {
    console.log('📥 Aggregator invoked with prefix:', prefix);
    console.log('📦 Using bucket:', BUCKET_NAME);

    // 1. List all pgX.json files in the folder
    const listResp = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `${prefix}/pg`
    }));

    const jsonFiles = (listResp.Contents || [])
      .map(obj => obj.Key!)
      .filter(key => key.endsWith('.json'))
      .sort();

    console.log(`🗂 Found ${jsonFiles.length} json files in ${prefix}`);
    jsonFiles.forEach((key) => console.log('  ➕', key));

    // 2. Load and combine paragraphs
    const allParagraphs: string[] = [];

    for (const key of jsonFiles) {
      const file = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      const body = await file.Body?.transformToString();
      const json = body ? JSON.parse(body) : null;

      console.log(`📄 Reading ${key} - parsed:`, json);

      //const paras = json?.paragraphs?.L?.map((p: any) => p.S) || [];
      const paras = Array.isArray(json?.paragraphs)
      ? json.paragraphs
      : json?.paragraphs?.L?.map((p: any) => p.S) || [];
      allParagraphs.push(...paras);
    }

    const fullText = allParagraphs.join('\n');
    console.log(`📚 Aggregated ${allParagraphs.length} paragraphs`);
    console.log(`🧾 Aggregated fullText (${fullText.length} chars):`, fullText.slice(0, 500));

    // 3. Call Claude generator Lambda with aggregated content
    const payload = JSON.stringify({ title: prefix, fullText });
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${prefix}/module-raw-aggregated.json`,
        Body: payload,
        ContentType: 'application/json'
      }));
      
    await lambda.send(new InvokeCommand({
        FunctionName: CLAUDE_MODULE_GENERATOR_FN,
        InvocationType: 'Event', // async
        Payload: Buffer.from(payload)
      }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Module aggregation and Claude trigger complete' })
    };
  } catch (err) {
    console.error('Aggregator error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal error', error: String(err) })
    };
  }
};