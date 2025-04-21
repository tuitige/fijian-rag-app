import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Sha256 } from "@aws-crypto/sha256-js";
import { Console } from "console";

const domainEndpoint = process.env.OPENSEARCH_ENDPOINT!;
const region = "us-west-2";
const indexName = "translations";

export const getVerifiedTranslation = async (sourceText: string): Promise<string | null> => {
  console.log("🔍 Searching for verified translation:", sourceText);
  const query = {
    query: {
      bool: {
        must: [
          { match_phrase: { "originalText":sourceText } },
          { term: { verified: true } }
        ]
      }
    },
    size: 1
  };
  console.log("🔍 OpenSearch query:", JSON.stringify(query));
  console.log("🔍 OpenSearch endpoint:", domainEndpoint);

  const req = new HttpRequest({
    method: "POST",
    hostname: domainEndpoint.replace(/^https?:\/\//, ""),
    path: `/${indexName}/_search`,
    body: JSON.stringify(query),
    headers: {
      host: domainEndpoint,
      "Content-Type": "application/json"
    }
  });
  console.log("req", req);  

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: "es",
    sha256: Sha256
  });

  console.log("signer", signer);

  const signedRequest = await signer.sign(req);
  console.log("🔍 Signed request:", signedRequest);
  const { response } = await new NodeHttpHandler().handle(signedRequest as any);
  const body = await new Response(response.body).json();

  console.log("🔍 OpenSearch response:", body);

  const hit = body?.hits?.hits?.[0]?._source;
  console.log('🎯 Verified hit:', JSON.stringify(hit, null, 2));
  if (hit && hit.translatedText) {
    return {
      translation: hit.translatedText,
      notes: hit.notes,
      confidence: 1,
      id: body?.hits?.hits?.[0]?._id,
    };
  }

  console.log("⚠️ No verified translation found.");
  return null;
};
