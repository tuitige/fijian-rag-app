
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  verify(
    id: string,
    sourceText: string,
    translatedText: string,
    sourceLanguage: string
  ): Observable<any> {
    const payload = {
      id, // UUID from /translate
      sourceText,
      translatedText,
      sourceLanguage,
      verified: true
    };

    return this.http.post(`${this.apiUrl}/verify`, payload);
  }
}
