import { translateArticleByParagraph } from './translateArticleByParagraph';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';

const TABLE_NAME = process.env.DDB_TABLE_NAME! || 'ArticleVerificationTable';

const ddb = new DynamoDBClient({ region: 'us-west-2' });

export const runTranslationAndStore = async (articleId: string, title: string, paragraphs: string[]) => {

  console.log('TABLE_NAME:', TABLE_NAME);

  try {
    const chunkSize = 8;
    const paragraphChunks: string[][] = [];
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      paragraphChunks.push(paragraphs.slice(i, i + chunkSize));
    }

    console.log(paragraphChunks.length, ' chunks created for translation');

    let globalIndex = 0;
    for (let chunkIndex = 0; chunkIndex < paragraphChunks.length; chunkIndex++) {
      const chunk = paragraphChunks[chunkIndex];
      console.log(`🧠 Claude chunk ${chunkIndex + 1}/${paragraphChunks.length} — ${chunk.length} paragraphs`);

      const chunkResult = await translateArticleByParagraph(chunk);
      console.log(`✅ Claude returned ${chunkResult.length} translations`);

      if (chunkResult.length < chunk.length) {
        console.warn(`⚠️ Claude returned fewer translations than input in chunk ${chunkIndex + 1}`);
      }

      for (const result of chunkResult) {
        const itemId = uuidv4();
        const item = {
          PK: { S: `article#${articleId}` },
          SK: { S: `paragraph#${globalIndex}` },
          id: { S: itemId },
          articleId: { S: articleId },
          title: { S: title },
          originalParagraph: { S: result.originalParagraph },
          translatedParagraph: { S: result.translatedParagraph },
          verified: { S: 'false' },
          confidence: { N: (result.confidence || 1).toString() },
          source: { S: 'Claude' },
          createdAt: { S: new Date().toISOString() },
          type: { S: 'ARTICLE_PARAGRAPH' }
        };

        console.log('TABLE_NAME:', TABLE_NAME);
        await ddb.send(new PutItemCommand({
          TableName: TABLE_NAME,
          Item: item
        }));

        console.log(`📦 Saved paragraph ${globalIndex + 1} to DDB:`, result.originalParagraph.slice(0, 60));
        globalIndex++;
      }
    }

    console.log(`🎉 Finished storing article: ${title} with ${globalIndex} paragraphs`);
  } catch (err) {
    console.error('❌ Error in background processing:', err);
  }
};
