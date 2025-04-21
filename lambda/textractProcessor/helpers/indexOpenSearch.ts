import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const OS_REGION = process.env.AWS_REGION!;
const TRANSLATIONS_INDEX = 'translations';

export const indexTranslation = async ({
    originalText,
    translatedText,
    verified,
    source,
    embedding,
    moduleId,
    learningModuleTitle
  }: {
    originalText: string;
    translatedText: string;
    verified: boolean;
    source: string;
    embedding: number[];
    moduleId: string;
    learningModuleTitle: string;    
  }) => {
    const doc = {
      originalText,
      translatedText,
      verified,
      source,
      embedding,
      moduleId,
      learningModuleTitle      
    };

  const req = new HttpRequest({
    method: 'POST',
    hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
    path: `/${TRANSLATIONS_INDEX}/_doc`,
    body: JSON.stringify(doc),
    headers: {
      host: OS_ENDPOINT,
      'Content-Type': 'application/json'
    }
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: OS_REGION,
    service: 'es',
    sha256: Sha256
  });

  const signedRequest = await signer.sign(req);
  const { response } = await new NodeHttpHandler().handle(signedRequest as any);

  if (response.statusCode !== 201 && response.statusCode !== 200) {
    const raw = await new Response(response.body).text();
    console.error('❌ Failed to index translation:', raw);
    throw new Error(`Failed to index phrase: ${originalText}`);
  }

  console.log(`✅ Indexed phrase: "${originalText}"`);
};
