import { APIGatewayProxyHandler } from 'aws-lambda';

import { handleTranslate } from './agents/translate-agent';
import { handleModuleSummary } from './agents/module-summary-agent';
import { handleVerify } from './agents/verify-agent';

import { fetchModule as fetchModuleByTitle } from './tools/fetch-module';
import { fetchPages as fetchPagesByPrefix } from './tools/fetch-pages';
import { storeVerified as storeVerifiedModule } from './tools/store-verified';

export const handler: APIGatewayProxyHandler = async (event) => {
  const path = event.resource || event.path;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    console.log(`📥 Received request on ${path}`, JSON.stringify(body, null, 2));

    switch (path) {
      case '/translate':
        return response(await handleTranslate(body.input));

      case '/summary':
        return response(await handleModuleSummary(body.input));

      case '/verify':
        return response(await handleVerify(body.input));

      case '/module':
        return response(await fetchModuleByTitle(event.queryStringParameters?.title || ''));

      case '/pages':
        return response(await fetchPagesByPrefix(event.queryStringParameters?.prefix || ''));

      case '/verify-module': {
        const { id, verifiedContent } = body;
        
        console.log('🔍 /verify-module invoked');
        console.log('📦 Payload received:', JSON.stringify(body, null, 2));
        
        if (!id || !verifiedContent) {
            console.warn('⚠️ Missing `id` or `verifiedContent` in request body');
            return response({ message: 'Missing id or verifiedContent' }, 400);
        }
        
        console.log(`📝 Storing verified content for ID: ${id}`);
        await storeVerifiedModule(id, verifiedContent);
        console.log('✅ Stored successfully');
        
        return response({ message: 'Module verified and stored' });
    }
          
      default:
        return response({ message: 'Not found' }, 404);
    }
  } catch (err) {
    console.error('❌ Uncaught error:', err);
    return response({ message: 'Internal error', error: err.message }, 500);
  }
};

const response = (body: any, statusCode = 200) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});
