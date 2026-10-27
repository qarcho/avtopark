import type { Metadata, Viewport } from "next";
import { Barlow_Semi_Condensed, Manrope, Noto_Sans_Georgian } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "cyrillic"] });
const georgian = Noto_Sans_Georgian({ variable: "--font-georgian", subsets: ["georgian"] });
const plate = Barlow_Semi_Condensed({ variable: "--font-barlow",subsets: ["latin"], weight: ["600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: { default: t("brand"), template: `%s · ${t("brand")}` }, description: t("tagline") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#151b25" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${manrope.variable} ${georgian.variable} ${plate.variable} h-full antialiased`}>
      <body className="min-h-full">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
