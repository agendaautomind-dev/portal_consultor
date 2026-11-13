import { SignIn as ClerkSignInForm } from '@clerk/nextjs';
import Image from 'next/image';

export default function SignInViewPage() {
  return (
    <div className='grid min-h-screen bg-[#03142e] lg:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]'>
      <div className='relative hidden overflow-hidden lg:block'>
        <Image
          src='/smartcar-portal-consultor.png'
          alt='Portal do Consultor Smartcar Proteção Veicular'
          fill
          priority
          sizes='60vw'
          className='object-contain'
        />
      </div>

      <main className='bg-background flex min-h-screen items-center justify-center p-6 lg:p-10'>
        <div className='flex w-full max-w-md items-center justify-center'>
          <ClerkSignInForm
            appearance={{
              elements: {
                footerAction: 'hidden'
              }
            }}
          />
        </div>
      </main>
    </div>
  );
}
