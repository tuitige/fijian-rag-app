/**
 * Tests for enhanced embedding pipeline functionality
 */
import { 
  createEmbedding, 
  createEmbeddingsBatch, 
  storeEmbeddingsToS3,
  EmbeddingMetadata 
} from '../backend/lambdas/dictionary/opensearch';
import { FijianDictionaryProcessor } from '../backend/lambdas/dictionary/processor';

// Mock AWS services for testing
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-dynamodb');

describe('Enhanced Embedding Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEmbedding with retries', () => {
    it('should successfully create embedding on first attempt', async () => {
      // Mock successful Bedrock response
      const mockSend = jest.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          embedding: new Array(1536).fill(0.1)
        }))
      });
      
      require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient.prototype.send = mockSend;

      const embedding = await createEmbedding('test text');
      
      expect(embedding).toHaveLength(1536);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and return zero vector as fallback', async () => {
      // Mock failed Bedrock responses
      const mockSend = jest.fn().mockRejectedValue(new Error('Bedrock error'));
      
      require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient.prototype.send = mockSend;

      const embedding = await createEmbedding('test text', 2);
      
      expect(embedding).toEqual(new Array(1536).fill(0));
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('createEmbeddingsBatch', () => {
    it('should process batch with progress tracking', async () => {
      // Mock successful Bedrock responses
      const mockSend = jest.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          embedding: new Array(1536).fill(0.1)
        }))
      });
      
      require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient.prototype.send = mockSend;

      const texts = ['text1', 'text2', 'text3'];
      const progressUpdates: Array<{completed: number, total: number}> = [];
      
      const results = await createEmbeddingsBatch(texts, {
        batchSize: 2,
        maxConcurrency: 1,
        onProgress: (completed, total) => {
          progressUpdates.push({ completed, total });
        }
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it('should handle mixed success/failure in batch', async () => {
      // Mock mixed responses
      let callCount = 0;
      const mockSend = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Bedrock error');
        }
        return Promise.resolve({
          body: new TextEncoder().encode(JSON.stringify({
            embedding: new Array(1536).fill(0.1)
          }))
        });
      });
      
      require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient.prototype.send = mockSend;

      const texts = ['text1', 'text2', 'text3', 'text4'];
      const results = await createEmbeddingsBatch(texts, {
        retries: 1
      });

      expect(results).toHaveLength(4);
      expect(results.filter(r => r.success).length).toBe(2);
      expect(results.filter(r => !r.success).length).toBe(2);
    });
  });

  describe('FijianDictionaryProcessor enhanced embedding', () => {
    let processor: FijianDictionaryProcessor;

    beforeEach(() => {
      processor = new FijianDictionaryProcessor('test-table');
    });

    it('should use batch mode for multiple entries', async () => {
      // Mock successful Bedrock responses
      const mockSend = jest.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          embedding: new Array(1536).fill(0.1)
        }))
      });
      
      require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient.prototype.send = mockSend;

      const entries = [
        { fijian_word: 'bula', english_translation: 'hello' },
        { fijian_word: 'vinaka', english_translation: 'thank you' }
      ];

      const results = await processor.generateEmbeddings(entries, {
        useBatchMode: true,
        batchSize: 2,
        storeToS3: false // Disable S3 for tests
      });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.embedding)).toBe(true);
      expect(results.every(r => r.embedding_metadata?.success)).toBe(true);
    });

    it('should fall back to sequential mode when requested', async () => {
      // Mock successful Bedrock responses
      const mockSend = jest.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          embedding: new Array(1536).fill(0.1)
        }))
      });
      
      require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient.prototype.send = mockSend;

      const entries = [
        { fijian_word: 'bula', english_translation: 'hello' }
      ];

      const results = await processor.generateEmbeddings(entries, {
        useBatchMode: false
      });

      expect(results).toHaveLength(1);
      expect(results[0].embedding).toBeTruthy();
      expect(results[0].embedding_metadata?.success).toBe(true);
    });
  });

  describe('S3 storage functionality', () => {
    it('should store embeddings metadata to S3', async () => {
      // Mock S3 client
      const mockSend = jest.fn().mockResolvedValue({});
      require('@aws-sdk/client-s3').S3Client.prototype.send = mockSend;

      const embeddings: EmbeddingMetadata[] = [
        {
          id: 'test-id',
          text: 'bula - hello',
          embedding: new Array(1536).fill(0.1),
          model: 'amazon.titan-embed-text-v1',
          dimensions: 1536,
          timestamp: new Date().toISOString(),
          success: true
        }
      ];

      const key = await storeEmbeddingsToS3(embeddings, 'test-prefix');

      expect(key).toMatch(/^test-prefix\/.*-embeddings-batch\.json$/);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: expect.any(String),
            Key: expect.any(String),
            Body: expect.any(String),
            ContentType: 'application/json'
          })
        })
      );
    });
  });
});