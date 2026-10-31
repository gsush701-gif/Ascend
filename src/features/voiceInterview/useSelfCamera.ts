import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Optional self-view for the voice interview — the candidate's own camera,
 * shown only to them so they can practise eye contact and posture. Off by
 * default and requested only when the user clicks "Show my camera".
 *
 * Privacy: video only (no microphone — speech recognition asks for that
 * separately), rendered into a local <video> element, and never recorded,
 * uploaded or sent anywhere. Tracks are stopped when the user turns it off,
 * the interview ends, or the page unmounts, so the camera light goes out.
 */
export function useSelfCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open a camera.");
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = media;
      setStream(media);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera access was blocked. Allow it in your browser's address bar to use self-view."
          : name === "NotFoundError"
            ? "No camera was found on this device."
            : "Couldn't start the camera.",
      );
    } finally {
      setStarting(false);
    }
  }, []);

  // Release the camera on unmount.
  useEffect(() => stop, [stop]);

  return { stream, error, starting, start, stop };
}
