import { APIGatewayProxyHandler } from 'aws-lambda';
import { translateArticleByParagraph } from './helpers/translateArticleByParagraph';
import { runTranslationAndStore } from './helpers/runTranslationAndStore';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';
import { v4 as uuidv4 } from 'uuid';

const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const TABLE_NAME = process.env.DDB_ARTICLE_VERIFICATION_TABLE!;
const REGION = process.env.DEFAULT_REGION!;
const INDEX = 'article-paragraphs';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { title, paragraphs } = body;

    if (!title || !paragraphs || !Array.isArray(paragraphs)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: 'Missing title or paragraphs[]'
      };
    }

    const articleId = uuidv4();
    console.log('TABLE_NAME:', TABLE_NAME);

    await runTranslationAndStore(articleId, title, paragraphs);

    return {
      statusCode: 202,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ message: 'Translation in progress', articleId })
    };
  } catch (err) {
    console.error('❌ ingestArticle error:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: 'Internal server error'
    };
  }
};

/*
const runTranslationAndStore = async (articleId: string, title: string, paragraphs: string[]) => {
  try {
    console.log('🧠 Starting translation for article:', title);
    console.log('OS_ENDPOINT:', OS_ENDPOINT);
    const translated = await translateArticleByParagraph(paragraphs);
    console.log('✅ Claude returned', translated.length, 'paragraphs');

    const signer = new SignatureV4({
      credentials: defaultProvider(),
      region: REGION,
      service: 'es',
      sha256: Sha256
    });

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

      console.log(`📤 Indexing doc ${i + 1}:`, doc);

      const signed = await signer.sign(request);
      const { response } = await new NodeHttpHandler().handle(signed as any);
      const rawBody = await new Response(response.body).text();
      console.log('🔍 OpenSearch response:', rawBody);
    }

    console.log(`✅ Stored ${translated.length} paragraphs for article: ${title}`);
  } catch (err) {
    console.error('❌ Error in background processing:', err);
  }
};
*/