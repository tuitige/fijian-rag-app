// src/app/services/learn.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LearnService {
  private apiUrl = environment.apiUrl + '/learn'; // Ensure your environment points to API Gateway URL

  constructor(private http: HttpClient) {}

  async sendMessage(message: string, session: any = {}): Promise<{ reply: string, session: any }> {
    const body = { input: message, session };
    const response = await this.http.post<{ reply: string, session: any }>(this.apiUrl, body).toPromise();
    return response!;
  }
  
}
