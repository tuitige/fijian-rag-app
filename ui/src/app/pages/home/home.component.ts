import { Component } from '@angular/core';
import { HeaderComponent } from '../../components/header/header.component';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent {

stats: any;

constructor(private translationService: TranslationService) {}

  ngOnInit() {
    this.translationService.getVerificationStats()
      .then(res => {
        this.stats = res.stats;
      })
      .catch(err => {
        console.error('Failed to fetch stats', err);
      });
  }



}
