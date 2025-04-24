import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.DDB_ARTICLE_VERIFICATION_TABLE! || 'ArticleVerificationTable';
const REGION = process.env.DEFAULT_REGION!;
const ddb = new DynamoDBClient({ region: REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const id = decodeURIComponent(event.queryStringParameters?.id || '');
    if (!id) {
      return { statusCode: 400, body: 'Missing id param' };
    }

    const pk = `article#${id}`;

    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': { S: pk }
      }
    });

    const data = await ddb.send(command);

    const results = data.Items?.map(item => ({
      id: item.id?.S || '',
      articleId: item.articleId?.S,
      title: item.title?.S,
      originalParagraph: item.originalParagraph?.S,
      translatedParagraph: item.translatedParagraph?.S,
      confidence: parseFloat(item.confidence?.N || '1'),
      verified: item.verified?.S === 'true',
      index: parseInt(item.index?.N || '0'),
      createdAt: item.createdAt?.S,
      source: item.source?.S
    })) || [];

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(results)
    };
  } catch (err) {
    console.error('❌ getParagraphsById error:', err);
    return { statusCode: 500, body: 'Error fetching paragraphs from DDB' };
  }
};

