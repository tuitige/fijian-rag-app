import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeaderComponent, CommonModule],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {

  stats: { [key: string]: { total: number, verified: number } } | null = null;
  translationTypes = ['vocab', 'phrase', 'paragraph'];

  constructor(private verificationService: VerificationService) {}

ngOnInit() {
  this.verificationService.getStats().subscribe(res => {
    this.stats = res.stats;
  });
}

getPercentage(type: string): string {
  const t = this.stats?.[type];
  if (!t || !t.total || !t.verified) return '0';
  const percent = (t.verified / t.total) * 100;
  return percent.toFixed(0);
}

}
