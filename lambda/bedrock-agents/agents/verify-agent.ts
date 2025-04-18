import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

export const handleVerify = async (input: string) => {
  const prompt = `You are a Fijian language expert verifying a translation. Please confirm the English is correct and provide any corrections or notes if needed.

Fijian:
${input}

Respond with corrected English and notes:`;

  const body = JSON.stringify({
    prompt,
    max_tokens_to_sample: 300,
    temperature: 0.3,
    top_k: 250,
    top_p: 1,
    stop_sequences: ['\n\n'],
    anthropic_version: 'bedrock-2023-05-31',
  });

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229',
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await bedrock.send(command);
  const json = JSON.parse(new TextDecoder().decode(response.body));
  return json.completion?.trim();
};