// lambda/textractProcessor/helpers/extractPeaceCorpsPhrases.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export const extractPeaceCorpsPhrases = async (paragraphs: string[]): Promise<any[]> => {
  const prompt = `You are a Fijian linguist. Extract all useful Fijian-English translation pairs from the following Peace Corps training material.

The material contains teaching examples, short dialogues, and crucial vocabulary sections like Commands or "Other words and phrases".

Your task:
- Extract all Fijian phrases and their English meanings
- Focus especially on vocabulary sections and example tables
- Keep each pair atomic, real-world, and unambiguous
- Add a note if it’s a politeness marker, command, or usage type

Return result as an array like this:
[
  {
    "originalText": "kerekere",
    "translatedText": "please",
    "notes": "politeness marker"
  },
  ...
]

Fijian lesson input:
---
${paragraphs.join('\n')}
---`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1200,
    temperature: 0.3,
    top_p: 0.9,
    top_k: 250,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt }
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
    ? parsed.content.map(c => c.text).join('\n')
    : '';

  const match = jsonString.match(/\[\s*{[\s\S]*?}\s*\]/);
  if (!match) throw new Error('Claude did not return a valid JSON array');

  return JSON.parse(match[0]);
};
