import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-verify-module',
  //templateUrl: './verify-module.component.html',
  template: `
  <div style="padding: 40px; background: #e0ffe0;">
    ✅ INLINE TEMPLATE WORKS<br />
    Module Title: {{ moduleTitle }}<br />
    Loading: {{ loading }}<br />
    Modules array: {{ modules.length }}<br />

    <div *ngIf="!loading">
      <p>✅ Finished loading!</p>
      <div *ngFor="let mod of modules">
        <h3>{{ mod.title }}</h3>
        <p>{{ mod.summary }}</p>
      </div>
    </div>
  </div>
`,
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
    this.moduleTitle = this.route.snapshot.paramMap.get('title') || '6 Verb Prefixes Vaka';

    this.translationService.getModule(this.moduleTitle).subscribe({
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
