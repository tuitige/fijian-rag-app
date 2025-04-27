// constants.ts

export const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || '';
export const WORKER_SQS_QUEUE_URL = process.env.WORKER_SQS_QUEUE_URL || '';
export const REGION = 'us-west-2';
export const INGESTION_BUCKET_NAME = 'fijian-rag-app-content';
export const TRANSLATIONS_TABLE = process.env.TRANSLATIONS_TABLE || 'FijianRagTranslations';
export const LEARNING_MODULES_TABLE = process.env.LEARNING_MODULES_TABLE || 'FijianRagLearningModules';
