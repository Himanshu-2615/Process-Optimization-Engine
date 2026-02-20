import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Process Optimization & Impact Simulation",
  description: "Business analytics for workflow modeling and optimization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
