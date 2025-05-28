import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { from, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private baseUrl = 'https://qbfl8hrn0g.execute-api.us-west-2.amazonaws.com/prod/verify';

  constructor(
    private http: HttpClient,
    private oidcSecurityService: OidcSecurityService
  ) {}

  private async getHeaders(): Promise<HttpHeaders> {
    const token = (await this.oidcSecurityService.getIdToken().toPromise()) || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'x-api-key': environment.apiKey
    });
  }

  getItemsToVerify(type: string): Observable<{ count: number; items: any[] }> {
    return from(this.getHeaders().then(headers =>
      this.http.get<{ count: number; items: any[] }>(
        `${this.baseUrl}-items?type=${type}`,
        { headers }
      ).toPromise()
    ).then(res => res ?? { count: 0, items: [] }));
  }


  getStats() {
    const headers = new HttpHeaders({ 'x-api-key': environment.apiKey });
    return this.http.get<{
      stats: {
        vocab: { total: number; verified: number };
        phrase: { total: number; verified: number };
        paragraph: { total: number; verified: number };
      };
    }>(`${this.baseUrl}-items?type=vocab`, { headers });
  }



  verifyItem(dataType: string, item: any): Observable<any> {
    const payload = {
      dataType,
      dataKey: item.dataKey,
      fields: item
    };
    return from(this.getHeaders().then(headers =>
      this.http.post<any>(
        `${this.baseUrl}-item`, payload, { headers }
      ).toPromise()
    ));
  }
}
