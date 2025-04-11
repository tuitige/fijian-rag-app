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
  
  export interface TranslationDocument {
    id: string;
    type: 'translation';
    sourceText: string;
    targetText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
    verified: boolean;
    createdAt: string;
    updatedAt: string;
    metadata?: {
      context?: string;
      verifiedBy?: string;
      verificationDate?: string;
    };
  }
  