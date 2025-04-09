// learning.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface LearningModule {
  id: string;
  title: string;
  level: number;
  content: ModuleContent[];
  userProgress: number;
}

interface ModuleContent {
  type: 'vocabulary' | 'grammar' | 'conversation';
  content: any;
}

@Component({
  selector: 'app-learning',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container mx-auto p-4">
      <h2 class="text-2xl font-bold mb-4">Fijian Language Learning</h2>
      
      <!-- Module Selection -->
      <div class="mb-6">
        <h3 class="text-xl mb-3">Available Modules</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div *ngFor="let module of learningModules" 
               class="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
               (click)="selectModule(module)">
            <h4 class="font-bold">{{module.title}}</h4>
            <div class="mt-2">Progress: {{module.userProgress}}%</div>
          </div>
        </div>
      </div>

      <!-- Active Module Content -->
      <div *ngIf="activeModule" class="mt-6">
        <h3 class="text-xl mb-3">{{activeModule.title}}</h3>
        <!-- Module content here -->
      </div>

      <!-- Chat Interface -->
      <div class="mt-6 border-t pt-4">
        <h3 class="text-xl mb-3">Practice with AI Tutor</h3>
        <div class="chat-container">
          <!-- Chat messages here -->
        </div>
        <div class="mt-4">
          <input type="text" 
                 [(ngModel)]="userMessage" 
                 (keyup.enter)="sendMessage()"
                 class="w-full p-2 border rounded"
                 placeholder="Ask a question in English or Fijian...">
        </div>
      </div>
    </div>
  `
})
export class LearningComponent implements OnInit {
  learningModules: LearningModule[] = [];
  activeModule: LearningModule | null = null;
  userMessage: string = '';

  constructor() {}

  ngOnInit() {
    this.loadModules();
  }

  async loadModules() {
    // Fetch modules from your backend
  }

  selectModule(module: LearningModule) {
    this.activeModule = module;
  }

  async sendMessage() {
    // Implement RAG-powered chat functionality
  }
}
