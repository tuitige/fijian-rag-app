import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

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

  constructor(private http: HttpClient, private auth: AuthService) {}

  async translate(sourceText: string, sourceLanguage: string): Promise<Translation> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.post<Translation>(`${this.apiUrl}/translate`, {
      sourceText,
      sourceLanguage
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No translation returned');
    return result;
  }

  async verify(
    id: string,
    sourceText: string,
    translatedText: string,
    sourceLanguage: string
  ): Promise<VerificationResponse> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const payload = {
      id,
      sourceText,
      translatedText,
      sourceLanguage,
      verified: true
    };
    const result = await this.http.post<VerificationResponse>(
      `${this.apiUrl}/verify`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    ).toPromise();
    if (!result) throw new Error('No verification response returned');
    return result;
  }
}
