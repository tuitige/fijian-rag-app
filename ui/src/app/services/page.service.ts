import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PageService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  async getPages(title: string): Promise<any> {
    const encoded = encodeURIComponent(title);
    const token = await this.auth.getIdToken();
    if (!token) throw new Error('No id token available');
    return this.http.get(`${this.apiUrl}/pages?prefix=${encoded}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).toPromise();
  }
}
