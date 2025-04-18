
export interface LearningExample {
    fijian: string;
    english: string;
    notes?: string;
  }
  
  export interface LearningModule {
    title: string;
    summary: string;
    examples: LearningExample[];
  }
  
  export interface TranslationRequest {
    input: string;
    context?: string;
  }
  