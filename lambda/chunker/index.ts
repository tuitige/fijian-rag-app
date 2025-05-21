import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";

const bedrock = new BedrockRuntimeClient({ region: "us-west-2" });
const ddb = new DynamoDBClient({});
const modelId = "anthropic.claude-3-haiku-20240307";
const TABLE_NAME = process.env.TABLE_NAME || "";

interface ChunkedResult {
  articleId: string;
  paragraphId: string;
  originalText: string;
  translatedParagraph?: string;
  atomicPhrases?: { fijian: string; english: string }[];
  vocabulary?: { word: string; type: string; meaning: string }[];
  error?: string;
  raw?: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("[chunker] Event received:", JSON.stringify(event));

  try {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing body" }) };
    }

    const { articleId, paragraphs } = JSON.parse(event.body);
    if (!articleId || !paragraphs || !Array.isArray(paragraphs)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid input format" }) };
    }

    const results: ChunkedResult[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphId = `p${i}`;

      const prompt = `You are a Fijian language linguist.\n
Take this Fijian paragraph and do the following:\n
1. Translate the entire paragraph to English.\n
2. Extract atomic Fijian phrase pairs and translate each.\n
3. Extract Fijian vocabulary words with part of speech and English meaning.\n
\n
Paragraph: ${paragraph}\n
\n
Respond only in the following JSON format:\n
{{
  "translatedParagraph": "...",
  "atomicPhrases": [{{ "fijian": "...", "english": "..." }}],
  "vocabulary": [{{ "word": "...", "type": "...", "meaning": "..." }}]
}}`;

      const body = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1024,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }]
      };

      const cmd = new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body)
      });

      const res = await bedrock.send(cmd);
      const jsonResponse = JSON.parse(new TextDecoder().decode(res.body));
      const outputText = jsonResponse.content[0].text.trim();

      let parsed: any;
      try {
        parsed = JSON.parse(outputText);
      } catch {
        parsed = { error: "Invalid Claude response", raw: outputText };
      }

      const itemBase = {
        pk: { S: `article#${articleId}` },
        originalLanguage: { S: "fj" },
        verified: { S: "false" }
      };

      // Paragraph-level item
      await ddb.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          ...itemBase,
          sk: { S: `paragraph#${paragraphId}` },
          originalText: { S: paragraph },
          translatedText: { S: parsed.translatedParagraph || "?" }
        }
      }));

      // Atomic phrases
      if (parsed.atomicPhrases) {
        for (let j = 0; j < parsed.atomicPhrases.length; j++) {
          const phrase = parsed.atomicPhrases[j];
          await ddb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
              ...itemBase,
              sk: { S: `atomic#${paragraphId}#${j}` },
              originalText: { S: phrase.fijian },
              translatedText: { S: phrase.english }
            }
          }));
        }
      }

      // Vocabulary words
      if (parsed.vocabulary) {
        for (let j = 0; j < parsed.vocabulary.length; j++) {
          const word = parsed.vocabulary[j];
          await ddb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
              ...itemBase,
              sk: { S: `vocab#${paragraphId}#${j}` },
              word: { S: word.word },
              type: { S: word.type },
              meaning: { S: word.meaning }
            }
          }));
        }
      }

      results.push({
        articleId,
        paragraphId,
        originalText: paragraph,
        ...parsed
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Chunked and stored successfully", chunks: results })
    };

  } catch (err: any) {
    console.error("[chunker] Error during chunking:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chunking failed", detail: err.message })
    };
  }
};
