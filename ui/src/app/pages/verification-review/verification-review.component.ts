import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { Component, OnInit } from '@angular/core';
import { VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-verification-review',
  template: `
    <h2>Verify {{ dataType }}</h2>
    <div *ngFor="let item of items">
      <input [(ngModel)]="item.word" placeholder="Word">
      <input [(ngModel)]="item.meaning" placeholder="Meaning">
      <button (click)="verifyItem(item)">Verify</button>
    </div>
  `
})
export class VerificationReviewComponent {
  dataType: 'phrase' | 'vocab' | 'paragraph' = 'vocab';
  items: any[] = [];

  constructor(private verificationService: VerificationService) {}

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.verificationService.getItemsToVerify(this.dataType).subscribe({
      next: (res) => this.items = res.items,
      error: (err) => console.error(err)
    });
  }

  verifyItem(item: any): void {
    this.verificationService.verifyItem(this.dataType, item).subscribe({
      next: () => {
        this.items = this.items.filter(i => i.dataKey !== item.dataKey);
      }
    });
  }
}
