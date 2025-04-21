import {
    BedrockRuntimeClient,
    InvokeModelCommand
  } from '@aws-sdk/client-bedrock-runtime';
  
  const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
  
  export const generateEmbedding = async (text: string): Promise<number[]> => {
    const payload = {
      inputText: text
    };
  
    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });
  
    const response = await bedrock.send(command);
    const raw = new TextDecoder().decode(response.body);
    const parsed = JSON.parse(raw);
  
    if (!parsed.embedding || !Array.isArray(parsed.embedding)) {
      throw new Error('Embedding not returned or malformed.');
    }
  
    return parsed.embedding;
  };
  