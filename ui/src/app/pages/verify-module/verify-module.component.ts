import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-verify-module',
  templateUrl: './verify-module.component.html',
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

  verifyCurrentModule(mod: any): void {
    const payload = {
      id: mod.id,
      title: mod.title,
      fullText: mod.fullText || '',
      modules: [mod]
    };

    this.translationService.verifyModule(payload).subscribe({
      next: (res) => {
        mod.verified = true;
        console.log('🟢 Module verified:', res);
      },
      error: (err) => {
        console.error('❌ Error verifying module:', err);
      }
    });
  }
}