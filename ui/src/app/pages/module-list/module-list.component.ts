// module-list.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header.component';
import { TranslationService } from '../../services/translation.service';

@Component({
  standalone: true,
  selector: 'app-module-list',
  templateUrl: './module-list.component.html',
  styleUrls: ['./module-list.component.scss'],
  imports: [CommonModule, FormsModule, HttpClientModule, HeaderComponent]
})
export class ModuleListComponent implements OnInit {
    modules: any[] = [];
    loading = true;
    selectedSource: string = 'All';
  
    constructor(private service: TranslationService, private router: Router) {}
  
    ngOnInit(): void {
      this.service.getAllModules().subscribe(data => {
        this.modules = data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        this.loading = false;
      });
    }
  
    get filteredModules() {
      if (this.selectedSource === 'All') return this.modules;
      return this.modules.filter(m => m.source === this.selectedSource);
    }
  
    goToReview(module: any) {
      this.router.navigate(['/module-review'], {
        queryParams: {
          id: module.id,
          title: module.learningModuleTitle
        }
      });
    }
  }
