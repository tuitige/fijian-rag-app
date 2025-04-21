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
    const body = JSON.parse(event.body || '{}');
    const id = body.id;

    if (!id) {
      return { statusCode: 400, body: 'Missing paragraph id' };
    }

    const updatePayload = {
      doc: {
        verified: true
      }
    };

    const request = new HttpRequest({
      method: 'POST',
      hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
      path: `/${INDEX}/_update/${id}`,
      body: JSON.stringify(updatePayload),
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
      body: JSON.stringify({ message: 'Paragraph marked verified', id })
    };
  } catch (err) {
    console.error('❌ verifyParagraph error:', err);
    return { statusCode: 500, body: 'Failed to verify paragraph' };
  }
};
