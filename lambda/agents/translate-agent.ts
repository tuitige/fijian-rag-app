import { APIGatewayProxyResult } from 'aws-lambda';
import { getVerifiedTranslation } from '../tools/get-verified';
import { searchSimilar } from '../tools/search-similar';
import { claudeTranslate } from '../tools/claude-translate';
import { generateEmbedding } from '../tools/generate-embedding';
import { storeTranslation } from '../tools/store-translation';

export const handleTranslate = async (body: any): Promise<APIGatewayProxyResult> => {
  try {
    const { input } = body;
    console.log('🔍 TranslateAgent input:', input);
    if (!input) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Input text is required.' })
      };
    }

    // Step 1: Check for exact verified translation
    const verified = await getVerifiedTranslation(input);
    console.log('🔍 Verified translation:', verified);
    if (verified) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ result: verified, source: 'verified' })
      };
    }

    // Step 2: Search similar phrases
    const similar = await searchSimilar(input);
    console.log('🔍 Similar phrases:', similar);
    if (similar && similar.length > 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ result: similar, source: 'similar' })
      };
    }

    // Step 3: Call Claude to translate
    const claudeResult = await claudeTranslate(input);
    console.log('🔍 Claude translation result:', claudeResult);

    // Step 4: Embed and store translation
    const embedding = await generateEmbedding(input);
    console.log('🔍 Embedding:', embedding);
    const storeTranslationResult = await storeTranslation({
      originalText: input,
      embedding,
      translatedText: claudeResult,
      verified: false
    });

    console.log('📝 Store translation result:', storeTranslationResult);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ result: claudeResult, source: 'claude' })
    };
  } catch (err: any) {
    console.error('❌ TranslateAgent error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Internal error' })
    };
  }
};