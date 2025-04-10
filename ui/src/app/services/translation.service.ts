// ui/src/app/services/translation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TranslationResponse {
  sourceText: string;
  translatedText: string;
  rawResponse?: string;
  confidence?: number;
  source: 'claude' | 'verified';
  sourceLanguage: 'en' | 'fj';
}

export interface VerifyResponse {
  message: string;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly translateUrl = 'https://vvnljm30ai.execute-api.us-west-2.amazonaws.com/prod/translate';
  private readonly verifyUrl = 'https://vvnljm30ai.execute-api.us-west-2.amazonaws.com/prod/verify';

  constructor(private http: HttpClient) {}

  translateText(inputText: string): Observable<TranslationResponse> {
    return this.http.post<TranslationResponse>(this.translateUrl, { 
      text: inputText,
      sourceLanguage: 'fj'
    });
  }

  verifyTranslation(originalFijian: string, verifiedEnglish: string): Observable<VerifyResponse> {
    return this.http.post<VerifyResponse>(this.verifyUrl, {
      text: originalFijian,
      verifiedEnglish
    });
  }
}
