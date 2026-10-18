import type { Metadata, Viewport } from "next";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhyWhen",
  description: "Tell me what you need, or book a time directly.",
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f4ef" }, { media: "(prefers-color-scheme: dark)", color: "#141412" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
