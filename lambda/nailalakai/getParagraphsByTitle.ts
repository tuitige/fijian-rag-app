import { APIGatewayProxyHandler } from 'aws-lambda';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';

const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const REGION = process.env.AWS_REGION!;
const INDEX = 'article-paragraphs';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const title = decodeURIComponent(event.queryStringParameters?.title || '');
    if (!title) {
      return { statusCode: 400, body: 'Missing title param' };
    }

    const query = {
      size: 100,
      query: {
        match_phrase: {
          title
        }
      },
      sort: [{ index: 'asc' }]
    };

    const request = new HttpRequest({
      method: 'POST',
      hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
      path: `/${INDEX}/_search`,
      body: JSON.stringify(query),
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
    const { response } = await new NodeHttpHandler().handle(signed as any);
    const raw = await new Response(response.body).json();

    const hits = raw.hits?.hits ?? [];
    const results = hits.map((h: any) => ({
      id: h._id,
      ...h._source
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },      
      body: JSON.stringify(results)
    };
  } catch (err) {
    console.error('❌ getParagraphsByTitle error:', err);
    return { statusCode: 500, body: 'Error fetching paragraphs' };
  }
};
