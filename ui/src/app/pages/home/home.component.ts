import { Component } from '@angular/core';
import { HeaderComponent } from '../../components/header/header.component';
import { VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent {

  stats: any;
  translationTypes = ['vocab', 'phrase', 'paragraph'];

  constructor(private verificationService: VerificationService) {}

  ngOnInit() {
    this.verificationService.getStats()
      .then(res => {
        this.stats = res.stats;
        console.log('Stats fetched successfully: ', this.stats);
      })
      .catch(err => console.error('Failed to fetch stats', err));
  }



}
