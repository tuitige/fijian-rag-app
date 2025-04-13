"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const agent_1 = require("./agent");
const handler = async (event) => {
    try {
        const request = JSON.parse(event.body || '{}');
        // Validate request
        if (!request.sourceText || !request.sourceLanguage || !request.targetLanguage) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Missing required fields: sourceText, sourceLanguage, targetLanguage'
                })
            };
        }
        console.log('Translation request:', request);
        const agent = new agent_1.TranslatorAgent();
        const result = await agent.translate(request);
        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    }
    catch (error) {
        console.error('Translation error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};
exports.handler = handler;
