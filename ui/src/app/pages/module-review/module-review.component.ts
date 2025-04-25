import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { TranslationService } from '../../services/translation.service';

@Component({
  standalone: true,
  selector: 'app-module-review',
  templateUrl: './module-review.component.html',
  styleUrls: ['./module-review.component.scss'],
  imports: [CommonModule, FormsModule, HttpClientModule, HeaderComponent]
})
export class ModuleReviewComponent implements OnInit {
  moduleId: string = '';
  moduleTitle: string = '';
  module: any;
  topics: any[] = [];
  phrases: any[] = [];
  showOnlyUnverified = false;
  loading = true;

  constructor(private route: ActivatedRoute, private service: TranslationService) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.moduleId = params['id'];
      this.moduleTitle = params['title'];
      this.loadData();
    });
  }

  loadData() {
    this.service.getModuleById(this.moduleId).subscribe(module => {
      this.module = module;
    });
    this.service.getPhrasesByModuleId(this.moduleId).subscribe(phrases => {
      this.phrases = phrases;
      this.loading = false;
    });
  }

  toggleUnverifiedFilter() {
    this.showOnlyUnverified = !this.showOnlyUnverified;
  }

  get filteredPhrases() {
    return this.showOnlyUnverified
      ? this.phrases.filter(p => !p.verified)
      : this.phrases;
  }

  markAsVerified(phrase: any) {
    this.service.verifyPhraseFromModule(this.moduleId, phrase).subscribe(() => {
      phrase.verified = true;
    });
  }

  isVerified(value: any): boolean {
    return value === true || value === 'true';
  }
  
  recordFijianSpeakerAudio(phrase: any) {
    alert(`🎙️ [Placeholder] Recording audio for: ${phrase.originalParagraph.slice(0, 50)}...`);
  }  

}