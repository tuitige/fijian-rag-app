import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({ region: 'us-west-2' });
const TABLE_NAME = process.env.DDB_LEARNING_MODULES_TABLE || '';

interface LearningStep {
    type: 'teaching' | 'practice'; // Can add 'quiz' or other types later
    text?: string;
    question?: string;
    answer?: string;
  }

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const userInput = body.input || '';
    let session = body.session || {}; // { moduleId: 'greetings-001', stepIndex: 0, expectingAnswer: false }

    if (!session.moduleId) {
      // Start a new session
      session = {
        moduleId: 'greetings-001', // Default module
        stepIndex: 0,
        expectingAnswer: false
      };
    }

    // Fetch the learning module from DynamoDB
    const moduleData = await getModule(session.moduleId);
    if (!moduleData) {
      throw new Error('Module not found.');
    }

    console.log('Loaded module:', moduleData);

    const steps: LearningStep[] = moduleData.steps || [];
    console.log('Steps:', steps);

    if (!Array.isArray(steps)) {
      throw new Error('Steps is not an array.');
    }

    // Guard: if session is out of bounds
    if (session.stepIndex >= steps.length) {
      const reply = "Great job! You've completed the module. 🎉";
      session = {}; // Clear session
      return responseOk({ reply, session });
    }

    const currentStep = steps[session.stepIndex];
    console.log('Current step:', currentStep);

    let reply = '';

    if (session.expectingAnswer) {
      if (currentStep && currentStep.type === 'practice') {
        const correct = isAnswerCorrect(userInput, currentStep.answer || '');
        if (correct) {
          reply = "Correct! 🎉 Let's continue.";
          session.expectingAnswer = false;
          session.stepIndex += 1;
        } else {
          reply = `Not quite. Try again: ${currentStep.question}`;
          return responseOk({ reply, session });
        }
      }
    } else {
      if (currentStep.type === 'teaching') {
        reply = currentStep.text || "Let's keep learning!";
        session.stepIndex += 1;
      } else if (currentStep.type === 'practice') {
        reply = currentStep.question || "Ready for the next question!";
        session.expectingAnswer = true;
      } else {
        reply = "Let's continue learning!";
        session.stepIndex += 1;
      }
    }

    // Final boundary check after processing
    if (session.stepIndex >= steps.length) {
      reply = "Great job! You've completed the module. 🎉";
      session = {};
    }

    return responseOk({ reply, session });

  } catch (error) {
    console.error('Learn Handler Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ reply: 'Error processing your request.', session: {} })
    };
  }
};

// Fetch a module cleanly, parsing steps properly
async function getModule(moduleId: string) {
    const command = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        moduleId: { S: moduleId }
      }
    });
    const result = await ddb.send(command);
    if (!result.Item) return null;
  
    const stepsRaw = result.Item.steps?.S || '[]';
    let stepsParsed: any = [];
  
    try {
      stepsParsed = JSON.parse(stepsRaw);
  
      // ✅ Defensive: if parsing still gives a string, parse again
      if (typeof stepsParsed === 'string') {
        console.log('Detected double stringified steps. Parsing again...');
        stepsParsed = JSON.parse(stepsParsed);
      }
  
      if (!Array.isArray(stepsParsed)) {
        throw new Error('Parsed steps is not an array.');
      }
    } catch (e) {
      console.error('Error parsing steps:', e);
      stepsParsed = [];
    }
  
    console.log('Parsed steps array:', stepsParsed);
  
    return {
      title: result.Item.title.S,
      description: result.Item.description.S,
      steps: stepsParsed
    };
  }

// Simple answer comparison
function isAnswerCorrect(userInput: string, expectedAnswer: string) {
  return userInput.trim().toLowerCase() === expectedAnswer.trim().toLowerCase();
}

// Build a 200 OK API response
function responseOk(body: any) {
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
}
