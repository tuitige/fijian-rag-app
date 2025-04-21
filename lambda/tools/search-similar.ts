// lambda/tools/search-similar.ts

import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';
import { OS_ENDPOINT, OS_REGION, TRANSLATIONS_INDEX } from '../shared/constants';
import { generateEmbedding } from './generate-embedding';

export const searchSimilar = async (input: string) => {
  const MIN_SIMILARITY_SCORE = 0.9;

  console.log(`🔍 Searching for similar translations to: ${input}`);

  const embedding = await generateEmbedding(input);
  console.log(`📡 Generated embedding: ${JSON.stringify(embedding)}`);

  const query = {
    knn: {
      embedding: {
        vector: embedding,
        k: 3
      }
    }
  };

  const request = new HttpRequest({
    method: 'POST',
    hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
    path: `/${TRANSLATIONS_INDEX}/_search`,
    body: JSON.stringify({ size: 3, query }),
    headers: {
      host: OS_ENDPOINT,
      'Content-Type': 'application/json',
    }
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256
  });

  const signed = await signer.sign(request);
  const { response } = await new NodeHttpHandler().handle(signed as any);
  const body = await new Response(response.body).json();

  console.log('🔍 OpenSearch search similar response:', JSON.stringify(body, null, 2));
  const hits = body.hits?.hits ?? [];
  
  const filtered = hits
    .filter((hit: any) => hit._score >= MIN_SIMILARITY_SCORE)
    .map((hit: any) => ({
      id: hit._id,
      sourceText: hit._source.sourceText,
      translatedText: hit._source.translatedText,
      score: hit._score
    }));

    if (filtered.length === 0) {
      console.log(`⚠️ No similar matches above score threshold (${MIN_SIMILARITY_SCORE})`);
    }
  
    return filtered;    

};
