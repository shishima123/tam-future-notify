# 📘 Binance Websocket Bot – LONG/SHORT Signal Scanner

Bot này kết nối tới **Binance Futures WebSocket**, đọc dữ liệu realtime và kiểm tra các điều kiện để phát hiện tín hiệu **LONG / SHORT**, sau đó gửi thông báo vào **Telegram**.

---

## 🚀 Setup

### 1. Clone project
```bash
git clone https://github.com/shishima123/tam-future-notify.git
cd tam-future-notify
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Tạo file `.env`

Tạo file `.env` tại thư mục gốc:

```
TELEGRAM_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
CHAT_ID=YOUR_TELEGRAM_CHAT_ID
```

> **Lưu ý:**  
> - Bot Telegram phải được thêm vào group/channel và được cấp quyền gửi tin nhắn.  
> - Đừng commit file `.env` lên GitHub.

---

## ▶️ Run

Chạy bot:

```bash
node index.js
```

Hoặc chạy với tự reload:

```bash
npm install -g nodemon
nodemon index.js
```

---

Bot sẽ tự động:

- Lấy lịch sử 80 giao dịch gần nhất từ REST API  
- Kết nối WebSocket `wss://fstream.binance.com/market/stream`  
- Build nến 1 phút realtime  
- Kiểm tra **3 điều kiện LONG** và **3 điều kiện SHORT**  
- Gửi thông báo Telegram khi thỏa điều kiện  

---

Nếu bạn muốn README **đầy đủ hơn** gồm mô tả logic, screenshot, cấu trúc thư mục, API docs… hãy nói **"viết bản nâng cao"**.
