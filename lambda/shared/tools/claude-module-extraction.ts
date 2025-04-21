import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { CLAUDE_3_5_SONNET_V2 } from '../constants';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

export const claudeModuleExtraction = async (rawText: string): Promise<any> => {
  const prompt = `
You are a linguistics teacher assistant. Your task is to extract a structured Fijian language learning module from raw OCR text.

The raw OCR text may contain:
- Section headings
- Fijian phrases or sentences
- Their English translations
- Optional notes or explanations

Format the response as a JSON object:
{
  "title": "Module Title",
  "pages": [
    {
      "pageNumber": 1,
      "content": [
        {
          "fijian": "original Fijian phrase or sentence",
          "english": "translated English text",
          "notes": "optional clarifying notes"
        }
      ]
    }
  ]
}
Ensure each page contains a list of 1 or more structured translation objects. Only return valid JSON.

Extracted OCR input:
${rawText}
`;

  const body = JSON.stringify({
    ...CLAUDE_3_5_SONNET_V2.baseBody,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt.trim()
          }
        ]
      }
    ]
  });

  const command = new InvokeModelCommand({
    modelId: CLAUDE_3_5_SONNET_V2.modelId,
    contentType: CLAUDE_3_5_SONNET_V2.contentType,
    accept: CLAUDE_3_5_SONNET_V2.accept,
    body
  });

  const response = await bedrock.send(command);
  const json = await new Response(response.body).text();

  console.log('📦 Claude raw module response:', json);

  try {
    return JSON.parse(json);
  } catch (e) {
    console.error('❌ Failed to parse Claude module output:', e);
    throw new Error('Claude returned invalid JSON for module extraction');
  }
};