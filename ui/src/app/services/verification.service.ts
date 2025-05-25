import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private baseUrl = 'https://your-api-endpoint/verify'; // replace this

  constructor(private http: HttpClient) {}

  getItemsToVerify(type: string) {
    return this.http.get<{ count: number, items: any[] }>(`${this.baseUrl}-items?type=${type}`);
  }

  verifyItem(dataType: string, item: any) {
    return this.http.post(`${this.baseUrl}-item`, {
      dataType,
      dataKey: item.dataKey,
      fields: item
    });
  }
}
