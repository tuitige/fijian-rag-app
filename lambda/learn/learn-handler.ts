import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.LEARNING_MODULES_TABLE || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const userInput = body.input || '';
    let session = body.session || {}; // { moduleId: 'greetings-001', stepIndex: 0, expectingAnswer: false }

    if (!session.moduleId) {
      // Start a new session
      session = {
        moduleId: 'greetings-001', // default for now
        stepIndex: 0,
        expectingAnswer: false
      };
    }

    // Fetch module from DDB
    const moduleData = await getModule(session.moduleId);
    if (!moduleData) {
      throw new Error('Module not found.');
    }

    const steps = moduleData.steps || [];
    let reply = '';

    if (session.expectingAnswer) {
      // Check the answer
      const currentStep = steps[session.stepIndex];
      if (currentStep && currentStep.type === 'practice') {
        const correct = isAnswerCorrect(userInput, currentStep.answer);
        if (correct) {
          reply = "Correct! 🎉 Let's continue.";
        } else {
          reply = `Not quite. Try again: ${currentStep.question}`;
          return responseOk({ reply, session });
        }
        session.expectingAnswer = false;
        session.stepIndex += 1;
      }
    }

    if (session.stepIndex >= steps.length) {
      reply = "Great job! You've completed the module. 🎉";
      session = {}; // End session
      return responseOk({ reply, session });
    }

    const nextStep = steps[session.stepIndex];
    if (nextStep.type === 'teaching') {
      reply = nextStep.text;
      session.stepIndex += 1;
    } else if (nextStep.type === 'practice') {
      reply = nextStep.question;
      session.expectingAnswer = true;
    }

    return responseOk({ reply, session });

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ reply: 'Error processing your request.', session: {} })
    };
  }
};

async function getModule(moduleId: string) {
  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: {
      moduleId: { S: moduleId }
    }
  });
  const result = await ddb.send(command);
  if (!result.Item) return null;

  return {
    title: result.Item.title.S,
    description: result.Item.description.S,
    steps: JSON.parse(result.Item.steps.S || '[]')
  };
}

function isAnswerCorrect(userInput: string, expectedAnswer: string) {
  return userInput.trim().toLowerCase() === expectedAnswer.trim().toLowerCase();
}

function responseOk(body: any) {
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
}
