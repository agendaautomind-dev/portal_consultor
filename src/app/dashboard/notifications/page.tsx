import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Notifications'
};

export default async function Page() {
  await auth.protect();
  redirect('/dashboard/overview');
}
