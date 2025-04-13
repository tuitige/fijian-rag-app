// lambda/shared/tools/opensearch-tools.ts
import { Tool } from '@langchain/core/tools';
import { Client } from '@opensearch-project/opensearch';
import { TranslationDocument } from '../types/documents';

export class SearchTranslationsTool extends Tool {
  name = 'search_similar_translations';
  description = 'Search for similar existing translations';
  private client: Client;
  private index: string;

  constructor(client: Client, index: string) {
    super();
    this.client = client;
    this.index = index;
  }

  /** @ignore */
  async _call(query: string): Promise<string> {
    try {
      const result = await this.client.search({
        index: this.index,
        body: {
          query: {
            bool: {
              must: [
                { term: { type: 'translation' } },
                { match: { sourceText: query } }
              ]
            }
          },
          sort: [{ confidence: 'desc' }]
        }
      });
      return JSON.stringify(result.body.hits.hits);
    } catch (error) {
      console.error('Search error:', error);
      return JSON.stringify([]);
    }
  }
}

export class SaveTranslationTool extends Tool {
  name = 'save_translation';
  description = 'Save a new translation to the database';
  private client: Client;
  private index: string;

  constructor(client: Client, index: string) {
    super();
    this.client = client;
    this.index = index;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    try {
      const translation: TranslationDocument = JSON.parse(input);
      const result = await this.client.index({
        index: this.index,
        body: translation,
        refresh: true
      });
      return `Translation saved with ID: ${result.body._id}`;
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  }
}

export class OpenSearchTools {
  private client: Client;
  private index: string;
  private searchTool: SearchTranslationsTool;
  private saveTool: SaveTranslationTool;

  constructor() {
    this.client = new Client({
      node: process.env.COLLECTION_ENDPOINT,
      ssl: {
        rejectUnauthorized: false
      }
    });
    this.index = process.env.COLLECTION_NAME || 'fijian-translations';
    this.searchTool = new SearchTranslationsTool(this.client, this.index);
    this.saveTool = new SaveTranslationTool(this.client, this.index);
  }

  getSearchTool(): SearchTranslationsTool {
    return this.searchTool;
  }

  getSaveTool(): SaveTranslationTool {
    return this.saveTool;
  }

  getTools(): Tool[] {
    return [this.searchTool, this.saveTool];
  }
}
