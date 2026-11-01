export type ID = string;

export interface Page<T> {
  results: T[];
  next: string | null;
  previous?: string | null;
}

/**
 * The server's one error envelope — `apps/common/errors.handler`.
 *
 * `error.fields` is a DRF serializer's own errors, one entry per field, and a
 * field can fail more than one rule at once: `{"links": ["Ensure this field has
 * no more than 5 elements."]}`. So each value is a string *or* a list of them,
 * and a reader that wants a sentence has to be ready for both.
 *
 * `detail` is here because not every refusal goes through that handler: a view
 * that builds its own `Response({"detail": ...}, 400)` — the verify app does,
 * for a rule its service raises — answers with the bare key and no envelope at
 * all. It is the same sentence the app reads off its own client, so it is read
 * here rather than thrown away for arriving in a different wrapper.
 */
export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string | string[]>;
  };
  detail?: string;
}

export interface ThemeRef {
  key: string;
  name?: string;
}

export interface UserCard {
  id: ID;
  username: string;
  name: string;
  avatar: string | null;
  cover?: string | null;
  initials: string;
  online?: boolean;
  is_private?: boolean;
  last_seen?: string | null;
  theme?: string | null;
  verified?: boolean;
}

export interface Me extends UserCard {
  phone?: string | null;
  email?: string | null;
  dob?: string | null;
  verified_via?: string | null;
  verified_target?: string | null;
  bio?: string | null;
  show_crew?: boolean;
  show_dob?: boolean;
  show_sparks?: boolean;
  allow_sensitive?: boolean;
  contacts_allowed?: boolean;
  contacts_asked?: boolean;
  posts_count?: number;
  followers_count?: number;
  following_count?: number;
  is_staff?: boolean;
  date_joined?: string;
  logo?: string | null;
  /**
   * Whether the account wears the Professional hat.
   *
   * Turned on and off through `POST /deals/mode/` — `is_company` is read-only on
   * the account for exactly that reason — and read here to decide whether the
   * Deals row and the *Edit professional profile* row are drawn at all.
   */
  is_company?: boolean;
  /**
   * When the @handle may next be changed, as an ISO string — null while it is
   * free.
   *
   * A handle moves once every thirty days, and the date the window reopens is
   * worked out on the server (`apps.accounts.services.username_next_change_at`)
   * because the app knows the handle but not when it last moved. A date already
   * in the past reads as free, which is the rule the server holds too.
   */
  username_next_change_at?: string | null;
  /**
   * The professional block, as four flat fields and not a nested object.
   *
   * `MeSerializer` lists `category`, `address`, `contact_email` and `links`
   * directly on the account — see its `Meta.fields` — so there is no
   * `professional` key on the wire to read, and no `work` / `place` / `email`
   * on it either. They arrive together or not at all, because all four are only
   * ever written through `PATCH /auth/me/professional/`, which is refused for
   * an account not wearing the hat. Read-only *here* and for that reason: the
   * serializer carries them in `read_only_fields`, so patching "me" cannot set
   * them.
   */
  category?: string | null;
  address?: string | null;
  contact_email?: string | null;
  /** `[{label, url}]`, in the order the profile draws them. Capped at 8. */
  links?: { label?: string | null; url?: string | null }[] | null;
  country?: string | null;
  verified_at?: string | null;
  /**
   * The figure this account wears, as a Drip key — `""` when none is chosen.
   *
   * `MeSerializer.character` and `ProfileSerializer.character` both carry it
   * through `WornGate`, so a profile and the chat behind it cannot disagree
   * about who is standing there. Read on the profile so the bio is said by the
   * right figure; null is not the same as empty — a payload that has not
   * answered leaves the theme's own figure to stand in.
   */
  character?: string | null;
  /** `MM-DD`, or empty unless today is the day. See `services.birthday_month_day`. */
  birthday?: string | null;
}

export interface ChatGate {
  mode?: string;
  can_type?: boolean;
  can_send?: boolean;
  text_only?: boolean;
  can_call?: boolean;
  title?: string;
  body?: string;
  text?: string;
  label?: string;
  cta?: string | null;
  action?: string | null;
  icon?: string | null;
  [key: string]: unknown;
}

export interface Profile extends UserCard {
  bio?: string | null;
  dob?: string | null;
  posts_count?: number | null;
  followers_count?: number | null;
  following_count?: number | null;
  relation?: Relation;
  gate?: ChatGate | null;
  cta?: string | null;
  crew?: UserCard[];
  /** A few of the faces we share, with `mutuals_count` the whole number. */
  mutuals?: UserCard[];
  /**
   * How many friends the reader and this account share.
   *
   * Null when there is no reader, and when it is the account looking at itself:
   * a person shares no friends "in common" with themselves, and the page draws
   * no mutual strip there. See `accounts.serializers.ProfileSerializer`.
   */
  mutuals_count?: number | null;
  professional?: Record<string, unknown>;
  /** `MM-DD` on the day itself, the same field the card carries. */
  birthday?: string | null;
  /** The Drip key this account wears. See `WornGate`. */
  character?: string | null;
  /** Whether the owner's figure stands beside their bio — their switch, not mine. */
  show_character?: boolean;
  /** Whether this account's things — drops, vibes, sounds, memories — are mine to read. */
  can_view?: boolean;
  /** The live sum of every spark alive right now. Null when hidden from me. */
  sparks_count?: number | null;
  /** The professional block. See `Me` for the same four fields. */
  is_company?: boolean;
  category?: string | null;
  address?: string | null;
  contact_email?: string | null;
  links?: { label?: string | null; url?: string | null }[] | null;
}

export interface Relation {
  self?: boolean;
  follow_state?: string;
  chat_state?: string;
  following?: boolean;
  follows_me?: boolean;
  blocked_by_me?: boolean;
  blocked_me?: boolean;
  follows_you?: boolean;
  requested?: boolean;
  blocked?: boolean;
  muted?: boolean;
  can_message?: boolean;
  [key: string]: boolean | string | undefined;
}

export interface Asset {
  id: ID;
  upload_id?: string;
  kind: "image" | "video" | "voice" | "audio" | "doc" | string;
  mime?: string;
  size?: number;
  original_name?: string;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  waveform?: number[] | null;
  quality?: string | null;
  available?: boolean;
  available_until?: string | null;
  content_url: string | null;
  thumbnail_url?: string | null;
}

export interface CollabBadge {
  people?: UserCard[];
  count?: number;
  state?: string;
  [key: string]: unknown;
}

export interface Drop {
  id: ID;
  author: UserCard;
  /**
   * What the row *is* — the server's own vocabulary, not its labels.
   *
   * `Drop.Kind` (`apps/drops/models.py`) is `text`, `image`, `video`, `audio`,
   * `poll`; the words beside them in that class ("Note", "Photo", "Clip") are
   * what a console column reads, and this used to carry two of those instead of
   * the values. `VibeSerializer.get_kind` answers `vibe`, which is the one value
   * that is not a column — a vibe is its own table and the app is told which
   * screen the payload came from rather than working it out from its shape.
   */
  kind: "text" | "image" | "video" | "audio" | "poll" | "vibe" | string;
  body: string;
  asset: Asset | null;
  /**
   * The ordered run of a picture drop's uploads.
   *
   * `get_gallery` answers `[]` for anything with fewer than two, so a non-empty
   * list is the whole test for "this pages" — the app's `isGallery` is
   * `media.length > 1` over a list that falls back to `[asset]`.
   */
  gallery?: Asset[] | null;
  ratio?: number;
  place?: string;
  tag?: string;
  poll?: Poll | null;
  created_at: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  liked: boolean;
  saved: boolean;
  mine: boolean;
  peek?: Comment | null;
  collab?: CollabBadge | null;
  views?: number;
  music?: string;
  clip_urls?: Record<string, { content_url: string; thumbnail_url: string | null }>;
  /**
   * A sound's artwork.
   *
   * A sound's own asset *is* the audio, so the picture on its square is a second
   * upload and never the first: `Drop.still` in the app is `isSound ? cover :
   * asset`, and a shelf handed an mp3 to draw puts a blank where a cover should
   * be. Null is honest — a sound with no cover has a mark in the middle of the
   * tile instead.
   */
  cover?: Asset | null;
  /** A sound's own name. */
  title?: string;
  sound_kind?: string | null;
  /** The poster's declaration and the reader's answer, as a moment carries them. */
  sensitive?: boolean;
  openable?: boolean;
  /**
   * The pills baked into a picture's pixels, and where each one sits.
   *
   * A pill is *in* the photograph — the editor drew it there — so the file
   * cannot be asked where it is. `x` and `y` are fractions of the frame and
   * `page` is which picture of a run carried it, which is what lets a tap land
   * on a pill at any size the picture is drawn at. See `DropLinkSerializer`.
   */
  links?: DropLink[] | null;
  /** A person placed on a picture, joined to `mentions` by their user id. */
  tags?: DropTag[] | null;
  /** Who the post names, which is also who was told about it. */
  mentions?: UserCard[] | null;
  /**
   * The sound a picture drop plays, which is a different thing from a sound
   * drop: this one has a picture and a tune behind it, and `sound_kind` says
   * which of the two ways it is worn (`song` or `voice`).
   */
  soundtrack?: Asset | null;
  /** A sound's own playlists, drawn as chips under the sound row. */
  shelves?: DropShelf[] | null;
  /**
   * The poster's two doors, off or on.
   *
   * `comments_off` is drawn as a replaced row — the count is not hidden, the
   * sheet refuses — and `likes_off` hides the felt count from everybody but
   * the author, which is the app's meaning and not a client-side guess.
   */
  comments_off?: boolean;
  likes_off?: boolean;
  /**
   * Whether the page said I keep this author, which is `null` when it did not.
   *
   * `social.services.kept_ids` answers it with the page, so the invitation
   * button never costs a request per card. `false` draws the button, `true`
   * draws nothing, and `null` — an older server, a profile shelf, a convo card
   * — draws nothing rather than guessing.
   */
  author_kept?: boolean | null;
  /**
   * The kind the content read filed this under, and its label.
   *
   * Not the poster's word for their own post: this is the closed vocabulary the
   * ranker uses (`comedy`, `news`), and it is the only thing "Less of this"
   * can honestly name. Empty on a post the read never filed.
   */
  format?: string;
  format_label?: string;
  /**
   * A vibe's edit — what plays and in what order.
   *
   * Left exactly as the editor wrote it rather than rewritten server-side; the
   * bytes for each upload it names arrive separately in `clip_urls`. Empty for
   * a clip nobody edited, which is not a case to handle: it has no second clip
   * to look up either.
   */
  recipe?: unknown;
}

/**
 * A post as it rides inside a moment — `DropPreviewSerializer` and
 * `VibePreviewSerializer`.
 *
 * The same card shape a convo message draws, and deliberately smaller than a
 * `Drop`: `liked`, `saved`, `mine`, `shares` and `saves` are facts about
 * whoever is reading, and a payload stored inside somebody else's moment cannot
 * answer for every reader of it. The card starts neutral and opens the post
 * itself for the rest — which is also why `gallery`, `poll` and the shelves are
 * not here: a moment references a post, it does not re-draw one.
 */
export type DropPreview = Pick<
  Drop,
  | "id"
  | "author"
  | "kind"
  | "body"
  | "title"
  | "asset"
  | "ratio"
  | "place"
  | "tag"
  | "created_at"
  | "likes"
  | "comments"
  | "collab"
  | "sensitive"
  | "openable"
  | "music"
  | "cover"
> & {
  views?: number;
  soundtrack?: Asset | null;
};

/** One pill placed on a picture: where it sits and where it goes. */
export interface DropLink {
  x: number;
  y: number;
  url: string;
  page?: number;
  scale?: number;
}

/** One person placed on a picture, by id — the name itself rides in `mentions`. */
export interface DropTag {
  person: ID;
  x: number;
  y: number;
  page?: number;
  scale?: number;
}

/**
 * A playlist a sound has been put on, as a sound wears it.
 *
 * Which one and what it is called, and nothing else: `audio.services.shelf_chip`
 * answers exactly those two, because the button on a sound is a way *into* the
 * shelf rather than a picture of it.
 */
export interface DropShelf {
  id: ID;
  name: string;
}

export interface PollOption {
  id: ID;
  text: string;
  votes?: number;
  mine?: boolean;
  ordinal?: number;
  /**
   * The picture behind a line, when the asker gave it one.
   *
   * `PollOptionSerializer.get_image_url` serves it when the bytes are still
   * there and answers `null` otherwise, so a line whose upload has expired
   * draws as words rather than as a broken frame — the same served-when-
   * available rule every other upload in this payload follows.
   */
  image_url?: string | null;
}

export interface Poll {
  id?: ID;
  options: PollOption[];
  multiple?: boolean;
  votes?: number;
  closed?: boolean;
  closes_at?: string | null;
  ends_at?: string | null;
  picked?: boolean;
  results?: boolean;
  mine?: boolean;
  /**
   * The poll's own shape: `choice` (the default) or `arrange`.
   *
   * An arrange poll is answered by putting its lines in order rather than by
   * ticking one, and it reads `picked` and `results` differently — see
   * `PollSerializer`'s own docstring. `correct` rides with it: whether the
   * order I handed in was the right one, or `null` when I have not answered.
   */
  format?: string;
  correct?: boolean | null;
}

/**
 * One sticker off the catalogue (`apps/stickers/serializers.py`).
 *
 * `url` is absolute and already served — a sticker's bytes are the catalogue's
 * and public, unlike a post's upload — so a shelf or a respond wearing one
 * asks for it by address and needs no token to see it.
 */
export interface Sticker {
  id: ID;
  name: string;
  keywords?: string[];
  url: string | null;
  width?: number;
  height?: number;
  pack?: string;
}

export interface Comment {
  id: ID;
  author: UserCard;
  body: string;
  likes?: number;
  liked?: boolean;
  mine?: boolean;
  created_at: string;
  /** The one upload this respond carries — a picture or a voice note. */
  asset?: Asset | null;
  /** The sticker it wears, beside the upload rather than instead of it. */
  sticker?: Sticker | null;
  /** Who it named; the handles in the body that match one of these are lit. */
  mentions?: UserCard[];
  /** The comment this one answers, or null when it stands on its own. */
  parent?: ID | null;
  replies?: Comment[];
}

/**
 * One private note on a drop — `NoteSerializer` in `apps/drops/serializers.py`.
 *
 * The same row as a respond with two differences that matter: it can be the
 * *owner* reading, in which case the list holds every reader's thread and
 * `subject` is who each one is with, and `mine` is who wrote the line rather
 * than whether it belongs to this reader (a reader's tab only ever holds their
 * own, so there the two agree).
 */
export interface Note {
  id: ID;
  author: UserCard;
  subject: UserCard;
  body: string;
  created_at: string;
  mine?: boolean;
  asset?: Asset | null;
  sticker?: Sticker | null;
}

export interface AssetRef {
  asset: Asset;
}

export interface TrayMoment {
  id: ID;
  author?: UserCard;
  items?: MomentItem[];
  cover?: Asset | null;
  kind?: string;
  mine?: boolean;
  seen?: boolean;
  unseen_count?: number;
  count?: number;
  created_at?: string;
  expires_at?: string;
  /**
   * Whether this reader has answered anything of theirs.
   *
   * Not the same fact as `seen`, and the rail draws the two apart: a watch is
   * what the reader did by looking, an answer is what they said. It is a flag
   * on the row and no longer a bucket of its own — see `TrayView`, which sends
   * the `answered` list empty and these people inside `unseen`/`seen` where
   * they now belong.
   */
  answered?: boolean;
  /**
   * Whether this reader has asked to be shown this person's day last.
   *
   * The rail is already in that order — the row arrives in the tray's own
   * `silenced` list — and this is the same fact on the row itself, so a card
   * can be drawn faint and offer the way back without remembering which list it
   * came out of.
   */
  silenced?: boolean;
  /** Whether anything behind this ring is marked, so the card can say so. */
  sensitive?: boolean;
}

/**
 * One option of a moment poll, as `services.poll_payload` answers it.
 *
 * A tally and never a list of names: `count` is how many chose it and `mine`
 * is whether the reader asking did. The two picture fields point at the
 * moment's own gated route; a text-only option leaves them null.
 */
export interface MomentPollOption {
  id: ID;
  text: string;
  count: number;
  mine: boolean;
  image_url?: string | null;
  image_thumb_url?: string | null;
}

/**
 * A poll on a moment: the question, the lines and where the vote stands.
 *
 * `total_voters` is how many people answered at all and is what a percentage
 * reads against; `total_votes` is every tick across every option, which is the
 * larger number on a pick-many poll where one person may hold several.
 * `voted` is the server's own answer to "has this reader answered", which is
 * what decides whether the bars are drawn at all.
 */
export interface MomentPoll {
  question: string;
  multi_select: boolean;
  options: MomentPollOption[];
  total_votes: number;
  total_voters: number;
  voted: boolean;
}

/** One answer given to a moment, with the face it was given with. */
export interface MomentReactor extends UserCard {
  emoji?: string;
  at?: string;
}

/** One option of a poll with the names under it — the author's own read. */
export interface MomentPollVoters {
  id: ID;
  text: string;
  ordinal?: number;
  count: number;
  voters?: UserCard[];
}

export interface MomentItem {
  id: ID;
  ordinal: number;
  /**
   * The server's own word (`MomentItem.Kind`): `image`, `video`, `text`, `poll`
   * or `drop`. `note` and `clip` are kept so payloads written by older builds
   * still type, and `vibe` while older item rows are still around.
   */
  kind: "image" | "video" | "text" | "note" | "clip" | "vibe" | "drop" | "poll" | string;
  body?: string;
  asset?: Asset | null;
  /** The Vibe a `vibe`/`drop` item is a way in to, when it still exists. */
  vibe?: DropPreview | null;
  /** The Drop this item references, when it is a drop card. */
  drop?: DropPreview | null;
  /**
   * The post this item was made from, when it was made from one — the id and
   * which kind of post, since the upload beside it is the copy, not the post.
   */
  made_from?: { drop?: ID | null; vibe?: ID | null } | null;
  sound?: Asset | null;
  sound_url?: string | null;
  /** Where in the sound it begins. Zero is the top of the file. */
  sound_start_ms?: number | null;
  /** Where it stops. Zero is "to the end of the file". */
  sound_end_ms?: number | null;
  /** Where in a clip the viewer starts, and where it stops (zero = the end). */
  clip_start_ms?: number | null;
  clip_end_ms?: number | null;
  muted?: boolean;
  mentions?: UserCard[];
  /** A poll's own question, tally and state — null on everything that is not one. */
  poll?: MomentPoll | null;
  seen?: boolean;
}

export interface Tray {
  mine?: TrayMoment[];
  mine_count?: number;
  unseen?: TrayMoment[];
  seen?: TrayMoment[];
  total?: number;
  shown?: number;
  hours?: number;
}

export interface MomentReactions {
  count: number;
  counts?: Record<string, number>;
  mine?: string | null;
}

export interface Moment {
  id: ID;
  author: UserCard;
  credit?: UserCard | null;
  source_id?: ID | null;
  items: MomentItem[];
  created_at: string;
  expires_at?: string;
  seen?: boolean;
  mine?: boolean;
  viewers?: number | UserCard[] | null;
  reactions?: MomentReactions;
  /**
   * The author's own reach for this one moment, told back to the author alone.
   *
   * A watcher is sent `"everyone"` — not because a hidden moment is everybody's,
   * but because whether it isn't is not theirs to know. See
   * `MomentSerializer.get_audience`.
   */
  audience?: "everyone" | "except" | "only" | string;
  /** Whom it was hidden from or shared with. Empty for everybody but the poster. */
  audience_users?: ID[];
  /** The author's own mark on it: adult, violent or graphic. */
  sensitive?: boolean;
  /** Whether this reader may uncover a marked one. */
  openable?: boolean;
}

export interface Memory {
  id: ID;
  title: string;
  ordinal?: number;
  created_at?: string;
  kind?: "moments" | "playlist" | string;
  items?: MomentItem[];
  count?: number;
  playlist?: Playlist | null;
  reactions?: MomentReactions;
  /**
   * The item chosen to stand for this shelf, as an id — or null, which means
   * nobody chose and the shelf draws the first picture it holds. That fallback
   * is a rule of drawing rather than of storage, which is why the two answers
   * are kept apart here too.
   */
  cover?: string | null;
  /** The picture the owner uploaded as the card, when that is what it is. */
  cover_upload?: Asset | null;
  /** Whether anything in it sits on a marked moment. */
  sensitive?: boolean;
  /** Whether the reader asking may uncover a marked one. */
  openable?: boolean;
}

export interface MomentTray {
  mine?: TrayMoment[];
  mine_count?: number;
  /**
   * Kept, and always empty.
   *
   * It is the third list the rail used to lead with — everybody the reader had
   * ever answered anything of — and the server sends it empty since 2026-10-13
   * so that a build which cannot be talked out of drawing it draws the same rail
   * as this one. Those people are inside `unseen`/`seen` now, where they belong.
   */
  answered?: TrayMoment[];
  unseen?: TrayMoment[];
  seen?: TrayMoment[];
  /** The people this reader has asked to be shown last, always last and faint. */
  silenced?: TrayMoment[];
  total?: number;
  shown?: number;
  hours?: number;
}

export interface Message {
  id: ID;
  thread: ID;
  channel?: ID | null;
  ordinal?: number;
  kind: string;
  body: string;
  sender: UserCard;
  mine: boolean;
  reply_to?: {
    id: ID;
    kind: string;
    body: string;
    sender: { id: ID; name: string };
    deleted_for_all?: boolean;
  } | null;
  asset?: Asset | null;
  payload?: Record<string, unknown> | null;
  poll?: MessagePoll | null;
  reactions?: { emoji: string; count: number }[];
  my_reaction?: string | null;
  can_copy?: boolean;
  held?: boolean;
  deleted_for_all?: boolean;
  client_id?: string | null;
  revision?: number;
  edited_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
  pending?: boolean;
  failed?: boolean;
}

export interface MessagePollOption {
  index: number;
  text: string;
  count: number;
}

export interface MessagePoll {
  question?: string;
  total?: number;
  mine?: number | null;
  options?: MessagePollOption[];
  votes?: number;
  picked?: ID[];
  multiple?: boolean;
  closed?: boolean;
}

export interface ThreadMember {
  user: UserCard;
  role?: string;
  left_at?: string | null;
  last_read_ordinal?: number;
  last_delivered_ordinal?: number;
  last_read_at?: string | null;
  burn_ordinal?: number;
}

export interface ThreadPreview {
  kind?: string;
  text?: string;
  at?: string;
  mine?: boolean;
  held?: boolean;
  sender?: string;
}

export interface ThreadCard {
  id: ID;
  kind: "direct" | "group" | string;
  title?: string;
  avatar?: string | null;
  other?: UserCard | null;
  members?: ThreadMember[];
  member?: UserCard;
  preview?: ThreadPreview | null;
  status?: string | null;
  last_message?: Message | null;
  last_message_at?: string | null;
  unread?: number;
  unread_count?: number;
  unread_other_count?: number;
  pinned?: boolean;
  muted?: boolean;
  vaulted?: boolean;
  spark_off?: boolean;
  locked?: boolean;
  invites_on?: boolean;
  my_role?: string;
  member_count?: number;
  channels?: Channel[];
  vanish_mode?: string;
  vanish_at?: string | null;
  wallpaper?: string | null;
  tint?: string | null;
  cleared_ordinal?: number;
  last_read_ordinal?: number;
  vanish_days?: number | null;
  spark?: number;
  created_at?: string;
  updated_at?: string;
  gate?: string | Record<string, unknown> | null;
}

export interface Thread extends ThreadCard {
  receipts?: unknown[];
  channels?: Channel[];
  invites?: Invite[];
}

export interface Relationship {
  id: ID;
  user: UserCard;
  follow_state?: string;
  chat_state?: string;
  follow_at?: string | null;
  chat_at?: string | null;
  created_at?: string;
}

export interface ChatRequest extends Relationship {
  message?: string | null;
}

export interface RequestsBundle {
  incoming_follow: Relationship[];
  incoming_chat: ChatRequest[];
  outgoing: Relationship[];
}

export interface ThreadDetail extends ThreadCard {
  members?: ThreadMember[];
  receipts?: unknown[];
  gate?: Record<string, unknown> | null;
  vanish_days?: number | null;
  cleared_ordinal?: number;
  last_read_ordinal?: number;
}

export interface Channel {
  id: ID;
  name: string;
  position?: number;
}

export interface Invite {
  id: ID;
  code?: string;
  url?: string;
  uses?: number;
  revoked?: boolean;
  created_at?: string;
}

export interface CoverRef {
  id?: ID;
  width?: number;
  height?: number;
  content_url: string;
  thumbnail_url?: string | null;
}

export interface Track {
  id: ID;
  kind?: string;
  title: string;
  artist: string;
  artist_slug?: string;
  series?: string | null;
  episode?: number | null;
  seconds?: number;
  plays?: number;
  seed?: number | string;
  liked?: boolean;
  cover_url?: string | null;
  cover?: CoverRef | null;
  stream?: string | null;
  stream_url?: string | null;
  item?: ID;
  color?: string | null;
}

export interface Playlist {
  id: ID;
  name: string;
  seed?: number | string;
  count?: number;
  seconds?: number;
  mine?: boolean;
  shared?: boolean;
  owner?: string;
  owner_username?: string;
  cover?: CoverRef | null;
  title?: string;
  description?: string;
  cover_url?: string | null;
  tracks?: Track[];
  track_count?: number;
  created_at?: string;
  share_url?: string | null;
}

export interface AudioHome {
  hero: Track | null;
  hero_source?: string;
  recent: Track[];
  recent_source?: string;
  playlists: Playlist[];
  podcasts: Track[];
  artists: { name: string; slug?: string; avatar?: string | null; tracks?: number; listeners?: number }[];
}

export interface SpacePerson {
  user?: ID;
  name?: string;
  username?: string;
  avatar?: string | null;
  role?: string;
  muted?: boolean;
  camera?: boolean;
  hand?: boolean;
  joined_at?: string;
}

export interface SpaceRoom {
  id: ID;
  title: string;
  note?: string;
  kind?: string;
  host?: UserCard;
  state?: "live" | "scheduled" | "ended" | string;
  topic?: string;
  tags?: string[];
  seed?: string | number;
  call_id?: string | null;
  cover_url?: string | null;
  listeners?: number;
  stage?: SpacePerson[];
  raised?: SpacePerson[];
  audience?: SpacePerson[];
  hands?: number;
  game?: Record<string, unknown> | null;
  mine?: boolean;
  me?: {
    in?: boolean;
    role?: string;
    hand?: boolean;
    muted?: boolean;
    camera?: boolean;
    host?: boolean;
    hears?: boolean;
  };
  starts_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  room?: Record<string, unknown>;
}

export interface SparkTier {
  key: string;
  name?: string;
  icon?: string;
  colour?: string;
  from?: number;
  to?: number;
  shields?: number;
  days?: string;
}

export interface Spark {
  id?: ID | null;
  thread_id?: ID;
  thread?: ID;
  other?: UserCard | null;
  with?: UserCard;
  off?: boolean;
  count?: number;
  best?: number;
  laps?: number;
  note?: string;
  alive?: boolean;
  done?: boolean;
  at_risk?: boolean;
  closing?: boolean;
  mine?: boolean;
  theirs?: boolean;
  saved?: boolean;
  last_counted?: string | null;
  stage?: SparkTier | null;
  second?: SparkTier | null;
  next_stage?: SparkTier | null;
  shields?: number;
  shield_cap?: number;
  next_at?: number;
  days_left?: number;
  pct?: number;
  pos?: number;
  cents?: number;
  seg_lo?: number;
  breaks_at?: string;
  seconds_left?: number;
  started_on?: string | null;
  days?: number;
  longest?: number;
  total?: number;
  state?: string;
  name?: string | null;
  updated_at?: string;
}

export interface Medal {
  id?: ID;
  thread_id?: ID;
  key?: string;
  kind?: string;
  name?: string;
  reached?: number;
  earned?: boolean;
  at?: number;
  days?: number;
  created_at?: string;
}

export interface Wallet {
  balance?: number;
  earned?: number;
  spent?: number;
  owned?: string[];
  themes?: string[];
  logo?: string | null;
  [key: string]: unknown;
}

export interface Tier {
  at: number;
  opens?: number;
  designs?: string[];
  [key: string]: unknown;
}

export interface VaultState {
  code_set: boolean;
  open: boolean;
  opened_at?: string | null;
  count?: number | null;
  hidden: boolean;
  hide_from_list?: boolean;
  length: number;
  open_minutes: number;
}

export interface ConvoWall {
  key: string;
  name: string;
  image?: string;
}

export interface ConvoTint {
  key: string;
  name: string;
  hex: string;
}

export interface ConvoCatalog {
  walls: ConvoWall[];
  tints: ConvoTint[];
  reactions: string[];
}

export interface AlertActor {
  id: ID;
  username: string;
  name: string;
  avatar?: string | null;
  verified?: boolean;
}

export interface AlertTarget {
  kind: string;
  id: ID;
}

export interface AlertPreview {
  kind: string;
  thumb?: string | null;
  caption?: string;
  w?: number | null;
  h?: number | null;
  sensitive?: boolean;
}

export interface Alert {
  id: ID;
  kind: string;
  about: string;
  body: string;
  at: string | null;
  read: boolean;
  rung?: number | null;
  kept?: boolean | null;
  actor?: AlertActor | null;
  target?: AlertTarget | null;
  preview?: AlertPreview | null;
  /**
   * Where a tap goes on the one kind that names no row of this database — news
   * from the shelf. A **route**, not an address — `/theme/<key>`, `/c/<key>`,
   * `/o/<id>`, `/l/<key>` — exactly as `Alert.route` is on the phone. Empty or
   * absent on every other kind, whose `target` already says where it opens.
   */
  route?: string;
}

export interface AlertsPageData {
  results: Alert[];
  next: string | null;
  previous?: string | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
}

export interface AlertFlags {
  pinned?: boolean;
  muted?: boolean;
}

/**
 * One file offered as proof on a verification request.
 *
 * `url` is built by the serializer against the request, so it is absolute and
 * already points at the bucket — the same shape every other media path in this
 * app arrives in. It is `null` for a row whose file never landed.
 */
export interface VerifyDoc {
  id: ID;
  label: string;
  url: string | null;
  created_at?: string;
}

/**
 * The account's case for the blue check, as the console reads it.
 *
 * `status` is the server's own word — `pending`, `approved`, `rejected`,
 * `withdrawn`, `revoked` — and is never translated here: the page matches on it
 * and the words a person reads are chosen in `features/verify/VerifyView.tsx`,
 * exactly as the app keeps `_Kind`'s values apart from the words it draws.
 *
 * `documents` is a list rather than a field because a case is made of several;
 * the app never reads it back (the form only ever writes), but the console does,
 * and a request shape that dropped it would be this page deciding what the other
 * reader may see.
 */
export interface VerifyRequest {
  id: ID;
  kind: string;
  reason: string;
  links: string[];
  status: string;
  note: string;
  decided_at: string | null;
  created_at: string;
  documents: VerifyDoc[];
}

/**
 * The account's whole standing: the badge and the latest request, in one answer.
 *
 * Both halves arrive together because the page cannot choose between its four
 * states without both — `services.status_for` (`apps/verify/services.py`) builds
 * exactly this dict, and `can_apply` is the server's own arithmetic (not
 * verified, and nothing already waiting) rather than something re-derived here.
 * A page that worked that rule out for itself would be a second opinion on a
 * question the server has already answered.
 */
export interface VerifyStatus {
  verified: boolean;
  verified_until: string | null;
  can_apply: boolean;
  request: VerifyRequest | null;
}

export interface ActivityData {
  liked: SavedThing[];
  said: SavedThing[];
}

/**
 * One thing on an account's own shelf, in whichever of the three shapes it is.
 *
 * The server sends each row under its own kind's key — `{"kind": "drop", "drop":
 * {...}}` — rather than flattening the three into one card, because the three are
 * drawn by three different shapes and each already knows how to read its own.
 * `vibe` and `drop` are the same serializer's output (`apps/drops`), which is why
 * they share a type here; `SavedThing.kind` is what says which key is live.
 *
 * `at` is when it was *put by*, not when it was posted. On a shelf that is the
 * question the row answers — "how long has this been here" — and it is null when
 * the server sent nothing readable, which is a row that still draws.
 */
export interface SavedThing {
  kind: "drop" | "vibe" | "track" | string;
  at: string | null;
  drop?: Drop;
  vibe?: Drop;
  track?: Track;
}

/**
 * The shelf, read whole.
 *
 * Not a cursor page: it is one person's own choosing and is bounded by that, so
 * the server sends all of it up to a ceiling and says whether the ceiling was
 * reached — `SHELF_LIMIT` in `apps/saved/services.py`, 300. A capped list that
 * did not say so would read as the whole shelf, which is why `more` exists and
 * why the foot of the page draws a note when it is true.
 */
export interface SavedShelf {
  items: SavedThing[];
  more: boolean;
}

export interface QRStart {
  session: ID;
  secret: string;
  code: string;
  code_expires_in: number;
  match: string;
  expires_in: number;
  poll_after: number;
}

export interface QRState {
  state: "waiting" | "scanned" | "approved" | "denied" | "collected" | "expired" | string;
  code?: string;
  code_expires_in?: number;
  poll_after?: number;
  match?: string;
  account?: string;
  user?: UserCard;
}

export interface AuthTokens {
  access: string;
  refresh?: string;
  user?: Me;
  sid?: string;
}

export interface SearchResults {
  people?: UserCard[];
  drops?: Drop[];
  places?: unknown[];
  tracks?: Track[];
  [key: string]: unknown;
}

/**
 * One row of the devices screen.
 *
 * Written against `SessionSerializer` and not against what the screen wished it
 * had. Two of the fields this used to declare do not exist on the wire at all:
 * there is no `push_token` — the serializer says why, an address that can wake
 * somebody's phone has no business being in a list somebody might screenshot,
 * and it sends `push_enabled`, a boolean, instead — and a session has no `name`,
 * no `location` and no `created_at`, because the place is two fields the server
 * joins into `place` and the date it keeps is `first_seen`.
 *
 * `current` and `primary` are facts about the list rather than about the row:
 * the first is which session asked for it, the second is the oldest one. Both
 * are computed by the view, so neither is ever missing from a payload.
 */
export interface Device {
  id: ID;
  platform: string;
  model: string | null;
  os_version: string | null;
  app_version: string | null;
  ip: string | null;
  city: string | null;
  country: string | null;
  /** "Mumbai, IN" / city / country / "" — the server's own join. */
  place: string | null;
  /** True when the address is inside the server's own network, not on a map. */
  private_address?: boolean;
  first_seen: string | null;
  last_active: string | null;
  push_enabled?: boolean;
  current?: boolean;
  primary?: boolean;
}

export interface NotificationFlags {
  [key: string]: boolean;
}

/**
 * Where a paid collaboration stands.
 *
 * The wire names, kept verbatim: `status` is what the server stores and what
 * every screen matches on, so it is never translated itself. The word a person
 * reads is chosen in `features/deals/model.ts`, the way the app keeps
 * `dealStatusWord` beside the screens rather than in `lib/deals.dart`.
 */
export type DealStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "delivered"
  | "approved"
  | "paid"
  | "cancelled";

/** One side of a deal — the company or the creator, as a small card. */
export interface DealUser {
  id: ID;
  username: string;
  name: string;
  avatar: string | null;
  verified?: boolean;
  followers_count?: number;
}

/** The uploaded deliverable. An asset like any other, served with the token. */
export interface DealAsset {
  id: ID;
  kind: string;
  thumb_url?: string | null;
  content_url?: string | null;
  duration_ms?: number | null;
}

/** One entry on the shared timeline both sides read. */
export interface DealEvent {
  kind: string;
  by?: DealUser | null;
  note?: string;
  at?: string | null;
}

export interface Deal {
  id: ID;
  title: string;
  brief: string;
  deliverable_kind: string;
  amount: number;
  currency: string;
  status: DealStatus;
  /** `company` when I sent the invite, `creator` when I received it. */
  my_role: string;
  agreement?: string;
  decline_reason?: string;
  deadline?: string | null;
  agreement_accepted_at?: string | null;
  created_at?: string | null;
  company?: DealUser | null;
  creator?: DealUser | null;
  deliverable?: DealAsset | null;
  events?: DealEvent[];
  /**
   * Server-computed permission map, keyed by action name — accept, decline,
   * deliver, approve, paid, cancel. The one source of truth for which buttons a
   * side may draw; never re-derive it from `status` here. Read it through
   * `canDo()` in `features/deals/model.ts`, which treats anything but `true` as
   * no.
   */
  can?: Record<string, boolean>;
}

/** Both `/deals/` and `/deals/creators/` answer a cursor page. */
export interface DealPage {
  results: Deal[];
  next: string | null;
}

export interface CreatorPage {
  results: DealUser[];
  next: string | null;
}
