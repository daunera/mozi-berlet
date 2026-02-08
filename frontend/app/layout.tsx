
import type { Metadata } from "next";
import { getDictionary, Locale } from "@/lib/dictionaries";
import "./globals.css";

export const dynamic = 'force-dynamic';

const locale = (process.env.APP_LOCALE as Locale) || 'en';
const dict = getDictionary(locale);

export const metadata: Metadata = {
  title: dict.metadata.title,
  description: dict.metadata.description,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
  other: {
    'google-site-verification': 'none',
  },
};

import PasscodeGate from "@/components/PasscodeGate";


import { I18nProvider } from "@/components/I18nProvider";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (process.env.APP_LOCALE as Locale) || 'en';
  const dict = getDictionary(locale);

  return (
    <html lang={locale}>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <I18nProvider locale={locale} dict={dict}>
          <PasscodeGate>
            <div className="flex-1">
              {children}
            </div>
          </PasscodeGate>
        </I18nProvider>
      </body>
    </html>
  );
}
