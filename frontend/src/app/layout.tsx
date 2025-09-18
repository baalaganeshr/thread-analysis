import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings";

export const metadata: Metadata = {
  title: "CyberGuard Platform",
  description: "Real-time cybersecurity monitoring and analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}

