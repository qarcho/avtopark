"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Invite links from Supabase's standard email template land here. The login tokens
// come after "#" in the address, which only the browser can read, so this page
// stores them as the session (in cookies) and sends the person on to set a password.
export default function AcceptInvitePage() {
  const t = useTranslations("auth");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Remove the tokens from the address bar and browser history right away.
    window.history.replaceState(null, "", window.location.pathname);

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      router.replace("/auth/error");
      return;
    }
    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => router.replace(error ? "/auth/error" : "/set-password"));
  }, [router]);

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <p role="status" className="text-muted">
        {t("signingIn")}
      </p>
    </main>
  );
}
