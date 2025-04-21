import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const body = JSON.stringify({
    inputText: text,
  });
  console.log('🔵 Embedding request:', body);

  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await bedrock.send(command);
  console.log('🔵 Bedrock Embedding response:', response);

  const raw = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(raw);

  console.log('🔹 Embedding response:', parsed);

  return parsed.embedding;
};