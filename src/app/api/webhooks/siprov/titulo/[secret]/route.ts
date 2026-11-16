import { receiveSiprovWebhook } from '@/lib/siprov/webhook-handler';

export async function POST(
  request: Request,
  context: { params: Promise<{ secret: string }> }
): Promise<Response> {
  const { secret } = await context.params;
  return receiveSiprovWebhook(request, secret, 'title');
}
