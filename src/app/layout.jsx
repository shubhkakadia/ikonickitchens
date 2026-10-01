import localFont from "next/font/local";
import "./globals.css";

// Fonts are self-hosted (latin subset, variable) from src/fonts — see the README there.
const geistSans = localFont({
  src: "../fonts/Geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "../fonts/GeistMono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const archivo = localFont({
  src: "../fonts/Archivo-latin.woff2",
  variable: "--font-archivo",
  weight: "300 600",
  display: "swap",
});

export const metadata = {
  title: "Ikonic Kitchens and Cabinets",
  description: "Ikonic Kitchens and Cabinets",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {children}
      </body>
    </html>
  );
}
