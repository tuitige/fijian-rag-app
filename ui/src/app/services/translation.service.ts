// src/app/services/translation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private apiUrl = 'https://bv4a86k87j.execute-api.us-west-2.amazonaws.com/prod';
  constructor(private http: HttpClient) {}

  translate(text: string, sourceLanguage: 'en' | 'fj'): Observable<any> {
    return this.http.post(`${this.apiUrl}/translate`, {
      sourceText: text,
      sourceLanguage,
      targetLanguage: sourceLanguage === 'en' ? 'fj' : 'en'
    });
  }

  verify(id: string, sourceText: string, translatedText: string, sourceLanguage: 'en' | 'fj', verified: boolean = true): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify`, {
      id,
      sourceText,
      translatedText,
      sourceLanguage,
      verified
    });
  }

  getModule(title: string): Observable<any> {
    const encodedTitle = encodeURIComponent(title);
    const path = `/assets/module-mock.json`; // 🔁 Replace this later with real S3 or API path if needed
    return this.http.get<any>(path);
  }

  getModuleFromApi(title: string): Observable<any> {
    const encoded = encodeURIComponent(title);
    return this.http.get<any>(`${this.apiUrl}/module?title=${encoded}`);
  }

  verifyModule(module: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-module`, module);
  }  

  getParagraphsByTitle(title: string) {
    return this.http.get<any[]>(`${this.apiUrl}/paragraphs?title=${encodeURIComponent(title)}`);
  }
  
  verifyParagraph(paragraph: any) {
    return this.http.post(`${this.apiUrl}/verify-paragraph`, {
      id: paragraph.articleId,
      originalParagraph: paragraph.originalParagraph,
      translatedParagraph: paragraph.translatedParagraph
    });
  }
  

}