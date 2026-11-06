import { Check, Languages, Smartphone } from "lucide-react";
import { SettingsRow, SettingsRows } from "@/features/settings/parts";
import { usePreferences, type AppLanguage } from "@/hooks/usePreferences";

/**
 * The language the app speaks.
 *
 * Ported from `app/lib/screens/language_screen.dart`. Every word on this page is
 * a constant, so nothing is fetched and nothing can fail: a tap is a repaint, in
 * airplane mode as much as on Wi-Fi. The chosen row is marked and the page stays
 * where it is, because the page is also the proof — it is redrawn in the
 * language just picked, and the person can see what they chose before they
 * leave.
 *
 * Two things here are deliberately not what the rest of this settings app does:
 *
 *   - **No confirmation.** The app's `Languages.it.set` stores the choice and
 *     repaints; there is no `say(...)` on the way out, and `Str.languageChanged`
 *     — the string that would have said so — is defined in all three tables and
 *     referenced nowhere in the app. Announcing a change the person is watching
 *     happen on the same frame is a toast about nothing.
 *   - **A check, not a word.** The chosen row carries the app's `Icons.check_rounded`
 *     in the accent, and that mark is also why it has no chevron: the shared row
 *     rule draws a chevron on a row that goes somewhere only while nothing is
 *     already drawn after the label, so the three unchosen rows keep theirs and
 *     the chosen one shows its answer instead.
 *
 * Each language is written in its own script with nothing beside it. A person
 * looking for their language looks for the shape of it; "हिन्दी" is found by
 * somebody who reads Hindi, and "Hindi" is only found by somebody who reads
 * English — who is not the one who needs this page. Only the system row, which
 * is a word the app itself says, comes from the translation table.
 */

/**
 * The four choices in the app's order, with the two words that are *not*
 * translated: a named language keeps the spelling its own script uses.
 */
const CHOICES: { key: AppLanguage; label: string }[] = [
  { key: "system", label: "System default" },
  { key: "en", label: "English" },
  { key: "hi", label: "हिन्दी" },
  { key: "ar", label: "العربية" },
];

export function LanguageView() {
  const preferences = usePreferences();
  const { t } = preferences;

  return (
    <div>
      <p className="px-[18px] pb-1 pt-2 text-[13px] leading-[1.4] text-dim">
        {t(
          "Changes the words in the app. Your messages, names and posts stay exactly as they are.",
        )}
      </p>

      <div className="pt-2">
        <SettingsRows>
          {CHOICES.map((choice) => (
            <SettingsRow
              key={choice.key}
              icon={
                choice.key === "system" ? (
                  <Smartphone className="size-5" />
                ) : (
                  <Languages className="size-5" />
                )
              }
              title={choice.key === "system" ? t(choice.label) : choice.label}
              note={choice.key === "system" ? t("Follow the phone") : undefined}
              trailing={
                preferences.language === choice.key ? (
                  <Check className="size-[21px] shrink-0 text-accent" aria-hidden />
                ) : undefined
              }
              onClick={() => preferences.setLanguage(choice.key)}
            />
          ))}
        </SettingsRows>
      </div>
    </div>
  );
}
