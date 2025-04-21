import {
    BedrockRuntimeClient,
    InvokeModelCommand
  } from '@aws-sdk/client-bedrock-runtime';
  
  const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
  
  export const translateArticleByParagraph = async (
    paragraphs: string[]
  ): Promise<
    {
      originalParagraph: string;
      translatedParagraph: string;
      confidence?: number;
    }[]
  > => {
    const promptText = `You will receive a list of Fijian-language paragraphs from a newspaper article. Your job is to return an English translation for each paragraph, one-to-one.
  
  Respond in this exact JSON format:
  
  [
    {
      "originalParagraph": "...",
      "translatedParagraph": "...",
      "confidence": 1.0
    }
  ]
  
  Translate clearly and concisely. Don't include additional commentary. Focus on accurate, paragraph-level translations.
  
  Input paragraphs:
  ---
  ${paragraphs.map((p, i) => `${i + 1}. ${p}`).join('\n')}
  ---`;
  
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1800,
      temperature: 0.3,
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
  
    console.log('📥 Claude paragraph translation response:\n', jsonString);
  
    const jsonMatch = jsonString.match(/\[\s*{[\s\S]*}\s*]/);
    if (!jsonMatch) {
      throw new Error('Claude response did not contain a valid JSON array.');
    }
  
    return JSON.parse(jsonMatch[0]);
  };
  