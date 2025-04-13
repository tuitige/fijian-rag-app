"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslatorAgent = void 0;
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
    async logMetric(metricName, value, unit = client_cloudwatch_1.StandardUnit.COUNT) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhZ2VudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxvQ0FBb0M7QUFDcEMsK0JBQW9DO0FBQ3BDLDRFQUEyRjtBQUMzRixrRUFJb0M7QUFDcEMsa0VBS29DO0FBb0NwQyxNQUFhLGVBQWU7SUFPMUI7UUFDRSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxXQUFXLENBQUM7UUFDckQsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLDZDQUFvQixDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxvQ0FBZ0IsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksb0NBQWdCLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLElBQUkscUJBQXFCLENBQUM7UUFDM0UsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksRUFBRSxDQUFDO0lBQ2xFLENBQUM7SUFFTyxLQUFLLENBQUMsU0FBUyxDQUFDLFVBQWtCLEVBQUUsS0FBYSxFQUFFLE9BQXFCLGdDQUFZLENBQUMsS0FBSztRQUNoRyxJQUFJLENBQUM7WUFDSCxNQUFNLFVBQVUsR0FBZ0I7Z0JBQzlCLFVBQVUsRUFBRSxVQUFVO2dCQUN0QixLQUFLLEVBQUUsS0FBSztnQkFDWixJQUFJLEVBQUUsSUFBSTtnQkFDVixTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUU7Z0JBQ3JCLFVBQVUsRUFBRTtvQkFDVjt3QkFDRSxJQUFJLEVBQUUsYUFBYTt3QkFDbkIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLGFBQWE7cUJB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Q0gsQ0FBQztJQUVPLHNCQUFzQixDQUFDLE1BQWM7UUFDM0MsSUFBSSxDQUFDO1lBQ0gsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFBQyxPQUFPLEtBQWMsRUFBRSxDQUFDO1lBQ3hCLElBQUksS0FBSyxZQUFZLEtBQUssRUFBRSxDQUFDO2dCQUMzQixJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRTtvQkFDMUIsWUFBWSxFQUFFLEtBQUssQ0FBQyxPQUFPO29CQUMzQixNQUFNO2lCQUNQLENBQUMsQ0FBQztZQUNMLENBQUM7WUFDRCxPQUFPO2dCQUNMLFVBQVUsRUFBRSxNQUFNO2dCQUNsQixVQUFVLEVBQUUsR0FBRztnQkFDZixpQkFBaUIsRUFBRSxJQUFJO2dCQUN2QixLQUFLLEVBQUUsbUNBQW1DO2FBQzNDLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbFJELDBDQWtSQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIGxhbWJkYS9hZ2VudHMvdHJhbnNsYXRvci9hZ2VudC50c1xyXG5pbXBvcnQgeyB2NCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkJztcclxuaW1wb3J0IHsgQmVkcm9ja1J1bnRpbWVDbGllbnQsIEludm9rZU1vZGVsQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1iZWRyb2NrLXJ1bnRpbWUnO1xyXG5pbXBvcnQgeyBcclxuICBPcGVuU2VhcmNoQ2xpZW50LCBcclxuICBEZXNjcmliZURvbWFpbkNvbW1hbmQsXHJcbiAgU2VhcmNoUmVxdWVzdCBcclxufSBmcm9tICdAYXdzLXNkay9jbGllbnQtb3BlbnNlYXJjaCc7XHJcbmltcG9ydCB7IFxyXG4gIENsb3VkV2F0Y2hDbGllbnQsIFxyXG4gIFB1dE1ldHJpY0RhdGFDb21tYW5kLCBcclxuICBTdGFuZGFyZFVuaXQsXHJcbiAgTWV0cmljRGF0dW0gXHJcbn0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNsb3Vkd2F0Y2gnO1xyXG5cclxuaW50ZXJmYWNlIFRyYW5zbGF0aW9uUmVxdWVzdCB7XHJcbiAgc291cmNlVGV4dDogc3RyaW5nO1xyXG4gIHRhcmdldExhbmd1YWdlOiBzdHJpbmc7XHJcbiAgc291cmNlTGFuZ3VhZ2U6IHN0cmluZztcclxuICBjb250ZXh0Pzogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgVHJhbnNsYXRpb25SZXNwb25zZSB7XHJcbiAgaWQ6IHN0cmluZztcclxuICBzb3VyY2VUZXh0OiBzdHJpbmc7XHJcbiAgdGFyZ2V0VGV4dDogc3RyaW5nO1xyXG4gIHNvdXJjZUxhbmd1YWdlOiBzdHJpbmc7XHJcbiAgdGFyZ2V0TGFuZ3VhZ2U6IHN0cmluZztcclxuICBjb25maWRlbmNlOiBudW1iZXI7XHJcbiAgbmVlZHNWZXJpZmljYXRpb246IGJvb2xlYW47XHJcbiAgY3JlYXRlZEF0OiBzdHJpbmc7XHJcbn1cclxuXHJcbmludGVyZmFjZSBUcmFuc2xhdGlvblJlc3VsdCB7XHJcbiAgdGFyZ2V0VGV4dDogc3RyaW5nO1xyXG4gIGNvbmZpZGVuY2U6IG51bWJlcjtcclxuICBuZWVkc1ZlcmlmaWNhdGlvbjogYm9vbGVhbjtcclxuICBub3Rlcz86IHN0cmluZztcclxufVxyXG5cclxuaW50ZXJmYWNlIE9wZW5TZWFyY2hSZXNwb25zZSB7XHJcbiAgaGl0cz86IHtcclxuICAgIGhpdHM6IEFycmF5PHtcclxuICAgICAgX2lkOiBzdHJpbmc7XHJcbiAgICAgIF9zb3VyY2U6IGFueTtcclxuICAgIH0+O1xyXG4gIH07XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBUcmFuc2xhdG9yQWdlbnQge1xyXG4gIHByaXZhdGUgYmVkcm9ja0NsaWVudDogQmVkcm9ja1J1bnRpbWVDbGllbnQ7XHJcbiAgcHJpdmF0ZSBvcGVuU2VhcmNoQ2xpZW50OiBPcGVuU2VhcmNoQ2xpZW50O1xyXG4gIHByaXZhdGUgY2xvdWRXYXRjaENsaWVudDogQ2xvdWRXYXRjaENsaWVudDtcclxuICBwcml2YXRlIGNvbGxlY3Rpb25OYW1lOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBjb2xsZWN0aW9uRW5kcG9pbnQ6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICBjb25zdCByZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIHx8ICd1cy13ZXN0LTInO1xyXG4gICAgdGhpcy5iZWRyb2NrQ2xpZW50ID0gbmV3IEJlZHJvY2tSdW50aW1lQ2xpZW50KHsgcmVnaW9uIH0pO1xyXG4gICAgdGhpcy5vcGVuU2VhcmNoQ2xpZW50ID0gbmV3IE9wZW5TZWFyY2hDbGllbnQoeyByZWdpb24gfSk7XHJcbiAgICB0aGlzLmNsb3VkV2F0Y2hDbGllbnQgPSBuZXcgQ2xvdWRXYXRjaENsaWVudCh7IHJlZ2lvbiB9KTtcclxuICAgIHRoaXMuY29sbGVjdGlvbk5hbWUgPSBwcm9jZXNzLmVudi5DT0xMRUNUSU9OX05BTUUgfHwgJ2Zpamlhbi10cmFuc2xhdGlvbnMnO1xyXG4gICAgdGhpcy5jb2xsZWN0aW9uRW5kcG9pbnQgPSBwcm9jZXNzLmVudi5DT0xMRUNUSU9OX0VORFBPSU5UIHx8ICcnO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBsb2dNZXRyaWMobWV0cmljTmFtZTogc3RyaW5nLCB2YWx1ZTogbnVtYmVyLCB1bml0OiBTdGFuZGFyZFVuaXQgPSBTdGFuZGFyZFVuaXQuQ09VTlQpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IG1ldHJpY0RhdGE6IE1ldHJpY0RhdHVtID0ge1xyXG4gICAgICAgIE1ldHJpY05hbWU6IG1ldHJpY05hbWUsXHJcbiAgICAgICAgVmFsdWU6IHZhbHVlLFxyXG4gICAgICAgIFVuaXQ6IHVuaXQsXHJcbiAgICAgICAgVGltZXN0YW1wOiBuZXcgRGF0ZSgpLFxyXG4gICAgICAgIERpbWVuc2lvbnM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgTmFtZTogJ0Vudmlyb25tZW50JyxcclxuICAgICAgICAgICAgVmFsdWU6IHByb2Nlc3MuZW52LkVOVklST05NRU5UIHx8ICdkZXZlbG9wbWVudCdcclxuICAgICAgICAgIH1cclxuICAgICAgICBdXHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBjb21tYW5kID0gbmV3IFB1dE1ldHJpY0RhdGFDb21tYW5kKHtcclxuICAgICAgICBOYW1lc3BhY2U6ICdGaWppYW5UcmFuc2xhdG9yJyxcclxuICAgICAgICBNZXRyaWNEYXRhOiBbbWV0cmljRGF0YV1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLmNsb3VkV2F0Y2hDbGllbnQuc2VuZChjb21tYW5kKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiB1bmtub3duKSB7XHJcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgbG9nZ2luZyBtZXRyaWM6JywgbWV0cmljTmFtZSwgZXJyb3IubWVzc2FnZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgbG9nRXZlbnQoZXZlbnROYW1lOiBzdHJpbmcsIGRldGFpbHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBsb2dFbnRyeSA9IHtcclxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgIGV2ZW50OiBldmVudE5hbWUsXHJcbiAgICAgIGRldGFpbHMsXHJcbiAgICAgIGVudmlyb25tZW50OiBwcm9jZXNzLmVudi5FTlZJUk9OTUVOVCB8fCAnZGV2ZWxvcG1lbnQnXHJcbiAgICB9O1xyXG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkobG9nRW50cnkpKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHRyYW5zbGF0ZShyZXF1ZXN0OiBUcmFuc2xhdGlvblJlcXVlc3QpOiBQcm9taXNlPFRyYW5zbGF0aW9uUmVzcG9uc2U+IHtcclxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCB0aGlzLmxvZ0V2ZW50KCdUcmFuc2xhdGlvblJlcXVlc3RlZCcsIHtcclxuICAgICAgICBzb3VyY2VMYW5ndWFnZTogcmVxdWVzdC5zb3VyY2VMYW5ndWFnZSxcclxuICAgICAgICB0YXJnZXRMYW5ndWFnZTogcmVxdWVzdC50YXJnZXRMYW5ndWFnZSxcclxuICAgICAgICB0ZXh0TGVuZ3RoOiByZXF1ZXN0LnNvdXJjZVRleHQubGVuZ3RoXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc3Qgc2ltaWxhclRyYW5zbGF0aW9ucyA9IGF3YWl0IHRoaXMuc2VhcmNoVHJhbnNsYXRpb25zKHJlcXVlc3Quc291cmNlVGV4dCk7XHJcbiAgICAgIGF3YWl0IHRoaXMubG9nTWV0cmljKCdTaW1pbGFyVHJhbnNsYXRpb25zRm91bmQnLCBzaW1pbGFyVHJhbnNsYXRpb25zLmxlbmd0aCk7XHJcblxyXG4gICAgICBpZiAoc2ltaWxhclRyYW5zbGF0aW9ucy5sZW5ndGggPiAwICYmIHNpbWlsYXJUcmFuc2xhdGlvbnNbMF0uX3NvdXJjZS5jb25maWRlbmNlID4gMC45KSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5sb2dFdmVudCgnQ2FjaGVIaXQnLCB7XHJcbiAgICAgICAgICBjb25maWRlbmNlOiBzaW1pbGFyVHJhbnNsYXRpb25zWzBdLl9zb3VyY2UuY29uZmlkZW5jZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGF3YWl0IHRoaXMubG9nTWV0cmljKCdDYWNoZUhpdHMnLCAxKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIGlkOiBzaW1pbGFyVHJhbnNsYXRpb25zWzBdLl9pZCxcclxuICAgICAgICAgIHNvdXJjZVRleHQ6IHJlcXVlc3Quc291cmNlVGV4dCxcclxuICAgICAgICAgIHRhcmdldFRleHQ6IHNpbWlsYXJUcmFuc2xhdGlvbnNbMF0uX3NvdXJjZS50YXJnZXRUZXh0LFxyXG4gICAgICAgICAgc291cmNlTGFuZ3VhZ2U6IHJlcXVlc3Quc291cmNlTGFuZ3VhZ2UsXHJcbiAgICAgICAgICB0YXJnZXRMYW5ndWFnZTogcmVxdWVzdC50YXJnZXRMYW5ndWFnZSxcclxuICAgICAgICAgIGNvbmZpZGVuY2U6IHNpbWlsYXJUcmFuc2xhdGlvbnNbMF0uX3NvdXJjZS5jb25maWRlbmNlLFxyXG4gICAgICAgICAgbmVlZHNWZXJpZmljYXRpb246IGZhbHNlLFxyXG4gICAgICAgICAgY3JlYXRlZEF0OiBzaW1pbGFyVHJhbnNsYXRpb25zWzBdLl9zb3VyY2UuY3JlYXRlZEF0XHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdHJhbnNsYXRpb24gPSBhd2FpdCB0aGlzLmdlbmVyYXRlVHJhbnNsYXRpb24ocmVxdWVzdCk7XHJcbiAgICAgIGF3YWl0IHRoaXMubG9nTWV0cmljKCdOZXdUcmFuc2xhdGlvbnNHZW5lcmF0ZWQnLCAxKTtcclxuICAgICAgYXdhaXQgdGhpcy5sb2dNZXRyaWMoJ1RyYW5zbGF0aW9uQ29uZmlkZW5jZScsIHRyYW5zbGF0aW9uLmNvbmZpZGVuY2UpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgZG9jdW1lbnQgPSB7XHJcbiAgICAgICAgaWQ6IHV1aWR2NCgpLFxyXG4gICAgICAgIHR5cGU6ICd0cmFuc2xhdGlvbicsXHJcbiAgICAgICAgc291cmNlVGV4dDogcmVxdWVzdC5zb3VyY2VUZXh0LFxyXG4gICAgICAgIHRhcmdldFRleHQ6IHRyYW5zbGF0aW9uLnRhcmdldFRleHQsXHJcbiAgICAgICAgc291cmNlTGFuZ3VhZ2U6IHJlcXVlc3Quc291cmNlTGFuZ3VhZ2UsXHJcbiAgICAgICAgdGFyZ2V0TGFuZ3VhZ2U6IHJlcXVlc3QudGFyZ2V0TGFuZ3VhZ2UsXHJcbiAgICAgICAgY29uZmlkZW5jZTogdHJhbnNsYXRpb24uY29uZmlkZW5jZSxcclxuICAgICAgICB2ZXJpZmllZDogZmFsc2UsXHJcbiAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgbWV0YWRhdGE6IHtcclxuICAgICAgICAgIGNvbnRleHQ6IHJlcXVlc3QuY29udGV4dFxyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVRyYW5zbGF0aW9uKGRvY3VtZW50KTtcclxuICAgICAgYXdhaXQgdGhpcy5sb2dNZXRyaWMoJ1RyYW5zbGF0aW9uc1NhdmVkJywgMSk7XHJcblxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IHtcclxuICAgICAgICBpZDogZG9jdW1lbnQuaWQsXHJcbiAgICAgICAgc291cmNlVGV4dDogZG9jdW1lbnQuc291cmNlVGV4dCxcclxuICAgICAgICB0YXJnZXRUZXh0OiBkb2N1bWVudC50YXJnZXRUZXh0LFxyXG4gICAgICAgIHNvdXJjZUxhbmd1YWdlOiBkb2N1bWVudC5zb3VyY2VMYW5ndWFnZSxcclxuICAgICAgICB0YXJnZXRMYW5ndWFnZTogZG9jdW1lbnQudGFyZ2V0TGFuZ3VhZ2UsXHJcbiAgICAgICAgY29uZmlkZW5jZTogZG9jdW1lbnQuY29uZmlkZW5jZSxcclxuICAgICAgICBuZWVkc1ZlcmlmaWNhdGlvbjogdHJhbnNsYXRpb24ubmVlZHNWZXJpZmljYXRpb24sXHJcbiAgICAgICAgY3JlYXRlZEF0OiBkb2N1bWVudC5jcmVhdGVkQXRcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcclxuICAgICAgYXdhaXQgdGhpcy5sb2dNZXRyaWMoJ1RyYW5zbGF0aW9uTGF0ZW5jeScsIGR1cmF0aW9uLCAnTWlsbGlzZWNvbmRzJyk7XHJcblxyXG4gICAgICBhd2FpdCB0aGlzLmxvZ0V2ZW50KCdUcmFuc2xhdGlvbkNvbXBsZXRlZCcsIHtcclxuICAgICAgICBpZDogZG9jdW1lbnQuaWQsXHJcbiAgICAgICAgY29uZmlkZW5jZTogZG9jdW1lbnQuY29uZmlkZW5jZSxcclxuICAgICAgICBuZWVkc1ZlcmlmaWNhdGlvbjogdHJhbnNsYXRpb24ubmVlZHNWZXJpZmljYXRpb24sXHJcbiAgICAgICAgZHVyYXRpb25cclxuICAgICAgfSk7XHJcblxyXG4gICAgICByZXR1cm4gcmVzcG9uc2U7XHJcblxyXG4gICAgfSBjYXRjaCAoZXJyb3I6IHVua25vd24pIHtcclxuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLmxvZ0V2ZW50KCdUcmFuc2xhdGlvbkVycm9yJywge1xyXG4gICAgICAgICAgZXJyb3JNZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxyXG4gICAgICAgICAgcmVxdWVzdFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIGF3YWl0IHRoaXMubG9nTWV0cmljKCdUcmFuc2xhdGlvbkVycm9ycycsIDEpO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgc2VhcmNoVHJhbnNsYXRpb25zKHNvdXJjZVRleHQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBzZWFyY2hCb2R5ID0ge1xyXG4gICAgICAgIHF1ZXJ5OiB7XHJcbiAgICAgICAgICBtYXRjaDoge1xyXG4gICAgICAgICAgICBzb3VyY2VUZXh0OiBzb3VyY2VUZXh0XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgLy8gVXNpbmcgdGhlIEFXUyBTREsncyBidWlsdC1pbiByZXF1ZXN0IHN0cnVjdHVyZVxyXG4gICAgICBjb25zdCBjb21tYW5kID0gbmV3IERlc2NyaWJlRG9tYWluQ29tbWFuZCh7XHJcbiAgICAgICAgRG9tYWluTmFtZTogdGhpcy5jb2xsZWN0aW9uTmFtZVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5vcGVuU2VhcmNoQ2xpZW50LnNlbmQoY29tbWFuZCk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XHJcbiAgICAgIGF3YWl0IHRoaXMubG9nTWV0cmljKCdTZWFyY2hMYXRlbmN5JywgZHVyYXRpb24sIFN0YW5kYXJkVW5pdC5NaWxsaXNlY29uZHMpO1xyXG5cclxuICAgICAgLy8gUGFyc2UgdGhlIHJlc3BvbnNlIHNhZmVseVxyXG4gICAgICBsZXQgaGl0czogYW55W10gPSBbXTtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCByZXNwb25zZUpzb24gPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlKSk7XHJcbiAgICAgICAgaGl0cyA9IHJlc3BvbnNlSnNvbj8uaGl0cz8uaGl0cyB8fCBbXTtcclxuICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHBhcnNpbmcgT3BlblNlYXJjaCByZXNwb25zZTonLCBwYXJzZUVycm9yKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIGhpdHM7XHJcblxyXG4gICAgfSBjYXRjaCAoZXJyb3I6IHVua25vd24pIHtcclxuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLmxvZ0V2ZW50KCdTZWFyY2hFcnJvcicsIHtcclxuICAgICAgICAgIGVycm9yTWVzc2FnZTogZXJyb3IubWVzc2FnZSxcclxuICAgICAgICAgIHNvdXJjZVRleHRcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICBhd2FpdCB0aGlzLmxvZ01ldHJpYygnU2VhcmNoRXJyb3JzJywgMSk7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZVRyYW5zbGF0aW9uKHJlcXVlc3Q6IFRyYW5zbGF0aW9uUmVxdWVzdCk6IFByb21pc2U8VHJhbnNsYXRpb25SZXN1bHQ+IHtcclxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBwcm9tcHQgPSB7XHJcbiAgICAgICAgcm9sZTogJ3N5c3RlbScsXHJcbiAgICAgICAgY29udGVudDogJ1lvdSBhcmUgYSBwcm9mZXNzaW9uYWwgdHJhbnNsYXRvciBzcGVjaWFsaXppbmcgaW4gRW5nbGlzaCB0byBGaWppYW4gdHJhbnNsYXRpb25zLidcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IHVzZXJNZXNzYWdlID0ge1xyXG4gICAgICAgIHJvbGU6ICd1c2VyJyxcclxuICAgICAgICBjb250ZW50OiBgVHJhbnNsYXRlIHRoZSBmb2xsb3dpbmcgdGV4dCBmcm9tICR7cmVxdWVzdC5zb3VyY2VMYW5ndWFnZX0gdG8gJHtyZXF1ZXN0LnRhcmdldExhbmd1YWdlfS4gXHJcbiAgICAgICAgICAgICAgICAgIENvbnRleHQ6ICR7cmVxdWVzdC5jb250ZXh0IHx8ICdOb25lIHByb3ZpZGVkJ31cclxuICAgICAgICAgICAgICAgICAgVGV4dDogJHtyZXF1ZXN0LnNvdXJjZVRleHR9YFxyXG4gICAgICB9O1xyXG5cclxuICAgICAgY29uc3QgY29tbWFuZCA9IG5ldyBJbnZva2VNb2RlbENvbW1hbmQoe1xyXG4gICAgICAgIG1vZGVsSWQ6ICdhbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjAnLFxyXG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgYWNjZXB0OiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgbWVzc2FnZXM6IFtwcm9tcHQsIHVzZXJNZXNzYWdlXVxyXG4gICAgICAgIH0pXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmJlZHJvY2tDbGllbnQuc2VuZChjb21tYW5kKTtcclxuICAgICAgY29uc3QgcmVzcG9uc2VCb2R5ID0gSlNPTi5wYXJzZShuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocmVzcG9uc2UuYm9keSkpO1xyXG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnBhcnNlVHJhbnNsYXRpb25SZXN1bHQocmVzcG9uc2VCb2R5LmNvbnRlbnRbMF0udGV4dCk7XHJcblxyXG4gICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XHJcbiAgICAgIGF3YWl0IHRoaXMubG9nTWV0cmljKCdCZWRyb2NrTGF0ZW5jeScsIGR1cmF0aW9uLCAnTWlsbGlzZWNvbmRzJyk7XHJcblxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG5cclxuICAgIH0gY2F0Y2ggKGVycm9yOiB1bmtub3duKSB7XHJcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5sb2dFdmVudCgnQmVkcm9ja0Vycm9yJywge1xyXG4gICAgICAgICAgZXJyb3JNZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxyXG4gICAgICAgICAgcmVxdWVzdFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIGF3YWl0IHRoaXMubG9nTWV0cmljKCdCZWRyb2NrRXJyb3JzJywgMSk7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzYXZlVHJhbnNsYXRpb24oZG9jdW1lbnQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gVXNpbmcgdGhlIEFXUyBTREsncyBidWlsdC1pbiByZXF1ZXN0IHN0cnVjdHVyZVxyXG4gICAgICBjb25zdCBjb21tYW5kID0gbmV3IERlc2NyaWJlRG9tYWluQ29tbWFuZCh7XHJcbiAgICAgICAgRG9tYWluTmFtZTogdGhpcy5jb2xsZWN0aW9uTmFtZVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGF3YWl0IHRoaXMub3BlblNlYXJjaENsaWVudC5zZW5kKGNvbW1hbmQpO1xyXG5cclxuICAgICAgY29uc3QgZHVyYXRpb24gPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xyXG4gICAgICBhd2FpdCB0aGlzLmxvZ01ldHJpYygnU2F2ZUxhdGVuY3knLCBkdXJhdGlvbiwgU3RhbmRhcmRVbml0Lk1pbGxpc2Vjb25kcyk7XHJcblxyXG4gICAgfSBjYXRjaCAoZXJyb3I6IHVua25vd24pIHtcclxuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLmxvZ0V2ZW50KCdTYXZlRXJyb3InLCB7XHJcbiAgICAgICAgICBlcnJvck1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXHJcbiAgICAgICAgICBkb2N1bWVudElkOiBkb2N1bWVudC5pZFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIGF3YWl0IHRoaXMubG9nTWV0cmljKCdTYXZlRXJyb3JzJywgMSk7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICBwcml2YXRlIHBhcnNlVHJhbnNsYXRpb25SZXN1bHQocmVzdWx0OiBzdHJpbmcpOiBUcmFuc2xhdGlvblJlc3VsdCB7XHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShyZXN1bHQpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3I6IHVua25vd24pIHtcclxuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcclxuICAgICAgICB0aGlzLmxvZ0V2ZW50KCdQYXJzZUVycm9yJywge1xyXG4gICAgICAgICAgZXJyb3JNZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxyXG4gICAgICAgICAgcmVzdWx0XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICB0YXJnZXRUZXh0OiByZXN1bHQsXHJcbiAgICAgICAgY29uZmlkZW5jZTogMC43LFxyXG4gICAgICAgIG5lZWRzVmVyaWZpY2F0aW9uOiB0cnVlLFxyXG4gICAgICAgIG5vdGVzOiAnUGFyc2VkIGZyb20gdW5zdHJ1Y3R1cmVkIHJlc3BvbnNlJ1xyXG4gICAgICB9O1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=