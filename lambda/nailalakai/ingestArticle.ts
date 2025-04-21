import { APIGatewayProxyHandler } from 'aws-lambda';
import { translateArticleByParagraph } from './helpers/translateArticleByParagraph';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';
import { v4 as uuidv4 } from 'uuid';

const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const REGION = process.env.AWS_REGION!;
const INDEX = 'article-paragraphs';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { title, paragraphs } = body;

    if (!title || !paragraphs || !Array.isArray(paragraphs)) {
      return {
        statusCode: 400,
        body: 'Missing title or paragraphs[]'
      };
    }

    const articleId = uuidv4();
    const translated = await translateArticleByParagraph(paragraphs);

    for (let i = 0; i < translated.length; i++) {
      const doc = {
        articleId,
        title,
        originalParagraph: translated[i].originalParagraph,
        translatedParagraph: translated[i].translatedParagraph,
        index: i,
        verified: false,
        createdAt: new Date().toISOString(),
        source: 'NaiLalakai'
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

      const signedRequest = await signer.sign(request);
      await new NodeHttpHandler().handle(signedRequest as any);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Article translated and stored', articleId })
    };
  } catch (err) {
    console.error('❌ Error ingesting article:', err);
    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
};
