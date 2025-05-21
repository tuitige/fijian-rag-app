// lambda/orchestrator/index.ts

import axios from 'axios';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({});
let apiKey: string | undefined;

const BASE_URL = process.env.UNIFIED_API_BASE_URL || 'https://h6sxwow3v8.execute-api.us-west-2.amazonaws.com/prod';
const SECRET_NAME = process.env.AGENT_API_KEY_SECRET_NAME || 'AgentApiKey';

// Cold start: load API key once
async function loadApiKey() {
  if (!apiKey) {
    const secret = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
    apiKey = secret.SecretString;
  }
}

// Axios-based agent call
async function callAgent(endpoint: string, payload: object) {
  await loadApiKey();

  const url = `${BASE_URL}/${endpoint}`;
  const headers = {
    'x-api-key': apiKey!,
    'Content-Type': 'application/json'
  };

  const response = await axios.post(url, payload, { headers });
  return response.data;
}

export const handler = async (event: any) => {
  console.log('[orchestrator] Received:', JSON.stringify(event));

  const action = event.action;
  const input = event.input || {};

  try {
    if (action === 'scrape-translate') {
      const { url } = input;

      const scraped = await callAgent('scraper', { url });
      const { articleId, paragraphs } = scraped;

      const translated = await callAgent('translator', { articleId, paragraphs });
      return {
        statusCode: 200,
        body: JSON.stringify({ articleId, translations: translated.translations })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: `Unknown action: ${action}` }) };

  } catch (err: any) {
    console.error('[orchestrator] Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Unhandled error' })
    };
  }
};
