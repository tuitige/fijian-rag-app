import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

export const handleModuleSummary = async (input: string) => {
  const prompt = `You are a Fijian linguistics expert. Summarize the following content into a structured learning module, including a title, summary, and 3–5 examples (each with Fijian, English, and optional notes):

${input}

Respond with JSON like:
{
  "title": "",
  "summary": "",
  "examples": [
    { "fijian": "", "english": "", "notes": "" }
  ]
}`;

  const body = JSON.stringify({
    prompt,
    max_tokens_to_sample: 600,
    temperature: 0.4,
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