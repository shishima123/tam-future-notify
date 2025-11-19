# Binance Candle Scanner – Installation & Run Guide

## Requirements
- Node.js v16+
- npm

## Installation

```bash
npm install
```

## Configuration

Edit the following values inside `index.js`:

```js
const TELEGRAM_TOKEN = "YOUR_TELEGRAM_TOKEN";
const CHAT_ID = "YOUR_CHAT_ID";
```

Or create a `.env` file if you prefer.

## Run the bot

```bash
node index.js
```

The console will start showing debug logs and real‑time candle updates.
