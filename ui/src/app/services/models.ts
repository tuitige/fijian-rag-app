export interface TranslationResponse {
  sourceText: string;
  translatedText: string;
  rawResponse?: string;
  confidence?: number;
  source: 'claude' | 'verified';
  sourceLanguage: 'en' | 'fj';
}

export interface VerificationResponse {
  message: string;
  id: string;
}