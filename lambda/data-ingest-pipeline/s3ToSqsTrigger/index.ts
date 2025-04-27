import { S3Event } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SQS_QUEUE_URL } from '../constants';

const sqsClient = new SQSClient({ region: 'us-west-2' });

export const handler = async (event: S3Event) => {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));

  const records = event.Records || [];

  for (const record of records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file: s3://${bucket}/${key}`);

    const messageBody = {
      bucket,
      key,
      source: determineSourceFromKey(key) // smart guess based on file path
    };

    const params = new SendMessageCommand({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody)
    });

    try {
      const response = await sqsClient.send(params);
      console.log('Message sent to SQS:', response.MessageId);
    } catch (error) {
      console.error('Error sending message to SQS:', error);
      throw error;
    }
  }

  return {
    statusCode: 200,
    body: 'S3 event processed successfully.'
  };
};

function determineSourceFromKey(key: string): string {
  if (key.startsWith('peace-corps/')) {
    return 'PeaceCorps';
  } else if (key.startsWith('fijian-grammar/')) {
    return 'FijianGrammar';
  } else if (key.startsWith('nai-lalakai/')) {
    return 'NaiLalakai';
  } else {
    return 'Unknown';
  }
}
