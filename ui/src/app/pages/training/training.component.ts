import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { ApiService } from '../../services/api.service';

interface TranslationResponse {
  translation: string;
  original: string;
  message: string;
}

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, HeaderComponent],
  templateUrl: './training.component.html'
})
export class TrainingComponent {
  fijianText: string = '';
  translatedText: string = '';
  isTranslating: boolean = false;
  isVerifying: boolean = false;
  errorMessage: string = '';

  constructor(private apiService: ApiService) {}

  async translateText() {
    if (!this.fijianText.trim()) {
      this.errorMessage = 'Please enter some Fijian text to translate';
      return;
    }

    this.isTranslating = true;
    this.errorMessage = '';

    try {
      const response = await this.apiService.translate(this.fijianText).toPromise();
      if (response) {
        this.translatedText = (response as any).translation;
      }
    } catch (error) {
      this.errorMessage = 'Error translating text. Please try again.';
      console.error('Translation error:', error);
    } finally {
      this.isTranslating = false;
    }
  }

  async submitVerifiedTranslation() {
    if (!this.fijianText.trim() || !this.translatedText.trim()) {
      this.errorMessage = 'Both Fijian text and verified translation are required';
      return;
    }

    this.isVerifying = true;
    this.errorMessage = '';

    try {
      await this.apiService.verify(this.fijianText, this.translatedText).toPromise();
      // Clear the form after successful submission
      this.fijianText = '';
      this.translatedText = '';
    } catch (error) {
      this.errorMessage = 'Error submitting verified translation. Please try again.';
      console.error('Verification error:', error);
    } finally {
      this.isVerifying = false;
    }
  }
}
