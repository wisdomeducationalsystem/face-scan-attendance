import { useEffect, useRef, useState } from "react";

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
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      try {
        if (!window.isSecureContext) {
          throw new Error("Camera requires HTTPS. Open the published https:// URL.");
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser does not support camera access.");
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const qr = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        instanceRef.current = qr;
        const last = { text: "", at: 0 };

        const startWith = async (cameraConfig: MediaTrackConstraints | { facingMode: string }) => {
          await qr.start(
            cameraConfig,
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
        };

        try {
          await startWith({ facingMode: { exact: "environment" } } as MediaTrackConstraints);
        } catch {
          try {
            await startWith({ facingMode: "environment" });
          } catch {
            // last fallback: pick first available camera
            const cams = await (await import("html5-qrcode")).Html5Qrcode.getCameras();
            if (!cams?.length) throw new Error("No cameras found on this device.");
            await startWith({ deviceId: { exact: cams[0].id } } as MediaTrackConstraints);
          }
        }
        if (!cancelled) setStarting(false);

        cleanup = () => {
          qr.stop().then(() => qr.clear()).catch(() => {});
        };
      } catch (err) {
        const e = err as { name?: string; message?: string };
        let msg = e?.message || "Failed to start camera.";
        if (e?.name === "NotAllowedError") {
          msg = "Camera permission denied. Allow camera access in your browser settings and reload.";
        } else if (e?.name === "NotFoundError") {
          msg = "No camera found on this device.";
        } else if (e?.name === "NotReadableError") {
          msg = "Camera is in use by another app. Close it and try again.";
        }
        console.error("QR start error", err);
        if (!cancelled) {
          setError(msg);
          setStarting(false);
        }
      }
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
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        <div id={containerId} className="aspect-square w-full" />
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-primary/70 shadow-[0_0_30px] shadow-primary/30" />
        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
            Starting camera…
          </div>
        )}
      </div>
      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
