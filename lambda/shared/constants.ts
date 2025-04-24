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

export const FIJI_RAG_REGION = 'us-west-2';
export const CONTENT_BUCKET_NAME = 'fijian-rag-app-content';

// DDB table names
export const DDB_LEARNING_MODULES_TABLE = 'LearningModulesTable';
export const ARTICLE_VERIFICATION_TABLE = 'ArticleVerificationTable';
export const TRANSLATIONS_TABLE = 'TranslationsTable';

// Opensearch constants
export const OS_DOMAIN = 'fijian-rag-domain';
export const TRANSLATIONS_INDEX = 'translations';
export const LEARNING_MODULES_INDEX = 'learning-modules';
