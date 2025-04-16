// /routes/learn.ts (placeholder)
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { buildResponse } from './utils';

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return buildResponse(200, { message: 'Learn route not yet implemented' });
};