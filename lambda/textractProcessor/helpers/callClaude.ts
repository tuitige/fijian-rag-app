import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export const generateModuleFromText = async (
  paragraphs: string[],
  title: string
): Promise<any> => {
  const promptText = `You are a linguist helping design a learning module to teach the Fijian language.

Your task:
- Identify distinct grammar topics or structures in the Fijian text
- For each topic, include a short summary
- Extract only high-confidence Fijian-to-English translation pairs
  - Only include examples where the Fijian phrase clearly aligns with its English meaning
  - Avoid speculative or unclear pairs

Each example should include:
- originalText: a Fijian phrase
- translatedText: the corresponding English translation
- notes: an optional short explanation

Return the result as a valid JSON object using this structure:
{
  "title": "Module Title",
  "topics": [
    {
      "title": "Topic Name",
      "summary": "Short description of the grammar concept",
      "examples": [
        {
          "originalText": "Fijian phrase",
          "translatedText": "English translation",
          "notes": "Short explanation"
        }
      ]
    }
  ],
  "additionalExamples": [
    {
      "originalText": "Fijian phrase",
      "translatedText": "English translation",
      "notes": "Explanation (optional)"
    }
  ]
}

After completing the module, provide 5–10 additional high-confidence Fijian-English translation pairs related to the same grammar theme(s). These do not need to appear in the original input but should be consistent with the topic and style of the lesson.

Input:
---
${paragraphs.join('\n')}
---`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1500,
    temperature: 0.4,
    top_p: 0.999,
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

  const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('❌ No JSON block found in Claude output:\n', jsonString);
    throw new Error('Claude response did not contain valid JSON.');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('❌ Failed to parse extracted JSON:\n', jsonMatch[0]);
    throw err;
  }
};
