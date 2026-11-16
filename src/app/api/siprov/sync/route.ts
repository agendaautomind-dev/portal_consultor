import { isSiprovEnabled } from '@/lib/siprov/client';
import { reconcileSiprov, SiprovSyncRequestSchema } from '@/lib/siprov/reconcile';
import { secretMatches } from '@/lib/siprov/webhook';

export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get('authorization') ?? '';
  const secret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!secretMatches(secret, process.env.SIPROV_SYNC_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isSiprovEnabled()) {
    return Response.json({ error: 'siprov_disabled' }, { status: 503 });
  }

  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 2048) {
      return Response.json({ error: 'payload_too_large' }, { status: 413 });
    }
    const input = SiprovSyncRequestSchema.parse(raw ? JSON.parse(raw) : { mode: 'daily', days: 2 });
    return Response.json({ status: 'ok', mode: input.mode, ...(await reconcileSiprov(input)) });
  } catch (error) {
    const badRequest =
      (error instanceof Error && error.name === 'ZodError') || error instanceof SyntaxError;
    return Response.json(
      {
        error: badRequest ? 'invalid_request' : 'sync_failed',
        message: error instanceof Error ? error.message : 'Falha desconhecida.'
      },
      { status: badRequest ? 400 : 503 }
    );
  }
}
