export type ID = string;

export interface Page<T> {
  results: T[];
  next: string | null;
  previous?: string | null;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
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
  professional?: Record<string, unknown> | boolean | null;
  verified_at?: string | null;
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
  mutuals?: UserCard[];
  professional?: Record<string, unknown>;
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
  kind: "note" | "photo" | "video" | "poll" | "vibe" | string;
  body: string;
  asset: Asset | null;
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
}

export interface PollOption {
  id: ID;
  text: string;
  votes?: number;
  mine?: boolean;
  ordinal?: number;
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
}

export interface Comment {
  id: ID;
  author: UserCard;
  body: string;
  likes?: number;
  liked?: boolean;
  mine?: boolean;
  created_at: string;
  replies?: Comment[];
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
}

export interface MomentItem {
  id: ID;
  ordinal: number;
  kind: "image" | "video" | "note" | "clip" | "vibe" | string;
  body?: string;
  asset?: Asset | null;
  vibe?: unknown;
  sound?: Asset | null;
  sound_url?: string | null;
  sound_start_ms?: number | null;
  clip_start_ms?: number | null;
  clip_end_ms?: number | null;
  muted?: boolean;
  mentions?: UserCard[];
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
  prompt?: string | null;
  created_at: string;
  expires_at?: string;
  seen?: boolean;
  mine?: boolean;
  viewers?: number | UserCard[] | null;
  reactions?: MomentReactions;
}

export interface MomentPrompt {
  day?: string;
  text?: string;
  prompt?: string;
  answers?: Moment[];
  count?: number;
  answered?: boolean;
  locked?: boolean;
  streak?: number;
  before?: MomentPrompt | null;
  [key: string]: unknown;
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
}

export interface MomentTray {
  mine?: TrayMoment[];
  mine_count?: number;
  unseen?: TrayMoment[];
  seen?: TrayMoment[];
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

export interface ActivityThing {
  kind: "drop" | "vibe" | "track" | string;
  at?: string | null;
  drop?: Drop;
  vibe?: Drop;
  track?: Track;
}

export interface ActivityData {
  liked: ActivityThing[];
  said: ActivityThing[];
}

export interface SavedItem {
  id?: ID;
  kind: string;
  drop?: Drop;
  object?: Drop;
  created_at?: string;
  [key: string]: unknown;
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

export interface Device {
  id: ID;
  platform: string;
  push_token: string;
  app_version: string;
  last_active: string;
  current?: boolean;
  first?: boolean;
  location?: string | null;
  ip?: string | null;
  created_at?: string | null;
  signed_in_at?: string | null;
  name?: string | null;
}

export interface NotificationFlags {
  [key: string]: boolean;
}
