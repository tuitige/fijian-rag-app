import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { APIGatewayProxyHandler } from "aws-lambda";
import * as crypto from "crypto";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

const ddb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({});
const osEndpoint = process.env.OS_DOMAIN_ENDPOINT || "";
const TABLE_NAME = process.env.TABLE_NAME || "";

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("[embedder] Event received:", event.body);

  try {
    const { pkPrefix = "article#" } = event.body ? JSON.parse(event.body) : {};

    const query = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "VerifiedIndex",
      KeyConditionExpression: "verified = :v AND begins_with(pk, :pk)",
      ExpressionAttributeValues: {
        ":v": { BOOL: true },
        ":pk": { S: pkPrefix }
      }
    });

    const { Items } = await ddb.send(query);
    if (!Items || Items.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No verified items found." })
      };
    }

    const indexed: string[] = [];

    for (const item of Items) {
      const originalText = item.originalText?.S || "";
      const translatedText = item.translatedText?.S || "";
      const embedding = await createCohereEmbedding(originalText);

      const docId = `${item.pk.S}::${item.sk.S}`;
      const body = {
        id: docId,
        originalText,
        translatedText,
        embedding
      };

      await indexToOpenSearch(body);
      indexed.push(docId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Embedded and indexed", count: indexed.length, indexed })
    };
  } catch (err: any) {
    console.error("[embedder] Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Embedding failed", detail: err.message })
    };
  }
};

async function createCohereEmbedding(text: string): Promise<number[]> {
  const body = {
    texts: [text],
    input_type: "search_document",
    truncation: "RIGHT"
  };

  const command = new InvokeModelCommand({
    modelId: "cohere.embed-english-v3",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body)
  });

  const res = await bedrock.send(command);
  const output = JSON.parse(new TextDecoder().decode(res.body));
  return output.embeddings?.[0] || [];
}

async function indexToOpenSearch(doc: any) {
  const endpoint = `https://${osEndpoint}`;
  const path = `/phrases/_doc/${doc.id}`;

  const request = new HttpRequest({
    method: "PUT",
    hostname: osEndpoint,
    path,
    headers: {
      "host": osEndpoint,
      "content-type": "application/json"
    },
    body: JSON.stringify(doc)
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: "us-west-2",
    service: "es",
    sha256: Sha256
  });

  const signedRequest = await signer.sign(request);
  const client = new NodeHttpHandler();
  const { response } = await client.handle(signedRequest as any);

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`OpenSearch indexing failed: ${response.statusCode}`);
  }
}
