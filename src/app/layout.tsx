import type { Metadata } from 'next';
import { Epilogue } from 'next/font/google';
import './globals.css';
import NextTopLoader from 'nextjs-toploader';
import Navbar from '@/components/navbar';
import { Providers } from './providers';

const epilogue = Epilogue({
  variable: '--font-epilogue',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: 'CEL Volunteer Tracker | Read-only',
  description: 'Read-only tracker to see attendance progress of CESAFI Esports League Volunteers.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${epilogue.className} antialiased`}>
        <Providers>
          <NextTopLoader color="#0f5390" />
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
