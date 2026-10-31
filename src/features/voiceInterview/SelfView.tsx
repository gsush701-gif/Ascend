import { useEffect, useRef } from "react";

/** Mirrored, muted preview of the candidate's own camera stream. */
export function SelfView({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      // Autoplay of a muted local stream is allowed everywhere that matters;
      // if it's refused the tile just stays on its first frame.
    });
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      autoPlay
      aria-label="Your camera preview"
      className="h-24 w-32 rounded-xl border border-slate-200 bg-slate-900 object-cover shadow-sm [transform:scaleX(-1)]"
    />
  );
}
