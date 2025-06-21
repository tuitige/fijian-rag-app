import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== 'GET' || event.path !== '/learn') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const modules = [
    { title: 'Basic Greetings', pages: 2, summary: 'This is a summary of the module content.' },
    { title: 'Numbers', pages: 1, summary: 'This is a summary of the module content.' }
  ];

  return {
    statusCode: 200,
    body: JSON.stringify({ modules })
  };
};
