// src/pages/index.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white p-6">
        <h1 className="text-4xl font-heading">Fijian Language AI</h1>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Link href="/training">
            <div className="card bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h2 className="text-2xl text-primary mb-4">AI Training & Verification</h2>
              <p>Help improve our AI by verifying Fijian translations</p>
            </div>
          </Link>
          
          <Link href="/learning">
            <div className="card bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h2 className="text-2xl text-primary mb-4">Learn Fijian</h2>
              <p>Start your journey in learning the Fijian language</p>
            </div>
          </Link>
          
          <Link href="/about">
            <div className="card bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h2 className="text-2xl text-primary mb-4">About RAG AI</h2>
              <p>Learn about our AI-powered learning system</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
