import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CustomCursor } from "@/shared/ui/CustomCursor";
import { OpeningIntro } from "@/shared/ui/OpeningIntro";
import { ToastProvider } from "@/shared/ui/Toast";
import { WalletProviders } from "@/shared/wallet/Providers";
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
  title: "CapitalRail - IXS entry preflight",
  description:
    "SERV-powered preflight for IXS RWA vault rails. GO only when deposit capacity is real.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
};

const introBootScript = `
try {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("cr-intro-done");
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: introBootScript }} />
      </head>
      <body className="min-h-full bg-[#02090d] font-sans text-[#f5fbfd] antialiased">
        <CustomCursor />
        <ToastProvider>
          <OpeningIntro>
            <WalletProviders>{children}</WalletProviders>
          </OpeningIntro>
        </ToastProvider>
      </body>
    </html>
  );
}
