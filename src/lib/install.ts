"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void> };

/** Stato per suggerire l'installazione: evento di Chrome/Android, istruzioni per iPhone. */
export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    try { setDismissed(localStorage.getItem("filo-install-dismissed") === "1"); } catch { setDismissed(false); }
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return {
    visible: !standalone && !dismissed && (event !== null || ios),
    ios: ios && event === null,
    install: async () => { await event?.prompt(); setEvent(null); },
    dismiss: () => {
      setDismissed(true);
      try { localStorage.setItem("filo-install-dismissed", "1"); } catch {}
    }
  };
}
