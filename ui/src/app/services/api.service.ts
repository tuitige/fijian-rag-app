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
}

export interface VerificationRequest {
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

  verify(sourceText: string, translatedText: string, sourceLanguage: string): Observable<VerificationResponse> {
    const payload: VerificationRequest = {
      sourceText,
      translatedText,
      sourceLanguage, 
      verified: true
    };
    return this.http.post<VerificationResponse>(`${this.apiUrl}/verify`, payload);
  }

  // Add method to get similar translations
  getSimilarTranslations(sourceText: string, sourceLanguage: string): Observable<SimilarTranslationsResponse> {
    return this.http.post<SimilarTranslationsResponse>(`${this.apiUrl}/similar`, {
      sourceText,
      sourceLanguage
    });
  }
}
