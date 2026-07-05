import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const ibm = IBM_Plex_Sans({
  variable: "--font-ibm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "SFRM",
  description: "A simple rolodex for student founders: people, projects, and follow-ups in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${ibm.variable} ${spaceMono.variable} no-scrollbar h-full antialiased`}>
      <body className="no-scrollbar h-full">{children}</body>
    </html>
  );
}
