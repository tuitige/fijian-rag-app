// src/app/services/learn.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LearnService {
  private apiUrl = environment.apiUrl + '/chat';

  constructor(private http: HttpClient) {}

  async sendMessage(message: string, session: any = {}): Promise<{ reply: string; session: any }> {
    const body = { input: message, session };
    const raw = await this.http
      .post(this.apiUrl, body, { responseType: 'text' })
      .toPromise();
    let reply = raw || '';
    let newSession = session;
    try {
      const parsed = JSON.parse(raw || '');
      reply = parsed?.content?.[0]?.text || parsed.reply || raw || '';
      if (parsed.session) {
        newSession = parsed.session;
      }
    } catch {
      // fall back to raw string
    }
    return { reply, session: newSession };
  }
  
}
