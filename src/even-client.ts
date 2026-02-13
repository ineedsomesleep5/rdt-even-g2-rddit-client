import {
  CreateStartUpPageContainer,
  DeviceConnectType,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';

import type { ViewState, RedditPost, RedditComment } from './types';
import {
  FEED_OPTIONS,
  TEXT_IDS,
  ITEMS_PER_PAGE,
  SWIPE_COOLDOWN_MS,
  currentFeed,
  setCurrentFeed,
} from './constants';
import { hoursAgo } from './utils';
import { fetchTopPosts, fetchComments } from './reddit-api';
import { appendEventLog, flashIndicator } from './simulator';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class EvenRedditClient {
  private view: ViewState = 'feeds';
  private posts: RedditPost[] = [];
  private comments: RedditComment[] = [];
  private selectedIndex = 0;
  private savedPostIndex = 1;
  private savedFeedIndex = 0;
  private savedCommentIndex = 0;
  private isInitializedUi = false;
  private lastSwipeTime = 0;

  constructor(private bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>) {}

  /** Read a cached value from App-side local storage. Returns null if missing or expired. */
  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.bridge.getLocalStorage(key);
      if (!raw) return null;
      const entry: { ts: number; data: T } = JSON.parse(raw);
      if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
      return entry.data;
    } catch {
      return null;
    }
  }

  /** Write a value to App-side local storage with a timestamp. */
  private async cacheSet<T>(key: string, data: T): Promise<void> {
    try {
      await this.bridge.setLocalStorage(key, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      console.warn('cacheSet failed for key', key, e);
    }
  }

  /** Returns true if the swipe should be processed, false if still in cooldown. */
  private swipeThrottleOk(): boolean {
    const now = Date.now();
    if (now - this.lastSwipeTime < SWIPE_COOLDOWN_MS) return false;
    this.lastSwipeTime = now;
    return true;
  }

  async init() {
    console.log('🚀 EvenRedditClient.init() starting...');

    this.bridge.onDeviceStatusChanged((status) => {
      console.log('📱 Device status changed:', status);
      if (status.connectType === DeviceConnectType.Connected) {
        console.log('Device connected', status.sn);
      }
    });

    console.log('👂 Registering onEvenHubEvent listener...');
    this.bridge.onEvenHubEvent((event) => {
      console.log('🎯 Bridge received event (before onEvenHubEvent):', event);
      this.onEvenHubEvent(event);
    });

    const uiOk = await this.ensureStartupUi();
    if (!uiOk) {
      throw new Error('Glasses UI initialization failed (bridge not available in this environment).');
    }
    await this.showFeedSelector();
    console.log('✅ EvenRedditClient.init() complete');
  }

  private async ensureStartupUi(): Promise<boolean> {
    if (this.isInitializedUi) return true;

    const containerHeight = 96; // 288 / 3 = 96px each
    const textContainers: TextContainerProperty[] = [];

    TEXT_IDS.forEach((id, idx) => {
      textContainers.push(new TextContainerProperty({
        xPosition: 0,
        yPosition: idx * containerHeight,
        width: 576,
        height: containerHeight,
        borderWidth: 0,
        borderColor: 5,
        paddingLength: 2,
        containerID: id,
        containerName: `item-${idx + 1}`,
        content: idx === 0 ? 'Loading…' : '',
        isEventCapture: idx === 0 ? 1 : 0,
      }));
    });

    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 3,
        textObject: textContainers,
      })
    );

    if (result !== 0) {
      console.warn('createStartUpPageContainer failed with code', result);
      return false;
    }

    this.isInitializedUi = true;
    return true;
  }

  async reloadFeed() {
    await this.loadPosts();
  }

  private async showFeedSelector() {
    this.view = 'feeds';
    this.selectedIndex = this.savedFeedIndex;
    await this.renderFeedsPage();
  }

  private async renderFeedsPage() {
    const feedList = new ListContainerProperty({
      containerID: 10,
      containerName: 'feeds',
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 1,
      borderColor: 13,
      borderRdaius: 6,
      paddingLength: 5,
      isEventCapture: 1,
      itemContainer: new ListItemContainerProperty({
        itemCount: FEED_OPTIONS.length,
        itemWidth: 560,
        isItemSelectBorderEn: 1,
        itemName: FEED_OPTIONS.map(f => {
          const subs = f.path ? f.path.replace(/\+/g, ' ') : 'top';
          const full = `${f.label} - ${subs}`;
          return full.length > 50 ? full.substring(0, 50) : full;
        }),
      }),
    });

    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 1,
        listObject: [feedList],
      })
    );
  }

  private async loadPosts() {
    this.view = 'posts';
    this.selectedIndex = 1; // Start at first real post (skip help)

    const cacheKey = `posts:${currentFeed.path}`;
    const cached = await this.cacheGet<RedditPost[]>(cacheKey);
    if (cached) {
      console.log(`📦 Using cached posts for "${currentFeed.label}"`);
      this.posts = cached;
      await this.renderPostsPage();
      return;
    }

    await this.showLoadingOnGlasses(`Loading ${currentFeed.label}…`);

    try {
      this.posts = await fetchTopPosts(20);
      await this.cacheSet(cacheKey, this.posts);
      await this.renderPostsPage();
    } catch (e) {
      console.error('loadPosts failed:', e);
      await this.showLoadingOnGlasses(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async showLoadingOnGlasses(message: string) {
    const containerHeight = Math.floor(288 / ITEMS_PER_PAGE);
    const textContainers: TextContainerProperty[] = TEXT_IDS.map((id, idx) =>
      new TextContainerProperty({
        xPosition: 12,
        yPosition: idx * containerHeight,
        width: 552,
        height: containerHeight,
        borderWidth: 0,
        borderColor: 5,
        paddingLength: 2,
        containerID: id,
        containerName: `item-${idx + 1}`,
        content: idx === 0 ? message : '',
        isEventCapture: idx === 0 ? 1 : 0,
      })
    );
    try {
      await this.bridge.rebuildPageContainer(
        new RebuildPageContainer({
          containerTotalNum: 3,
          textObject: textContainers,
        })
      );
    } catch (e) {
      console.error('showLoadingOnGlasses failed:', e);
    }
  }

  private async loadCommentsForSelectedPost() {
    const post = this.posts[this.selectedIndex];
    if (!post?.permalink) return;

    this.savedPostIndex = this.selectedIndex;
    this.view = 'comments';
    this.selectedIndex = 0;

    const cacheKey = `comments:${post.permalink}`;
    const cached = await this.cacheGet<RedditComment[]>(cacheKey);
    if (cached) {
      console.log(`📦 Using cached comments for "${post.title.substring(0, 40)}"`);
      this.comments = cached;
      await this.renderCommentsPage();
      return;
    }

    await this.showLoadingOnGlasses('Loading comments…');

    try {
      this.comments = await fetchComments(post.permalink, 50);
      await this.cacheSet(cacheKey, this.comments);
      await this.renderCommentsPage();
    } catch (e) {
      console.error(e);
      await this.showLoadingOnGlasses(`Error: ${e instanceof Error ? e.message : String(e)}`);
      this.comments = [];
      await this.renderCommentsPage();
    }
  }

  private async renderPostsPage() {
    const adjustedIndex = this.selectedIndex - 1;
    const startIdx = Math.floor(adjustedIndex / ITEMS_PER_PAGE) * ITEMS_PER_PAGE;
    const containerHeight = Math.floor(288 / ITEMS_PER_PAGE);
    const textContainers: TextContainerProperty[] = [];
    const selectedSlot = adjustedIndex - startIdx;

    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      const postIdx = startIdx + i + 1; // +1 to skip help post
      const post = this.posts[postIdx];
      const containerId = TEXT_IDS[i];
      const isSelected = (i === selectedSlot && post);
      const borderWidth = isSelected ? 3 : 0;

      let content = '';
      if (post) {
        const ageHours = hoursAgo(post.createdUtcSeconds);
        const title = post.title.length > 60 ? post.title.substring(0, 60) + '…' : post.title;
        content = `${title}\n${postIdx}/${this.posts.length - 1} ▲ ${post.ups} ${post.subreddit} - ${post.numComments} comments\n${ageHours}h ago by ${post.author}`;
      }

      textContainers.push(new TextContainerProperty({
        xPosition: 12,
        yPosition: i * containerHeight,
        width: 552,
        height: containerHeight,
        borderWidth,
        borderColor: 5,
        paddingLength: 2,
        containerID: containerId,
        containerName: `item-${i + 1}`,
        content,
        isEventCapture: isSelected ? 1 : 0,
      }));
    }

    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 3,
        textObject: textContainers,
      })
    );
  }

  private async renderCommentsPage() {
    const startIdx = Math.floor(this.selectedIndex / ITEMS_PER_PAGE) * ITEMS_PER_PAGE;
    const containerHeight = Math.floor(288 / ITEMS_PER_PAGE);
    const textContainers: TextContainerProperty[] = [];
    const selectedSlot = this.selectedIndex - startIdx;

    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      const commentIdx = startIdx + i;
      const comment = this.comments[commentIdx];
      const containerId = TEXT_IDS[i];
      const isSelected = (i === selectedSlot && comment);
      const borderWidth = isSelected ? 3 : 0;

      let content = '';
      let indentX = 12;
      let containerWidth = 552;

      if (comment) {
        const ageHours = hoursAgo(comment.createdUtcSeconds);
        const indentPerDepth = 16;
        indentX = 12 + Math.min(comment.depth * indentPerDepth, 200);
        containerWidth = 576 - indentX - 12;

        const cleanBody = comment.body.replace(/\s+/g, ' ').trim();
        const body = cleanBody.length > 100 ? cleanBody.substring(0, 100) + '…' : cleanBody;
        content = `${commentIdx + 1}/${this.comments.length} ▲${comment.ups} ${comment.author} ${ageHours}h ago\n${body}`;
      }

      textContainers.push(new TextContainerProperty({
        xPosition: indentX,
        yPosition: i * containerHeight,
        width: containerWidth,
        height: containerHeight,
        borderWidth,
        borderColor: 5,
        paddingLength: 2,
        containerID: containerId,
        containerName: `item-${i + 1}`,
        content,
        isEventCapture: isSelected ? 1 : 0,
      }));
    }

    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 3,
        textObject: textContainers,
      })
    );
  }

  private async renderCommentDetail() {
    const comment = this.comments[this.savedCommentIndex];
    if (!comment) return;

    const ageHours = hoursAgo(comment.createdUtcSeconds);
    const header = `\u25B2${comment.ups} ${comment.author} ${ageHours}h ago`;
    const content = `${header}\n${comment.body.trim()}`;

    const textContainers: TextContainerProperty[] = [
      new TextContainerProperty({
        xPosition: 12,
        yPosition: 0,
        width: 552,
        height: 288,
        borderWidth: 0,
        borderColor: 5,
        paddingLength: 4,
        containerID: TEXT_IDS[0],
        containerName: 'item-1',
        content,
        isEventCapture: 1,
      }),
      new TextContainerProperty({
        xPosition: 0, yPosition: 288, width: 1, height: 1,
        borderWidth: 0, borderColor: 5, paddingLength: 0,
        containerID: TEXT_IDS[1], containerName: 'item-2',
        content: '', isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: 0, yPosition: 289, width: 1, height: 1,
        borderWidth: 0, borderColor: 5, paddingLength: 0,
        containerID: TEXT_IDS[2], containerName: 'item-3',
        content: '', isEventCapture: 0,
      }),
    ];

    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 3,
        textObject: textContainers,
      })
    );
  }

  private async onEvenHubEvent(event: EvenHubEvent) {
    const rawStr = JSON.stringify(event, null, 0);
    const keys = Object.keys(event);
    appendEventLog(`keys=[${keys.join(',')}] raw=${rawStr}`);

    if (event?.listEvent) {
      const le = event.listEvent;
      appendEventLog(`LIST => containerID=${le.containerID} containerName="${le.containerName}" eventType=${le.eventType} (${typeof le.eventType}) selectIdx=${le.currentSelectItemIndex} selectName="${le.currentSelectItemName}"`);
    }
    if (event?.textEvent) {
      const te = event.textEvent;
      appendEventLog(`TEXT => containerID=${te.containerID} containerName="${te.containerName}" eventType=${te.eventType} (${typeof te.eventType})`);
    }
    if (event?.sysEvent) {
      const se = event.sysEvent;
      appendEventLog(`SYS => eventType=${se.eventType} (${typeof se.eventType})`);
    }
    if (event?.audioEvent) {
      appendEventLog(`AUDIO => pcm length=${event.audioEvent.audioPcm?.length}`);
    }
    if (event?.jsonData) {
      appendEventLog(`jsonData => ${JSON.stringify(event.jsonData, null, 0)}`);
    }
    if (!event.listEvent && !event.textEvent && !event.sysEvent && !event.audioEvent) {
      appendEventLog(`UNKNOWN event shape! Full: ${rawStr}`);
    }

    console.log('🔥 RAW EVENT:', JSON.stringify(event, null, 2));

    // Check textEvent (swipes come here)
    if (event?.textEvent) {
      const eventType = event.textEvent.eventType;

      if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
        flashIndicator('ind-scroll-top', 'SCROLL_TOP_EVENT');
        if (this.swipeThrottleOk()) await this.handleSwipeLeft();
      } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        flashIndicator('ind-scroll-bottom', 'SCROLL_BOTTOM_EVENT');
        if (this.swipeThrottleOk()) await this.handleSwipeRight();
      } else if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
        flashIndicator('ind-click', 'TEXT CLICK_EVENT');
        await this.handleTap();
      } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        flashIndicator('ind-double-click', 'TEXT DOUBLE_CLICK_EVENT');
        await this.handleDoubleTap();
      }
    }

    // Check sysEvent (taps/double-taps come here)
    if (event?.sysEvent) {
      const eventType = event.sysEvent.eventType;

      if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
        flashIndicator('ind-click', 'SYS CLICK_EVENT');
        await this.handleTap();
      } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        flashIndicator('ind-double-click', 'SYS DOUBLE_CLICK_EVENT');
        await this.handleDoubleTap();
      } else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
        flashIndicator('ind-scroll-top', 'SYS SCROLL_TOP_EVENT');
        if (this.swipeThrottleOk()) await this.handleSwipeLeft();
      } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        flashIndicator('ind-scroll-bottom', 'SYS SCROLL_BOTTOM_EVENT');
        if (this.swipeThrottleOk()) await this.handleSwipeRight();
      }
    }

    // Check listEvent — only used by the feeds view (ListContainerProperty)
    if (event?.listEvent) {
      const le = event.listEvent;
      const eventType = le.eventType;

      if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
        // The device tells us which feed was tapped via currentSelectItemIndex
        const idx = le.currentSelectItemIndex;
        flashIndicator('ind-click', `LIST CLICK idx=${idx}`);
        if (this.view === 'feeds' && idx != null && idx >= 0 && idx < FEED_OPTIONS.length) {
          this.savedFeedIndex = idx;
          this.selectedIndex = idx;
          setCurrentFeed(FEED_OPTIONS[idx]);
          const webSelect = document.getElementById('web-feed-select') as HTMLSelectElement | null;
          const simSelect = document.getElementById('sim-feed-select') as HTMLSelectElement | null;
          if (webSelect) webSelect.value = String(idx);
          if (simSelect) simSelect.value = String(idx);
          await this.loadPosts();
        }
      } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        flashIndicator('ind-double-click', 'LIST DOUBLE_CLICK_EVENT');
        // double-tap on feed list has nothing to go back to, ignore
      }
      // scroll events are handled natively by the list widget — no manual paging needed
    }
  }

  private async handleSwipeLeft() {
    if (this.view === 'feeds') {
      // Feeds use a native list — scrolling is handled by the device
      return;
    } else if (this.view === 'posts') {
      if (this.selectedIndex <= 1) return;
      this.selectedIndex--;
      await this.renderPostsPage();
    } else if (this.view === 'comments') {
      if (this.selectedIndex === 0) return;
      this.selectedIndex--;
      await this.renderCommentsPage();
    } else if (this.view === 'comment-detail') {
      if (this.savedCommentIndex <= 0) return;
      this.savedCommentIndex--;
      await this.renderCommentDetail();
    }
  }

  private async handleSwipeRight() {
    if (this.view === 'feeds') {
      // Feeds use a native list — scrolling is handled by the device
      return;
    } else if (this.view === 'posts') {
      const maxIdx = this.posts.length - 1;
      if (this.selectedIndex >= maxIdx) return;
      this.selectedIndex++;
      await this.renderPostsPage();
    } else if (this.view === 'comments') {
      const maxIdx = this.comments.length - 1;
      if (this.selectedIndex >= maxIdx) return;
      this.selectedIndex++;
      await this.renderCommentsPage();
    } else if (this.view === 'comment-detail') {
      const maxIdx = this.comments.length - 1;
      if (this.savedCommentIndex >= maxIdx) return;
      this.savedCommentIndex++;
      await this.renderCommentDetail();
    }
  }

  private async handleTap() {
    if (this.view === 'feeds') {
      // Feeds tap is handled by listEvent (native list widget) — nothing to do here
      return;
    } else if (this.view === 'posts') {
      await this.loadCommentsForSelectedPost();
    } else if (this.view === 'comments') {
      this.savedCommentIndex = this.selectedIndex;
      this.view = 'comment-detail';
      await this.renderCommentDetail();
    }
  }

  private async handleDoubleTap() {
    if (this.view === 'comment-detail') {
      this.view = 'comments';
      this.selectedIndex = this.savedCommentIndex;
      await this.renderCommentsPage();
    } else if (this.view === 'comments') {
      this.view = 'posts';
      this.selectedIndex = this.savedPostIndex;
      await this.renderPostsPage();
    } else if (this.view === 'posts') {
      await this.showFeedSelector();
    }
  }
}
