// src/app/services/translation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private apiUrl = '/api';  // Update this with your API endpoint

  constructor(private http: HttpClient) {}

  translate(text: string, sourceLanguage: 'en' | 'fj'): Observable<any> {
    return this.http.post(`${this.apiUrl}/translate`, {
      text,
      sourceLanguage
    });
  }

  verify(id: string, sourceText: string, verifiedTranslation: string, sourceLanguage: 'en' | 'fj'): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify`, {
      id,
      sourceText,
      verifiedTranslation,
      sourceLanguage
    });
  }
}
