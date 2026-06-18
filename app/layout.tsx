import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

// Body & data face — Inter is a variable font, so no explicit weights needed.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Display/heading face — Poppins is NOT variable on Google Fonts, so the
// weights we actually use must be enumerated or the build fails.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mission ON — Smart Choices",
  description:
    "A safe, confidential space to make smart choices with a mentor you choose.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
