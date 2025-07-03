// src/app/services/learning.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface LearningModule {
  id: string;
  learningModuleTitle: string;
  content: string;
  pageNumber: number;
  paragraphs: string[];
  totalPages?: number;
  userProgress?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LearningService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  async getModules(): Promise<{ modules: string[] }> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new Error('No access token available');
    const result = await this.http.get<{ modules: string[] }>(`${this.apiUrl}/learn`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No modules returned');
    return result;
  }

  async getModulePage(moduleTitle: string, page: number): Promise<LearningModule> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new Error('No access token available');
    const result = await this.http.get<LearningModule>(`${this.apiUrl}/learn`, {
      params: { moduleTitle, page: page.toString() },
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
    if (!result) throw new Error('No module page returned');
    return result;
  }

  async updateProgress(moduleData: any): Promise<any> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new Error('No access token available');
    return this.http.post(`${this.apiUrl}/learn`, moduleData, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
  }
}
