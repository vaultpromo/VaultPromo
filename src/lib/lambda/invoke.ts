import "server-only";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

/**
 * Invoke the audio worker Lambda.
 *
 * Uses InvocationType "Event" (fire-and-forget).
 * Lambda processes up to 5 jobs per invocation (batchSize in pg-boss fetch).
 *
 * If there are more than 5 pending jobs, invokes Lambda multiple times
 * with a 2-second delay between invocations to avoid overwhelming it.
 *
 * Falls back silently if AWS credentials are not configured.
 */

let _client: LambdaClient | null = null;

function getClient(): LambdaClient | null {
  if (_client) return _client;

  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    console.warn("[lambda] AWS credentials not configured");
    return null;
  }

  _client = new LambdaClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Invoke Lambda enough times to cover `pendingCount` jobs.
 * Batches of 5 with 2s delay between invocations.
 */
export async function invokeLambdaWorker(pendingCount = 5): Promise<void> {
  const client = getClient();
  const fnName = process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (!client || !fnName) {
    console.warn("[lambda] Skipping invoke — not configured");
    return;
  }

  const invocations = Math.max(1, Math.ceil(pendingCount / 5));
  console.log(`[lambda] Invoking ${invocations}x for ${pendingCount} pending tracks`);

  for (let i = 0; i < invocations; i++) {
    if (i > 0) await delay(2000); // 2s between invocations

    try {
      await client.send(
        new InvokeCommand({
          FunctionName: fnName,
          InvocationType: "Event", // async fire-and-forget
          Payload: Buffer.from(JSON.stringify({})),
        }),
      );
      console.log(`[lambda] Invocation ${i + 1}/${invocations} sent`);
    } catch (err) {
      console.warn(`[lambda] Invocation ${i + 1} failed:`, (err as Error).message);
      break; // Stop if Lambda is unreachable
    }
  }
}
