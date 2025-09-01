export interface VocabularyRecord {
  word: string;
  frequency: number;
  sources: string[];
  lastSeen: string;
  definition?: string;
  context?: string;
  articleIds?: string[];
  lastUpdated?: string;
}

export interface VocabularyListResponse {
  items: VocabularyRecord[];
  total: number;
  hasMore: boolean;
  lastEvaluatedKey?: string;
}

export interface UpdateDefinitionRequest {
  definition: string;
  context?: string;
}

export interface SuggestDefinitionRequest {
  word: string;
  context?: string;
}

export interface SuggestDefinitionResponse {
  word: string;
  suggestedDefinition: string;
  confidence: string;
}

export interface VocabularyFilters {
  hasDefinition?: 'true' | 'false';
  sortBy?: 'frequency' | 'word' | 'lastSeen';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  lastEvaluatedKey?: string;
}