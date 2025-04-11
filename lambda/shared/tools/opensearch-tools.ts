// lambda/shared/tools/opensearch-tools.ts
import { Tool } from 'langchain/tools';
import { Client } from '@opensearch-project/opensearch';
import { TranslationDocument } from '../types/documents';

export class OpenSearchTools {
  private client: Client;
  private index: string;

  constructor() {
    this.client = new Client({
      node: process.env.OPENSEARCH_ENDPOINT,
    });
    this.index = 'fijian-content';
  }

  getTools(): Tool[] {
    return [
      new Tool({
        name: 'search_similar_translations',
        description: 'Search for similar existing translations',
        func: async (query: string) => {
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
              sort: [
                { confidence: 'desc' }
              ]
            }
          });
          return JSON.stringify(result.body.hits.hits);
        }
      }),
      new Tool({
        name: 'save_translation',
        description: 'Save a new translation to the database',
        func: async (input: string) => {
          const translation: TranslationDocument = JSON.parse(input);
          await this.client.index({
            index: this.index,
            body: translation,
            refresh: true
          });
          return `Translation saved with ID: ${translation.id}`;
        }
      })
    ];
  }
}
