import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Remove the import from './models' since we're defining interfaces here
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

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = '/api';

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
}
