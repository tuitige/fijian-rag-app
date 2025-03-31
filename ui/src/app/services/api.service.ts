import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) {}

  translate(fijianText: string) {
    return this.http.post('/rag', {
      fijianText: fijianText
    });
  }

  verify(originalFijian: string, verifiedEnglish: string) {
    return this.http.post('/verify', {
      originalFijian,
      verifiedEnglish
    });
  }
}
