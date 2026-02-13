# rdt

A Reddit reader for [Even G2](https://www.evenrealities.com/) smart glasses. Browse top posts and comments from configurable subreddit feeds using touchpad gestures.

Built with the [EvenHub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk) and TypeScript.

## Requirements

- [Node.js](https://nodejs.org/) (v18+)
- Even G2 glasses paired with the EvenHub app

## Getting Started

```bash
npm install
npm run dev
npm run qr
```
Note: Keep `npm run dev` running while using `npm run qr` (use a split terminal or a second terminal window).

Scan the QR code with the EvenHub app to load the app on your glasses.

## Controls

| Gesture | Action |
|---|---|
| Swipe forward | Next post / scroll down |
| Swipe backward | Previous post / scroll up |
| Single tap | Open comments / cycle view |
| Double tap | Back / switch feed |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run qr` | Show QR code for EvenHub |
| `npm run build` | Production build |
| `npm run pack` | Build and package as `.ehpk` |
