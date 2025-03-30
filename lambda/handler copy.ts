// handler.ts
import { Client } from '@opensearch-project/opensearch';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });

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
                  engine: 'faiss'  // Changed from 'nmslib' to 'faiss'
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

const vectorSearch = async (client: Client, vector: number[], k: number = 3) => {
  const result = await client.search({
    index: 'fijian-embeddings',
    body: {
      size: k,
      query: {
        knn: {
          embedding: {
            vector: vector,
            k: k
          }
        }
      }
    }
  });
  return result.body.hits.hits;
};

const invokeClaudeModel = async (prompt: string, context: string) => {
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
              text: `You are a helpful assistant that answers questions about the Fijian language. Use the following context to answer the question. If you cannot answer based on the context, say so.

Context:
${context}

Question: ${prompt}`
            }
          ]
        }
      ]
    })
  };

  try {
    const command = new InvokeModelCommand(params);
    const response = await bedrockRuntime.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;  // Changed from completion to content[0].text
  } catch (error) {
    console.error('Error invoking Claude:', error);
    throw error;
  }
};

export const main = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { path, httpMethod } = event;

  try {
    const client = await createOpenSearchClient();
    await createIndexIfNotExists(client);

    if (path === '/rag' && httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { query } = body;

      if (!query) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Query is required' })
        };
      }

      // 1. First check if we have a verified translation in AOSS
      const queryEmbedding = await getEmbedding(query);
      const searchResults = await vectorSearch(client, queryEmbedding);
      
      let answer;
      if (searchResults && searchResults.length > 0) {
        // Found verified translation(s)
        const context = searchResults
          .map((hit: any) => `English: ${hit._source.english}\nFijian: ${hit._source.fijian}`)
          .join('\n\n');

        // Use Claude to formulate a response using verified translations
        answer = await invokeClaudeModel(query, context);
      } else {
        // No verified translation found, use Claude's native knowledge
        const directTranslationPrompt = {
          modelId: "anthropic.claude-3-sonnet-20240229-v1:0", // Make sure this is also using Claude 3 Sonnet
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
                    text: `Please translate the following to Fijian. If you're not completely sure, please indicate that this is your best attempt but should be verified: "${query}"`
                  }
                ]
              }
            ]
          })
        };

        const bedrockRuntime = new BedrockRuntimeClient({ region: "us-west-2" });
        const command = new InvokeModelCommand(directTranslationPrompt);
        const response = await bedrockRuntime.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        answer = responseBody.content[0].text;
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          answer,
          verified: searchResults.length > 0,
          context: searchResults
        })
      };
    }

    if (path === '/search' && httpMethod === 'POST') {
      const { query } = JSON.parse(event.body || '{}');
      //const client = await createOpenSearchClient();
      const embedding = await getEmbedding(query);
      const results = await vectorSearch(client, embedding, 5);

      return {
        statusCode: 200,
        body: JSON.stringify({ results }),
      };
    }

    if (path === '/verify' && httpMethod === 'POST') {
      const { fijian, english, metadata } = JSON.parse(event.body || '{}');
      const combinedText = `${fijian}\n${english}`;
      const embedding = await getEmbedding(combinedText);
      //const client = await createOpenSearchClient();

      const doc = {
        id: uuidv4(),
        fijian,
        english,
        metadata,
        embedding,
      };

      const res = await client.index({
        index: 'fijian-embeddings',
        body: doc,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Verified translation stored.', result: res.body }),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Not Found' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', detail: error }),
    };
  }
};
