import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function aggregateTextFromS3Folder(bucket: string, prefix: string): Promise<{ fullText: string, pages: number }> {
  const list = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `${prefix}/`
  }));

  const files = (list.Contents || []).filter(obj => obj.Key?.endsWith('.json'));
  files.sort((a, b) => (a.Key! > b.Key! ? 1 : -1));

  const paragraphs: string[] = [];

  for (const file of files) {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: file.Key! }));
    const body = await res.Body?.transformToString();
    if (!body) continue;

    try {
      const parsed = JSON.parse(body);
      const pageParagraphs = parsed?.paragraphs?.map((p: any) => (typeof p === 'string' ? p : p.S)) || [];
      paragraphs.push(...pageParagraphs);
    } catch (err) {
      console.warn('Skipping invalid JSON file:', file.Key);
    }
  }

  return {
    fullText: paragraphs.join('\n\n'),
    pages: files.length
  };
}