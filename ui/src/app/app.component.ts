import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="min-h-screen bg-background">
      <header class="bg-primary text-white p-6">
        <h1 class="text-4xl">Fijian Language AI</h1>
        <nav>
          <a routerLink="/home">Home</a>
          <a routerLink="/training">Training</a>
          <a routerLink="/learning">Learning</a>
          <a routerLink="/about">About</a>
        </nav>
      </header>
      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AppComponent {
  title = 'Fijian Language AI';
}
