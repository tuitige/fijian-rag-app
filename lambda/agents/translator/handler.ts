// lambda/agents/translator/handler.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TranslatorAgent } from './agent';
// In handler.ts and other files
import { TranslationRequest } from '../../shared/types/documents';



export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const request: TranslationRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!request.sourceText || !request.sourceLanguage || !request.targetLanguage) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: sourceText, sourceLanguage, targetLanguage'
        })
      };
    }

    console.log('Translation request:', request);

    const agent = new TranslatorAgent();
    const result = await agent.translate(request);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Translation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
