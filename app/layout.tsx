import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FixDorm — Perawatan asrama, lebih mudah",
  description: "Platform pelaporan dan pengelolaan perbaikan fasilitas asrama.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

