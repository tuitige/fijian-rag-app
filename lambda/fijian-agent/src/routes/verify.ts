import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { updateItem, buildResponse } from './utils';

const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { id, sourceText, translatedText, verified } = JSON.parse(event.body || '{}');
    if (!id) return buildResponse(400, { message: 'Missing ID for verification' });

    await updateItem(TABLE_NAME, id, {
      verified: { BOOL: verified ?? true },
      sourceText: { S: sourceText },
      translatedText: { S: translatedText },
      updatedAt: { S: new Date().toISOString() }
    });

    return buildResponse(200, { message: 'Translation verified', id });
  } catch (err) {
    console.error('Verify error:', err);
    return buildResponse(500, { message: 'Verification failed' });
  }
};