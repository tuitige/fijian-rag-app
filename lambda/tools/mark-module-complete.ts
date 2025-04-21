import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';

const region = 'us-west-2';
const domainEndpoint = process.env.OPENSEARCH_ENDPOINT!;
const indexName = 'learningmodules';

export const markModuleComplete = async (moduleId: string) => {
  const body = JSON.stringify({
    doc: { complete: true }
  });

  const req = new HttpRequest({
    method: 'POST',
    hostname: domainEndpoint.replace(/^https?:\/\//, ''),
    path: `/${indexName}/_update/${moduleId}`,
    body,
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

  console.log(`✅ Marked module ${moduleId} as complete:`, result);

  return result;
};
