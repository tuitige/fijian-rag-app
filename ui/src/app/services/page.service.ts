import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PageService {
  private apiUrl = 'https://0jg10ewks8.execute-api.us-west-2.amazonaws.com/prod';

  constructor(private http: HttpClient) {}

  getPages(title: string): Observable<any> {
    const encoded = encodeURIComponent(title);
    return this.http.get(`${this.apiUrl}/pages?prefix=${encoded}`);
  }
}
