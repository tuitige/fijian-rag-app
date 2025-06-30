import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'GET' && event.path === '/learn') {
    const modules = [
      { title: 'Basic Greetings', pages: 2, summary: 'This is a summary of the module content.' },
      { title: 'Numbers', pages: 1, summary: 'This is a summary of the module content.' }
    ];
    return {
      statusCode: 200,
      body: JSON.stringify({ modules })
    };
  }

  if (event.httpMethod === 'POST' && event.path === '/chat') {
    const body = JSON.parse(event.body || '{}');
    const br = new BedrockRuntimeClient({});
    const res = await br.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ messages: [{ role: 'user', content: body.input || '' }], max_tokens: 100 })
    }));
    const text = Buffer.from(res.body).toString();
    return { statusCode: 200, body: text };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
