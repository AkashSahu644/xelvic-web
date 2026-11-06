import { useEffect, useRef } from "react";
import { cn } from "@/utils/cn";

/**
 * The two elements a stream needs, in one place.
 *
 * A stream is not a picture or a sound: it is whatever the far end is sending,
 * and the same object may be a camera today and a voice alone tomorrow. Both
 * of these attach it the moment it arrives and let go of it on the way out, so
 * a tile that is replaced or a call that ends does not leave an element
 * holding a live stream — which is a camera light that stays on after the call
 * is over.
 */

/** One person's picture, attached the moment it arrives. */
export function VideoSurface({
  stream,
  className,
  muted,
  mirror,
  onShape,
  onElement,
  onBlocked,
}: {
  stream: MediaStream;
  className?: string;
  muted?: boolean;
  mirror?: boolean;
  /** The picture's own height over width, once the browser knows it. */
  onShape?: (tall: number) => void;
  /**
   * The element itself, for the one thing that cannot be done to it from
   * outside: a picture drawn in the corner of somebody's screen while they look
   * at something else. `null` on the way out, so nothing holds a video element
   * that has been taken off the page.
   */
  onElement?: (element: HTMLVideoElement | null) => void;
  /** A picture with a voice in it can be refused too. See [AudioSurface]. */
  onBlocked?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // The shape's reader changes on every render of the screen that draws this,
  // and keeping it in a ref is what lets the effect below attach the stream
  // once rather than on each of those renders — re-attaching a live stream is
  // a picture that flickers black for a frame.
  const shape = useRef(onShape);
  useEffect(() => {
    shape.current = onShape;
  }, [onShape]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    onElement?.(element);
    // A play() a browser refuses is a picture that stays black, not an error
    // worth putting in front of somebody who is already on a call.
    void element.play().catch(() => onBlocked?.());
    // A track can be replaced under a picture that is already playing — a
    // camera for a shared screen, mid-call — and the element is then a
    // different shape without being a different stream. `resize` is the only
    // event that says so; `loadedmetadata` never fires a second time.
    const measure = () => {
      const ask = shape.current;
      if (!ask || !element.videoWidth || !element.videoHeight) return;
      ask(element.videoHeight / element.videoWidth);
    };
    element.addEventListener("resize", measure);
    return () => {
      element.removeEventListener("resize", measure);
      element.srcObject = null;
      onElement?.(null);
    };
  }, [stream, onElement, onBlocked]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      onLoadedMetadata={(event) => {
        const picture = event.currentTarget;
        if (!onShape || !picture.videoWidth || !picture.videoHeight) return;
        onShape(picture.videoHeight / picture.videoWidth);
      }}
      className={cn(className, mirror && "-scale-x-100")}
    />
  );
}

/**
 * One person's voice, for a tile that has no picture to give it to.
 *
 * A browser may refuse to start a sound that no press asked for, and a room
 * somebody walked into by opening a page is exactly that shape. The refusal is
 * reported rather than swallowed: a listener looking at "Hearing the room"
 * while hearing nothing has been told something untrue, and the fix — one press
 * — is the caller's to offer.
 */
export function AudioSurface({
  stream,
  onBlocked,
}: {
  stream: MediaStream | null;
  onBlocked?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    if (stream) void element.play().catch(() => onBlocked?.());
    return () => {
      element.srcObject = null;
    };
  }, [stream, onBlocked]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

/**
 * Ask every sound and picture inside a container to start.
 *
 * Called from a press, which is the only thing a browser accepts as an answer
 * to "may I play this". Returns whether they all started, so a caller can say
 * so instead of clearing a warning it has not earned.
 */
export async function playInside(container: HTMLElement | null): Promise<boolean> {
  if (!container) return true;
  const media = container.querySelectorAll<HTMLMediaElement>("audio, video");
  const answers = await Promise.all(
    [...media].map((element) =>
      element.play().then(
        () => true,
        () => false,
      ),
    ),
  );
  return answers.every(Boolean);
}
