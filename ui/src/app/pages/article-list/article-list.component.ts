// article-list.component.ts
import { Component, OnInit } from '@angular/core';
import { TranslationService } from '../../services/translation.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';


@Component({
  selector: 'app-article-list',
  standalone: true,
  templateUrl: './article-list.component.html',
  styleUrls: ['./article-list.component.scss'],
  imports: [CommonModule, FormsModule, HttpClientModule, HeaderComponent]
})
export class ArticleListComponent implements OnInit {
  articles: any[] = [];
  loading = true;

  constructor(private translationService: TranslationService, private router: Router) {}

  ngOnInit(): void {
    this.translationService.getAllArticles().subscribe(data => {
      this.articles = data;
      this.loading = false;
    });
  }

  goToReview(article: any) {
    this.router.navigate(['/article-review'], {
      queryParams: { id: article.articleId, title: article.title }
    });
  }
}
