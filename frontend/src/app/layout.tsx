import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DaashTics Bogor - Smart Traffic & AI Analytics",
  description:
    "Sistem Pemantauan Terpadu Arus Lalu Lintas, Deteksi Kerumunan, Parkir Liar, dan Muatan ODOL Berbasis Kecerdasan Buatan Kota Bogor.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-[#0b0f19] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
