import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PageService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPages(title: string): Observable<any> {
    const encoded = encodeURIComponent(title);
    return this.http.get(`${this.apiUrl}/pages?prefix=${encoded}`);
  }
}
