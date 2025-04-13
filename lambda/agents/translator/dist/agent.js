"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslatorAgent = void 0;
// lambda/agents/translator/agent.ts
// lambda/agents/translator/agent.ts
const uuid_1 = require("uuid");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const client_opensearch_1 = require("@aws-sdk/client-opensearch");
const client_cloudwatch_1 = require("@aws-sdk/client-cloudwatch");
class TranslatorAgent {
    constructor() {
        const region = process.env.AWS_REGION || 'us-west-2';
        this.bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region });
        this.openSearchClient = new client_opensearch_1.OpenSearchClient({ region });
        this.cloudWatchClient = new client_cloudwatch_1.CloudWatchClient({ region });
        this.collectionName = process.env.COLLECTION_NAME || 'fijian-translations';
        this.collectionEndpoint = process.env.COLLECTION_ENDPOINT || '';
    }
    async logMetric(metricName, value, unit = client_cloudwatch_1.StandardUnit.Count) {
        try {
            const metricData = {
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: [
                    {
                        Name: 'Environment',
                        Value: process.env.ENVIRONMENT || 'development'
                    }
                ]
            };
            const command = new client_cloudwatch_1.PutMetricDataCommand({
                Namespace: 'FijianTranslator',
                MetricData: [metricData]
            });
            await this.cloudWatchClient.send(command);
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error logging metric:', metricName, error.message);
            }
        }
    }
    async logEvent(eventName, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: eventName,
            details,
            environment: process.env.ENVIRONMENT || 'development'
        };
        console.log(JSON.stringify(logEntry));
    }
    async translate(request) {
        const startTime = Date.now();
        try {
            await this.logEvent('TranslationRequested', {
                sourceLanguage: request.sourceLanguage,
                targetLanguage: request.targetLanguage,
                textLength: request.sourceText.length
            });
            const similarTranslations = await this.searchTranslations(request.sourceText);
            await this.logMetric('SimilarTranslationsFound', similarTranslations.length);
            if (similarTranslations.length > 0 && similarTranslations[0]._source.confidence > 0.9) {
                await this.logEvent('CacheHit', {
                    confidence: similarTranslations[0]._source.confidence
                });
                await this.logMetric('CacheHits', 1);
                return {
                    id: similarTranslations[0]._id,
                    sourceText: request.sourceText,
                    targetText: similarTranslations[0]._source.targetText,
                    sourceLanguage: request.sourceLanguage,
                    targetLanguage: request.targetLanguage,
                    confidence: similarTranslations[0]._source.confidence,
                    needsVerification: false,
                    createdAt: similarTranslations[0]._source.createdAt
                };
            }
            const translation = await this.generateTranslation(request);
            await this.logMetric('NewTranslationsGenerated', 1);
            await this.logMetric('TranslationConfidence', translation.confidence);
            const document = {
                id: (0, uuid_1.v4)(),
                type: 'translation',
                sourceText: request.sourceText,
                targetText: translation.targetText,
                sourceLanguage: request.sourceLanguage,
                targetLanguage: request.targetLanguage,
                confidence: translation.confidence,
                verified: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: {
                    context: request.context
                }
            };
            await this.saveTranslation(document);
            await this.logMetric('TranslationsSaved', 1);
            const response = {
                id: document.id,
                sourceText: document.sourceText,
                targetText: document.targetText,
                sourceLanguage: document.sourceLanguage,
                targetLanguage: document.targetLanguage,
                confidence: document.confidence,
                needsVerification: translation.needsVerification,
                createdAt: document.createdAt
            };
            const duration = Date.now() - startTime;
            await this.logMetric('TranslationLatency', duration, 'Milliseconds');
            await this.logEvent('TranslationCompleted', {
                id: document.id,
                confidence: document.confidence,
                needsVerification: translation.needsVerification,
                duration
            });
            return response;
        }
        catch (error) {
            if (error instanceof Error) {
                await this.logEvent('TranslationError', {
                    errorMessage: error.message,
                    request
                });
            }
            await this.logMetric('TranslationErrors', 1);
            throw error;
        }
    }
    async searchTranslations(sourceText) {
        const startTime = Date.now();
        try {
            const searchBody = {
                query: {
                    match: {
                        sourceText: sourceText
                    }
                }
            };
            // Using the AWS SDK's built-in request structure
            const command = new client_opensearch_1.DescribeDomainCommand({
                DomainName: this.collectionName
            });
            const response = await this.openSearchClient.send(command);
            const duration = Date.now() - startTime;
            await this.logMetric('SearchLatency', duration, client_cloudwatch_1.StandardUnit.Milliseconds);
            // Parse the response safely
            let hits = [];
            try {
                const responseJson = JSON.parse(JSON.stringify(response));
                hits = responseJson?.hits?.hits || [];
            }
            catch (parseError) {
                console.error('Error parsing OpenSearch response:', parseError);
            }
            return hits;
        }
        catch (error) {
            if (error instanceof Error) {
                await this.logEvent('SearchError', {
                    errorMessage: error.message,
                    sourceText
                });
            }
            await this.logMetric('SearchErrors', 1);
            throw error;
        }
    }
    async generateTranslation(request) {
        const startTime = Date.now();
        try {
            const prompt = {
                role: 'system',
                content: 'You are a professional translator specializing in English to Fijian translations.'
            };
            const userMessage = {
                role: 'user',
                content: `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}. 
                  Context: ${request.context || 'None provided'}
                  Text: ${request.sourceText}`
            };
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    messages: [prompt, userMessage]
                })
            });
            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const result = this.parseTranslationResult(responseBody.content[0].text);
            const duration = Date.now() - startTime;
            await this.logMetric('BedrockLatency', duration, 'Milliseconds');
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                await this.logEvent('BedrockError', {
                    errorMessage: error.message,
                    request
                });
            }
            await this.logMetric('BedrockErrors', 1);
            throw error;
        }
    }
    async saveTranslation(document) {
        const startTime = Date.now();
        try {
            // Using the AWS SDK's built-in request structure
            const command = new client_opensearch_1.DescribeDomainCommand({
                DomainName: this.collectionName
            });
            await this.openSearchClient.send(command);
            const duration = Date.now() - startTime;
            await this.logMetric('SaveLatency', duration, client_cloudwatch_1.StandardUnit.Milliseconds);
        }
        catch (error) {
            if (error instanceof Error) {
                await this.logEvent('SaveError', {
                    errorMessage: error.message,
                    documentId: document.id
                });
            }
            await this.logMetric('SaveErrors', 1);
            throw error;
        }
    }
    parseTranslationResult(result) {
        try {
            return JSON.parse(result);
        }
        catch (error) {
            if (error instanceof Error) {
                this.logEvent('ParseError', {
                    errorMessage: error.message,
                    result
                });
            }
            return {
                targetText: result,
                confidence: 0.7,
                needsVerification: true,
                notes: 'Parsed from unstructured response'
            };
        }
    }
}
exports.TranslatorAgent = TranslatorAgent;
