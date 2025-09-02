// lambda/process-learning-module/opensearch.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { v4 as uuidv4 } from 'uuid';

const bedrock = new BedrockRuntimeClient({});
const s3Client = new S3Client({});
const OS_ENDPOINT = process.env.OS_ENDPOINT!;
const OS_REGION = process.env.OS_REGION || 'us-west-2';
const CONTENT_BUCKET = process.env.CONTENT_BUCKET_NAME || 'fijian-rag-content';

/**
 * Enhanced embedding generation with retry logic and metadata tracking
 * 
 * Model Choice and Rationale:
 * - Amazon Titan Embed Text v1: Multilingual support for Fijian-English pairs
 * - 1536-dimensional vectors optimized for semantic similarity
 * - Native AWS integration with Bedrock for scalability and cost-effectiveness
 * - Proven performance on multilingual and cross-lingual tasks
 */
export async function createEmbedding(text: string, retries: number = 3): Promise<number[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Using Amazon Titan Embeddings model for multilingual support
      const response = await bedrock.send(new InvokeModelCommand({
        modelId: 'amazon.titan-embed-text-v1',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: text
        })
      }));
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.embedding;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`Embedding creation attempt ${attempt}/${retries} failed:`, error);
      
      // Exponential backoff with jitter
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('All embedding creation attempts failed:', lastError);
  // Return zero vector as fallback
  return new Array(1536).fill(0);
}

/**
 * Enhanced batch embedding creation with parallelization and progress tracking
 */
export async function createEmbeddingsBatch(
  texts: string[],
  options: {
    batchSize?: number;
    maxConcurrency?: number;
    retries?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<Array<{ text: string; embedding: number[]; success: boolean; error?: string }>> {
  const {
    batchSize = 25,
    maxConcurrency = 5,
    retries = 3,
    onProgress
  } = options;

  const results: Array<{ text: string; embedding: number[]; success: boolean; error?: string }> = [];
  
  // Process in batches with controlled concurrency
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    // Create promises for concurrent processing within batch
    const batchPromises = batch.map(async (text, index) => {
      try {
        const embedding = await createEmbedding(text, retries);
        const success = !embedding.every(val => val === 0); // Check if it's not a zero vector
        return {
          text,
          embedding,
          success,
          ...(success ? {} : { error: 'Generated zero vector fallback' })
        };
      } catch (error) {
        return {
          text,
          embedding: new Array(1536).fill(0),
          success: false,
          error: (error as Error).message
        };
      }
    });

    // Process batch with controlled concurrency
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Report progress
    if (onProgress) {
      onProgress(results.length, texts.length);
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Embedding metadata interface for tracking and storage
 */
export interface EmbeddingMetadata {
  id: string;
  text: string;
  embedding: number[];
  model: string;
  dimensions: number;
  timestamp: string;
  success: boolean;
  retries?: number;
  processingTime?: number;
  error?: string;
  source?: string;
  category?: string;
}

/**
 * Store embeddings and metadata to S3 for intermediate storage
 */
export async function storeEmbeddingsToS3(
  embeddings: EmbeddingMetadata[],
  prefix: string = 'embeddings'
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${prefix}/${timestamp}-embeddings-batch.json`;
  
  const data = {
    metadata: {
      batchId: uuidv4(),
      timestamp,
      count: embeddings.length,
      model: 'amazon.titan-embed-text-v1',
      dimensions: 1536
    },
    embeddings
  };
  
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: CONTENT_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'batch-id': data.metadata.batchId,
        'embedding-count': embeddings.length.toString(),
        'model-version': 'amazon.titan-embed-text-v1'
      }
    }));
    
    console.log(`Stored ${embeddings.length} embeddings to S3: s3://${CONTENT_BUCKET}/${key}`);
    return key;
  } catch (error) {
    console.error('Failed to store embeddings to S3:', error);
    throw error;
  }
}

/**
 * Retrieve embeddings from S3 storage
 */
export async function getEmbeddingsFromS3(key: string): Promise<{
  metadata: any;
  embeddings: EmbeddingMetadata[];
}> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: CONTENT_BUCKET,
      Key: key
    }));
    
    const content = await response.Body?.transformToString();
    if (!content) {
      throw new Error('Empty response from S3');
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to retrieve embeddings from S3: ${key}`, error);
    throw error;
  }
}

export async function indexToOpenSearch(params: {
  index: string;
  id: string;
  body: any;
}) {
  const host = OS_ENDPOINT.replace(/^https?:\/\//, '');
  const path = `/${params.index}/_doc/${params.id}`;
  
  console.log('[OpenSearch] Indexing document:', {
    index: params.index,
    host,
    path,
    documentId: params.id,
  });
  
  // First, check if index exists and create if needed
  await ensureIndexExists(params.index);
  
  // Index the document
  const request = new HttpRequest({
    method: 'PUT',
    hostname: host,
    path,
    headers: {
      'Content-Type': 'application/json',
      host,
    },
    body: JSON.stringify(params.body),
  });
  
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256,
  });
  
  const signed = await signer.sign(request);
  const { response } = await new NodeHttpHandler().handle(signed as HttpRequest);
  
  if (response.statusCode !== 200 && response.statusCode !== 201) {
    const body = await streamToString(response.body);
    throw new Error(`[OpenSearch] Failed to index document: ${response.statusCode} - ${body}`);
  }
  
  return response;
}

async function ensureIndexExists(indexName: string) {
  const host = OS_ENDPOINT.replace(/^https?:\/\//, '');
  const path = `/${indexName}`;
  
  // Check if index exists
  const checkRequest = new HttpRequest({
    method: 'HEAD',
    hostname: host,
    path,
    headers: { host },
  });
  
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256,
  });
  
  const signedCheck = await signer.sign(checkRequest);
  const { response: checkResponse } = await new NodeHttpHandler().handle(signedCheck as HttpRequest);
  
  if (checkResponse.statusCode === 404) {
    console.log(`[OpenSearch] Creating index: ${indexName}`);
    
    // Create index with proper mappings
    const createRequest = new HttpRequest({
      method: 'PUT',
      hostname: host,
      path,
      headers: {
        'Content-Type': 'application/json',
        host,
      },
      body: JSON.stringify({
        mappings: {
          properties: {
            contentType: { type: 'keyword' },
            moduleId: { type: 'keyword' },
            fijian: { 
              type: 'text',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            english: { 
              type: 'text',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            type: { type: 'keyword' },
            category: { type: 'keyword' },
            embedding: {
              type: 'knn_vector',
              dimension: 1536,
              method: {
                name: 'hnsw',
                space_type: 'l2',
                engine: 'nmslib',
                parameters: {
                  ef_construction: 512,
                  m: 16
                }
              }
            },
            page: { type: 'integer' },
            verified: { type: 'boolean' },
            source: { type: 'keyword' },
            lessonTitle: { type: 'text' },
            timestamp: { type: 'date' },
            usageNotes: { type: 'text' },
            pronunciation: { type: 'text' },
            // Grammar-specific fields
            concept: { type: 'text' },
            explanation: { type: 'text' },
            pattern: { type: 'text' },
            examples: { type: 'object' }
          }
        },
        settings: {
          'index.knn': true,
          'number_of_shards': 1,
          'number_of_replicas': 1
        }
      }),
    });
    
    const signedCreate = await signer.sign(createRequest);
    const { response: createResponse } = await new NodeHttpHandler().handle(signedCreate as HttpRequest);
    
    if (createResponse.statusCode !== 200 && createResponse.statusCode !== 201) {
      const body = await streamToString(createResponse.body);
      throw new Error(`[OpenSearch] Failed to create index: ${createResponse.statusCode} - ${body}`);
    }
  }
}

export async function searchSimilar(params: {
  index: string;
  embedding: number[];
  size?: number;
  filter?: any;
}) {
  const host = OS_ENDPOINT.replace(/^https?:\/\//, '');
  const path = `/${params.index}/_search`;
  
  const searchBody = {
    size: params.size || 10,
    query: {
      knn: {
        embedding: {
          vector: params.embedding,
          k: params.size || 10
        }
      }
    }
  };
  
  if (params.filter) {
    searchBody.query = {
      bool: {
        must: [searchBody.query],
        filter: params.filter
      }
    } as any;
  }
  
  const request = new HttpRequest({
    method: 'POST',
    hostname: host,
    path,
    headers: {
      'Content-Type': 'application/json',
      host,
    },
    body: JSON.stringify(searchBody),
  });
  
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256,
  });
  
  const signed = await signer.sign(request);
  const { response } = await new NodeHttpHandler().handle(signed as HttpRequest);
  
  if (response.statusCode !== 200) {
    const body = await streamToString(response.body);
    throw new Error(`[OpenSearch] Search failed: ${response.statusCode} - ${body}`);
  }
  
  const responseBody = await streamToString(response.body);
  const result = JSON.parse(responseBody);
  
  return result.hits.hits;
}

export async function hybridSearch(params: {
  index: string;
  query: string;
  embedding?: number[];
  size?: number;
  filter?: any;
}) {
  const host = OS_ENDPOINT.replace(/^https?:\/\//, '');
  const path = `/${params.index}/_search`;
  
  const must: any[] = [];
  const should: any[] = [];
  
  // Text search on fijian and english fields
  if (params.query) {
    should.push({
      multi_match: {
        query: params.query,
        fields: ['fijian^2', 'english^2', 'usageNotes', 'explanation'],
        type: 'best_fields',
        fuzziness: 'AUTO'
      }
    });
  }
  
  // KNN search if embedding provided
  if (params.embedding) {
    must.push({
      knn: {
        embedding: {
          vector: params.embedding,
          k: params.size || 10
        }
      }
    });
  }
  
  const searchBody = {
    size: params.size || 10,
    query: {
      bool: {
        must: must.length > 0 ? must : undefined,
        should: should.length > 0 ? should : undefined,
        filter: params.filter
      }
    },
    highlight: {
      fields: {
        fijian: {},
        english: {},
        explanation: {}
      }
    }
  };
  
  const request = new HttpRequest({
    method: 'POST',
    hostname: host,
    path,
    headers: {
      'Content-Type': 'application/json',
      host,
    },
    body: JSON.stringify(searchBody),
  });
  
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256,
  });
  
  const signed = await signer.sign(request);
  const { response } = await new NodeHttpHandler().handle(signed as HttpRequest);
  
  if (response.statusCode !== 200) {
    const body = await streamToString(response.body);
    throw new Error(`[OpenSearch] Hybrid search failed: ${response.statusCode} - ${body}`);
  }
  
  const responseBody = await streamToString(response.body);
  const result = JSON.parse(responseBody);
  
  return result.hits.hits;
}

export async function bulkIndex(documents: Array<{
  index: string;
  id: string;
  body: any;
}>) {
  const host = OS_ENDPOINT.replace(/^https?:\/\//, '');
  const path = '/_bulk';
  
  // Build bulk request body
  const bulkBody = documents.flatMap(doc => [
    JSON.stringify({ index: { _index: doc.index, _id: doc.id } }),
    JSON.stringify(doc.body)
  ]).join('\n') + '\n';
  
  const request = new HttpRequest({
    method: 'POST',
    hostname: host,
    path,
    headers: {
      'Content-Type': 'application/x-ndjson',
      host,
    },
    body: bulkBody,
  });
  
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256,
  });
  
  const signed = await signer.sign(request);
  const { response } = await new NodeHttpHandler().handle(signed as HttpRequest);
  
  if (response.statusCode !== 200) {
    const body = await streamToString(response.body);
    throw new Error(`[OpenSearch] Bulk index failed: ${response.statusCode} - ${body}`);
  }
  
  const responseBody = await streamToString(response.body);
  const result = JSON.parse(responseBody);
  
  if (result.errors) {
    console.error('Bulk indexing errors:', JSON.stringify(result.errors, null, 2));
  }
  
  return result;
}

export async function deleteIndex(indexName: string) {
  const host = OS_ENDPOINT.replace(/^https?:\/\//, '');
  const path = `/${indexName}`;
  
  const request = new HttpRequest({
    method: 'DELETE',
    hostname: host,
    path,
    headers: { host },
  });
  
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256,
  });
  
  const signed = await signer.sign(request);
  const { response } = await new NodeHttpHandler().handle(signed as HttpRequest);
  
  if (response.statusCode !== 200) {
    const body = await streamToString(response.body);
    throw new Error(`[OpenSearch] Failed to delete index: ${response.statusCode} - ${body}`);
  }
  
  console.log(`Deleted index: ${indexName}`);
  return response;
}

export async function getIndexStats(indexName: string) {
  const host = OS_ENDPOINT.replace(/^https?:\/\//, '');
  const path = `/${indexName}/_stats`;
  
  const request = new HttpRequest({
    method: 'GET',
    hostname: host,
    path,
    headers: { host },
  });
  
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256,
  });
  
  const signed = await signer.sign(request);
  const { response } = await new NodeHttpHandler().handle(signed as HttpRequest);
  
  if (response.statusCode !== 200) {
    const body = await streamToString(response.body);
    throw new Error(`[OpenSearch] Failed to get index stats: ${response.statusCode} - ${body}`);
  }
  
  const responseBody = await streamToString(response.body);
  return JSON.parse(responseBody);
}

// Helper function to convert stream to string
async function streamToString(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}