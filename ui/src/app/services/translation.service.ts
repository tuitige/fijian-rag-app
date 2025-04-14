import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TranslateResponse {
  translatedText: string;
  rawResponse?: string;
  confidence?: number;
  id: string;
  similarTranslations?: number;
  debug?: any;
}

export interface VerificationPayload {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: 'en' | 'fj';
  verified: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private apiUrl = 'https://mbrdtlh12m.execute-api.us-west-2.amazonaws.com/prod';

  constructor(private http: HttpClient) {}

  translate(sourceText: string, sourceLanguage: 'en' | 'fj'): Observable<TranslateResponse> {
    const payload = { sourceText, sourceLanguage };
    return this.http.post<TranslateResponse>(`${this.apiUrl}/translate`, payload);
  }

  verify(id: string, sourceText: string, translatedText: string, sourceLanguage: 'en' | 'fj'): Observable<any> {
    const payload: VerificationPayload = {
      id,
      sourceText,
      translatedText,
      sourceLanguage,
      verified: true
    };
    return this.http.post(`${this.apiUrl}/verify`, payload);
  }
}
