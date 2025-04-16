import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export async function generateLearningModule(title: string, fullText: string): Promise<{ rawResponse: string; parsed: any }> {
  const prompt = `You are a Fijian language educator and curriculum writer. Analyze the following material scanned from a Fijian grammar book and extract as much useful content as possible for learners.

Return a JSON object with a single key "modules": an array of modules, each with:
- "title": the topic
- "summary": a helpful summary of usage
- "examples": a list of objects with "fijian", "english", and "notes"

Text:
${fullText}`;

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

  return {
    rawResponse: textBody,
    parsed
  };
}