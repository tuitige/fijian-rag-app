import { DynamoDBClient, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
export const handler = async (event) => {
  const ddb = new DynamoDBClient({});
  const moduleId = event.queryStringParameters?.id;

  console.log(`📄 Module ID: ${moduleId}`);
  console.log(`📄 Learning Modules Table: ${process.env.DDB_LEARNING_MODULES_TABLE}`);

  const query = await ddb.send(new QueryCommand({
    TableName: process.env.DDB_LEARNING_MODULES_TABLE || 'LearningModulesTable',
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :meta)',
    ExpressionAttributeValues: {
      ':pk': { S: `module#${moduleId}` },
      ':meta': { S: 'meta#' }
    }
  }));

  const item = query.Items?.[0];

  if (!item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Module not found' })
    };
  }
  
  const parsed = Object.fromEntries(Object.entries(item).map(
    ([k, v]) => [k, Object.values(v)[0]]
  ));
  
  // Properly parse the topics field and paragraphs
  const topicsRaw = item.topics?.S || '[]';
  let topics;
  try {
    topics = JSON.parse(topicsRaw);
  } catch (err) {
    console.warn('⚠️ Failed to parse topics JSON:', topicsRaw);
    topics = [];
  }
  
  const paragraphs = item.paragraphs?.L?.map(p => p.S) || [];
  
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      learningModuleTitle: parsed.learningModuleTitle,
      source: parsed.source,
      createdAt: parsed.createdAt,
      topics,
      paragraphs
    })
  };
};
