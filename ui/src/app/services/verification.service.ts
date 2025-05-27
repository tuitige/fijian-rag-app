import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';

@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private baseUrl = 'https://qbfl8hrn0g.execute-api.us-west-2.amazonaws.com/prod/verify';

  constructor(
    private http: HttpClient,
    private oidcSecurityService: OidcSecurityService
  ) {}

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.oidcSecurityService.getAccessToken().toPromise();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  async getItemsToVerify(type: string) {
    const headers = await this.getAuthHeaders();
    return this.http.get<{ count: number, items: any[] }>(
      `${this.baseUrl}-items?type=${type}`,
      { headers }
    ).toPromise();
  }

  async getStats() {
    const headers = await this.getAuthHeaders();
    return this.http.get<any>(
      `${this.baseUrl}-items?type=vocab`,
      { headers }
    ).toPromise();
  }

  async verifyItem(dataType: string, item: any) {
    const headers = await this.getAuthHeaders();
    return this.http.post(
      `${this.baseUrl}-item`,
      {
        dataType,
        dataKey: item.dataKey,
        fields: item
      },
      { headers }
    ).toPromise();
  }
}
