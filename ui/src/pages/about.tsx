// src/pages/about.tsx
export default function About() {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-primary text-white p-6">
          <h1 className="text-4xl font-heading">About Fijian RAG AI</h1>
        </header>
        <main className="container mx-auto px-4 py-8">
          <h2 className="text-2xl text-primary mb-4">Our Mission</h2>
          <p>Learn about how we're using AI to preserve and teach the Fijian language...</p>
        </main>
      </div>
    );
  }