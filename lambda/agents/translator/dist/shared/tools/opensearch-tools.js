"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSearchTools = exports.SaveTranslationTool = exports.SearchTranslationsTool = void 0;
// lambda/shared/tools/opensearch-tools.ts
const tools_1 = require("@langchain/core/tools");
const opensearch_1 = require("@opensearch-project/opensearch");
class SearchTranslationsTool extends tools_1.Tool {
    constructor(client, index) {
        super();
        this.name = 'search_similar_translations';
        this.description = 'Search for similar existing translations';
        this.client = client;
        this.index = index;
    }
    /** @ignore */
    async _call(query) {
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
        }
        catch (error) {
            console.error('Search error:', error);
            return JSON.stringify([]);
        }
    }
}
exports.SearchTranslationsTool = SearchTranslationsTool;
class SaveTranslationTool extends tools_1.Tool {
    constructor(client, index) {
        super();
        this.name = 'save_translation';
        this.description = 'Save a new translation to the database';
        this.client = client;
        this.index = index;
    }
    /** @ignore */
    async _call(input) {
        try {
            const translation = JSON.parse(input);
            const result = await this.client.index({
                index: this.index,
                body: translation,
                refresh: true
            });
            return `Translation saved with ID: ${result.body._id}`;
        }
        catch (error) {
            console.error('Save error:', error);
            throw error;
        }
    }
}
exports.SaveTranslationTool = SaveTranslationTool;
class OpenSearchTools {
    constructor() {
        this.client = new opensearch_1.Client({
            node: process.env.COLLECTION_ENDPOINT,
            ssl: {
                rejectUnauthorized: false
            }
        });
        this.index = process.env.COLLECTION_NAME || 'fijian-translations';
        this.searchTool = new SearchTranslationsTool(this.client, this.index);
        this.saveTool = new SaveTranslationTool(this.client, this.index);
    }
    getSearchTool() {
        return this.searchTool;
    }
    getSaveTool() {
        return this.saveTool;
    }
    getTools() {
        return [this.searchTool, this.saveTool];
    }
}
exports.OpenSearchTools = OpenSearchTools;
