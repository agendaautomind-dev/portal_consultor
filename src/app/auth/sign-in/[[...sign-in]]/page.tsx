import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'Entrar | Portal do Consultor Smartcar',
  description: 'Acesso dos consultores Smartcar.'
};

export default async function Page() {
  return <SignInViewPage />;
}
