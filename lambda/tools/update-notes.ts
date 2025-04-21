import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';

const region = 'us-west-2';
const domainEndpoint = process.env.OPENSEARCH_ENDPOINT!;
const indexName = 'translations';

export const updateNotes = async (id: string, notes: string) => {
  const body = JSON.stringify({
    doc: { notes }
  });

  const req = new HttpRequest({
    method: 'POST',
    hostname: domainEndpoint.replace(/^https?:\/\//, ''),
    path: `/${indexName}/_update/${id}`,
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

  console.log(`📝 Updated notes for ${id}:`, result);

  return result;
};
