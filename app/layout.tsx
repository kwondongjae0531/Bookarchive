import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kwon-archive-gilt.vercel.app"),

  title: "KWON'S ARCHIVE®",

  description:
    "읽고, 오래 곁에 두고 싶은 이야기들을 모아 둔 작은 서재. KWON'S ARCHIVE.",

  openGraph: {
    title: "KWON'S ARCHIVE®",
    description:
      "읽고, 오래 곁에 두고 싶은 이야기들을 모아 둔 작은 서재.",
    url: "https://kwon-archive-gilt.vercel.app",
    siteName: "KWON'S ARCHIVE",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "KWON'S ARCHIVE",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "KWON'S ARCHIVE®",
    description:
      "읽고, 오래 곁에 두고 싶은 이야기들을 모아 둔 작은 서재.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}