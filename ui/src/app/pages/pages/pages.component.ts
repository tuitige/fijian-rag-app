import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.scss']
})
export class PagesComponent implements OnInit {
  moduleTitle = '';
  pages: { pageNumber: number; paragraphs: string[] }[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.moduleTitle = this.route.snapshot.paramMap.get('title') || '';
    const url = `${environment.apiUrl}/pages?prefix=${encodeURIComponent(this.moduleTitle)}`;

    this.http.get<{ pages: { pageNumber: number; paragraphs: string[] }[] }>(url).subscribe({
      next: (data) => {
        this.pages = data.pages;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load pages:', err);
        this.loading = false;
      }
    });
  }
}