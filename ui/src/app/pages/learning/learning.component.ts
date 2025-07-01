// learning.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LearningService, LearningModule } from '../services/learning.service';
import { LearnService } from '../../services/learn.service';

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
          <div *ngFor="let moduleTitle of availableModules" 
               class="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
               (click)="selectModule(moduleTitle)">
            <h4 class="font-bold">{{moduleTitle}}</h4>
          </div>
        </div>
      </div>

      <!-- Active Module Content -->
      <div *ngIf="activeModule" class="mt-6">
        <h3 class="text-xl mb-3">{{activeModule.learningModuleTitle}}</h3>
        
        <!-- Navigation -->
        <div class="flex justify-between items-center mb-4">
          <button 
            [disabled]="currentPage === 1"
            (click)="changePage(currentPage - 1)"
            class="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300">
            Previous
          </button>
          <span>Page {{currentPage}} of {{activeModule.totalPages}}</span>
          <button 
            [disabled]="currentPage === activeModule.totalPages"
            (click)="changePage(currentPage + 1)"
            class="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300">
            Next
          </button>
        </div>

        <!-- Content -->
        <div class="space-y-4">
          <div *ngFor="let paragraph of activeModule.paragraphs" 
               class="p-4 bg-white rounded shadow">
            {{paragraph}}
          </div>
        </div>
      </div>

      <!-- Chat Interface -->
      <div class="mt-6 border-t pt-4">
        <h3 class="text-xl mb-3">Practice with AI Tutor</h3>
        <div class="chat-container min-h-[200px] border rounded p-4 mb-4">
          <!-- Chat messages here -->
          <div *ngFor="let message of chatMessages" 
               class="mb-2"
               [ngClass]="{'text-right': message.isUser}">
            <div [class]="message.isUser ? 
                         'bg-blue-100 inline-block p-2 rounded' : 
                         'bg-gray-100 inline-block p-2 rounded'">
              {{message.text}}
            </div>
          </div>
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
  availableModules: string[] = [];
  activeModule: LearningModule | null = null;
  currentPage: number = 1;
  userMessage: string = '';
  chatMessages: Array<{ text: string; isUser: boolean }> = [];
  session: any = {};

  constructor(
    private learningService: LearningService,
    private learnService: LearnService
  ) {}

  ngOnInit() {
    this.loadModules();
  }

  async loadModules() {
    this.learningService.getModules().subscribe({
      next: (response) => {
        this.availableModules = response.modules;
      },
      error: (error) => {
        console.error('Error loading modules:', error);
      }
    });
  }

  selectModule(moduleTitle: string) {
    this.currentPage = 1;
    this.loadModulePage(moduleTitle, this.currentPage);
  }

  loadModulePage(moduleTitle: string, page: number) {
    this.learningService.getModulePage(moduleTitle, page).subscribe({
      next: (module) => {
        this.activeModule = module;
        this.currentPage = page;
      },
      error: (error) => {
        console.error('Error loading module page:', error);
      }
    });
  }

  changePage(newPage: number) {
    if (this.activeModule && newPage >= 1 && newPage <= (this.activeModule.totalPages || 1)) {
      this.loadModulePage(this.activeModule.learningModuleTitle, newPage);
    }
  }

  async sendMessage() {
    if (!this.userMessage.trim()) return;

    // Add user message to chat
    this.chatMessages.push({ text: this.userMessage, isUser: true });
    const msg = this.userMessage;
    this.userMessage = '';

    try {
      const response = await this.learnService.sendMessage(msg, this.session);
      this.session = response.session;
      this.chatMessages.push({ text: response.reply, isUser: false });
    } catch (err) {
      console.error('Chat failed', err);
      this.chatMessages.push({ text: 'Sorry, something went wrong.', isUser: false });
    }
  }
}
