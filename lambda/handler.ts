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
