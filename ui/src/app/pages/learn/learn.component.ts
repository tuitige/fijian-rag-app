// src/app/learn/learn.component.ts
import { Component } from '@angular/core';
import { LearnService } from '../../services/learn.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
//import { TranslationService } from '../../services/translation.service';
import { HeaderComponent } from '../../components/header/header.component';

interface ChatMessage {
  sender: 'user' | 'system';
  text: string;
}

@Component({
  standalone: true,
  selector: 'app-learn',
  templateUrl: './learn.component.html',
  styleUrls: ['./learn.component.scss']
})
export class LearnComponent {
  messages: ChatMessage[] = [
    { sender: 'system', text: 'Bula! Welcome to your Fijian lesson. Type anything to get started!' }
  ];
  userInput: string = '';

  constructor(private learnService: LearnService) {}

  session: any = {};

  async sendMessage() {
    if (!this.userInput.trim()) return;
  
    this.messages.push({ sender: 'user', text: this.userInput });
    const userMessage = this.userInput;
    this.userInput = '';
  
    try {
      const response = await this.learnService.sendMessage(userMessage, this.session);
      this.session = response.session || {};
      this.messages.push({ sender: 'system', text: response.reply });
    } catch (error) {
      console.error(error);
      this.messages.push({ sender: 'system', text: 'Sorry, something went wrong. Please try again.' });
    }
  }
}
