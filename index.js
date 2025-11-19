import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const SYMBOL = "BTCUSDT";          // ví dụ cho fetch realtime
const PAIR = "SENTUSDT";           // dùng klines history
const CONTRACT_TYPE = "PERPETUAL";

// =======================
// START + CRON 1 PHÚT
// =======================
console.log("📌 Bot started!");

runEveryMinute(); // chạy ngay khi start

setInterval(() => {
    runEveryMinute();
}, 60 * 1000);

// =======================
// MANUAL TEST TELEGRAM
// =======================
async function testTelegram() {
    await notify(
        {
            TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
            CHAT_ID: process.env.CHAT_ID,
        },
        "✅ Test message from Node.js + Axios!"
    );
}
// testTelegram(); // ← bật để test 1 lần

// =======================
// TIME FORMAT
// =======================
function formatTime(ts) {
    const d = new Date(ts);

    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    const HH = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");

    return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

// ===============================
// FETCH HISTORY KLINES (1M)
// ===============================
async function getHistoryKlines(
    {
        pair = PAIR,
        limit = 10,
        endTime = Date.now(),
        interval = "1m",
        contractType = CONTRACT_TYPE
    }
) {
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

        // Format candle
        return data.map(c => ({
            time: formatTime(c[0]),       // open time
            timestamp: c[0],
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5]),
            closeTime: c[6],
            trades: c[8]
        }));
    } catch (err) {
        console.log("❌ Fetch klines error:", err.message);
        return [];
    }
}

// =======================
// JOB CHÍNH
// =======================
async function runEveryMinute() {
    console.log("\n⏳ Running job...");

    const candles = await getHistoryKlines({
        pair: PAIR,
        limit: 50,
        endTime: Date.now()
    });

    if (!Array.isArray(candles) || candles.length === 0) {
        console.log("⚠️ No candle data");
        return;
    }

    console.log("📘 Latest Candles:\n", candles); // in 5 nến cuối

    await checkSignals(candles, {
        TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
        CHAT_ID: process.env.CHAT_ID,
    });
}

// ===========================================
// SIGNALS — LONG (đã đổi tên theo yêu cầu)
// ===========================================
function long1(candles) {
    if (candles.length < 10) return false;
    const arr = candles.slice(-10).map(c => c.close);
    return arr.every((p, i) => i === 0 || p > arr[i - 1]);
}

function long2(candles) {
    if (candles.length < 7) return false;
    const arr = candles.slice(-7).map(c => c.close);

    return (
        arr.slice(0, 6).every((p, i) => i === 0 || p > arr[i - 1]) &&
        arr[6] < arr[5]
    );
}

function long3(candles) {
    if (candles.length < 3) return false;

    return candles.slice(-3).every(c => {
        return (c.high - c.low) / c.low > 0.0025;
    });
}

// ===========================================
// SIGNALS — SHORT (giữ nguyên)
// ===========================================
function short1(candles) {
    if (candles.length < 10) return false;
    const arr = candles.slice(-10).map(c => c.close);
    return arr.every((p, i) => i === 0 || p < arr[i - 1]);
}

function short2(candles) {
    if (candles.length < 7) return false;
    const arr = candles.slice(-7).map(c => c.close);

    return (
        arr.slice(0, 6).every((p, i) => i === 0 || p < arr[i - 1]) &&
        arr[6] > arr[5]
    );
}

function short3(candles) {
    if (candles.length < 3) return false;

    return candles.slice(-3).every(c => {
        return (c.high - c.low) / c.high > 0.0025;
    });
}

// ===============================
// TELEGRAM NOTIFY (AXIOS)
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
// CHECK ALL SIGNALS
// ===============================
async function checkSignals(candles, env) {
    // ——— LONG ———
    if (long1(candles)) await notify(env, "📈 LONG – Điều kiện 1");
    if (long2(candles)) await notify(env, "📈 LONG – Điều kiện 2");
    if (long3(candles)) await notify(env, "📈 LONG – Điều kiện 3");

    // ——— SHORT ———
    if (short1(candles)) await notify(env, "📉 SHORT – Điều kiện 1");
    if (short2(candles)) await notify(env, "📉 SHORT – Điều kiện 2");
    if (short3(candles)) await notify(env, "📉 SHORT – Điều kiện 3");
}
