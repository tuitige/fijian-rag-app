import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { Component, OnInit } from '@angular/core';
import { VerificationService } from '../../services/verification.service';

@Component({
  standalone: true,
  selector: 'app-verification-review',
  templateUrl: './verification-review.component.html',
  styleUrls: ['./verification-review.component.scss'],
  imports: [CommonModule, FormsModule, HttpClientModule, HeaderComponent]
})
export class VerificationReviewComponent implements OnInit {
  dataType: 'phrase' | 'vocab' | 'paragraph' = 'phrase';
  items: any[] = [];
  loading = false;

  constructor(private verificationService: VerificationService) {}

  ngOnInit(): void {
    console.log('VerificationReviewComponent initialized');
    this.loadItems();
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

  changeTab(type: 'phrase' | 'vocab' | 'paragraph') {
    this.dataType = type;
    this.items = [];
    this.loadItems();
  }

  verifyItem(item: any) {
    this.verificationService.verifyItem(this.dataType, item).subscribe({
      next: () => {
        this.items = this.items.filter(i => i.dataKey !== item.dataKey);
      },
      error: (err) => console.error('Verify failed:', err)
    });
  }
}
