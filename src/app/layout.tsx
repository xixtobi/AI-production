import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Production Control",
  description: "Ruang kerja lokal untuk mengatur produksi video.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
