export interface ChapterManifest {
  chapter: string;
  topic: string;
  startPage: number;
  totalPages: number;
  files: string[];
  timestamp: string;
  s3Prefix: string;
  runComparison?: boolean;
}

export interface ChapterExtraction {
  chapterMetadata: {
    lesson: string;
    title: string;
    subtitle: string;
    pageRange: string;
    source: string;
    totalPages: number;
    learningObjectives: string[];
    prerequisiteLessons?: string[];
  };
  translationPairs: {
    [category: string]: TranslationItem[];
  };
  grammarRules: GrammarRule[];
  exercises: Exercise[];
  culturalNotes: CulturalNote[];
  dialogues?: Dialogue[];
  visualAids?: VisualAid[];
}

export interface TranslationItem {
  fijian: string;
  english: string;
  type: string;
  page: number;
  usageNotes?: string;
  pronunciation?: string;
  verified: boolean;
  source: string;
}

export interface GrammarRule {
  concept: string;
  explanation: string;
  pattern?: string;
  examples: Array<{
    fijian: string;
    english: string;
    breakdown?: string;
  }>;
  page: number;
}

export interface Exercise {
  type: string;
  instruction: string;
  content?: string;
  page: number;
}

export interface CulturalNote {
  note: string;
  pages?: number[];
}

export interface Dialogue {
  id: string;
  topic: string;
  participants?: string[];
  page: number;
}

export interface VisualAid {
  type: string;
  description: string;
  pages: number[];
}