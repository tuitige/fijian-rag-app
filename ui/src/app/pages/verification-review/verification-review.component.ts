import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-verification-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatButtonModule
  ],
  templateUrl: './verification-review.component.html',
  styleUrls: ['./verification-review.component.scss']
})
export class VerificationReviewComponent implements OnInit {
  dataType: 'vocab' | 'phrase' | 'paragraph' = 'vocab';
  items: any[] = [];
  loading = false;
  selectedTabIndex = 0;
  verifyingItemId: string | null = null;

  constructor(private verificationService: VerificationService) {}

  ngOnInit(): void {
    this.loadItems();
  }


selectTab(index: number): void {
  const tabKeys = ['vocab', 'phrase', 'paragraph'];
  this.selectedTabIndex = index;
  this.dataType = tabKeys[index] as 'vocab' | 'phrase' | 'paragraph';
}

  loadItems(): void {
    this.loading = true;
    this.verificationService.getItemsToVerify(this.dataType).subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading items:', err);
        this.loading = false;
      }
    });
  }

verifyItem(item: any): void {
  this.verifyingItemId = item.dataKey;

  this.verificationService.verifyItem(this.dataType, item).subscribe({
    next: () => {
      this.items = this.items.filter(i => i.dataKey !== item.dataKey);
      this.verifyingItemId = null;
      alert('✅ Verified successfully!');
    },
    error: (err) => {
      console.error('Error verifying item:', err);
      this.verifyingItemId = null;
      alert('❌ Failed to verify item');
    }
  });
}

  getDisplayedColumns(): string[] {
    if (this.dataType === 'vocab') {
      return ['partOfSpeech', 'word', 'meaning', 'actions'];
    }
    if (this.dataType === 'phrase') {
      return ['source', 'target', 'actions'];
    }
    return ['originalText', 'translatedText', 'actions']; // paragraph
  }

  isEven(index: number): boolean {
    return index % 2 === 0;
  }


}
