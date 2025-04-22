import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export const translateArticleByParagraph = async (paragraphs: string[]): Promise<any[]> => {
  const promptText = `You are a translator working on a Fijian language newspaper article.
Your job is to return only the raw JSON array with paragraph-level translations.
DO NOT include any commentary, intro text, or extra formatting outside the JSON array.

Expected format:
[
  {
    "originalParagraph": "...",
    "translatedParagraph": "...",
    "confidence": 1.0
  }
]

Translate each paragraph of the article:
---
${paragraphs.join('\n')}
---`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4000,
    temperature: 0.3,
    top_p: 0.95,
    top_k: 250,
    stop_sequences: [],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptText
          }
        ]
      }
    ]
  };

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  });

  const response = await bedrock.send(command);
  const raw = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(raw);

  const jsonString = Array.isArray(parsed.content)
    ? parsed.content.map((c: any) => c.text).join('\n')
    : '';

  console.log('🟢 Claude raw JSON string:\n', jsonString);

  // Use fallback parser with non-greedy match
  const jsonMatch = jsonString.match(/\[\s*{[\s\S]*?}\s*]/);
  if (!jsonMatch) {
    console.error('❌ Failed to match JSON array in Claude output:\n', jsonString);
    throw new Error('Claude response did not contain a valid JSON array.');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('❌ Failed to parse extracted JSON:\n', jsonMatch[0]);
    throw err;
  }
};
