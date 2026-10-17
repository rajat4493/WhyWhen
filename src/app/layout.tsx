import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intent Scheduler",
  description: "Tell me what you need, or book a time directly.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
