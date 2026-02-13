import type { FeedOption } from './types';

export const FEED_OPTIONS: FeedOption[] = [
  {
    label: 'Front Page',
    description: 'Reddit\'s default top posts of the day',
    path: '',
  },
  {
    label: 'Tech & AI',
    description: 'localllama + sysadmin + chatgpt',
    path: 'r/localllama+sysadmin+chatgpt',
  },
  {
    label: 'AR & Smart Glasses',
    description: 'augmentedreality + EvenRealities + SmartGlasses + wearables',
    path: 'r/augmentedreality+EvenRealities+SmartGlasses+wearables',
  },
  {
    label: 'Programming',
    description: 'programming + webdev + typescript + devops + nix',
    path: 'r/programming+webdev+typescript+devops+nix',
  },
  {
    label: 'Science & Space',
    description: 'science + space + physics + askscience',
    path: 'r/science+space+physics+askscience',
  },
  {
    label: 'World News',
    description: 'worldnews + geopolitics + economics + news',
    path: 'r/worldnews+geopolitics+economics+news',
  },
  {
    label: 'Finance',
    description: 'wallstreetbets + investing + stocks + personalfinance',
    path: 'r/wallstreetbets+investing+stocks+personalfinance',
  },
  {
    label: 'Gaming',
    description: 'pcgaming + games + linux_gaming + indiegaming',
    path: 'r/pcgaming+games+linux_gaming+indiegaming',
  },
  {
    label: 'Self-hosted & Homelab',
    description: 'selfhosted + homelab + homeassistant + pihole',
    path: 'r/selfhosted+homelab+homeassistant+pihole',
  },
];

export const TEXT_IDS = [1, 2, 3] as const;
export const ITEMS_PER_PAGE = 3;
export const SWIPE_COOLDOWN_MS = 300;

/** Mutable current feed selection – shared across modules. */
export let currentFeed: FeedOption = FEED_OPTIONS[0];

export function setCurrentFeed(feed: FeedOption) {
  currentFeed = feed;
}
