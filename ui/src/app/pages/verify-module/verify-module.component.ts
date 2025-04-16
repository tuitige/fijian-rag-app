import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../services/translation.service';

@Component({
  standalone: true,
  selector: 'app-verify-module',
  templateUrl: './verify-module.component.html',
  imports: [CommonModule,FormsModule],
  styleUrls: ['./verify-module.component.scss'],
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

    // verifyModule
    verified = false;
    verifyCurrentModule(): void {
        console.log('🧪 verifyCurrentModule called');
    
        const payload = {
        title: this.moduleTitle,
        fullText: this.modules
            .map(m => m.examples.map((e: any) => `${e.fijian} ${e.english}`).join('\n'))
            .join('\n\n'),
        modules: this.modules
        };
    
        this.translationService.verifyModule(payload).subscribe({
        next: (res: any) => {
            console.log('✅ Verified module saved:', res);
            this.verified = true;
            alert('Module saved as verified!');
        },
        error: (err: any) => {
            console.error('❌ Error saving module:', err);
            alert('Error verifying module.');
        }
        });
    }

    // inline editing and toggle
    isEditing = false;
    toggleEditing(): void {
    this.isEditing = !this.isEditing;
    }


}
