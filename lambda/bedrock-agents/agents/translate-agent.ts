import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { queryVerifiedTranslation, querySimilarEmbeddings } from '../tools/vector-search';
import { storeEmbedding } from '../tools/store-embedding';
import { parseClaudeResponse } from '../shared/utils';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

export const handleTranslate = async (input: string): Promise<any> => {
  const sourceLanguage = 'fj';
  const translatedLanguage = 'en';

  // Step 1: Check if a verified translation exists in DDB
  const verified = await queryVerifiedTranslation(input);
  if (verified) {
    return {
      ...verified,
      sourceText: input,
      sourceLanguage,
      translatedLanguage,
      verified: true,
      confidence: 1.0,
      similarTranslations: 0
    };
  }

  // Step 2: Query similar items via embedding search
  const similar = await querySimilarEmbeddings(input);
  const similarCount = similar.length;

  // Step 3: Use Claude to generate a fresh translation
  const prompt = `Translate the following Fijian phrase into English. Only return the translated English.

"${input}"`;

  const body = JSON.stringify({
    messages: [
      { role: 'user', content: prompt }
    ],
    max_tokens: 1024,
    temperature: 0.2,
    anthropic_version: 'bedrock-2023-05-31'
  });

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body
  });

  const response = await bedrock.send(command);
  const raw = new TextDecoder().decode(response.body);
  const parsed = parseClaudeResponse(raw);

  // Step 4: Save to embeddings for future similarity
  await storeEmbedding({
    sourceText: input,
    translatedText: parsed.translatedText,
    sourceLanguage,
    translatedLanguage,
    rawResponse: raw
  });

  return {
    ...parsed,
    id: parsed.id,
    sourceText: input,
    sourceLanguage,
    translatedLanguage,
    verified: false,
    similarTranslations: similarCount,
    rawResponse: raw
  };
};