import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { CLAUDE_3_5_SONNET_V2 } from '../shared/constants';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

export const claudeTranslate = async (text: string): Promise<string> => {
  const body = JSON.stringify({
    ...CLAUDE_3_5_SONNET_V2.baseBody,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Translate the following Fijian phrase to English. Only return the translated English:

"${text}"`
          }
        ]
      }
    ]
  });

  const command = new InvokeModelCommand({
    modelId: CLAUDE_3_5_SONNET_V2.modelId,
    contentType: CLAUDE_3_5_SONNET_V2.contentType,
    accept: CLAUDE_3_5_SONNET_V2.accept,
    body
  });

  const response = await bedrock.send(command);
  const raw = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(raw);

  const content = parsed.content?.[0]?.text?.trim();
  console.log('🟢 Claude translation response:', content);

  return content || '[no translation]';
};