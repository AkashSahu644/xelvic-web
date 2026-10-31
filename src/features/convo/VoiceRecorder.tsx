import { useRef, useState, useEffect, useCallback } from "react";
import { Mic, X, Lock, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";

interface VoiceRecorderProps {
  onVoiceRecorded: (file: File) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onVoiceRecorded, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "locked">("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showCancel, setShowCancel] = useState(false);
  const [showLock, setShowLock] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const micButtonRef = useRef<HTMLButtonElement>(null);

  const resetRecording = useCallback(() => {
    setState("idle");
    setRecordSeconds(0);
    setDragOffset({ x: 0, y: 0 });
    setShowCancel(false);
    setShowLock(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("This browser cannot record a voice note");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = media;
      const recorder = new MediaRecorder(media);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        onVoiceRecorded(file);
        resetRecording();
      };
      recorder.start();
      setState("recording");
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access was not given. Allow the microphone to record a voice note.");
    }
  }, [onVoiceRecorded, resetRecording]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startXRef.current = clientX;
    startYRef.current = clientY;
    startRecording();
  }, [startRecording]);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (state !== "recording" && state !== "locked") return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startYRef.current - clientY;
    const deltaX = clientX - startXRef.current;
    setDragOffset({ x: deltaX, y: deltaY });
    setShowCancel(deltaX > 60);
    setShowLock(deltaY > 60);
  }, [state]);

  const handleMouseUp = useCallback(() => {
    if (state === "recording") {
      if (showCancel) {
        onCancel();
        resetRecording();
      } else if (showLock) {
        setState("locked");
        setShowLock(false);
        setDragOffset({ x: 0, y: 0 });
      } else {
        stopRecording();
      }
    } else if (state === "locked") {
      stopRecording();
    }
    setShowCancel(false);
    setShowLock(false);
  }, [state, showCancel, showLock, stopRecording, onCancel, resetRecording]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (state === "idle") return null;

  const isLocked = state === "locked";
  const timerText = duration(recordSeconds);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-sm mx-4">
        <div className="flex flex-col items-center gap-4 bg-card rounded-[24px] p-6 shadow-2xl border border-line">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-[var(--accent-soft)] animate-pulse" style={{ animationDuration: "1.5s" }} />
            <div className="absolute inset-0 rounded-full bg-[var(--accent-soft)] animate-pulse" style={{ animationDuration: "1.5s", animationDelay: "0.75s" }} />
            <button
              ref={micButtonRef}
              type="button"
              className={cn(
                "relative w-full h-full rounded-full flex items-center justify-center transition-transform duration-100",
                "bg-accent text-on-accent shadow-[0_8px_30px_color-mix(in_srgb,var(--accent)_40%,transparent)]",
                isLocked && "scale-110",
                showCancel && "opacity-50",
                showLock && "ring-4 ring-[var(--good)]"
              )}
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
              style={{ transform: `translate(${dragOffset.x}px, ${-dragOffset.y}px)` }}
            >
              <Mic className="size-8" />
            </button>
            {showCancel && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 flex items-center gap-2 text-white/90">
                <X className="size-5" />
                <span className="text-[11px] font-bold whitespace-nowrap">Slide to cancel</span>
              </div>
            )}
            {showLock && (
              <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-16 flex items-center gap-2 text-white/90">
                <span className="text-[11px] font-bold whitespace-nowrap">Slide up to lock</span>
                <Lock className="size-5" />
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="num text-[11px] font-bold text-dim">{timerText}</p>
            {isLocked ? (
              <p className="mt-1 text-[12px] font-semibold text-[var(--good)]">Recording locked · Tap to finish</p>
            ) : state === "recording" ? (
              <p className="mt-1 text-[12px] font-semibold text-accent">Hold to record · Slide up to lock, left to cancel</p>
            ) : null}
          </div>

          {isLocked && (
            <button
              type="button"
              onClick={stopRecording}
              className="mt-2 w-full rounded-full bg-[var(--bad)] px-6 py-3 text-base font-extrabold text-white shadow-[0_4px_16px_color-mix(in_srgb,var(--bad)_40%,transparent)]"
            >
              <Send className="size-4 mr-2" /> Finish & Send
            </button>
          )}
        </div>

        <div className="mt-3 text-center text-[11px] text-dim">
          {isLocked ? "Tap the button to finish and send" : "Hold the mic button to record"}
        </div>
      </div>
    </div>
  );
}