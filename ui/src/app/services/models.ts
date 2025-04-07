export interface TranslationResponse {
  translation: string;
  rawResponse?: string;
  confidence?: number;
  id?: string;
  similarTranslations?: number;
  source?: 'claude' | 'verified';
}

export interface VerificationResponse {
  message: string;
  id: string;
}