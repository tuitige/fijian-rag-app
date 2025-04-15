import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Readable } from 'stream';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const streamToString = async (stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });

export const handler = async (event: S3Event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  if (!key.endsWith("chapterText.json")) {
    console.log(`Skipping non-target file: ${key}`);
    return;
  }

  const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bodyStr = await streamToString(Body as Readable);
  const chapter = JSON.parse(bodyStr);

  const title = chapter.title;
  const fullText = chapter.fullText;

  const prompt = `
Create 1–3 beginner-friendly learning modules from this Fijian grammar chapter titled "${title}".

Each module should include:
- A "title"
- A "summary" of the concept
- 3–5 examples with:
  - "fijian": phrase
  - "english": translation
  - "notes": a grammar explanation

Return the response in JSON using this shape:
{
  "modules": [
    {
      "title": "...",
      "summary": "...",
      "examples": [
        {
          "fijian": "...",
          "english": "...",
          "notes": "..."
        }
      ]
    }
  ]
}

Text to use:
${fullText}
  `.trim();

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1500,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }]
    }),
  });

  const response = await bedrock.send(command);
  const responseBody = Buffer.from(response.body as Uint8Array).toString("utf-8");
  console.log("🧪 Claude raw:", responseBody.slice(0, 500));
  
  const parsed = JSON.parse(responseBody);
  const message = parsed?.content?.[0]?.text ?? parsed?.content ?? parsed;

  const outputKey = `learning-modules/${title}/module.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: outputKey,
      Body: message,
      ContentType: "application/json"
    })
  );

  console.log(`✅ Claude module saved to: ${outputKey}`);
};
