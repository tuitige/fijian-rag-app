import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Translation {
  translatedText: string;
  rawResponse: string;
  confidence?: number;
  id: string;
  similarTranslations: number;
  source?: 'claude' | 'verified';
  sourceText: string;
}

export interface VerificationRequest {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  verified: boolean;
}

export interface VerificationResponse {
  message: string;
  success: boolean;
}

export interface SimilarTranslationsResponse {
  translations: Translation[];
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly apiUrl: string = environment.apiUrl;

  constructor(private http: HttpClient) {}

  translate(sourceText: string, sourceLanguage: string): Observable<Translation> {
    return this.http.post<Translation>(`${this.apiUrl}/translate`, {
      sourceText,
      sourceLanguage
    });
  }

  verify(
    id: string,
    sourceText: string,
    translatedText: string,
    sourceLanguage: string
  ): Observable<VerificationResponse> {
    const payload = {
      id,
      sourceText,
      translatedText,
      sourceLanguage,
      verified: true
    };
  
    return this.http.post<VerificationResponse>(
      `${this.apiUrl}/verify`,
      payload
    );
}};
