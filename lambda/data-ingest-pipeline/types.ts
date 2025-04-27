// types.ts

export type SourceType = 'PeaceCorps' | 'FijianGrammar' | 'NaiLalakai';

export interface IngestSqsMessage {
  type: SourceType;
  title: string;
  s3Prefix: string;
  source: SourceType;
}

export interface LearningModule {
  moduleId: string;
  title: string;
  description: string;
  steps: any[]; // Later could type each step better
}

export interface TranslationItem {
  translationId: string;
  fijian: string;
  english: string;
  source: SourceType;
  status: 'unverified' | 'verified';
  moduleId?: string;
}
