// lambda/tools/store-verified.ts

import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';
import { OS_ENDPOINT, OS_REGION, TRANSLATIONS_INDEX } from '../shared/constants';

export const storeVerified = async ({
  id,
  verifiedText
}: {
  id: string;
  verifiedText: string;
}) => {

  const body = {
    doc: {
      translatedText: verifiedText,
      verified: true
    }
  };

  const req = new HttpRequest({
    method: 'POST',
    hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
    path: `/${TRANSLATIONS_INDEX}/_update/${id}`,
    body: JSON.stringify(body),
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

  const signed = await signer.sign(req);
  const { response } = await new NodeHttpHandler().handle(signed as any);
  const result = await new Response(response.body).text();

  console.log('✅ Verified translation updated:', result);
};
