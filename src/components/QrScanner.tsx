import { useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type Props = {
  onScan: (text: string) => void;
  paused?: boolean;
};

export function QrScanner({ onScan, paused }: Props) {
  const containerId = "qr-reader";
  const instanceRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let cancelled = false;
    const qr = new Html5Qrcode(containerId, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    instanceRef.current = qr;

    const lastScannedRef = { current: { text: "", at: 0 } };

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
      (decodedText) => {
        const now = Date.now();
        if (
          decodedText === lastScannedRef.current.text &&
          now - lastScannedRef.current.at < 1500
        ) {
          return;
        }
        lastScannedRef.current = { text: decodedText, at: now };
        onScanRef.current(decodedText);
      },
      () => {},
    ).catch((err) => {
      if (!cancelled) console.error("QR start error", err);
    });

    return () => {
      cancelled = true;
      const i = instanceRef.current;
      if (i) {
        i.stop().then(() => i.clear()).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const i = instanceRef.current;
    if (!i) return;
    if (paused) {
      i.pause(true);
    } else {
      try { i.resume(); } catch { /* noop */ }
    }
  }, [paused]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
      <div id={containerId} className="aspect-square w-full" />
      <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-primary/70 shadow-[0_0_30px] shadow-primary/30" />
    </div>
  );
}
