import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { getConsultantDashboardData } from '@/features/consultant/api/service';
import { ConsultantDashboard } from '@/features/consultant/components/consultant-dashboard';

export default async function OverviewLayout() {
  await auth.protect();
  const data = await getConsultantDashboardData();

  return (
    <PageContainer>
      <ConsultantDashboard data={data} />
    </PageContainer>
  );
}
