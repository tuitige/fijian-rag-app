// src/app/services/learning.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

  constructor(private http: HttpClient) {}

  getModules(): Observable<{ modules: string[] }> {
    return this.http.get<{ modules: string[] }>(`${this.apiUrl}/learn`);
  }

  getModulePage(moduleTitle: string, page: number): Observable<LearningModule> {
    return this.http.get<LearningModule>(`${this.apiUrl}/learn`, {
      params: { moduleTitle, page: page.toString() }
    });
  }

  updateProgress(moduleData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/learn`, moduleData);
  }
}
