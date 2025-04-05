// src/app/services/translation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TranslationResponse {
  sourceText: string;
  translation: string;
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
  private readonly translateUrl = 'https://9vvnczutih.execute-api.us-west-2.amazonaws.com/prod/translate';
  private readonly verifyUrl = 'https://9vvnczutih.execute-api.us-west-2.amazonaws.com/prod/verify';

  constructor(private http: HttpClient) {}

  translateText(fijianText: string): Observable<TranslationResponse> {
    return this.http.post<TranslationResponse>(this.translateUrl, { fijianText });
  }

  verifyTranslation(originalFijian: string, verifiedEnglish: string): Observable<VerifyResponse> {
    return this.http.post<VerifyResponse>(this.verifyUrl, {
      originalFijian,
      verifiedEnglish
    });
  }
}