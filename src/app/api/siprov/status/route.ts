import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getSiprovClient, isSiprovEnabled, SiprovClientError } from '@/lib/siprov/client';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!isSiprovEnabled()) {
    return NextResponse.json({ enabled: false, connected: false, mode: 'demo' });
  }

  const user = await currentUser();
  const metadata = (user?.privateMetadata ?? {}) as Record<string, unknown>;
  const consultantId = Number(metadata.siprovConsultantId);

  if (!Number.isInteger(consultantId) || consultantId <= 0) {
    return NextResponse.json(
      { enabled: true, connected: false, error: 'consultant_not_configured' },
      { status: 409 }
    );
  }

  try {
    const vendors = await getSiprovClient().listVendors();
    const vendor = vendors.find((item) => Number(item.id) === consultantId);
    return NextResponse.json({
      enabled: true,
      connected: Boolean(vendor),
      consultantConfigured: true,
      vendorActive: Boolean(vendor),
      vendorName: typeof vendor?.nome === 'string' ? vendor.nome : null
    });
  } catch (error) {
    const status = error instanceof SiprovClientError && error.status === 401 ? 502 : 503;
    return NextResponse.json(
      { enabled: true, connected: false, error: 'siprov_unavailable' },
      { status }
    );
  }
}
