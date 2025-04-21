import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
//import { ModuleService } from '../../services/module.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  standalone: true,
  selector: 'app-article-review',
  templateUrl: './article-review.component.html',
  styleUrls: ['./article-review.component.scss'],
  imports: [CommonModule, FormsModule, HttpClientModule, HeaderComponent]
})
export class ArticleReviewComponent implements OnInit {
  paragraphs: any[] = [];
  loading = false;
  selectedArticleTitle = 'Nai Lalakai - Development';

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.loadParagraphs();
  }

  loadParagraphs() {
    this.loading = true;
    this.translationService.getParagraphsByTitle(this.selectedArticleTitle).subscribe({
      next: (data) => {
        console.log('📦 Paragraphs loaded:', data);
        this.paragraphs = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  verifyParagraph(p: any) {
    this.translationService.verifyParagraph(p.id).subscribe(() => {
      p.verified = true;
    });
  }
}
