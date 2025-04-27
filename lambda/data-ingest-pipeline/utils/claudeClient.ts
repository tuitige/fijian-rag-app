import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { REGION } from '../constants';
import { readFileSync } from 'fs';
import * as path from 'path';

const bedrock = new BedrockRuntimeClient({ region: REGION });

// Load prompts at startup
const generateModulePrompt = readFileSync(
  path.resolve(__dirname, '../prompts/generateModulePrompt.txt'), 'utf-8'
);
const extractTranslationsPrompt = readFileSync(
  path.resolve(__dirname, '../prompts/extractTranslationsPrompt.txt'), 'utf-8'
);

const CLAUDE_MODEL_ID = 'anthropic.claude-3-sonnet-20240229'; // or whatever version you're using

export class BedrockClaudeClient {

  static async generateModule(chapterText: string, moduleTitle: string) {
    const prompt = `${generateModulePrompt}\n\nChapter Title: ${moduleTitle}\n\nChapter Content:\n${chapterText}\n\nGenerate the learning module JSON:`;

    console.log('Calling Claude for module generation...');
    const response = await sendClaudeRequest(prompt);

    const parsed = JSON.parse(response);
    return parsed; // should return structured { title, description, steps }
  }

  static async extractTranslations(text: string) {
    const prompt = `${extractTranslationsPrompt}\n\nInput Text:\n${text}\n\nGenerate the translation pairs:`;

    console.log('Calling Claude for translation extraction...');
    const response = await sendClaudeRequest(prompt);

    const parsed = JSON.parse(response);
    return parsed.phrases || []; // expecting { phrases: [ { fijian, english }, ... ] }
  }
}

async function sendClaudeRequest(prompt: string): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4000,
    temperature: 0.3,
    stop_sequences: [],
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const command = new InvokeModelCommand({
    modelId: CLAUDE_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(Buffer.from(response.body).toString('utf-8'));

  const completion = responseBody.content?.[0]?.text || '';

  console.log('Claude completion received.');
  return completion;
}
