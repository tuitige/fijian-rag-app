// === lambda/shared/dedupUtils.ts ===

import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TRANSLATIONS_REVIEW_TABLE_NAME = process.env.TRANSLATIONS_REVIEW_TABLE_NAME!;
const VERIFIED_TRANSLATIONS_TABLE = process.env.VERIFIED_TRANSLATIONS_TABLE!;
const VERIFIED_VOCAB_TABLE = process.env.VERIFIED_VOCAB_TABLE!;

// Check dedup key in unverified table (via GSI)
export async function existsInUnverified(dedupKey: string): Promise<boolean> {
  const cmd = new QueryCommand({
    TableName: TRANSLATIONS_REVIEW_TABLE_NAME,
    IndexName: 'GSI_UnverifiedKey',
    KeyConditionExpression: 'dedupKey = :k',
    ExpressionAttributeValues: { ':k': { S: dedupKey } },
    Limit: 1,
  });

  const result = await ddb.send(cmd);
  return !!(result.Items && result.Items.length > 0);
}

// Check exact match in verified translations or vocab tables
export async function existsInVerified(dataType: 'translation' | 'vocab', key1: string, key2: string): Promise<boolean> {
  const table = dataType === 'translation' ? VERIFIED_TRANSLATIONS_TABLE : VERIFIED_VOCAB_TABLE;

  const cmd = new GetItemCommand({
    TableName: table,
    Key: dataType === 'translation'
      ? { fijian: { S: key1 }, english: { S: key2 } }
      : { word: { S: key1 }, meaning: { S: key2 } }
  });

  const result = await ddb.send(cmd);
  return !!result.Item;
}

// Combined dedup check
export async function isDuplicate(
  dataType: 'translation' | 'vocab',
  key1: string | undefined,
  key2: string | undefined
): Promise<boolean> {
  if (!key1 || !key2) {
    console.warn(`[dedup] Skipping null/undefined check: ${key1}, ${key2}`);
    return true; // assume duplicate or bad input
  }

  const dedupKey = `${key1.toLowerCase()}::${key2.toLowerCase()}`;

  const [inUnverified, inVerified] = await Promise.all([
    existsInUnverified(dedupKey),
    existsInVerified(dataType, key1, key2)
  ]);
  return inUnverified || inVerified;
}
