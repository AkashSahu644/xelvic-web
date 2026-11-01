import {
  AtSign,
  AudioLines,
  Briefcase,
  BriefcaseMedical,
  Brush,
  Building2,
  CalendarCheck,
  Camera,
  Code,
  Dumbbell,
  Film,
  Flower2,
  Footprints,
  Gamepad2,
  Globe,
  GraduationCap,
  Home,
  Link2,
  MapPin,
  MessageCircle,
  Music,
  Network,
  Newspaper,
  NotebookPen,
  Palette,
  PersonStanding,
  Pin,
  PlayCircle,
  Send,
  ShoppingBag,
  Smile,
  Sparkles,
  Store,
  ThumbsUp,
  Utensils,
  UtensilsCrossed,
  VenetianMask,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * What a professional profile says it does, and the mark that line wears.
 *
 * Ported from `app/lib/professional.dart`. One table, shared by the form that
 * picks the trade and the profile that shows it, because those two have to
 * agree: the icon somebody chose while editing is the icon that comes back when
 * the page is looked at, and a table living in only one of them is a badge that
 * changes shape between being written and being read.
 *
 * The category is free text as far as the server is concerned — 40 characters it
 * cleans and stores, no list to validate against — so nothing here is a gate.
 * `TRADES` is what the picker offers, the box at the top of that picker is how
 * somebody writes a trade that is not in the list, and `tradeIcon` reads *any*
 * string, including one typed before this table existed.
 *
 * The glyphs are Material's, mapped one for one onto the nearest lucide mark.
 * Where lucide has no counterpart the closest surviving idea is used and named
 * in a comment, rather than dropping the trade from the table.
 */

/** One thing a person can say they do. */
export interface Trade {
  /** The English word the server stores and the table matches on. */
  label: string;
  icon: LucideIcon;
  /**
   * The stems that recognise this trade inside a string that is not exactly
   * `label` — lower case, matched with `includes`, so "photography",
   * "Photographer" and "wedding photographer" all land on the same mark. They
   * are deliberately short and deliberately few: a stem that is a fragment of
   * another trade's word is a badge that lies.
   */
  keys: string[];
}

/**
 * The trades the picker offers, in the order it draws them.
 *
 * Ordered by how often this app's people are likely to be one, not
 * alphabetically: a list this long is read from the top, and an influencer
 * should not have to scroll past a realtor to find themselves.
 */
export const TRADES: Trade[] = [
  { label: "Influencer", icon: Sparkles, keys: ["influenc", "creator", "content"] },
  { label: "Writer", icon: NotebookPen, keys: ["writ", "author", "blog", "poet"] },
  { label: "Photographer", icon: Camera, keys: ["photo", "camera", "shoot"] },
  { label: "Filmmaker", icon: Film, keys: ["film", "video", "director", "cinemat"] },
  { label: "Musician", icon: Music, keys: ["music", "singer", "band", "dj", "producer"] },
  { label: "Artist", icon: Palette, keys: ["art", "paint", "illustrat"] },
  { label: "Designer", icon: Brush, keys: ["design", "graphic", "ux", "ui"] },
  // `face_retouching_natural` — the face a model's badge wears. lucide's nearest
  // is the plain smiling face.
  { label: "Model", icon: Smile, keys: ["model", "fashion"] },
  // `theater_comedy` — the pair of masks. lucide's own mask is the same idea.
  { label: "Actor", icon: VenetianMask, keys: ["act", "theatre", "theater", "drama"] },
  // `directions_walk` and `directions_run` are two figures in Material and there
  // is one in lucide, so the dancer keeps the standing figure and the athlete
  // takes the footprints.
  { label: "Dancer", icon: PersonStanding, keys: ["danc", "choreograph"] },
  {
    label: "Chef",
    icon: Utensils,
    keys: ["chef", "cook", "kitchen", "food", "cafe", "café", "restaurant", "bak"],
  },
  { label: "Coach", icon: Dumbbell, keys: ["coach", "trainer", "fitness", "gym", "yoga", "nutrition"] },
  { label: "Developer", icon: Code, keys: ["dev", "engineer", "programm", "software"] },
  { label: "Journalist", icon: Newspaper, keys: ["journal", "news", "report", "media"] },
  { label: "Streamer", icon: Gamepad2, keys: ["stream", "game", "gamer", "esport"] },
  { label: "Teacher", icon: GraduationCap, keys: ["teach", "tutor", "professor", "school", "institute"] },
  {
    label: "Doctor",
    icon: BriefcaseMedical,
    keys: ["doctor", "clinic", "health", "nurse", "dentist", "therap"],
  },
  { label: "Salon", icon: Flower2, keys: ["salon", "beauty", "makeup", "hair", "spa", "stylist"] },
  { label: "Shop", icon: Store, keys: ["shop", "store", "brand", "retail", "boutique", "label"] },
  {
    // `business_center` is a briefcase in Material, and the briefcase is already
    // the *fallback* mark for a trade this table does not know — so the agency
    // takes the company building instead, which keeps the two apart.
    label: "Agency",
    icon: Building2,
    keys: ["agency", "studio", "consult", "market", "company", "startup"],
  },
  {
    label: "Athlete",
    icon: Footprints,
    keys: ["athlet", "sport", "player", "cricket", "football", "fitness"],
  },
  {
    // `home_work` — a home with an office in it. lucide's plain home is the half
    // of it that says "property".
    label: "Property",
    icon: Home,
    keys: ["property", "realtor", "real estate", "builder", "interior"],
  },
];

/** The trade a written category names, or null when it names none of them. */
export function tradeNamed(category: string | null | undefined): Trade | null {
  const needle = (category ?? "").trim().toLowerCase();
  if (!needle) return null;
  // The label is tried whole first and only then the stems, so "Shop" picked
  // from the list is never read back as something whose stem happens to be
  // inside it.
  for (const trade of TRADES) {
    if (trade.label.toLowerCase() === needle) return trade;
  }
  for (const trade of TRADES) {
    for (const key of trade.keys) {
      if (needle.includes(key)) return trade;
    }
  }
  return null;
}

/**
 * The mark for a written category — and the fallback that makes this total.
 *
 * Nothing is ever drawn without an icon: a trade the table has never heard of
 * gets the work glyph, which says "a trade" and not "a mistake". A category is
 * 40 characters of whatever somebody typed, and the one thing it must not do is
 * leave a hole where a badge should be.
 */
export function tradeIcon(category: string | null | undefined): LucideIcon {
  return tradeNamed(category)?.icon ?? Briefcase;
}

/**
 * The word to draw for a stored category.
 *
 * Only a category that is exactly one of the table's labels is translated: a
 * trade somebody wrote themselves is their own wording and is left alone.
 */
export function tradeWord(category: string | null | undefined, t: (key: string) => string): string {
  const needle = (category ?? "").trim().toLowerCase();
  for (const trade of TRADES) {
    if (trade.label.toLowerCase() === needle) return t(trade.label);
  }
  return (category ?? "").trim();
}

/* ----------------------------------------------------------------- links -- */

/** One place a link can point, and the mark that says so at a glance. */
interface LinkMark {
  /** Matched against the label *and* the address, lower case, with `includes`. */
  key: string;
  icon: LucideIcon;
  /** A shortcut's own word, where the row names itself rather than describing a link. */
  name?: string;
}

const MARKS: LinkMark[] = [
  { key: "instagram", icon: Camera },
  { key: "youtube", icon: PlayCircle },
  { key: "youtu.be", icon: PlayCircle },
  { key: "tiktok", icon: Music },
  { key: "twitter", icon: AtSign },
  { key: "x.com", icon: AtSign },
  { key: "threads", icon: AtSign },
  { key: "facebook", icon: ThumbsUp },
  { key: "linkedin", icon: Briefcase },
  { key: "whatsapp", icon: MessageCircle },
  { key: "wa.me", icon: MessageCircle },
  { key: "telegram", icon: Send },
  { key: "snapchat", icon: Zap },
  { key: "github", icon: Code },
  { key: "spotify", icon: AudioLines },
  { key: "soundcloud", icon: AudioLines },
  { key: "behance", icon: Palette },
  { key: "dribbble", icon: Brush },
  { key: "pinterest", icon: Pin },
  { key: "medium", icon: NotebookPen },
  { key: "substack", icon: AtSign },
  { key: "calendly", icon: CalendarCheck },
  { key: "linktr.ee", icon: Network },
  { key: "maps.app", icon: MapPin },
  { key: "menu", icon: UtensilsCrossed },
  { key: "shop", icon: ShoppingBag },
  { key: "store", icon: ShoppingBag },
  { key: "book", icon: CalendarCheck },
];

/**
 * The mark for a link, read off what it is called and where it goes.
 *
 * Both halves are read, and the label first in effect because they share one
 * haystack: a label is a word somebody chose ("My shop") while a host is what a
 * URL happens to contain, and where the two disagree the typed word is the one
 * that means something.
 */
export function linkIcon(options: { label?: string | null; url?: string | null }): LucideIcon {
  const hay = `${options.label ?? ""} ${options.url ?? ""}`.toLowerCase();
  for (const mark of MARKS) {
    if (hay.includes(mark.key)) return mark.icon;
  }
  return Link2;
}

/**
 * The quick-add row above the link list: the handful of places people actually
 * send people to, each one naming itself.
 *
 * A label here is the *button's* text and the new link's label at once, so
 * adding an Instagram row needs no typing at all — the address is the only thing
 * left, and it is the only thing only they know. The word is fetched through
 * `t()` at the call site because it is drawn *and* stored, and the app stores
 * whichever wording the person saw.
 */
export const LINK_SHORTCUTS: { label: string; icon: LucideIcon }[] = [
  { label: "Instagram", icon: Camera },
  { label: "YouTube", icon: PlayCircle },
  { label: "Website", icon: Globe },
  { label: "Booking", icon: CalendarCheck },
  { label: "Shop", icon: ShoppingBag },
  { label: "Location", icon: MapPin },
];

/**
 * The word on a link button: the label the account typed, or the host of the
 * URL when it left the label blank — a button that has to say something.
 *
 * `linkLabel` in `professional.dart`, used by the profile's icon row and by the
 * edit form's preview, so the mark somebody sees while editing is the mark the
 * page will wear.
 */
export function linkLabel(link: { label?: string | null; url?: string | null }, word: string): string {
  const label = (link.label ?? "").trim();
  if (label) return label;
  const url = (link.url ?? "").trim();
  let host: string;
  try {
    host = new URL(url.includes("://") ? url : `https://${url}`).host;
  } catch {
    host = "";
  }
  return host ? host.replace(/^www\./, "") : word;
}

/** How many links the server keeps. Kept in step with `services.MAX_LINKS`. */
export const MAX_LINKS = 8;
