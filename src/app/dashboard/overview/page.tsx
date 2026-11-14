import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { getConsultantDashboardData } from '@/features/consultant/api/service';
import { ConsultantDashboard } from '@/features/consultant/components/consultant-dashboard';

export default async function OverviewPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await auth.protect();
  const { period } = await searchParams;
  const data = await getConsultantDashboardData(period);

  return (
    <PageContainer>
      <ConsultantDashboard data={data} />
    </PageContainer>
  );
}
