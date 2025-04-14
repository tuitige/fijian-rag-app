import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private apiUrl = 'https://mbrdtlh12m.execute-api.us-west-2.amazonaws.com/prod';

  constructor(private http: HttpClient) {}

  translate(sourceText: string, sourceLanguage: 'en' | 'fj'): Observable<any> {
    return this.http.post(`${this.apiUrl}/translate`, {
      sourceText,
      sourceLanguage
    });
  }

  verify(
    id: string,
    sourceText: string,
    translatedText: string,
    sourceLanguage: 'en' | 'fj'
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify`, {
      id,
      sourceText,
      translatedText,
      sourceLanguage,
      verified: true
    });
  }
}
