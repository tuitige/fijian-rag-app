import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handleTranslate } from './agents/translate-agent';
import { handleVerify } from './agents/verify-agent';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const route = event.path;
    const body = event.body ? JSON.parse(event.body) : {};

    switch (route) {
      case '/translate':
        return await handleTranslate(body);
      case '/verify':
        return await handleVerify(body);
      default:
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Route not found' })
        };
    }
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Unexpected error' })
    };
  }
};
