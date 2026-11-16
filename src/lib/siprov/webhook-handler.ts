import 'server-only';

import { saveSiprovWebhook } from './sync-store';
import { parseSiprovWebhook, secretMatches, type SiprovWebhookType } from './webhook';

export async function receiveSiprovWebhook(
  request: Request,
  secret: string,
  type: SiprovWebhookType
): Promise<Response> {
  if (!secretMatches(secret, process.env.SIPROV_WEBHOOK_SECRET)) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return Response.json({ error: 'content_type_must_be_json' }, { status: 415 });
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }

  try {
    await saveSiprovWebhook(parseSiprovWebhook(type, await request.text()));
    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida.';
    const badPayload =
      message.startsWith('Payload Siprov') || (error instanceof Error && error.name === 'ZodError');
    return Response.json(
      { error: badPayload ? 'invalid_payload' : 'temporarily_unavailable' },
      { status: badPayload ? 400 : 503 }
    );
  }
}
