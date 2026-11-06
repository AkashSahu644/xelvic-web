import { useState } from "react";
import { Bell, Music2, Phone } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import {
  usePreferences,
  type MessageSound,
  type Ringtone,
} from "@/hooks/usePreferences";
import { ChoiceModal, SettingsRow, SettingsRows, SettingsSwitch } from "./parts";

/**
 * The notification choices, given a page of their own.
 *
 * Ported from `app/lib/screens/notification_settings.dart`. They used to sit on
 * the controls page mixed in with the permission rows, which put two different
 * questions on one list — whether the app should interrupt you at all, and
 * whether the phone lets it. The owner's words were *"profile ke andar setting
 * notifications or permission ye sab ek page me do alag setting ke notification
 * and permisstion ka naam ka do usme jaane ke baad ye sab dikhe"*: two rows on
 * the controls page, and the choices behind each.
 *
 * What is behind this one is the switch that decides whether there is anything
 * to hear, and the two sounds of a chat, in the app's order and with the app's
 * words. Three things about it are deliberate:
 *
 *   - **The switch's note flips with the switch.** A row that said "Calls and
 *     convos" over a switch that is off would be the one place this page lies.
 *   - **Turning them on asks the browser.** That is the app's
 *     `if (value) Tray.it.ask()` — the answer may have been no before, and the
 *     only way to hear a yes is to ask. The ask lives on the Permissions page
 *     too, because it is a permission; here it is a consequence of the switch.
 *   - **No full-screen row.** The app draws `_FullScreenRow` only when
 *     `defaultTargetPlatform == TargetPlatform.android`, because Android 14
 *     turned `USE_FULL_SCREEN_INTENT` into a decision only the phone's own
 *     Settings can change. A browser has no such permission and no such page, so
 *     drawing the row here would be a door onto nothing.
 */

const MESSAGE_SOUNDS: { key: MessageSound; name: string }[] = [
  { key: "silent", name: "Silent" },
  { key: "note", name: "Note" },
  { key: "ping", name: "Ping" },
  { key: "pop", name: "Pop" },
  { key: "soft", name: "Soft" },
];

const RINGTONES: { key: Ringtone; name: string }[] = [
  { key: "phone", name: "Phone ringtone" },
  { key: "classic", name: "Classic" },
  { key: "pulse", name: "Pulse" },
  { key: "marimba", name: "Marimba" },
];

export function NotificationsView() {
  const preferences = usePreferences();
  const { t } = preferences;
  const { toast } = useToast();
  const [choice, setChoice] = useState<"sound" | "ringtone" | null>(null);

  const soundName =
    MESSAGE_SOUNDS.find((item) => item.key === preferences.messageSound)?.name ?? "Note";
  const ringtoneName =
    RINGTONES.find((item) => item.key === preferences.ringtone)?.name ?? "Phone ringtone";

  /**
   * Flip the switch, and ask for the browser's answer on the way on.
   *
   * The ask and the switch are two different facts and the page says which is
   * which: a browser that will not give permission leaves the choice switched
   * off and says so, rather than leaving a switch on over a channel that is
   * closed.
   */
  const toggle = async () => {
    if (preferences.notifications) {
      preferences.setNotifications(false);
      return;
    }
    if (typeof Notification === "undefined") {
      preferences.setNotifications(true);
      toast({
        title: "Notifications are on",
        description: "This browser cannot show system notifications. The app's own sounds still play.",
        tone: "info",
      });
      return;
    }
    let answer: NotificationPermission = Notification.permission;
    if (answer === "default") {
      try {
        answer = await Notification.requestPermission();
      } catch {
        answer = Notification.permission;
      }
    }
    if (answer === "granted") {
      preferences.setNotifications(true);
      return;
    }
    preferences.setNotifications(false);
    toast({
      title: "Notifications stay off",
      description:
        answer === "denied"
          ? "This browser has blocked them. Allow notifications for this site to turn them on."
          : "The browser did not give an answer.",
      tone: "error",
    });
  };

  return (
    <div>
      <SettingsRows>
        <SettingsRow
          icon={<Bell className="size-5" />}
          title={t("Notifications")}
          // The app's own note says "Calls and convos", because on a phone a call
          // is one of the two things that can reach you. Calls are not on the web
          // yet, so this says the half that is true here rather than a sentence
          // about a ring this site cannot produce.
          note={
            preferences.notifications
              ? t("New convos, wherever you are in the site.")
              : t("Nothing will interrupt you: no sound, no notification.")
          }
          trailing={
            <SettingsSwitch
              on={preferences.notifications}
              onChange={() => void toggle()}
              label={t("Notifications")}
            />
          }
        />

        {/* The two sounds of a chat, under the switch that decides whether there
            is anything to hear at all. Both are the app's own: the message note
            plays in the app, and the ringtone plays while the app is the thing on
            screen. */}
        <SettingsRow
          icon={<Music2 className="size-5" />}
          title={t("Message sound")}
          value={t(soundName)}
          note={
            preferences.messageSound === "silent"
              ? t("No sound when a line arrives or leaves while you are in the app.")
              : t("The note a line makes while you are in the app.")
          }
          onClick={() => setChoice("sound")}
        />
        <SettingsRow
          icon={<Phone className="size-5" />}
          title={t("Ringtone")}
          value={t(ringtoneName)}
          note={t("Saved for calls. Calls are not on the web yet, so nothing rings on this site.")}
          onClick={() => setChoice("ringtone")}
        />
      </SettingsRows>

      {/* Where the sound stops, said plainly.
          The phone's page needs no note, because the phone handles the half of
          a notification that happens when nobody is looking. A browser cannot:
          this build has no push address — the server rings a pocket through
          Firebase, to the tokens the phone app registers, and this site has no
          such token — so once the tab is closed there is nothing to hear. Saying
          that is the honest half of the answer, and the alternative is a page
          that implies a sound it cannot produce. */}
      <p className="px-4 py-3 text-[12px] leading-[1.4] text-dim">
        {t(
          "While this site is open in a tab — even one you are looking away from — a new line shows a notification of its own and plays the sound above. Once the site is closed nothing arrives: the server pushes to the phone app's own address, and this site does not have one.",
        )}
      </p>

      <ChoiceModal
        open={choice === "sound"}
        title={t("Message sound")}
        options={MESSAGE_SOUNDS.map((item) => ({
          ...item,
          name: t(item.name),
          kind: item.key === "silent" ? ("silent" as const) : ("note" as const),
        }))}
        value={preferences.messageSound}
        onSelect={(value) => {
          preferences.setMessageSound(value);
          // The tone plays on the way out: a tone's name is not the tone, and a
          // choice made without hearing it is a choice made twice. Silent is a
          // choice with nothing to hear, which is why it is the one that does
          // not play — the app's `if (picked != MessageSound.silent)`.
          if (value !== "silent") preferences.playMessageSound(value);
        }}
        onClose={() => setChoice(null)}
      />

      <ChoiceModal
        open={choice === "ringtone"}
        title={t("Ringtone")}
        note={t("While you are in the app.")}
        options={RINGTONES.map((item) => ({
          ...item,
          name: t(item.name),
          kind: "ring" as const,
        }))}
        value={preferences.ringtone}
        // The ring is not played here, and that is the app's behaviour rather
        // than an omission: `_pickCallSound` stores the choice and returns, while
        // `_pickMessageSound` plays. A ringtone is a minute long and this sheet
        // is not a preview.
        onSelect={(value) => preferences.setRingtone(value)}
        onClose={() => setChoice(null)}
      />
    </div>
  );
}
