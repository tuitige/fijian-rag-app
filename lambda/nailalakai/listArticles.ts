import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.DDB_ARTICLE_VERIFICATION_TABLE! || 'ArticleVerificationTable';
const REGION = process.env.DEFAULT_REGION!;
const ddb = new DynamoDBClient({ region: REGION });

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :pkprefix)',
      ExpressionAttributeValues: {
        ':pkprefix': { S: 'article#' }
      },
      ProjectionExpression: 'articleId, title'
    });

    const data = await ddb.send(command);

    // Group by articleId
    const uniqueMap = new Map<string, { articleId: string; title: string }>();

    (data.Items || []).forEach(item => {
      const articleId = item.articleId?.S || '';
      const title = item.title?.S || '';
      if (articleId && !uniqueMap.has(articleId)) {
        uniqueMap.set(articleId, { articleId, title });
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(Array.from(uniqueMap.values()))
    };
  } catch (err) {
    console.error('❌ list-articles error:', err);
    return {
      statusCode: 500,
      body: 'Error fetching articles list'
    };
  }
};
