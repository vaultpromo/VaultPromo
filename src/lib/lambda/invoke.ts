import "server-only";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

/**
 * Invoke the audio worker Lambda directly (asynchronous).
 *
 * Uses InvocationType "Event" — fire-and-forget. Lambda picks up the
 * job from pg-boss and processes it. No waiting for a response.
 *
 * Falls back silently if Lambda credentials are not configured — the
 * pg-boss job stays in queue and can be processed later manually.
 */

let _client: LambdaClient | null = null;

function getClient(): LambdaClient | null {
  if (_client) return _client;

  const region = process.env.AWS_REGION;
  const fnName = process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (!region || !fnName) return null;

  // Uses AWS credentials from environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
  // or the IAM role attached to the execution environment.
  _client = new LambdaClient({ region });
  return _client;
}

export async function invokeLambdaWorker(): Promise<void> {
  const client = getClient();
  const fnName = process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (!client || !fnName) {
    console.warn("[lambda] AWS_LAMBDA_FUNCTION_NAME not set — skipping direct invoke");
    return;
  }

  try {
    await client.send(
      new InvokeCommand({
        FunctionName: fnName,
        InvocationType: "Event", // async — don't wait for response
        Payload: Buffer.from(JSON.stringify({})),
      }),
    );
    console.log("[lambda] Invoked worker asynchronously");
  } catch (err) {
    // Non-fatal — job stays in pg-boss queue
    console.warn("[lambda] Failed to invoke worker:", (err as Error).message);
  }
}
