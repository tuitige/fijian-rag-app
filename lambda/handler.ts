import { Client } from '@opensearch-project/opensearch';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Updated constants for provisioned cluster
const OPENSEARCH_DOMAIN_ENDPOINT = process.env.OPENSEARCH_DOMAIN_ENDPOINT || '';
const INDEX_NAME = process.env.INDEX_NAME || 'translations';

// Modified client creation for provisioned cluster
const createOpenSearchClient = () => {
  if (!OPENSEARCH_DOMAIN_ENDPOINT) {
    throw new Error('OPENSEARCH_DOMAIN_ENDPOINT environment variable is required');
  }

  return new Client({
    ...AwsSigv4Signer({
      region: process.env.AWS_REGION || 'us-west-2',
      service: 'es', // Changed from 'aoss' to 'es' for provisioned cluster
      getCredentials: defaultProvider()
    }),
    node: `https://${OPENSEARCH_DOMAIN_ENDPOINT}`,
    ssl: {
      rejectUnauthorized: true
    }
  });
};

// Modified index creation with health check
const createIndexIfNotExists = async (client: Client) => {
  try {
    // Check cluster health first
    const health = await client.cluster.health({});
    if (health.body.status === 'red') {
      throw new Error('Cluster health is red, operations not permitted');
    }

    const exists = await client.indices.exists({
      index: INDEX_NAME
    });
    
    if (!exists.body) {
      await client.indices.create({
        index: INDEX_NAME,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1
          },
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

// Modified verify handler with enhanced error handling
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
    // Check cluster health before proceeding
    const health = await client.cluster.health({});
    if (health.body.status === 'red') {
      throw new Error('Cluster is not healthy');
    }

    const document = {
      fijian: originalFijian,
      english: verifiedEnglish,
      timestamp: new Date().toISOString()
    };

    const response = await client.index({
      index: INDEX_NAME,
      body: document,
      refresh: true // Ensure immediate searchability
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Translation verified and stored successfully',
        id: response.body._id,
        clusterHealth: health.body.status
      })
    };
  } catch (error) {
    console.error('Verification error:', error);

    // Enhanced error handling
    if (error.name === 'ConnectionError') {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          message: 'OpenSearch cluster is not available',
          error: 'The cluster might be stopped or starting up'
        })
      };
    }

    if (error.message.includes('Cluster is not healthy')) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          message: 'OpenSearch cluster is not healthy',
          error: 'Please try again later'
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Error storing verified translation',
        error: error.message
      })
    };
  }
};

// Your existing handleTranslate function remains unchanged
const handleTranslate = async (body: any, headers: any): Promise<APIGatewayProxyResult> => {
  try {
    const { fijianText } = body;

    if (!fijianText) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "fijianText is required in request body" })
      };
    }

    const bedrockClient = new BedrockRuntimeClient({ region: "us-west-2" });

    const prompt = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please translate the following Fijian text to English. Provide your response in JSON format with these keys:
              - translation: Your direct English translation
              - confidence: "high", "medium", or "low"
              - notes: Any disclaimers, uncertainties, or additional context about the translation
              
              Fijian text: "${fijianText}"`
            }
          ]
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(prompt)
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const claudeResponse = responseBody.content[0].text;

    // Parse Claude's JSON response
    let parsedResponse;
    try {
      // Modified regex to work without 's' flag
      const jsonMatch = claudeResponse.match(/```json[\r\n]?([\s\S]*?)[\r\n]?```/) || 
                       claudeResponse.match(/{[\s\S]*}/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : claudeResponse;
      parsedResponse = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Error parsing Claude response:', parseError);
      parsedResponse = {
        translation: claudeResponse,
        confidence: "unknown",
        notes: "Error parsing structured response"
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        originalText: fijianText,
        translation: parsedResponse.translation,
        confidence: parsedResponse.confidence,
        notes: parsedResponse.notes,
        rawResponse: claudeResponse // Optional: include for debugging
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

// Modified main handler with client reuse
let opensearchClient: Client | null = null;

export const main = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST'
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    // Initialize client if not exists
    if (!opensearchClient) {
      opensearchClient = createOpenSearchClient();
      await createIndexIfNotExists(opensearchClient);
    }

    const path = event.path;
    const body = JSON.parse(event.body || '{}');

    switch (path) {
      case '/translate':
        return await handleTranslate(body, headers);
      case '/verify':
        return await handleVerify(opensearchClient, body, headers);
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'Not Found' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Internal Server Error',
        error: error.message
      })
    };
  }
};
