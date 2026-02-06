
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Mi megy a moziba?",
  description: "Menni kű abba a moziba befele, ha már ingyen vagyon!",
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
import LogoutButton from "@/components/LogoutButton";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <PasscodeGate>
          <div className="flex-1">
            {children}
          </div>
          <footer className="py-8 flex justify-center mt-auto">
            <LogoutButton />
          </footer>
        </PasscodeGate>
      </body>
    </html>
  );
}
