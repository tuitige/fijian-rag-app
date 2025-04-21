export const CLAUDE_3_5_SONNET_V2 = {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    baseBody: {
      anthropic_version: 'bedrock-2023-05-31',
      temperature: 0.2,
      top_k: 250,
      top_p: 0.999,
      stop_sequences: [],
      max_tokens: 1024
    }
  };

export const OS_REGION = 'us-west-2';

export const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT || 'https://search-fijian-rag-domain-xxxxxx.us-west-2.es.amazonaws.com';

// Index names
export const TRANSLATIONS_INDEX = 'translations';
export const MODULES_INDEX = 'learning-modules';
