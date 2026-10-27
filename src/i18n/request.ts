import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

// Staff pages keep the language in a cookie (no /ka or /en in the address).
export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
  return {
    locale,
    timeZone: "Asia/Tbilisi",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
