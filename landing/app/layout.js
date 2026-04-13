import "./globals.css";

export const metadata = {
  title: "Lenny Live — Compounded experience. Borrowed intuition.",
  description:
    "The wisdom of 300+ product leaders, arriving exactly when you need it. A Chrome extension that brings Lenny Rachitsky's voice into your PM workflow.",
  icons: {
    icon: '/logo-icon.svg',
  },
  openGraph: {
    title: "Lenny Live — Compounded experience. Borrowed intuition.",
    description:
      "The wisdom of 300+ product leaders, arriving exactly when you need it.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
