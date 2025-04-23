import { APIGatewayProxyHandler } from 'aws-lambda';
import { UpdateItemCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const TABLE_NAME = process.env.DDB_TABLE_NAME! || 'articleVerificationTable';
const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const REGION = process.env.AWS_REGION!;
const OS_INDEX = 'translations';

const ddb = new DynamoDBClient({ region: REGION });
const bedrock = new BedrockRuntimeClient({ region: REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { articleId, index, originalParagraph, translatedParagraph } = body;

    if (!articleId || index === undefined || !originalParagraph || !translatedParagraph) {
      return { statusCode: 400, body: 'Missing required fields' };
    }

    // 1. Update DDB
    await ddb.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: { S: `article#${articleId}` },
        SK: { S: `paragraph#${index}` }
      },
      UpdateExpression: 'SET verified = :v, translatedParagraph = :t',
      ExpressionAttributeValues: {
        ':v': { S: 'true' },
        ':t': { S: translatedParagraph }
      }
    }));

    // 2. Embed using Titan
    const embedBody = JSON.stringify({
      inputText: originalParagraph,
      embeddingConfig: {},
      modelId: 'amazon.titan-embed-text-v1'
    });

    const embedCommand = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: embedBody
    });

    const embedResponse = await bedrock.send(embedCommand);
    const raw = new TextDecoder().decode(embedResponse.body);
    const parsed = JSON.parse(raw);
    const embedding = parsed.embedding;

    // 3. Store in OpenSearch
    const osDoc = {
      originalText: originalParagraph,
      translatedText: translatedParagraph,
      verified: true,
      source: 'Makita',
      embedding
    };

    const request = new HttpRequest({
      method: 'POST',
      hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
      path: `/${OS_INDEX}/_doc`,
      body: JSON.stringify(osDoc),
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
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ message: 'Paragraph verified and indexed' })
    };

  } catch (err) {
    console.error('❌ verifyParagraph error:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: 'Failed to verify paragraph'
    };
  }
};
