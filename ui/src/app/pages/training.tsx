// src/pages/training.tsx
import { useState } from 'react';

export default function Training() {
  const [fijianText, setFijianText] = useState('');
  const [translation, setTranslation] = useState('');
  const [verifiedTranslation, setVerifiedTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTranslate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceText: sourceText,
          sourceLanguage: sourceLanguage
        }),
      });
      const data = await response.json();
      setTranslation(data);
      setVerifiedTranslation(data.translation);
    } catch (error) {
      console.error('Translation error:', error);
    }
    setIsLoading(false);
  };

  const handleVerify = async () => {
    try {
      await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalFijian: fijianText,
          verifiedEnglish: verifiedTranslation
        })
      });
      alert('Translation verified and stored successfully!');
      // Reset form
      setFijianText('');
      setTranslation('');
      setVerifiedTranslation('');
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white p-6">
        <h1 className="text-4xl font-heading">Translation Training</h1>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <label className="block text-primary mb-2">Fijian Text</label>
            <textarea
              className="w-full p-3 border rounded-lg"
              rows={4}
              value={fijianText}
              onChange={(e) => setFijianText(e.target.value)}
              placeholder="Enter Fijian text here..."
            />
          </div>

          <button
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-opacity-90"
            onClick={handleTranslate}
            disabled={isLoading}
          >
            {isLoading ? 'Translating...' : 'Translate'}
          </button>

          {translation && (
            <div>
              <label className="block text-primary mb-2">Verified Translation</label>
              <textarea
                className="w-full p-3 border rounded-lg"
                rows={4}
                value={verifiedTranslation}
                onChange={(e) => setVerifiedTranslation(e.target.value)}
                placeholder="Edit translation if needed..."
              />
              <button
                className="mt-4 bg-secondary text-white px-6 py-2 rounded-lg hover:bg-opacity-90"
                onClick={handleVerify}
              >
                Verify Translation
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
