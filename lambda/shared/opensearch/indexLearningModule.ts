import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

const OS_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const OS_REGION = process.env.DEFAULT_REGION!;

export const indexToOpenSearch = async (index: string, doc: any) => {

  console.log(`📥 Indexing learning module to ${index}:`, doc);
  console.log('OS_ENDPOINT:', OS_ENDPOINT);
  console.log('OS_REGION:', OS_REGION);  

  const req = new HttpRequest({
    method: 'POST',
    hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
    path: `/${index}/_doc`,
    body: JSON.stringify(doc),
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

  const signedRequest = await signer.sign(req);
  const { response } = await new NodeHttpHandler().handle(signedRequest as any);

  if (response.statusCode !== 201 && response.statusCode !== 200) {
    const raw = await new Response(response.body).text();
    console.error('❌ Failed to index learning module:', raw);
    throw new Error(`Failed to index learning module to index: ${index}`);
  }

  console.log(`✅ Indexed learning module to ${index}`);
};
