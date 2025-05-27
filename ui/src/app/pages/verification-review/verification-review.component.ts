import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
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
    this.selectTab(this.selectedTabIndex);
    this.loadItems();
  }


  selectTab(index: number): void {
    const tabKeys = ['vocab', 'phrase', 'paragraph'];
    this.selectedTabIndex = index;
    this.dataType = tabKeys[index] as 'vocab' | 'phrase' | 'paragraph';
    console.log('Selected data type:', this.dataType);
    this.loadItems();
  }

  loadItems(): void {
    this.loading = true;
    const type = this.dataType;

    this.verificationService.getItemsToVerify(type).subscribe(res => {
      this.items = res.items.map(item => ({
        ...item,
        finalTranslation: item.finalTranslation || item.aiTranslation || ''
      }));
      this.loading = false;
    });
  }


  verifyItem(item: any): void {
    this.verifyingItemId = item.dataKey;

    const payload = {
      ...item,
      translatedText: item.finalTranslation || item.aiTranslation || ''
    };

    this.verificationService.verifyItem(this.dataType, payload).subscribe({
      next: () => {
        this.items = this.items.filter(i => i.dataKey !== item.dataKey);
        this.verifyingItemId = null;
      },
      error: (err) => {
        console.error('Error verifying item:', err);
        this.verifyingItemId = null;
      }
    });
  }


  getDisplayedColumns(): string[] {
    return ['sourceText', 'aiTranslation', 'finalTranslation', 'actions'];
  }



  isEven(index: number): boolean {
    return index % 2 === 0;
  }


}
