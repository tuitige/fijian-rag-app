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
  title = 'Nai Lalakai - Development';
  showOnlyUnverified = false;
  loading = true;
  newFijian = '';
  newEnglish = '';

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.translationService.getParagraphsByTitle(this.title).subscribe(data => {
      this.paragraphs = data;
      this.loading = false;
    });
  }

  saveAndVerify(paragraph: any) {
    this.translationService.verifyParagraph(paragraph).subscribe(
      (res) => {
        paragraph.verified = true;
        alert('✔ Translation saved and verified');
      },
      (err) => {
        console.error(err);
        alert('❌ Failed to verify');
      }
    );
  }

  toggleFilter() {
    this.showOnlyUnverified = !this.showOnlyUnverified;
  }

  get filteredParagraphs() {
    return this.showOnlyUnverified
      ? this.paragraphs.filter(p => !p.verified)
      : this.paragraphs;
  }

  addNewTranslation() {
    const newItem = {
      articleId: this.title,
      originalParagraph: this.newFijian,
      translatedParagraph: this.newEnglish
    };
    this.translationService.verifyParagraph(newItem).subscribe(
      (res) => {
        alert('✔ New translation saved');
        this.paragraphs.push({ ...newItem, verified: true });
        this.newFijian = '';
        this.newEnglish = '';
      },
      (err) => {
        console.error(err);
        alert('❌ Failed to add translation');
      }
    );
  }

  recordAudio(paragraph: any) {
    alert(`🎤 [Placeholder] Would start recording for: ${paragraph.originalParagraph.slice(0, 40)}...`);
  }
}
