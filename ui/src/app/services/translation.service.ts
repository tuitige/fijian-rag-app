// src/app/services/translation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface TranslationResponse {
  originalText: string;
  translation: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private apiUrl = 'https://9vvnczutih.execute-api.us-west-2.amazonaws.com/prod/translate';

  constructor(private http: HttpClient) { }

  translateText(fijianText: string): Observable<TranslationResponse> {
    return this.http.post<TranslationResponse>(this.apiUrl, { fijianText });
  }
}
