// shared/utils.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({});
const SECRET_ARN = process.env.ANTHROPIC_SECRET_ARN!;

export async function getAnthropicApiKey(): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: SECRET_ARN });
  const secret = await secretsClient.send(command);
  return secret.SecretString!;
}
