import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../services/translation.service';

@Component({
  standalone: true,
  selector: 'app-verify-module',
  templateUrl: './verify-module.component.html',
  imports: [CommonModule],
  styleUrls: ['./verify-module.component.scss']
})
export class VerifyModuleComponent implements OnInit {
  moduleTitle: string = '';
  modules: any[] = [];
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    console.log('✅ VerifyModuleComponent initialized');

    verifyCurrentModule(): void {
        console.log('🧪 verifyCurrentModule called');
      
        const payload = {
          title: this.moduleTitle,
          fullText: this.modules.map(m =>
            m.examples.map(e => `${e.fijian} ${e.english}`).join('\n')
          ).join('\n\n'),
          modules: this.modules
        };
      
        this.translationService.verifyModule(payload).subscribe({
          next: (res) => {
            console.log('✅ Verified module saved:', res);
            alert('Module saved as verified!');
          },
          error: (err) => {
            console.error('❌ Error saving module:', err);
            alert('Error verifying module.');
          }
        });
    }      

    this.moduleTitle = this.route.snapshot.paramMap.get('title') || '6 Verb Prefixes Vaka';

    this.translationService.getModuleFromApi(this.moduleTitle).subscribe({
      next: (data) => {
        console.log('✅ Loaded module:', data);
        this.modules = data.modules;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading module:', err);
        this.loading = false;
      }
    });
  }

}
