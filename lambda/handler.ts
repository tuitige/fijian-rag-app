import { Client } from '@opensearch-project/opensearch';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT || '';
const COLLECTION_NAME = process.env.COLLECTION_NAME || '';
const INDEX_NAME = 'fijian-embeddings'; // Added constant definition

const createOpenSearchClient = async () => {
  return new Client({
    ...AwsSigv4Signer({
      region: process.env.AWS_REGION || 'us-west-2',
      service: 'aoss',
      getCredentials: defaultProvider()
    }),
    node: OPENSEARCH_ENDPOINT,
  });
};

// create the index if it doesn't exist
const createIndexIfNotExists = async (client: Client) => {
  try {
    const exists = await client.indices.exists({
      index: INDEX_NAME
    });
    
    if (!exists.body) {
      await client.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: {
            properties: {
              fijian: { type: 'text' },
              english: { type: 'text' },
              timestamp: { type: 'date' }
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

const handleVerify = async (client: Client, body: any, headers: any): Promise<APIGatewayProxyResult> => {
  const { originalFijian, verifiedEnglish } = body;

  if (!originalFijian || !verifiedEnglish) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'originalFijian and verifiedEnglish are required' })
    };
  }

  try {
    const document = {
      fijian: originalFijian,
      english: verifiedEnglish,
      timestamp: new Date().toISOString()
    };

    const response = await client.index({
      index: INDEX_NAME,
      body: document
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Translation verified and stored successfully',
        id: response.body._id
      })
    };
  } catch (error) {
    console.error('Verification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error storing verified translation',
        error: error.message })
    };
  }
};

const handleTranslate = async (body: any, headers: any): Promise<APIGatewayProxyResult> => {
  try {
    // Extract fijianText from request body
    const { fijianText } = body;

    if (!fijianText) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "fijianText is required in request body" })
      };
    }

    // Initialize Bedrock client
    const bedrockClient = new BedrockRuntimeClient({ region: "us-west-2" });

    // Prepare the prompt for Claude
    const prompt = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please translate the following Fijian text to English. If you're not completely sure about any part of the translation, please indicate that in your response: "${fijianText}"`
            }
          ]
        }
      ]
    };

    // Call Claude 3 Sonnet
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(prompt)
    });

    const response = await bedrockClient.send(command);

    // Parse the response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const translation = responseBody.content[0].text;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        originalText: fijianText,
        translation: translation
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error translating text",
        details: error.message
      })
    };
  }
};


export const main = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST'
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    const client = await createOpenSearchClient();
    await createIndexIfNotExists(client);

    const path = event.path;
    const body = JSON.parse(event.body || '{}');

    switch (path) {
      case '/translate':
        return await handleTranslate(body, corsHeaders);
      case '/verify':
        return await handleVerify(client, body, corsHeaders);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Not Found' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal Server Error' })
    };
  }
};
