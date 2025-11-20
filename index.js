import axios from "axios";
import dotenv from "dotenv";
import { WilliamsR } from "technicalindicators";
dotenv.config();

const PAIR = "BTCUSDT";
const CONTRACT_TYPE = "PERPETUAL";

console.log("📌 Bot started!");

runEveryMinute();
setInterval(() => runEveryMinute(), 60 * 1000);

// Test TG
async function testTelegram() {
    await notify(
        {
            TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
            CHAT_ID: process.env.CHAT_ID,
        },
        "✅ Test message from Node.js + Axios!"
    );
}
// testTelegram();

// =======================
// TIME FORMAT
// =======================
function formatTime(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
    ).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// ===============================
// FETCH HISTORY KLINES 1M
// ===============================
async function getHistoryKlines({
                                    pair = PAIR,
                                    limit = 200,
                                    endTime = Date.now(),
                                    interval = "1m",
                                    contractType = CONTRACT_TYPE,
                                }) {
    const url =
        `https://www.binance.com/fapi/v1/continuousKlines?interval=${interval}` +
        `&endTime=${endTime}&limit=${limit}&pair=${pair}&contractType=${contractType}`;

    try {
        const res = await axios.get(url);
        const data = res.data;

        if (!Array.isArray(data)) {
            console.log("❌ API Error:", data);
            return [];
        }

        return data.map((c) => ({
            time: formatTime(c[0]),
            timestamp: c[0],
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5]),
            closeTime: c[6],
            trades: c[8],
        }));
    } catch (err) {
        console.log("❌ Fetch klines error:", err.message);
        return [];
    }
}

// ===============================
// TÍNH WILLIAMS %R
// ===============================
function calcWilliams(candles) {
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);

    function wr(period) {
        if (candles.length < period) return null;

        return WilliamsR.calculate({
            high: highs.slice(-period),
            low: lows.slice(-period),
            close: closes.slice(-period),
            period,
        }).slice(-1)[0]; // lấy giá trị mới nhất
    }

    return {
        w14: wr(14),
        w70: wr(70),
        w140: wr(140),
    };
}

// ===============================
// CHECK WILLIAMS CONDITION
// ===============================
function checkWilliams({ w14, w70, w140 }) {
    if (w14 == null || w70 == null || w140 == null) return false;

    // W%R > -30 tương đương vùng > 70
    return w14 > -30 && w70 > -30 && w140 > -30;
}

// ===============================
// CONDITIONS — LONG
// ===============================
function long1(candles) {
    if (candles.length < 10) return false;
    const arr = candles.slice(-10).map((c) => c.close);
    return arr.every((p, i) => i === 0 || p > arr[i - 1]);
}

function long2(candles) {
    if (candles.length < 7) return false;
    const arr = candles.slice(-7).map((c) => c.close);

    return arr.slice(0, 6).every((p, i) => i === 0 || p > arr[i - 1]) && arr[6] < arr[5];
}

function long3(candles) {
    if (candles.length < 3) return false;
    return candles.slice(-3).every((c) => (c.high - c.low) / c.low > 0.0025);
}

// ===============================
// CONDITIONS — SHORT
// ===============================
function short1(candles) {
    if (candles.length < 10) return false;
    const arr = candles.slice(-10).map((c) => c.close);
    return arr.every((p, i) => i === 0 || p < arr[i - 1]);
}

function short2(candles) {
    if (candles.length < 7) return false;
    const arr = candles.slice(-7).map((c) => c.close);

    return arr.slice(0, 6).every((p, i) => i === 0 || p < arr[i - 1]) && arr[6] > arr[5];
}

function short3(candles) {
    if (candles.length < 3) return false;
    return candles.slice(-3).every((c) => (c.high - c.low) / c.high > 0.0025);
}

// ===============================
// TELEGRAM
// ===============================
async function notify(env, msg) {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;

    try {
        await axios.post(url, {
            chat_id: env.CHAT_ID,
            text: msg,
        });

        console.log("📨 TG SENT:", msg);
    } catch (e) {
        console.log("❌ TG ERROR:", e.message);
    }
}

// ===============================
// CHECK SIGNALS
// ===============================
async function checkSignals(candles, env) {
    const williams = calcWilliams(candles);
    console.log("📊 W%R:", williams);

    const wOK = checkWilliams(williams);

    // ——— LONG ———
    if (wOK && long1(candles)) await notify(env, "📈 LONG – Điều kiện 1 + Williams");
    if (wOK && long2(candles)) await notify(env, "📈 LONG – Điều kiện 2 + Williams");
    if (wOK && long3(candles)) await notify(env, "📈 LONG – Điều kiện 3 + Williams");

    // ——— SHORT ———
    if (wOK && short1(candles)) await notify(env, "📉 SHORT – Điều kiện 1 + Williams");
    if (wOK && short2(candles)) await notify(env, "📉 SHORT – Điều kiện 2 + Williams");
    if (wOK && short3(candles)) await notify(env, "📉 SHORT – Điều kiện 3 + Williams");
}

// ===============================
// JOB CHÍNH
// ===============================
async function runEveryMinute() {
    console.log("\n⏳ Running job...");

    const candles = await getHistoryKlines({
        pair: PAIR,
        limit: 200,
        endTime: Date.now(),
    });

    if (!Array.isArray(candles) || candles.length === 0) {
        console.log("⚠️ No candle data");
        return;
    }

    console.log("📘 Latest Candle:", candles[candles.length - 1]);

    await checkSignals(candles, {
        TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
        CHAT_ID: process.env.CHAT_ID,
    });
}
