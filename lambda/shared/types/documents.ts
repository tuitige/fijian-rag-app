// lambda/shared/types/documents.ts
export interface TranslationRequest {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
}

export interface TranslationResponse {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  needsVerification: boolean;
  createdAt: string;
}

export interface TranslationDocument extends TranslationResponse {
  type: 'translation';
  verified: boolean;
  updatedAt: string;
  metadata: {
    context?: string;
  };
}
