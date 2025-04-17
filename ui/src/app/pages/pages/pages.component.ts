import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageService } from '../../services/page.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.scss']
})
export class PagesComponent implements OnInit {
  moduleTitle = '';
  pages: { pageNumber: number; paragraphs: string[] }[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private pageService: PageService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.moduleTitle = this.route.snapshot.paramMap.get('title') || '';
    this.pageService.getPages(this.moduleTitle).subscribe({
      next: (data) => {
        console.log('✅ Pages loaded:', data);
        this.pages = data.pages;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Failed to load pages:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}