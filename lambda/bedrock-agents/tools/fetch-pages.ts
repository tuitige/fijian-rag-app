import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3 = new S3Client({ region: 'us-west-2' });
const BUCKET_NAME = process.env.BUCKET_NAME!;

const streamToString = async (stream: Readable): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
};

type Page = {
    pageNumber: number;
    paragraphs: string[];
    [key: string]: any;
  };

export const fetchPages = async (prefix: string) => {
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: `${prefix}/pg`,
  });

  const listed = await s3.send(listCommand);
  if (!listed.Contents) return [];

  const sortedKeys = listed.Contents
    .map(obj => obj.Key!)
    .sort((a, b) => {
      const getNum = (key: string) => parseInt(key.match(/pg(\d+)\.json/)?.[1] || '0');
      return getNum(a) - getNum(b);
    });

  const pages: { pageNumber: number; paragraphs: string[] }[] = [];

  for (const key of sortedKeys) {
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    const data = await s3.send(getCommand);
    const body = await streamToString(data.Body as Readable);
    pages.push(JSON.parse(body));
  }

  return pages;
};