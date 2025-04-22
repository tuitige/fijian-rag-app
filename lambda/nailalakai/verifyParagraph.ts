import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION!;
const TABLE_NAME = process.env.DDB_TABLE_NAME!;
const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const INDEX = 'translations';

const ddb = new DynamoDBClient({ region: REGION });
const bedrock = new BedrockRuntimeClient({ region: REGION });

const generateEmbedding = async (text: string): Promise<number[]> => {
  const payload = {
    inputText: text,
    embeddingConfig: {},
    modelId: 'amazon.titan-embed-text-v1'
  };

  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  });

  const response = await bedrock.send(command);
  const raw = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(raw);
  return parsed.embedding;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { id, originalParagraph, translatedParagraph } = body;

    if (!id || !originalParagraph || !translatedParagraph) {
      return {
        statusCode: 400,
        body: 'Missing required fields'
      };
    }

    // Update DynamoDB entry
    await ddb.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: { S: `article#${id}` },
        SK: { S: `paragraph#${id}` }
      },
      UpdateExpression: 'SET verified = :v, translatedParagraph = :t',
      ExpressionAttributeValues: {
        ':v': { S: 'true' },
        ':t': { S: translatedParagraph }
      }
    }));

    // Generate embedding and index to OpenSearch
    const embedding = await generateEmbedding(originalParagraph);

    const doc = {
      originalText: originalParagraph,
      translatedText: translatedParagraph,
      verified: true,
      source: 'Claude',
      embedding
    };

    const request = new HttpRequest({
      method: 'POST',
      hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
      path: `/${INDEX}/_doc`,
      body: JSON.stringify(doc),
      headers: {
        host: OS_ENDPOINT,
        'Content-Type': 'application/json'
      }
    });

    const signer = new SignatureV4({
      credentials: defaultProvider(),
      region: REGION,
      service: 'es',
      sha256: Sha256
    });

    const signed = await signer.sign(request);
    await new NodeHttpHandler().handle(signed as any);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ message: 'Verified and stored', id })
    };
  } catch (err) {
    console.error('❌ verify-paragraph error:', err);
    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
};
