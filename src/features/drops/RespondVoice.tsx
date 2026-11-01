import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";

/**
 * Recording the voice note a respond carries.
 *
 * The app records one where the composer is (`recordVoice` in
 * `screens/drop_sheets.dart`), because a response's upload is made here rather
 * than picked off the phone. A browser cannot hold a recording inside a form
 * field, so the same act gets a small sheet of its own: start, watch the
 * seconds, stop — and what comes out is the file the upload route already takes.
 *
 * Nothing is sent from here. `onRecorded` hands the file back and the composer
 * uploads it the same way it uploads a picture, so the one failing step (the
 * upload) reports in the one place the composer already reports to.
 */
export function RespondVoice({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  onRecorded: (file: File) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [trouble, setTrouble] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordedRef = useRef<((file: File) => void) | null>(null);

  function teardown() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setSeconds(0);
  }

  // Closing the sheet — by the cross, by Escape, or by the parent — stops the
  // microphone. A stream left running is a browser still saying the mic is in
  // use after the sheet is gone.
  useEffect(() => {
    if (open) {
      setTrouble(null);
      return;
    }
    // `teardown` reads refs only; it is safe to run when the sheet closes.
    teardown();
  }, [open]);

  useEffect(() => () => teardown(), []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setTrouble("This browser cannot record a voice note.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        const hand = recordedRef.current;
        teardown();
        if (hand && blob.size) hand(file);
      };
      recordedRef.current = onRecorded;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      // A refusal here is the browser's (no microphone, or a door not opened);
      // it is said in the sheet rather than thrown away, because the reader is
      // standing in front of the button that just did nothing.
      setTrouble("The microphone could not be reached.");
    }
  }

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Voice note" size="sm">
      <div className="flex flex-col items-center gap-4 px-5 py-6">
        <button
          type="button"
          onClick={() => (recording ? stop() : void start())}
          className={cn(
            "flex size-20 items-center justify-center rounded-full text-on-accent transition",
            recording ? "bg-[var(--bad)]" : "bg-accent",
          )}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}
        </button>
        <p className="num text-[13px] font-bold text-dim">{duration(seconds)}</p>
        <p className="text-center text-[12px] leading-5 text-dim">
          {trouble ?? (recording ? "Recording. Stop when you have said it." : "Start, say what you mean, then stop.")}
        </p>
        {recording ? (
          <button type="button" onClick={stop} className="btn btn-primary w-full">
            Finish
          </button>
        ) : null}
      </div>
    </Modal>
  );
}