import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { ChapterExtraction } from '../process-learning-module/interfaces';

const s3 = new S3Client({});
const CONTENT_BUCKET = process.env.CONTENT_BUCKET!;

async function fetchJson(bucket: string, key: string): Promise<ChapterExtraction> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty body for s3://${bucket}/${key}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as any) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(text);
}

export const handler = async (event: { prefix: string; bucket?: string }) => {
  if (!event || !event.prefix) {
    return { statusCode: 400, body: 'Missing prefix' };
  }
  const bucket = event.bucket || CONTENT_BUCKET;
  const prefix = event.prefix.endsWith('/') ? event.prefix : event.prefix + '/';

  const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const keys = (list.Contents || [])
    .map(obj => obj.Key!)
    .filter(k => k.endsWith('.json') && !k.endsWith('chapter.json'))
    .sort();
  if (keys.length === 0) {
    return { statusCode: 400, body: 'No page JSON files found' };
  }

  const merged: ChapterExtraction = {
    chapterMetadata: {} as any,
    translationPairs: {},
    grammarRules: [],
    exercises: [],
    culturalNotes: [],
    dialogues: [],
    visualAids: []
  };

  for (const key of keys) {
    const data = await fetchJson(bucket, key);
    if (!merged.chapterMetadata.lesson) {
      merged.chapterMetadata = data.chapterMetadata;
    }
    for (const [cat, items] of Object.entries(data.translationPairs)) {
      if (!merged.translationPairs[cat]) merged.translationPairs[cat] = [];
      merged.translationPairs[cat].push(...items as any[]);
    }
    merged.grammarRules.push(...(data.grammarRules || []));
    merged.exercises.push(...(data.exercises || []));
    merged.culturalNotes.push(...(data.culturalNotes || []));
    if (data.dialogues) merged.dialogues!.push(...data.dialogues);
    if (data.visualAids) merged.visualAids!.push(...data.visualAids);
  }

  const chapterKey = prefix + 'chapter.json';
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: chapterKey,
    Body: JSON.stringify(merged, null, 2),
    ContentType: 'application/json'
  }));

  return { statusCode: 200, body: JSON.stringify({ merged: keys.length, output: `s3://${bucket}/${chapterKey}` }) };
};
