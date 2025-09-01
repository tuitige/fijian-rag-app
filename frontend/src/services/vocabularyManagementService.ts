import api from './api';
import { 
  VocabularyListResponse, 
  VocabularyFilters, 
  UpdateDefinitionRequest,
  SuggestDefinitionRequest,
  SuggestDefinitionResponse,
  VocabularyRecord
} from '../types/vocabulary';

export class VocabularyManagementService {
  /**
   * Get vocabulary records with filtering and pagination
   */
  static async getVocabulary(filters: VocabularyFilters = {}): Promise<VocabularyListResponse> {
    const params = new URLSearchParams();
    
    if (filters.hasDefinition) params.append('hasDefinition', filters.hasDefinition);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.lastEvaluatedKey) params.append('lastEvaluatedKey', filters.lastEvaluatedKey);

    const response = await api.get(`/vocabulary/management?${params.toString()}`);
    return response.data;
  }

  /**
   * Update definition for a vocabulary word
   */
  static async updateDefinition(word: string, request: UpdateDefinitionRequest): Promise<{ message: string; record: VocabularyRecord }> {
    const response = await api.put(`/vocabulary/${encodeURIComponent(word)}/definition`, request);
    return response.data;
  }

  /**
   * Get AI-suggested definition for a word
   */
  static async suggestDefinition(request: SuggestDefinitionRequest): Promise<SuggestDefinitionResponse> {
    const response = await api.post('/vocabulary/suggest-definition', request);
    return response.data;
  }
}

export default VocabularyManagementService;