// lambda/agents/translator/agent.ts
// lambda/agents/translator/agent.ts
import { v4 as uuidv4 } from 'uuid';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { 
  OpenSearchServerlessClient,
  BatchGetCollectionCommand,
  BatchGetCollectionCommandInput,
  BatchGetCollectionCommandOutput
} from '@aws-sdk/client-opensearchserverless';
import { ServiceOutputTypes } from '@aws-sdk/client-opensearchserverless';

import { 
  CloudWatchClient, 
  PutMetricDataCommand, 
  StandardUnit,
  MetricDatum 
} from '@aws-sdk/client-cloudwatch';
import fetch from 'node-fetch';


interface TranslationRequest {
  sourceText: string;
  targetLanguage: string;
  sourceLanguage: string;
  context?: string;
}

interface TranslationResponse {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  needsVerification: boolean;
  createdAt: string;
}

interface TranslationResult {
  targetText: string;
  confidence: number;
  needsVerification: boolean;
  notes?: string;
}

interface OpenSearchResponse {
  hits?: {
    hits: Array<{
      _id: string;
      _source: any;
    }>;
  };
}

export class TranslatorAgent {
  private bedrockClient: BedrockRuntimeClient;
  private openSearchClient: OpenSearchServerlessClient;
  private cloudWatchClient: CloudWatchClient;
  private collectionName: string;
  private collectionEndpoint: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-west-2';
    this.bedrockClient = new BedrockRuntimeClient({ region });
    this.openSearchClient = new OpenSearchServerlessClient({ region });
    this.cloudWatchClient = new CloudWatchClient({ region });
    this.collectionName = process.env.COLLECTION_NAME || 'fijian-translations';
    this.collectionEndpoint = process.env.COLLECTION_ENDPOINT || '';
  }

  private async logMetric(metricName: string, value: number, unit: StandardUnit = StandardUnit.Count): Promise<void> {
    try {
      const metricData: MetricDatum = {
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

      const command = new PutMetricDataCommand({
        Namespace: 'FijianTranslator',
        MetricData: [metricData]
      });

      await this.cloudWatchClient.send(command);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error logging metric:', metricName, error.message);
      }
    }
  }

  private async logEvent(eventName: string, details: Record<string, unknown>): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: eventName,
      details,
      environment: process.env.ENVIRONMENT || 'development'
    };
    console.log(JSON.stringify(logEntry));
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
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
        id: uuidv4(),
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

    } catch (error: unknown) {
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

  private async searchTranslations(sourceText: string): Promise<any[]> {
    const startTime = Date.now();
    try {
      // Get the collection ID from the collection name
      // Convert to lowercase and remove any non-alphanumeric characters
      const collectionId = this.collectionName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
  
      // Verify the collection exists using BatchGetCollection
      const command = new BatchGetCollectionCommand({
        ids: [collectionId]  // Use the formatted ID instead of the name
      });
      
      const response = await this.openSearchClient.send(command);
      
      // Check if collection exists and is active
      if (response && 
          response.collectionDetails && 
          response.collectionDetails[0]?.status === 'ACTIVE' && 
          this.collectionEndpoint) {
        
        // Prepare the search request
        const searchBody = {
          query: {
            match: {
              sourceText: sourceText
            }
          }
        };
  
        // Make the search request to OpenSearch
        const searchResponse = await fetch(`https://${this.collectionEndpoint}/_search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchBody)
        });
  
        if (!searchResponse.ok) {
          throw new Error(`OpenSearch search failed: ${searchResponse.statusText}`);
        }
  
        const searchData: OpenSearchResponse = await searchResponse.json();
        const duration = Date.now() - startTime;
        await this.logMetric('SearchLatency', duration, StandardUnit.Milliseconds);
  
        // Return the hits array or empty array if no hits
        return searchData.hits?.hits || [];
      }
      
      return [];
  
    } catch (error: unknown) {
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
  
  private async generateTranslation(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();
    try {
      const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are a professional translator specializing in English to Fijian translations.
  
  Please translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}. 
  Context: ${request.context || 'None provided'}
  Text: ${request.sourceText}`
          }
        ]
      };
  
      const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      });
  
      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const result = this.parseTranslationResult(responseBody.content[0].text);
  
      const duration = Date.now() - startTime;
      await this.logMetric('BedrockLatency', duration, 'Milliseconds');
  
      return result;
  
    } catch (error: unknown) {
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
  
  
  private async saveTranslation(document: Record<string, unknown>): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('saveTranslation Document:', document);
      console.log('Collection endpoint:', this.collectionEndpoint);

      if (!this.collectionEndpoint) {
        throw new Error('Collection endpoint is not configured');
      }
  
      // Fix the URL format - remove any potential double https://
      const endpoint = this.collectionEndpoint.replace(/^https?:\/\//, '');
      const url = `https://${endpoint}/_doc`;
  
      console.log('URL:', url); 
      console.log('endpoint:', endpoint);

      // Make a direct POST request to the OpenSearch endpoint
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(document)
      });
  
      if (!response.ok) {
        throw new Error(`Failed to save translation: ${response.statusText}`);
      }
  
      const duration = Date.now() - startTime;
      await this.logMetric('SaveLatency', duration, StandardUnit.Milliseconds);
  
    } catch (error: unknown) {
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
    
  private parseTranslationResult(result: string): TranslationResult {
    try {
      // First try to parse as JSON in case it's structured
      return JSON.parse(result);
    } catch (error: unknown) {
      // If it's plain text, extract the translation
      // Remove any prefixes like "Here is my translation..."
      const cleanedText = result
        .replace(/^Here is my translation[^:]*:\s*/i, '')
        .replace(/^Translation:\s*/i, '')
        .trim();
  
      return {
        targetText: cleanedText,
        confidence: 0.9,  // High confidence since it's a direct model response
        needsVerification: false,
        notes: 'Extracted from model response'
      };
    }
  }
}
