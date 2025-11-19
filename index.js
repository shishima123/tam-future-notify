require("dotenv").config();
const axios = require("axios");
const WebSocket = require("ws");
const TelegramBot = require("node-telegram-bot-api");

// =========================
// CONFIG
// =========================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!TELEGRAM_TOKEN || !CHAT_ID) {
    console.error("❌ Missing TELEGRAM_TOKEN or CHAT_ID in .env");
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const SYMBOL = "BTCUSDT";

// Lưu nến 1m
let candles = [];

// =========================
// FETCH CANDLE HISTORY
// =========================
async function fetchHistory() {
    const url = "https://www.binance.com/fapi/v1/aggTrades?limit=80&symbol=" + SYMBOL;

    console.log("[REST] Fetching candle history...");

    const res = await axios.get(url);
    const trades = res.data;

    candles = aggregateTradesToCandles(trades);

    console.log(`[REST] Loaded ${candles.length} candles`);
    console.log("[REST] Last candle:", candles[candles.length - 1]);
}

function aggregateTradesToCandles(trades) {
    const map = {};

    trades.forEach((t) => {
        const minute = Math.floor(t.T / 60000);
        const price = parseFloat(t.p);

        if (!map[minute]) {
            map[minute] = {
                time: minute,
                open: price,
                high: price,
                low: price,
                close: price,
            };
        } else {
            map[minute].high = Math.max(map[minute].high, price);
            map[minute].low = Math.min(map[minute].low, price);
            map[minute].close = price;
        }
    });

    return Object.values(map);
}

// =========================
// TELEGRAM
// =========================
function notify(msg) {
    console.log("[TELEGRAM] Sending:", msg);
    bot.sendMessage(CHAT_ID, msg).catch(err => console.log("Telegram Error:", err.message));
}

// =========================
// CONDITIONS WITH LOGGING
// =========================

function cond1_up() {
    if (candles.length < 10) return false;
    const arr = candles.slice(-10);

    let ok = true;
    for (let i = 1; i < arr.length; i++) {
        if (!(arr[i].close > arr[i - 1].close)) ok = false;
    }

    console.log("[COND1] 10 nến tăng dần:", ok);
    return ok;
}

function cond2_up_down() {
    if (candles.length < 7) return false;
    const arr = candles.slice(-7);

    let inc = true;
    for (let i = 1; i < 6; i++) {
        if (!(arr[i].close > arr[i - 1].close)) inc = false;
    }

    let dec = arr[6].close < arr[5].close;

    console.log(`[COND2] 6 tăng: ${inc}, sau đó 1 giảm: ${dec}`);

    return inc && dec;
}

function cond3_volatile() {
    if (candles.length < 3) return false;

    const arr = candles.slice(-3);
    const results = arr.map(c => (c.high - c.low) / c.low);

    const ok = results.every(v => v > 0.0025);

    console.log("[COND3] 3 nến biến động mạnh:", results, "=>", ok);

    return ok;
}

// =========================
// SHORT CONDITIONS
// =========================

function checkShort1() {
    if (candles.length < 10) return false;
    const arr = candles.slice(-10);

    let ok = true;
    for (let i = 1; i < arr.length; i++) {
        if (!(arr[i].close < arr[i - 1].close)) ok = false;
    }

    console.log("[SHORT1] 10 nến giảm dần:", ok);
    return ok;
}

function checkShort2() {
    if (candles.length < 7) return false;
    const arr = candles.slice(-7);

    let dec = true;
    for (let i = 1; i < 6; i++) {
        if (!(arr[i].close < arr[i - 1].close)) dec = false;
    }

    let inc = arr[6].close > arr[5].close;

    console.log(`[SHORT2] 6 giảm: ${dec}, sau đó 1 tăng: ${inc}`);

    return dec && inc;
}

function checkShort3() {
    if (candles.length < 3) return false;

    const arr = candles.slice(-3);
    const results = arr.map(c => (c.high - c.low) / c.high);

    const ok = results.every(v => v > 0.0025);

    console.log("[SHORT3] 3 nến biến động mạnh (giảm):", results, "=>", ok);

    return ok;
}

// =========================
// CHECK LONG / SHORT
// =========================
function checkSignals() {
    console.log("==== Checking signals ====");

    if (cond1_up()) notify("📈 LONG – Điều kiện 1 đạt!");
    if (cond2_up_down()) notify("📈 LONG – Điều kiện 2 đạt!");
    if (cond3_volatile()) notify("📈 LONG – Điều kiện 3 đạt!");

    if (checkShort1()) notify("📉 SHORT – Điều kiện 1 đạt!");
    if (checkShort2()) notify("📉 SHORT – Điều kiện 2 đạt!");
    if (checkShort3()) notify("📉 SHORT – Điều kiện 3 đạt!");
}

// =========================
// WEBSOCKET
// =========================
function startWS() {
    console.log("[WS] Connecting...");
    const ws = new WebSocket("wss://fstream.binance.com/market/stream");

    ws.on("open", () => {
        console.log("[WS] Connected");

        ws.send(
            JSON.stringify({
                method: "SUBSCRIBE",
                params: [
                    "btcusdt_perpetual@continuousKline_1m",
                    "btcusdt@aggTrade",
                ],
                id: 4,
            })
        );

        console.log("[WS] Subscribed to streams");
    });

    ws.on("message", (raw) => {
        const msg = JSON.parse(raw);

        if (msg.stream === "btcusdt@aggTrade") {
            console.log("[WS] trade:", msg.data.p, "qty:", msg.data.q);
            updateFromTrade(msg.data);
        }
    });

    ws.on("error", (err) => {
        console.log("[WS] ERROR:", err.message);
    });

    ws.on("close", () => {
        console.log("[WS] Disconnected. Reconnecting in 2s...");
        setTimeout(startWS, 2000);
    });
}

// =========================
// UPDATE CANDLE
// =========================
function updateFromTrade(trade) {
    const price = parseFloat(trade.p);
    const minute = Math.floor(trade.T / 60000);

    let last = candles[candles.length - 1];
    const lastMin = last?.time;

    if (!last || minute > lastMin) {
        console.log("[CANDLE] New candle created");
        candles.push({
            time: minute,
            open: price,
            high: price,
            low: price,
            close: price,
        });
    } else {
        console.log("[CANDLE] Update current candle:", price);
        last.close = price;
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
    }

    if (candles.length > 200) candles.shift();

    checkSignals();
}

// =========================
// START
// =========================
(async () => {
    testTelegram();
    // await fetchHistory();
    // startWS();
})();

function testTelegram() {
    bot.sendMessage(CHAT_ID, "✅ Telegram Test: Bot đã hoạt động!")
        .then(() => console.log("[TEST] Gửi test Telegram thành công"))
        .catch(err => console.error("[TEST] Lỗi gửi Telegram:", err.message));
}
