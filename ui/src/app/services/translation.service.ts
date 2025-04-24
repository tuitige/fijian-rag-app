// src/app/services/translation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private apiUrl = environment.apiUrl;
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
    return this.http.get<any[]>(`${this.apiUrl}/get-paragraphs?title=${encodeURIComponent(title)}`);
  }

  getParagraphsById(articleId: string) {
    return this.http.get<any[]>(`${this.apiUrl}/get-paragraphs?id=${encodeURIComponent(articleId)}`);
  }

  verifyParagraph(payload: {
    articleId: string;
    index: number;
    originalParagraph: string;
    translatedParagraph: string;
  }) {
    return this.http.post(`${this.apiUrl}/verify-paragraph`, payload);
  }

  getAllArticles() {
    return this.http.get<any[]>(`${this.apiUrl}/list-articles`);
  }
  
  getModuleById(moduleId: string) {
    return this.http.get<any>(`${this.apiUrl}/get-module?id=${moduleId}`);
  }
  
  getPhrasesByModuleId(moduleId: string) {
    return this.http.get<any[]>(`${this.apiUrl}/module-phrases?moduleId=${moduleId}`);
  }
  
  verifyPhraseFromModule(moduleId: string, phrase: any) {
    return this.http.post(`${this.apiUrl}/verify-phrase`, {
      moduleId,
      phraseId: phrase.id,
      originalText: phrase.originalText,
      translatedText: phrase.translatedText
    });
  }

  getAllModules() {
    return this.http.get<any[]>(`${this.apiUrl}/list-modules`);
  }
  
    

}