// handler.ts
import { Client } from '@opensearch-project/opensearch';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });

// Types for better type safety
interface TranslateRequest {
  fijianText: string;
}

interface VerifyRequest {
  originalFijian: string;
  verifiedEnglish: string;
}

const createOpenSearchClient = async () => {
  return new Client({
    ...AwsSigv4Signer({
      region: process.env.AWS_REGION || 'us-west-2',
      service: 'aoss',
      getCredentials: () => defaultProvider()(),
    }),
    node: process.env.OPENSEARCH_ENDPOINT,
  });
};

// create the index if it doesn't exist
const createIndexIfNotExists = async (client: Client) => {
  try {
    const exists = await client.indices.exists({
      index: 'fijian-embeddings'
    });
    
    if (!exists.body) {
      await client.indices.create({
        index: 'fijian-embeddings',
        body: {
          mappings: {
            properties: {
              embedding: {
                type: 'knn_vector',
                dimension: 1536,
                method: {
                  name: 'hnsw',
                  space_type: 'l2',
                  engine: 'faiss'
                }
              },
              fijian: { type: 'text' },
              english: { type: 'text' }
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('Error creating index:', error);
    throw error;
  }
};

const getEmbedding = async (text: string): Promise<number[]> => {
  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    body: JSON.stringify({ inputText: text }),
    contentType: 'application/json',
    accept: 'application/json',
  }));

  const parsed = JSON.parse(Buffer.from(response.body).toString());
  return parsed.embedding;
};

const translateWithClaude = async (fijianText: string): Promise<string> => {
  const bedrockRuntime = new BedrockRuntimeClient({ region: "us-west-2" });
  
  const params = {
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please translate this Fijian text to English as accurately as possible: "${fijianText}"`
            }
          ]
        }
      ]
    })
  };

  const command = new InvokeModelCommand(params);
  const response = await bedrockRuntime.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
};

// Store verified translation in AOSS
const storeVerifiedTranslation = async (client: Client, fijianText: string, englishText: string) => {
  const embedding = await getEmbedding(fijianText);
  
  const document = {
    fijian: fijianText,
    english: englishText,
    embedding: embedding,
    timestamp: new Date().toISOString(),
    verified: true
  };

  await client.index({
    index: 'fijian-embeddings',
    body: document
  });

  return document;
};

export const main = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { path, httpMethod, body } = event;

    // Handle translate endpoint
    if (path === '/translate' && httpMethod === 'POST') {
      if (!body) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Request body is required' })
        };
      }

      const request: TranslateRequest = JSON.parse(body);
      
      if (!request.fijianText) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'fijianText is required' })
        };
      }

      const translation = await translateWithClaude(request.fijianText);

      return {
        statusCode: 200,
        body: JSON.stringify({
          original: request.fijianText,
          translation: translation,
          message: "Review this translation and use /verify endpoint to submit verified version"
        })
      };
    }

    // Handle verify endpoint
    if (path === '/verify' && httpMethod === 'POST') {
      if (!body) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Request body is required' })
        };
      }

      const request: VerifyRequest = JSON.parse(body);
      
      if (!request.originalFijian || !request.verifiedEnglish) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Both originalFijian and verifiedEnglish are required' })
        };
      }

      const client = await createOpenSearchClient();
      await createIndexIfNotExists(client);
      const storedDocument = await storeVerifiedTranslation(
        client,
        request.originalFijian,
        request.verifiedEnglish
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Verified translation stored successfully",
          document: storedDocument
        })
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        detail: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
