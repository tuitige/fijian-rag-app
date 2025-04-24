import {
    BedrockRuntimeClient,
    InvokeModelCommand
  } from '@aws-sdk/client-bedrock-runtime';
  
  const bedrock = new BedrockRuntimeClient({ region: process.env.DEFAULT_REGION });
  
  export const extractTranslationPairsFromText = async (
    paragraphs: string[]
  ): Promise<
    {
      originalText: string;
      translatedText: string;
      notes?: string;
    }[]
  > => {
    const promptText = `You are assisting in building a high-quality Fijian-to-English translation dataset.
  
  The following input contains scanned text from a Fijian grammar book. Your job is to extract as many **distinct Fijian-English phrase pairs** as possible.
  
  Focus especially on:
  - Phrases where a Fijian sentence is followed by its English meaning (e.g. lines like: 'E vaka-momo vei au' → 'He calls me "momo".')
  - Quoted or embedded examples within paragraphs or explanations
  - Any phrases where the structure clearly implies a Fijian phrase with its corresponding English meaning
  - Lines where both languages appear in the same sentence or separated by a colon, dash, or quotes
  - Any phrases where the structure clearly implies a Fijian phrase with its corresponding English meaning, where you can use your own basic knowledge of Fijian to identify the phrases and translations seem appropriate
  
  Your goal is to find and preserve all potentially useful teaching examples. Skip non-linguistic commentary.
  
  Return your results ONLY as a valid JSON array in this format:
  
  [
    {
      "originalText": "Fijian phrase",
      "translatedText": "English translation",
      "notes": "Optional short explanation"
    }
  ]
  
  Input:
  ---
  ${paragraphs.join('\n')}
  ---`;
  
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1400,
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
  
    console.log('📥 Claude raw phrase list:\n', jsonString);
  
    const jsonMatch = jsonString.match(/\[\s*{[\s\S]*?}\s*]/);
    if (!jsonMatch) {
      console.error('❌ No JSON phrase list found in Claude output:\n', jsonString);
      throw new Error('Claude response did not contain a valid JSON array.');
    }
  
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('❌ Failed to parse extracted phrase list:\n', jsonMatch[0]);
      throw err;
    }
  };
  