import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TranslationResponse, VerificationResponse } from './models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private createHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  translate(text: string, sourceLanguage: 'en' | 'fj' = 'fj'): Observable<TranslationResponse> {
    const options = {
      headers: this.createHeaders()
    };
    return this.http.post<TranslationResponse>(`${this.apiUrl}/translate`, {
      sourceText: text,
      sourceLanguage
    }, options);
  }

  verify(originalFijian: string, verifiedEnglish: string): Observable<VerificationResponse> {
    const options = {
      headers: this.createHeaders()
    };
    return this.http.post<VerificationResponse>(`${this.apiUrl}/verify`, {
      originalFijian,
      verifiedEnglish
    }, options);
  }
}