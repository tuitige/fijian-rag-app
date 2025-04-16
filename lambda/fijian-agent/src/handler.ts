import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as translateHandler } from './routes/translate';
import { handler as verifyHandler } from './routes/verify';
import { handler as learnHandler } from './routes/learn';
import { handler as similarHandler } from './routes/similar';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  switch (event.resource) {
    case '/translate':
      return translateHandler(event);
    case '/verify':
      return verifyHandler(event);
    case '/learn':
      return learnHandler(event);
    case '/similar':
      return similarHandler(event);
    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Not found' })
      };
  }
};
