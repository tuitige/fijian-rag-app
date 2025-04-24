// lambda/textractProcessor/helpers/extractPeaceCorpsPhrases.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export const extractPeaceCorpsPhrases = async (paragraphs: string[]): Promise<any[]> => {
  const prompt = `You are an expert in linguistics and Fijian language training.

From the input text (from a Peace Corps training manual), extract ONLY high-confidence Fijian-to-English phrase pairs.

Focus especially on:
- Vocabulary sections
- Commands
- Dialogues
- Any Fijian phrases clearly followed by their English equivalent

Output format:
[
  {
    "originalText": "Fijian phrase",
    "translatedText": "English translation",
    "notes": "optional clarifying info"
  }
]`;

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
