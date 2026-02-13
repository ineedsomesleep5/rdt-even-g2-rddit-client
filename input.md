# Even G2 Glasses Input Reference

How touchpad events actually work on the Even G2 glasses, based on testing with the EvenHub SDK.

## Event Routing Summary

| Gesture | Event type | `eventType` value | Arrives as |
|---|---|---|---|
| Swipe forward | `SCROLL_BOTTOM_EVENT` | `2` | `textEvent` |
| Swipe backward | `SCROLL_TOP_EVENT` | `1` | `textEvent` |
| Single tap | `CLICK_EVENT` | `0` | `sysEvent` |
| Double tap | `DOUBLE_CLICK_EVENT` | `3` | `sysEvent` |

**Key insight:** Swipes arrive as `textEvent` (on the container with `isEventCapture=1`), but taps arrive as `sysEvent` — a global system event not tied to any specific container.

## The Protobuf Zero-Value Trap

`CLICK_EVENT = 0` is the protobuf default value. The host omits default values during serialization, so a single tap arrives as:

```json
{ "type": "sysEvent", "jsonData": {} }
```

The SDK parses this as `eventType: undefined`, **not** `eventType: 0`. You must treat `undefined` as a click:

```typescript
if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
  // Handle single tap
}
```

Double tap (`eventType: 3`) is not the default value, so it arrives normally:

```json
{ "type": "sysEvent", "jsonData": { "eventType": 3 } }
```

## Container Setup

Use `TextContainerProperty` for display. Set `isEventCapture: 1` on exactly one container to receive swipe events. Taps don't require `isEventCapture` — they fire as `sysEvent` regardless.

```typescript
const containers: TextContainerProperty[] = [];

for (let i = 0; i < 3; i++) {
  containers.push(new TextContainerProperty({
    xPosition: 0,
    yPosition: i * 96,       // 288 / 3 = 96px per slot
    width: 576,
    height: 96,
    borderWidth: isSelected(i) ? 3 : 0,
    borderColor: 5,
    paddingLength: 2,
    containerID: i + 1,
    containerName: `item-${i + 1}`,
    content: getContent(i),
    isEventCapture: isSelected(i) ? 1 : 0,
  }));
}

// Startup (call once)
await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: containers,
  })
);

// Subsequent updates
await bridge.rebuildPageContainer(
  new RebuildPageContainer({
    containerTotalNum: 3,
    textObject: containers,
  })
);
```

## Event Handling

```typescript
bridge.onEvenHubEvent((event: EvenHubEvent) => {

  // Swipes arrive as textEvent
  if (event.textEvent) {
    const eventType = event.textEvent.eventType;

    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      // Swipe backward — navigate up/previous
    } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      // Swipe forward — navigate down/next
    }
  }

  // Taps arrive as sysEvent
  if (event.sysEvent) {
    const eventType = event.sysEvent.eventType;

    if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
      // Single tap — select/confirm
      // NOTE: eventType 0 is omitted by protobuf, arrives as undefined
    } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      // Double tap — back/cancel
    }
  }
});
```

## Raw Host Message Format

The Even App sends messages via `_listenEvenAppMessage` in this format:

```json
// Swipe (textEvent, eventType present)
{
  "type": "listen_even_app_data",
  "method": "evenHubEvent",
  "data": {
    "type": "textEvent",
    "jsonData": {
      "containerID": 1,
      "containerName": "item-1",
      "eventType": 2
    }
  }
}

// Single tap (sysEvent, eventType 0 OMITTED by protobuf)
{
  "type": "listen_even_app_data",
  "method": "evenHubEvent",
  "data": {
    "type": "sysEvent",
    "jsonData": {}
  }
}

// Double tap (sysEvent, eventType 3 present)
{
  "type": "listen_even_app_data",
  "method": "evenHubEvent",
  "data": {
    "type": "sysEvent",
    "jsonData": {
      "eventType": 3
    }
  }
}
```

## Display Constraints (G1)

- Canvas: **576 x 288** pixels
- Max containers: **4** (per `createStartUpPageContainer` / `rebuildPageContainer`)
- Practical fit: **3 rows** of multi-line text (96px each)
- Title truncation: ~**50 characters** fits one line
- `containerName`: max 16 characters
- `content`: max 1000 characters (startup), 2000 characters (`textContainerUpgrade`)

## OsEventTypeList Enum

```typescript
enum OsEventTypeList {
  CLICK_EVENT = 0,          // Single tap (⚠️ arrives as undefined)
  SCROLL_TOP_EVENT = 1,     // Swipe backward
  SCROLL_BOTTOM_EVENT = 2,  // Swipe forward
  DOUBLE_CLICK_EVENT = 3,   // Double tap
  FOREGROUND_ENTER_EVENT = 4,
  FOREGROUND_EXIT_EVENT = 5,
  ABNORMAL_EXIT_EVENT = 6,
}
```
