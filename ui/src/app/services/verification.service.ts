import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private baseUrl = 'https://qbfl8hrn0g.execute-api.us-west-2.amazonaws.com/prod/verify';

  private headers = new HttpHeaders({
    'x-api-key': environment.apiKey
  });

  constructor(private http: HttpClient) {}

  getItemsToVerify(type: string) {
    return this.http.get<{ count: number, items: any[] }>(
      `${this.baseUrl}-items?type=${type}`,
      { headers: this.headers }
    );
  }

  getStats() {
    return this.http.get<any>(
      `${this.baseUrl}-items?type=vocab`,
      { headers: this.headers }
    );
  }

  verifyItem(dataType: string, item: any) {
    return this.http.post(
      `${this.baseUrl}-item`,
      {
        dataType,
        dataKey: item.dataKey,
        fields: item
      },
      { headers: this.headers }
    );
  }
}
