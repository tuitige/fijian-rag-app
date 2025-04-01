// src/app/services/translation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TranslationResponse {
  originalText: string;
  translation: string;
  confidence: string;
  notes: string;
  rawResponse?: string;
}

export interface VerifyResponse {
  message: string;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translateUrl = 'https://9vvnczutih.execute-api.us-west-2.amazonaws.com/prod/translate';
  private verifyUrl = 'https://9vvnczutih.execute-api.us-west-2.amazonaws.com/prod/verify';


  constructor(private http: HttpClient) { }

  translateText(fijianText: string): Observable<TranslationResponse> {
    return this.http.post<TranslationResponse>(this.apiUrl, { fijianText });
  }

  verifyTranslation(originalFijian: string, verifiedEnglish: string): Observable<VerifyResponse> {
    return this.http.post<VerifyResponse>(this.verifyUrl, { originalFijian, verifiedEnglish });
  }

}
