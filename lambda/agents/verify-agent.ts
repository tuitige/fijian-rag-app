import { APIGatewayProxyResult } from 'aws-lambda';
import { storeVerified } from '../tools/store-verified';
import { updateNotes } from '../tools/update-notes';
import { markModuleComplete } from '../tools/mark-module-complete';

export const handleVerify = async (body: any): Promise<APIGatewayProxyResult> => {
  try {
    const { id, verifiedText, notes, moduleId, markComplete } = body;
    if (!id || !verifiedText) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'id and verifiedText are required.' })
      };
    }

    await storeVerified(id, verifiedText);

    if (notes) {
      await updateNotes(id, notes);
    }

    if (markComplete && moduleId) {
      await markModuleComplete(moduleId);
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Verification stored successfully.' })
    };
  } catch (err: any) {
    console.error('❌ VerifyAgent error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Internal error' })
    };
  }
};