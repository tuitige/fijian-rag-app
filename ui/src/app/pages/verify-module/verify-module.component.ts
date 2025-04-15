import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-verify-module',
  //templateUrl: './verify-module.component.html',
  template: `
  <div *ngIf="!loading">
  <p>✅ Finished loading!</p>

  <div *ngFor="let mod of modules" style="margin: 1em; padding: 1em; border: 1px solid black;">
    <h3>📘 Title: {{ mod.title }}</h3>
    <p>📝 Summary: {{ mod.summary }}</p>

    <div *ngFor="let ex of mod.examples" style="margin-top: 0.5em;">
      <p>🗣 Fijian: {{ ex.fijian }}</p>
      <p>💬 English: {{ ex.english }}</p>
      <p>📚 Notes: {{ ex.notes }}</p>
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
