import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PreferencesContext } from "@/context/preferences";
import { STORAGE_KEYS } from "@/constants/storage";

export type AppLanguage = "system" | "en" | "hi" | "ar";
export type MessageSound = "silent" | "note" | "ping" | "pop" | "soft";
export type Ringtone = "phone" | "classic" | "pulse" | "marimba";

export interface Preferences {
  language: AppLanguage;
  notifications: boolean;
  messageSound: MessageSound;
  ringtone: Ringtone;
  logo: string;
}

export interface PreferencesContextValue extends Preferences {
  setLanguage: (value: AppLanguage) => void;
  setNotifications: (value: boolean) => void;
  setMessageSound: (value: MessageSound) => void;
  setRingtone: (value: Ringtone) => void;
  setLogo: (value: string) => void;
  playMessageSound: (value?: MessageSound) => void;
  playRingtone: (value?: Ringtone) => void;
  t: (key: string) => string;
}

const STORAGE_KEY = STORAGE_KEYS.preferences;

const defaults: Preferences = {
  language: "system",
  notifications: true,
  messageSound: "note",
  ringtone: "phone",
  logo: "pink",
};

const hindi: Record<string, string> = {
  "Controls": "कंट्रोल्स",
  "This phone": "यह फ़ोन",
  "Privacy": "प्राइवेसी",
  "Professional": "प्रोफेशनल",
  "How you look": "आप कैसे दिखते हैं",
  "Account": "अकाउंट",
  "Owner tools": "ओनर टूल्स",
  "Language": "भाषा",
  "Notifications": "नोटिफिकेशन",
  "Permissions": "अनुमतियाँ",
  "Private profile": "प्राइवेट प्रोफाइल",
  "Show my crew count": "मेरा क्रू काउंट दिखाएँ",
  "Show my sparks": "मेरे स्पार्क्स दिखाएँ",
  "Show my birthday": "मेरा बर्थडे दिखाएँ",
  "Lock chat": "चैट लॉक करें",
  "Allow sensitive content": "सेंसिटिव कॉन्टेंट की अनुमति दें",
  "Professional profile": "प्रोफेशनल प्रोफाइल",
  "Marketplace": "मार्केटप्लेस",
  "App logo": "ऐप लोगो",
  "Profile": "प्रोफाइल",
  "Get verified": "वेरिफाई कराएँ",
  "Kept": "कीप किए गए",
  "Saved": "सेव किए गए",
  "Felt & responded": "फेल्ट और रिस्पॉन्ड",
  "Wallet": "वॉलेट",
  "Where you are signed in": "आप कहाँ साइन इन हैं",
  "Log out": "लॉग आउट",
  "Delete account": "अकाउंट डिलीट करें",
  "Console": "कंसोल",
  "App language": "ऐप की भाषा",
  "System default": "सिस्टम डिफ़ॉल्ट",
  "Follow the phone": "फ़ोन की भाषा",
  "English": "अंग्रेज़ी",
  "Hindi": "हिन्दी",
  "Arabic": "अरबी",
  "Back": "वापस",
  "Save": "सेव करें",
  "Saving...": "सेव हो रहा है...",
  "Loading...": "लोड हो रहा है...",
  "Message sound": "मैसेज की आवाज़",
  "Ringtone": "रिंगटोन",
  "Calls over the lock screen": "लॉक स्क्रीन पर कॉल",
  "Silent": "साइलेंट",
  "Note": "नोट",
  "Ping": "पिंग",
  "Pop": "पॉप",
  "Soft": "सॉफ्ट",
  "Phone ringtone": "फ़ोन रिंगटोन",
  "Classic": "क्लासिक",
  "Pulse": "पल्स",
  "Marimba": "मरिम्बा",
  "Allowed": "अनुमति है",
  "Not asked": "नहीं पूछा",
  "Blocked": "ब्लॉक है",
  "Not available": "उपलब्ध नहीं",
  "Camera": "कैमरा",
  "Microphone": "माइक्रोफ़ोन",
  "Photos and media": "फ़ोटो और मीडिया",
  "Contacts": "कॉन्टैक्ट्स",
  "Location": "लोकेशन",
  "Bluetooth": "ब्लूटूथ",
  "This device": "यह डिवाइस",
  "Remove": "हटाएँ",
  "Sign out everywhere else": "बाकी जगहों से साइन आउट करें",
  "Reset password now": "अभी पासवर्ड रीसेट करें",
  "Verify": "वेरिफाई",
  "Submit request": "रिक्वेस्ट भेजें",
  "Cancel": "कैंसिल",
  "Delete": "डिलीट करें",
  "Profile saved": "प्रोफाइल सेव हो गया",
  "Name": "नाम",
  "Handle": "हैंडल",
  "Era": "ईरा",
  "Change photo": "फ़ोटो बदलें",
  "Change cover": "कवर बदलें",
};

const arabic: Record<string, string> = {
  "Controls": "الإعدادات",
  "This phone": "هذا الهاتف",
  "Privacy": "الخصوصية",
  "Professional": "احترافي",
  "How you look": "كيف تبدو",
  "Account": "الحساب",
  "Owner tools": "أدوات المالك",
  "Language": "اللغة",
  "Notifications": "الإشعارات",
  "Permissions": "الأذونات",
  "Private profile": "ملف خاص",
  "Show my crew count": "إظهار عدد أصدقائي",
  "Show my sparks": "إظهار شراري",
  "Show my birthday": "إظهار عيد ميلادي",
  "Lock chat": "قفل المحادثة",
  "Allow sensitive content": "السماح بالمحتوى الحساس",
  "Professional profile": "ملف احترافي",
  "Marketplace": "المتجر",
  "App logo": "شعار التطبيق",
  "Profile": "الملف الشخصي",
  "Get verified": "اطلب التوثيق",
  "Kept": "المحفوظون",
  "Saved": "المحفوظات",
  "Felt & responded": "التفاعلات",
  "Wallet": "المحفظة",
  "Where you are signed in": "أين سجلت الدخول",
  "Log out": "تسجيل الخروج",
  "Delete account": "حذف الحساب",
  "Console": "لوحة التحكم",
  "App language": "لغة التطبيق",
  "System default": "لغة النظام",
  "Follow the phone": "حسب الهاتف",
  "English": "الإنجليزية",
  "Hindi": "الهندية",
  "Arabic": "العربية",
  "Back": "رجوع",
  "Save": "حفظ",
  "Message sound": "صوت الرسالة",
  "Ringtone": "نغمة الرنين",
  "Silent": "صامت",
  "Note": "نغمة",
  "Ping": "بينغ",
  "Pop": "بوب",
  "Soft": "هادئ",
  "Phone ringtone": "رنين الهاتف",
  "Classic": "كلاسيكي",
  "Pulse": "نبض",
  "Marimba": "ماريمبا",
  "Allowed": "مسموح",
  "Not asked": "لم يُطلب",
  "Blocked": "محجوب",
  "Not available": "غير متاح",
  "Camera": "الكاميرا",
  "Microphone": "الميكروفون",
  "Photos and media": "الصور والوسائط",
  "Contacts": "جهات الاتصال",
  "Location": "الموقع",
  "Bluetooth": "البلوتوث",
  "This device": "هذا الجهاز",
  "Remove": "إزالة",
  "Sign out everywhere else": "تسجيل الخروج من الباقي",
  "Reset password now": "إعادة تعيين كلمة المرور",
  "Cancel": "إلغاء",
  "Delete": "حذف",
  "Name": "الاسم",
  "Handle": "المعرّف",
  "Era": "النبذة",
  "Change photo": "تغيير الصورة",
  "Change cover": "تغيير الغلاف",
};

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      language: parsed.language === "en" || parsed.language === "hi" || parsed.language === "ar" ? parsed.language : "system",
      notifications: parsed.notifications !== false,
      messageSound: ["silent", "note", "ping", "pop", "soft"].includes(String(parsed.messageSound)) ? parsed.messageSound as MessageSound : defaults.messageSound,
      ringtone: ["phone", "classic", "pulse", "marimba"].includes(String(parsed.ringtone)) ? parsed.ringtone as Ringtone : defaults.ringtone,
      logo: typeof parsed.logo === "string" && parsed.logo ? parsed.logo : defaults.logo,
    };
  } catch {
    return defaults;
  }
}

function resolvedLanguage(language: AppLanguage) {
  if (language !== "system") return language;
  const code = typeof navigator === "undefined" ? "en" : navigator.language.slice(0, 2).toLowerCase();
  return code === "hi" || code === "ar" ? code : "en";
}

function tone(context: AudioContext, frequency: number, start: number, duration: number, volume = 0.05, type: OscillatorType = "sine") {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
  gain.gain.setValueAtTime(0.0001, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration + 0.02);
}

function playPattern(kind: MessageSound | Ringtone) {
  if (kind === "silent" || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  void context.resume().catch(() => undefined);
  const start = 0;
  if (kind === "note") tone(context, 880, start, 0.22, 0.045);
  else if (kind === "ping") {
    tone(context, 1046.5, start, 0.14, 0.04);
    tone(context, 1318.5, start + 0.11, 0.2, 0.04);
  } else if (kind === "pop") {
    tone(context, 392, start, 0.07, 0.06, "triangle");
    tone(context, 523.25, start + 0.055, 0.09, 0.035, "triangle");
  } else if (kind === "soft") {
    tone(context, 523.25, start, 0.25, 0.03);
    tone(context, 659.25, start + 0.09, 0.28, 0.03);
  } else if (kind === "phone") {
    [0, 0.36].forEach((offset) => {
      tone(context, 440, start + offset, 0.22, 0.045, "square");
      tone(context, 480, start + offset, 0.22, 0.035, "square");
    });
  } else if (kind === "classic") {
    [660, 880, 660].forEach((frequency, index) => tone(context, frequency, start + index * 0.2, 0.2, 0.035, "triangle"));
  } else if (kind === "pulse") {
    [0, 0.22, 0.44].forEach((offset) => tone(context, 740, start + offset, 0.14, 0.035));
  } else if (kind === "marimba") {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(context, frequency, start + index * 0.13, 0.2, 0.035, "triangle"));
  }
  window.setTimeout(() => void context.close().catch(() => undefined), 1800);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Storage is optional.
    }
    const language = resolvedLanguage(preferences.language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href = `/logos/${preferences.logo || "pink"}.webp`;
  }, [preferences]);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const setLanguage = useCallback((value: AppLanguage) => update("language", value), [update]);
  const setNotifications = useCallback((value: boolean) => update("notifications", value), [update]);
  const setMessageSound = useCallback((value: MessageSound) => update("messageSound", value), [update]);
  const setRingtone = useCallback((value: Ringtone) => update("ringtone", value), [update]);
  const setLogo = useCallback((value: string) => update("logo", value), [update]);

  const playMessageSound = useCallback((value?: MessageSound) => playPattern(value ?? preferencesRef.current.messageSound), []);
  const playRingtone = useCallback((value?: Ringtone) => playPattern(value ?? preferencesRef.current.ringtone), []);

  const t = useCallback((key: string) => {
    const language = resolvedLanguage(preferencesRef.current.language);
    if (language === "hi") return hindi[key] ?? key;
    if (language === "ar") return arabic[key] ?? key;
    return key;
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      setLanguage,
      setNotifications,
      setMessageSound,
      setRingtone,
      setLogo,
      playMessageSound,
      playRingtone,
      t,
    }),
    [preferences, setLanguage, setNotifications, setMessageSound, setRingtone, setLogo, playMessageSound, playRingtone, t],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

