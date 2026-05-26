import { useEffect, useRef } from "react";

type Props = {
  onScan: (text: string) => void;
  paused?: boolean;
};

export function QrScanner({ onScan, paused }: Props) {
  const containerId = "qr-reader";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instanceRef = useRef<any>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) return;
      const qr = new Html5Qrcode(containerId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      instanceRef.current = qr;
      const last = { text: "", at: 0 };

      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
          (decodedText) => {
            const now = Date.now();
            if (decodedText === last.text && now - last.at < 1500) return;
            last.text = decodedText;
            last.at = now;
            onScanRef.current(decodedText);
          },
          () => {},
        );
      } catch (err) {
        console.error("QR start error", err);
      }

      cleanup = () => {
        qr.stop().then(() => qr.clear()).catch(() => {});
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const i = instanceRef.current;
    if (!i) return;
    if (paused) {
      try { i.pause(true); } catch { /* noop */ }
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
