import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { PageService } from '../../services/page.service';

@Component({
  standalone: true,
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.scss'],
  imports: [CommonModule, HeaderComponent]
})
export class PagesComponent implements OnInit {
  moduleTitle = '';
  pages: { pageNumber: number; paragraphs: string[] }[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private pageService: PageService) {}

  ngOnInit(): void {
    this.moduleTitle = this.route.snapshot.paramMap.get('title') || '';
  
    if (!this.moduleTitle) {
      console.warn('⚠️ No module title in route param');
      this.loading = false;
      return;
    }
  
    this.pageService.getPages(this.moduleTitle).subscribe({
      next: (data) => {
        console.log('✅ Pages loaded:', data);
        this.pages = data.pages ?? []; // Use nullish coalescing
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Failed to load pages:', err);
        this.pages = [];
        this.loading = false;
      }
    });
  }
  
}