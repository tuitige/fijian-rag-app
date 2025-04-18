import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import fetch from "node-fetch";

const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const REGION = "us-west-2";

// Construct the signer for OpenSearch Serverless
const signer = new SignatureV4({
  credentials: defaultProvider(),
  region: REGION,
  service: "aoss",
  sha256: Sha256,
});

// Reusable signed request function
export const signedAossRequest = async (
  method: string,
  path: string,
  body?: object
): Promise<any> => {
  const url = `${OPENSEARCH_ENDPOINT}${path}`;
  const request = new HttpRequest({
    method,
    headers: {
      host: new URL(OPENSEARCH_ENDPOINT).hostname,
      "Content-Type": "application/json",
    },
    hostname: new URL(OPENSEARCH_ENDPOINT).hostname,
    path,
    body: body ? JSON.stringify(body) : undefined,
    protocol: "https:",
  });

  const signedRequest = await signer.sign(request);
  const response = await fetch(url, {
    method: signedRequest.method,
    headers: signedRequest.headers as any,
    body: signedRequest.body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AOSS error: ${response.status} - ${text}`);
  }

  return await response.json();
};
