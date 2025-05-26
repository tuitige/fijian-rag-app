import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-verification-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatTabsModule,
    MatInputModule
  ],
  templateUrl: './verification-review.component.html',
  styleUrls: ['./verification-review.component.scss']
})
export class VerificationReviewComponent implements OnInit {
  dataType: 'phrase' | 'vocab' | 'paragraph' = 'phrase';
  items: any[] = [];
  loading = false;
  tabIndex = 0;

  constructor(private verificationService: VerificationService) {}

  ngOnInit(): void {
    this.loadItems();
  }

  changeTab(type: 'phrase' | 'vocab' | 'paragraph') {
    this.dataType = type;
    this.tabIndex = this.getTabIndexFromType(type);
    this.items = [];
    this.loadItems();
  }

  getTabIndexFromType(type: string): number {
    return { phrase: 0, vocab: 1, paragraph: 2 }[type] ?? 0;
  }

  getTypeFromTabIndex(index: number): 'phrase' | 'vocab' | 'paragraph' {
    return ['phrase', 'vocab', 'paragraph'][index] as any;
  }

  onTabChanged(index: number) {
    this.changeTab(this.getTypeFromTabIndex(index));
  }

  loadItems(): void {
    this.loading = true;
    this.verificationService.getItemsToVerify(this.dataType).subscribe({
      next: (res) => {
        this.items = res.items;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading items:', err);
        this.loading = false;
      }
    });
  }

  getDisplayedColumns(): string[] {
    if (this.dataType === 'phrase' || this.dataType === 'paragraph') {
      return ['originalText', 'translatedText', 'notes', 'action'];
    } else if (this.dataType === 'vocab') {
      return ['word', 'partOfSpeech', 'meaning', 'action'];
    }
    return [];
  }

  verifyItem(item: any) {
    this.verificationService.verifyItem(this.dataType, item).subscribe({
      next: () => {
        this.items = this.items.filter(i => i.dataKey !== item.dataKey);
      },
      error: (err) => console.error('Verification failed:', err)
    });
  }
}
