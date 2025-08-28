// index.ts (Lambda entrypoint)
//
// This version expects that each S3 “manifest.json” triggers this function.
// It now fetches per‐page both a Textract JSON and a raw‐text file, plus the image,
// then calls Claude (sonnet‐4) with exactly the same prompt you validated locally.
//
// Make sure you have @anthropic‐ai/sdk, @aws‐sdk/client‐s3, @aws‐sdk/client‐dynamodb,
// @aws‐sdk/util‐dynamodb, @aws‐sdk/client‐secrets‐manager, and uuid installed.

import { S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  PutItemCommand,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { indexToOpenSearch, createEmbedding } from "./opensearch";
import {
  ChapterManifest,
  ChapterExtraction,
  TranslationItem,
  GrammarRule,
  Exercise,
  CulturalNote,
  Dialogue,
  VisualAid,
} from "./interfaces";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

// Environment variables (set via CDK)
// CONTENT_BUCKET         = process.env.CONTENT_BUCKET
// LEARNING_MODULES_TABLE = process.env.LEARNING_MODULES_TABLE
// MODULE_VOCABULARY_TABLE= process.env.MODULE_VOCABULARY_TABLE
// VERIFIED_TRANSLATIONS_TABLE
// VERIFIED_VOCAB_TABLE

const CONTENT_BUCKET = process.env.CONTENT_BUCKET!;
const LEARNING_MODULES_TABLE = process.env.LEARNING_MODULES_TABLE!;
const MODULE_VOCABULARY_TABLE = process.env.MODULE_VOCABULARY_TABLE!;
const VERIFIED_TRANSLATIONS_TABLE = process.env.VERIFIED_TRANSLATIONS_TABLE!;
const VERIFIED_VOCAB_TABLE = process.env.VERIFIED_VOCAB_TABLE!;

// ─── Helpers ────────────────────────────────────────────────────────────────────

// Fetch a Key from S3, return the Body as a Buffer
async function fetchS3ObjectAsBuffer(bucket: string, key: string): Promise<Buffer> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await s3.send(cmd);
  if (!res.Body) throw new Error(`Empty body for s3://${bucket}/${key}`);
  // @ts-ignore – in Node 18+, res.Body is a Readable stream
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as any) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf-8") : chunk);
  }
  return Buffer.concat(chunks);
}

// Fetch a Key from S3, return the Body as a UTF‐8 string
async function fetchS3ObjectAsString(bucket: string, key: string): Promise<string> {
  const buf = await fetchS3ObjectAsBuffer(bucket, key);
  return buf.toString("utf-8");
}

// Retrieve Anthropic API key from Secrets Manager
async function getAnthropicApiKeyFromSecrets(): Promise<string> {
  const client = new SecretsManagerClient({ region: "us-west-2" });
  const cmd = new GetSecretValueCommand({
    SecretId:
      "arn:aws:secretsmanager:us-west-2:934889091214:secret:AnthropicApiKey-MDtXdC",
  });
  const r = await client.send(cmd);
  if (!r.SecretString) throw new Error("No Anthropic API key in Secrets Manager");
  return r.SecretString;
}

// ─── Lambda Handler ─────────────────────────────────────────────────────────────

export const handler = async (event: S3Event | any) => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  try {
    // Check if this is an API Gateway event for dictionary processing
    if (event.httpMethod && event.path) {
      console.log('API Gateway event detected');
      // Import and call the dictionary processor handler
      const { processDictionaryHandler } = await import('./processor');
      return await processDictionaryHandler(event);
    }
    
    // Original S3 event handling for learning modules
    if (event.Records && event.Records[0].s3) {
      const bucket = event.Records[0].s3.bucket.name;
      const key = decodeURIComponent(
        event.Records[0].s3.object.key.replace(/\+/g, " ")
      );

      console.log(`Processing manifest from s3://${bucket}/${key}`);

      // 1) Download manifest JSON
      const manifestContent = await fetchS3ObjectAsString(bucket, key);
      const manifest: ChapterManifest = JSON.parse(manifestContent);

      // 2) Process entire chapter
      await processChapter(manifest, bucket, key.substring(0, key.lastIndexOf("/")));

      return { statusCode: 200, body: "Processing complete" };
    }

    return { statusCode: 400, body: "No valid event detected" };
  } catch (error: any) {
    console.error("Error processing:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Processing failed", details: error.message }),
    };
  }
};

// ─── processChapter ────────────────────────────────────────────────────────────

async function processChapter(
  manifest: ChapterManifest,
  bucket: string,
  prefix: string
) {
  console.log(`Processing chapter ${manifest.chapter} with ${manifest.totalPages} pages`);

  // 1) Instantiate Anthropic client once
  const anthropicApiKey = await getAnthropicApiKeyFromSecrets();
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  // 2) For each “image filename” in manifest.files, fetch:
  //    a) the page image (convert to base64)
  //    b) the Textract JSON (detectDocumentTextResponse.json)
  //    c) the raw text (rawText.txt) – two different S3 keys
  //
  // We assume that, for each filename “foo.jpg” in manifest.files,
  // there exist sibling keys:
  //   prefix/foo.jpg
  //   prefix/foo-textract.json
  //   prefix/foo-raw.txt
  //
  // In practice, you should upload both the full Textract output AND a raw‐text output
  // under those keys (or adjust this code to match your actual naming convention).

  const extractions: ChapterExtraction[] = [];

  for (const filename of manifest.files) {
    if (filename.toLowerCase().endsWith(".json")) continue; // skip manifest itself

    // Image buffer → base64
    const imgBuf = await fetchS3ObjectAsBuffer(bucket, `${prefix}/${filename}`);
    const imgBase64 = imgBuf.toString("base64");
    console.log(`  • Fetched image ${filename} (${(imgBuf.length / 1024).toFixed(1)} KiB)`);

    // Build Textract JSON key: replace extension with “-textract.json”
    const texKey = filename.replace(/\.[^.]+$/, "-textract.json");
    console.log(`    – Fetching Textract JSON s3://${bucket}/${prefix}/${texKey}`);
    const texJsonText = await fetchS3ObjectAsString(bucket, `${prefix}/${texKey}`);
    const texParsed = JSON.parse(texJsonText);
    const texPretty = JSON.stringify(texParsed, null, 2);
    console.log(
      `    – Textract JSON length ${(texPretty.length / 1024).toFixed(1)} KiB`
    );

    // Build raw‐text key: replace extension with “-raw.txt”
    const rawKey = filename.replace(/\.[^.]+$/, "-raw.txt");
    console.log(`    – Fetching raw text s3://${bucket}/${prefix}/${rawKey}`);
    const rawText = await fetchS3ObjectAsString(bucket, `${prefix}/${rawKey}`);
    const rawTrimmed = rawText.trim();
    console.log(
      `    – Raw text length ${(rawTrimmed.length / 1024).toFixed(1)} KiB`
    );

    // Extract content from this single page
    const singlePageExtraction = await extractPageContent(
      anthropic,
      imgBase64,
      filename,
      texPretty,
      rawTrimmed,
      manifest
    );
    extractions.push(singlePageExtraction);
  }

  // 3) Merge “per‐page” extractions into a single ChapterExtraction object
  //    (concatenate translationPairs, grammarRules, etc.). For simplicity, we assume
  //    that each page returns the same top‐level “chapterMetadata.” If not, take the
  //    first one.
  const merged: ChapterExtraction = {
    chapterMetadata: extractions[0].chapterMetadata,
    translationPairs: {},
    grammarRules: [],
    exercises: [],
    culturalNotes: [],
    dialogues: [],
    visualAids: [],
  };

  for (const ex of extractions) {
    // Merge translationPairs
    for (const [cat, items] of Object.entries(ex.translationPairs)) {
      if (!merged.translationPairs[cat]) merged.translationPairs[cat] = [];
      merged.translationPairs[cat].push(...items);
    }
    // Append arrays
    merged.grammarRules.push(...ex.grammarRules);
    merged.exercises.push(...ex.exercises);
    merged.culturalNotes.push(...ex.culturalNotes);
    if (ex.dialogues) merged.dialogues!.push(...ex.dialogues!);
    if (ex.visualAids) merged.visualAids!.push(...ex.visualAids!);
  }

  // 4) Store results
  await storeChapterData(merged, manifest);
  // 5) Index to OpenSearch
  await indexChapterContent(merged);

  console.log(`Processing complete for chapter ${manifest.chapter}`);
}

// ─── extractPageContent ─────────────────────────────────────────────────────────
//
// Calls Claude‐sonnet‐4 with:
//   • system prompt (schema), user prompt (raw + Textract JSON)
//   • a single image block (no inline base64 in text)
// Returns exactly one page’s ChapterExtraction fragment.

async function extractPageContent(
  anthropic: Anthropic,
  imageBase64: string,
  filename: string,
  texPretty: string,
  rawTrimmed: string,
  manifest: ChapterManifest
): Promise<ChapterExtraction> {
  const modelName = "claude-sonnet-4-20250514";
  const maxTokens = 12000;
  const temperature = 0.0; // deterministic

  // Determine media_type from extension
  const mediaType: "image/png" | "image/jpeg" =
    filename.toLowerCase().endsWith(".png")
      ? "image/png"
      : "image/jpeg";

  // System prompt (same as local)
  const systemPrompt = `
You are a Fijian‐language extraction engine. You will receive:
  • A block of OCR‐extracted text (from AWS Textract), in JSON form.
  • A “raw text” block of the same page (plain UTF‐8).
  • A Base64‐encoded image of the same page.

Produce exactly one JSON object that follows this schema (no extra keys):
{
  "chapterMetadata": {
    "lesson": "<lesson ID or chapter number>",
    "title": "<Main Fijian heading on page, if any>",
    "subtitle": "<English subtitle, if present>",
    "pageRange": "<e.g. 37-47>",
    "source": "Peace Corps Fiji",
    "totalPages": number,
    "learningObjectives": ["...","..."],
    "prerequisiteLessons": ["2.4","2.3"]  // if mentioned
  },
  "translationPairs": {
    "<category1>": [
      {
        "fijian": "<Fijian word or phrase>",
        "english": "<English translation>",
        "type": "<noun|verb|phrase|number|…>",
        "page": <page number>,
        "usageNotes": "<optional context>",
        "pronunciation": "<optional notes>",
        "verified": true,
        "source": "peace_corps_manual"
      }
      // …more…
    ],
    "<anotherCategory>": [ … ]
  },
  "grammarRules": [
    {
      "concept": "<Grammar concept>",
      "explanation": "<How it works>",
      "pattern": "<Pattern formula, if any>",
      "examples": [
        { "fijian": "<…>", "english": "<…>", "breakdown": "<…>" }
      ],
      "page": <page number>
    }
    // …etc…
  ],
  "exercises": [
    {
      "type": "<listening|fill_in_blank|practice|…>",
      "instruction": "<What students do>",
      "content": "<Details>",
      "page": <page number>
    }
    // …etc…
  ],
  "culturalNotes": [
    {
      "note": "<Cultural note text>",
      "pages": [<array of page numbers>]
    }
    // …etc…
  ],
  "dialogues": [
    {
      "id": "<e.g. 2.5.1>",
      "topic": "<Conversation topic>",
      "participants": ["A","B"],
      "page": <page number>
    }
    // …etc…
  ],
  "visualAids": [
    {
      "type": "<clock_faces|images|charts|…>",
      "description": "<What it shows>",
      "pages": [<array of page numbers>]
    }
    // …etc…
  ]
}

Important:
  • Use ALL usable content on the page.
  • The JSON block above is strict—no extra keys.
  • Trust the OCR JSON for structure; use raw text for actual words.
  • Use the image only if needed (embedded below).
  • Mark every translation with \"verified\": true.
  • Group vocabulary into logical categories (\"numbers\", \"time_expressions\", etc.).
  • Include page numbers for everything.
`;

  // Build user prompt (raw + JSON)
  const userPrompt = `
Here is the raw OCR text from Textract:
─── RAW OCR TEXT BEGIN ───
${rawTrimmed}
─── RAW OCR TEXT END ───

Here is the Textract JSON (pretty‐printed):
─── TEXTRACT JSON BEGIN ───
${texPretty}
─── TEXTRACT JSON END ───
`;

  // Build Antropic “image” block
  const imageBlock = {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: mediaType,
      data: imageBase64,
    },
  };

  console.log(`    ✎ Calling Claude (${modelName}) for page ${filename}…`);
  const response = await anthropic.messages.create({
    model: modelName,
    max_tokens: maxTokens,
    temperature,
    system: [{ type: "text" as const, text: systemPrompt.trim() }],
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: userPrompt.trim() },
          imageBlock,
        ],
      },
    ],
  });

  // Concatenate all “text” blocks
  const textBlocks = response.content.filter((b) => b.type === "text");
  const combinedText = textBlocks.map((b) => b.text).join("\n").trim();

  // Save raw response into S3 for debugging
  await s3.send(
    new GetObjectCommand({
      Bucket: CONTENT_BUCKET,
      Key: `debug/claude-raw/${manifest.chapter}-${filename.replace(
        /\.[^.]+$/,
        ""
      )}-${Date.now()}.json`,
    })
  );

  // Strip Markdown code fences if any
  let cleaned = combinedText;
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
  }

  console.log(
    `    ✔ Claude responded (${combinedText.length} chars), parsing JSON…`
  );
  let parsed: ChapterExtraction;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    console.error("    ✗ Failed to parse JSON:", err);
    console.error("    >> First 1000 chars of response:", combinedText.substring(0, 1000));
    throw new Error("Failed to parse Claude response as JSON");
  }

  // Basic sanity check
  if (!parsed.chapterMetadata || !parsed.translationPairs) {
    console.error("    ✗ Missing top-level fields in parsed output:", Object.keys(parsed));
    throw new Error("Invalid extraction structure");
  }

  console.log(`    ✔ Parsed page ${filename} with keys:`, Object.keys(parsed));
  return parsed;
}

// ─── storeChapterData ──────────────────────────────────────────────────────────

async function storeChapterData(extraction: ChapterExtraction, manifest: ChapterManifest) {
  const moduleId = `ch${manifest.chapter}`;
  const timestamp = new Date().toISOString();

  // 1) Store module‐level metadata in LEARNING_MODULES_TABLE
  const metadataItem = {
    moduleId,
    contentType: "metadata",
    chapter: manifest.chapter.split(".")[0],
    lessonNumber: parseFloat(manifest.chapter),
    lesson: extraction.chapterMetadata.lesson,
    title: extraction.chapterMetadata.title,
    subtitle: extraction.chapterMetadata.subtitle,
    pageRange: extraction.chapterMetadata.pageRange,
    source: extraction.chapterMetadata.source,
    totalPages: extraction.chapterMetadata.totalPages,
    learningObjectives: JSON.stringify(
      extraction.chapterMetadata.learningObjectives || []
    ),
    prerequisiteLessons: JSON.stringify(
      extraction.chapterMetadata.prerequisiteLessons || []
    ),
    manifestData: JSON.stringify(manifest),
    createdAt: timestamp,
    status: "processed",
  };

  console.log("  • Storing metadata:", metadataItem);
  await ddb.send(
    new PutItemCommand({
      TableName: LEARNING_MODULES_TABLE,
      Item: marshall(metadataItem, { removeUndefinedValues: true }),
    })
  );

  // 2) Store vocabulary/translation pairs into two tables:
  //    a) MODULE_VOCABULARY_TABLE (batch writes)
  //    b) VERIFIED_TRANSLATIONS_TABLE & VERIFIED_VOCAB_TABLE individually
  const vocabRequests: any[] = [];
  let vocabCount = 0;

  for (const [category, items] of Object.entries(extraction.translationPairs)) {
    for (const item of items) {
      const vocabId = `${moduleId}_vocab_${++vocabCount}`;
      // a) Push into MODULE_VOCABULARY_TABLE in batches
      vocabRequests.push({
        PutRequest: {
          Item: marshall({
            vocabularyId: vocabId,
            moduleId,
            category,
            ...item,
            createdAt: timestamp,
          }),
        },
      });

      // b) Directly write into VERIFIED_TRANSLATIONS_TABLE
      await ddb.send(
        new PutItemCommand({
          TableName: VERIFIED_TRANSLATIONS_TABLE,
          Item: marshall({
            fijian: item.fijian,
            english: item.english,
            type: item.type,
            source: "peace_corps_manual",
            moduleId,
            verified: true,
            verifiedAt: timestamp,
          }),
        })
      );

      // If it’s a single‐word (no space), also write into VERIFIED_VOCAB_TABLE
      if (item.type !== "phrase" && !item.fijian.includes(" ")) {
        await ddb.send(
          new PutItemCommand({
            TableName: VERIFIED_VOCAB_TABLE,
            Item: marshall({
              word: item.fijian,
              meaning: item.english,
              partOfSpeech: item.type,
              source: "peace_corps_manual",
              moduleId,
              verified: true,
              verifiedAt: timestamp,
            }),
          })
        );
      }
    }
  }

  // Batch‐write into MODULE_VOCABULARY_TABLE (25‐item chunks)
  for (let i = 0; i < vocabRequests.length; i += 25) {
    const batch = vocabRequests.slice(i, i + 25);
    await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [MODULE_VOCABULARY_TABLE]: batch,
        },
      })
    );
  }

  console.log(`  • Stored ${vocabCount} translation items.`);

  // 3) Store grammarRules, exercises, culturalNotes (all as JSON strings in LEARNING_MODULES_TABLE)
  if (extraction.grammarRules.length) {
    await ddb.send(
      new PutItemCommand({
        TableName: LEARNING_MODULES_TABLE,
        Item: marshall({
          moduleId,
          contentType: "grammar",
          rules: JSON.stringify(extraction.grammarRules),
          createdAt: timestamp,
        }),
      })
    );
  }
  if (extraction.exercises.length) {
    await ddb.send(
      new PutItemCommand({
        TableName: LEARNING_MODULES_TABLE,
        Item: marshall({
          moduleId,
          contentType: "exercises",
          exercises: JSON.stringify(extraction.exercises),
          createdAt: timestamp,
        }),
      })
    );
  }
  if (extraction.culturalNotes.length) {
    await ddb.send(
      new PutItemCommand({
        TableName: LEARNING_MODULES_TABLE,
        Item: marshall({
          moduleId,
          contentType: "cultural",
          notes: JSON.stringify(extraction.culturalNotes),
          createdAt: timestamp,
        }),
      })
    );
  }

  console.log(`  • Completed storing all chapter data for ${moduleId}`);
}

// ─── indexChapterContent ────────────────────────────────────────────────────────

async function indexChapterContent(extraction: ChapterExtraction) {
  const indexPromises: Promise<any>[] = [];

  // 1) Vocabulary items
  for (const [category, items] of Object.entries(extraction.translationPairs)) {
    for (const item of items) {
      const contextString = `
Fijian: "${item.fijian}"
English: "${item.english}"
Type: ${item.type}
Category: ${category}
Usage: ${item.usageNotes || "general"}
Lesson: ${extraction.chapterMetadata.lesson}
      `.trim();

      const embedding = await createEmbedding(contextString);
      indexPromises.push(
        indexToOpenSearch({
          index: "fijian-learning-modules",
          id: uuidv4(),
          body: {
            contentType: "vocabulary",
            moduleId: `ch${extraction.chapterMetadata.lesson}`,
            fijian: item.fijian,
            english: item.english,
            type: item.type,
            category,
            usageNotes: item.usageNotes,
            page: item.page,
            embedding,
            lessonTitle: extraction.chapterMetadata.title,
            verified: true,
            source: "peace_corps_manual",
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
  }

  // 2) Grammar rules
  for (const rule of extraction.grammarRules) {
    const ruleContext = `
Grammar concept: ${rule.concept}
Explanation: ${rule.explanation}
Pattern: ${rule.pattern || "N/A"}
Examples: ${rule.examples.map((e) => `${e.fijian} = ${e.english}`).join("; ")}
    `.trim();

    const embedding = await createEmbedding(ruleContext);
    indexPromises.push(
      indexToOpenSearch({
        index: "fijian-learning-modules",
        id: uuidv4(),
        body: {
          contentType: "grammar",
          moduleId: `ch${extraction.chapterMetadata.lesson}`,
          concept: rule.concept,
          explanation: rule.explanation,
          pattern: rule.pattern,
          examples: rule.examples,
          page: rule.page,
          embedding,
          lessonTitle: extraction.chapterMetadata.title,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  await Promise.all(indexPromises);
  console.log(`  • Indexed ${indexPromises.length} items to OpenSearch`);
}
