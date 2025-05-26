import { Component, OnInit } from '@angular/core';
import { HeaderComponent } from '../../components/header/header.component';
import { VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeaderComponent],
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

}
