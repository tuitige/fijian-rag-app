// src/app/services/translation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient, private auth: AuthService) {}

  async translate(text: string, sourceLanguage: 'en' | 'fj'): Promise<any> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.post(`${this.apiUrl}/translate`, {
      sourceText: text,
      sourceLanguage,
      targetLanguage: sourceLanguage === 'en' ? 'fj' : 'en'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No translation returned');
    return result;
  }

  async verify(id: string, sourceText: string, translatedText: string, sourceLanguage: 'en' | 'fj', verified: boolean = true): Promise<any> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.post(`${this.apiUrl}/verify`, {
      id,
      sourceText,
      translatedText,
      sourceLanguage,
      verified
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No verification response returned');
    return result;
  }

  async getModule(title: string): Promise<any> {
    const encodedTitle = encodeURIComponent(title);
    const path = `/assets/module-mock.json`;
    // This is a local asset, no auth needed
    const result = await this.http.get<any>(path).toPromise();
    if (!result) throw new Error('No module returned');
    return result;
  }

  async getModuleFromApi(title: string): Promise<any> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const encoded = encodeURIComponent(title);
    const result = await this.http.get<any>(`${this.apiUrl}/module?title=${encoded}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No module returned');
    return result;
  }

  async verifyModule(module: any): Promise<any> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.post(`${this.apiUrl}/verify-module`, module, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No verification response returned');
    return result;
  }

  async getParagraphsByTitle(title: string): Promise<any[]> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.get<any[]>(`${this.apiUrl}/get-paragraphs?title=${encodeURIComponent(title)}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No paragraphs returned');
    return result;
  }

  async getParagraphsById(articleId: string): Promise<any[]> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.get<any[]>(`${this.apiUrl}/get-paragraphs?id=${encodeURIComponent(articleId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No paragraphs returned');
    return result;
  }

  async verifyParagraph(payload: {
    articleId: string;
    index: number;
    originalParagraph: string;
    translatedParagraph: string;
  }): Promise<any> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.post(`${this.apiUrl}/verify-paragraph`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No verification response returned');
    return result;
  }

  async getAllArticles(): Promise<any[]> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.get<any[]>(`${this.apiUrl}/list-articles`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No articles returned');
    return result;
  }

  async getModuleById(moduleId: string): Promise<any> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.get<any>(`${this.apiUrl}/get-module?id=${moduleId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No module returned');
    return result;
  }

  async getPhrasesByModuleId(moduleId: string): Promise<any[]> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.get<any[]>(`${this.apiUrl}/module-phrases?moduleId=${moduleId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No phrases returned');
    return result;
  }

  async verifyPhraseFromModule(moduleId: string, phrase: any): Promise<any> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.post(`${this.apiUrl}/verify-phrase`, {
      moduleId,
      phraseId: phrase.id,
      originalText: phrase.originalText,
      translatedText: phrase.translatedText,
      verified: true
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No verification response returned');
    return result;
  }

  async getVerificationStats(): Promise<any> {
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    const result = await this.http.get<any>(`${this.apiUrl}/verify-items?type=vocab`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No verification stats returned');
    return result;
  }

}