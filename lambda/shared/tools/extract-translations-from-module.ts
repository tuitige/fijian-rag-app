import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';
import { v4 as uuidv4 } from 'uuid';
import { OS_ENDPOINT, OS_REGION, TRANSLATIONS_INDEX } from '../constants';

export const extractAndStoreTranslationsFromModule = async (learningModule: any) => {
  const translations = learningModule.pages.flatMap((page: any) => page.content);

  for (const entry of translations) {
    const document = {
      id: uuidv4(),
      sourceText: entry.fijian,
      translatedText: entry.english,
      verified: false,
      notes: entry.notes ?? ''
    };

    const req = new HttpRequest({
      method: 'POST',
      hostname: OS_ENDPOINT.replace(/^https?:\/\//, ''),
      path: `/${TRANSLATIONS_INDEX}/_doc/${document.id}`,
      body: JSON.stringify(document),
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
    const result = await new Response(response.body).text();

    console.log(`📥 Stored translation: ${document.sourceText} → ${document.translatedText}`);
    console.log(`🧾 OpenSearch response: ${result}`);
  }
};