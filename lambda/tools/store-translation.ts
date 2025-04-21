import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';

const region = 'us-west-2';
const domainEndpoint = process.env.OPENSEARCH_ENDPOINT!;
const indexName = 'translations';

type TranslationDoc = {
  originalText: string;
  translatedText: string;
  embedding: number[];
  verified: boolean;
};

export const storeTranslation = async (doc: TranslationDoc) => {

  console.log('📥 Storing translation:', doc);

  const req = new HttpRequest({
    method: 'POST',
    hostname: domainEndpoint.replace(/^https?:\/\//, ''),
    path: `/${indexName}/_doc`,
    body: JSON.stringify(doc),
    headers: {
      host: domainEndpoint,
      'Content-Type': 'application/json',
    },
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: 'es',
    sha256: Sha256,
  });

  const signedRequest = await signer.sign(req);
  const { response } = await new NodeHttpHandler().handle(signedRequest as any);

  const result = await new Response(response.body).text();
  console.log('📝 Stored translation:', result);

  return result;
};
