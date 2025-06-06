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
  styleUrls: ['./learn.component.scss'],
  imports: [CommonModule, FormsModule]
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

      console.log('Sending message to backend:', { input: userMessage, session: this.session });

      const response = await this.learnService.sendMessage(userMessage, this.session);

      console.log('Raw response from backend:', response);      

      // ✅ Update session if backend sent a new one
      if (response.session) {
        console.log('Updating session:', response.session);
        this.session = response.session;
      }
  
      // ✅ Push system reply
      if (response.reply) {
        console.log('Pushing system reply:', response.reply);
        this.messages.push({ sender: 'system', text: response.reply });
      } else {
        console.warn('No reply field received from backend.');
        this.messages.push({ sender: 'system', text: 'No response received.' });
      }
    } catch (error) {
      console.error(error);
      this.messages.push({ sender: 'system', text: 'Sorry, something went wrong. Please try again.' });
    }
  }
  
}
