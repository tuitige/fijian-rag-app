import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  constructor(private http: HttpClient) {}

  translate(text: string, sourceLanguage: 'en' | 'fj' = 'fj'): Observable<TranslationResponse> {
    return this.http.post<TranslationResponse>('/translate', {
      sourceText: text,
      sourceLanguage
    }).pipe(
      map(response => ({
        ...response,
        translation: response.translation?.replace(/^Translation:\s*/, '') || '',
      }))
    );
  }

  verifyTranslation(originalText: string, verifiedTranslation: string): Observable<VerificationResponse> {
    return this.http.post<VerificationResponse>('/verify', {
      sourceText: originalText,
      verifiedTranslation
    });
  }
}