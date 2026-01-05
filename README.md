# Music Generator API

Đây là một API Node.js để tạo nhạc bằng AI sử dụng công cụ music-cli.

## Yêu cầu hệ thống

- Node.js (phiên bản 14 trở lên)
- Python 3 (để chạy music-cli)
- pip (để cài đặt music-cli)

## Cài đặt

1. **Clone repository:**

   ```
   git clone <repository-url>
   cd music-generator-api
   ```

2. **Cài đặt dependencies Node.js:**

   ```
   npm install
   ```

3. **Thiết lập môi trường Python và cài đặt music-cli:**

   Tạo virtual environment:

   ```
   python3 -m venv venv
   ```

   Kích hoạt virtual environment:

   - Trên macOS/Linux:
     ```
     source venv/bin/activate
     ```
   - Trên Windows:
     ```
     venv\Scripts\activate
     ```

   Cài đặt music-cli (giả sử có sẵn trên PyPI hoặc từ source):

   ```
   pip install music-cli
   ```

   (Nếu music-cli không có trên PyPI, hãy cài đặt từ source theo hướng dẫn của dự án music-cli.)

4. **Đảm bảo cấu trúc thư mục:**

   Dự án sẽ tự động tạo các thư mục cần thiết như `temp/cli-config` và `public/music` khi chạy.

## Chạy server

1. Đảm bảo virtual environment được kích hoạt (nếu cần).

2. Khởi động server:

   ```
   npm start
   ```

   Server sẽ chạy trên cổng 3000 và hiển thị địa chỉ IP local để truy cập từ thiết bị khác trên cùng mạng.

## Sử dụng API

API cung cấp các endpoint để tạo nhạc với các mô hình AI khác nhau:

- `POST /musicAI`: Sử dụng mô hình audioldm-s-full-v2 (mặc định)
- `POST /musicgen`: Sử dụng mô hình musicgen-large
- `POST /audioLDM`: Sử dụng mô hình audioldm-l-full
- `POST /bark`: Sử dụng mô hình bark

### Ví dụ request:

```json
POST http://localhost:3000/musicAI
Content-Type: application/json

{
  "prompt": "nhạc jazz vui vẻ",
  "duration": 15
}
```

### Response:

```json
{
  "success": true,
  "url": "http://192.168.1.100:3000/music/track_123456789.wav",
  "prompt": "nhạc jazz vui vẻ",
  "model": "audioldm-s-full-v2"
}
```

## Lưu ý

- Server sẽ tự động dọn dẹp file nhạc cũ sau 1 giờ để tiết kiệm dung lượng.
- Đảm bảo music-cli được cài đặt đúng cách trong virtual environment.
- Nếu gặp lỗi, kiểm tra log console để debug.
