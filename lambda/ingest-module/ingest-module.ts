import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.LEARNING_MODULES_TABLE || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) throw new Error('No input body.');

    const moduleData = JSON.parse(event.body);

    // --- Basic validation ---
    if (!moduleData.moduleId || !moduleData.title || !moduleData.steps) {
      throw new Error('Missing required fields.');
    }

    const item = {
      moduleId: { S: moduleData.moduleId },
      title: { S: moduleData.title },
      description: { S: moduleData.description || '' },
      steps: { S: JSON.stringify(moduleData.steps) } // serialize steps array
    };

    const command = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: item
    });

    await ddb.send(command);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: `Module ${moduleData.moduleId} ingested successfully.` })
    };
  } catch (error) {
    console.error('Error ingesting module:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Error ingesting module.', error: error.message })
    };
  }
};
