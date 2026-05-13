import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const fraunces = localFont({
  src: [
    {
      path: "../fonts/fraunces-latin.woff2",
      style: "normal",
    },
    {
      path: "../fonts/fraunces-latin-italic.woff2",
      style: "italic",
    },
  ],
  variable: "--font-display",
  display: "swap",
  weight: "100 900",
});

const sourceSans = localFont({
  src: [
    {
      path: "../fonts/source-sans-3-latin.woff2",
      style: "normal",
    },
    {
      path: "../fonts/source-sans-3-latin-italic.woff2",
      style: "italic",
    },
  ],
  variable: "--font-body",
  display: "swap",
  weight: "200 900",
});

export const metadata: Metadata = {
  title: "Tailor — Resume for the role",
  description:
    "Shape your experience to match a job description and preview a tailored resume.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSans.variable} h-full`}
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
