import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { putItem, buildResponse, generateEmbedding, cosineSimilarity, queryVerifiedTranslations, translateWithClaude } from './utils';

const TABLE_NAME = process.env.TRANSLATIONS_TABLE!;
const SIMILARITY_THRESHOLD = 0.85;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { sourceText, sourceLanguage } = JSON.parse(event.body || '{}');
    const sourceEmbedding = await generateEmbedding(sourceText);

    // 1. Query for verified translations in the same language
    const verifiedItems = await queryVerifiedTranslations(TABLE_NAME, sourceLanguage);

    // 2. Score all results by cosine similarity
    const similarMatches = verifiedItems
      .filter(item => item.embedding?.S)
      .map(item => {
        try {
          const embedding = JSON.parse(item.embedding.S || '[]');
          const score = cosineSimilarity(sourceEmbedding, embedding);
          return {
            id: item.id?.S,
            sourceText: item.sourceText?.S,
            translatedText: item.translatedText?.S,
            score
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.score - a.score);

    // 3. Return top match if found
    if (similarMatches.length > 0) {
        console.log('Similar matches:', similarMatches);
        console.log('Best match:', similarMatches[0]);
    }

    if (similarMatches.length > 0 && similarMatches[0].score >= SIMILARITY_THRESHOLD) {
      const best = similarMatches[0];
      return buildResponse(200, {
        translatedText: best.translatedText,
        confidence: best.score,
        id: best.id,
        similarTranslations: similarMatches.length,
        debug: { foundSimilarTranslations: similarMatches }
      });
    }

    // 4. Otherwise, use Claude to translate
    const claude = await translateWithClaude(sourceText, sourceLanguage);
    console.log('Claude response:', claude);
    const translationEmbedding = await generateEmbedding(claude.translation);

    const id = uuidv4();
    await putItem(TABLE_NAME, {
      id: { S: id },
      type: { S: 'translation' },
      sourceText: { S: sourceText },
      translatedText: { S: claude.translation },
      sourceLanguage: { S: sourceLanguage },
      confidence: { N: (claude.confidence || 1).toString() },
      verified: { BOOL: false },
      embedding: { S: JSON.stringify(sourceEmbedding) },
      translationEmbedding: { S: JSON.stringify(translationEmbedding) },
      createdAt: { S: new Date().toISOString() },
      rawResponse: { S: claude.rawResponse }
    });

    return buildResponse(200, {
      translatedText: claude.translation,
      rawResponse: claude.rawResponse,
      confidence: claude.confidence,
      id,
      similarTranslations: 0
    });
  } catch (err) {
    console.error('Translate error:', err);
    return buildResponse(500, { message: 'Translation failed' });
  }
};
