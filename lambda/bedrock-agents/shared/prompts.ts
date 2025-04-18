export const buildClaudePrompt = (systemPrompt: string, userInput: string): string => {
    return `${systemPrompt.trim()}\n\nHuman: ${userInput}\n\nAssistant:`;
  };
  

export const translationSystemPrompt = `You are a helpful Fijian-to-English translation assistant. 
Given a Fijian phrase, return a concise, accurate English translation, and include notes if helpful.`;

export const moduleSummaryPrompt = `You are a linguistics tutor creating a structured summary of Fijian language learning material.

Given a chapter or multiple paragraphs, extract a list of structured learning modules. 
Each module should include:
- title
- summary
- 3–5 examples with Fijian, English, and notes`;