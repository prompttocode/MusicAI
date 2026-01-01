const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
app.use(express.json());

// --- CẤU HÌNH ---

// 1. Đường dẫn file chạy music-cli (Trong venv)
const MUSIC_CLI_PATH = path.join(__dirname, "venv", "bin", "music-cli");

// 2. Thư mục music-cli nhả file ra (Mặc định trên Mac/Linux)
const SOURCE_DIR = path.join(os.homedir(), ".config", "music-cli", "ai_music");

// 3. Thư mục Web Public của dự án (Nơi mình sẽ lưu file để tạo link)
const PUBLIC_DIR = path.join(__dirname, "public", "music");

// Tạo thư mục public/music nếu chưa có
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// QUAN TRỌNG: Mở cổng cho thư mục này để bên ngoài truy cập được file
app.use("/music", express.static(PUBLIC_DIR));

// Hàm lấy IP mạng LAN (Để điện thoại cùng Wifi truy cập được)
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
};

// Hàm tìm file mới nhất vừa sinh ra
const getNewestFile = (dir) => {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".wav") || f.endsWith(".mp3"))
    .map((f) => ({
      name: f,
      time: fs.statSync(path.join(dir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);
  return files.length > 0 ? files[0].name : null;
};

// --- TỰ ĐỘNG DỌN DẸP ---
const CLEANUP_MAX_AGE_SECONDS = 300; // 1 giờ

const cleanupOldFiles = (dir, maxAgeSeconds) => {
  console.log(
    `\n🧹 Bắt đầu dọn dẹp file cũ hơn ${
      maxAgeSeconds / 3600
    } giờ trong thư mục ${dir}...`
  );
  try {
    const files = fs.readdirSync(dir);
    const now = Date.now();

    files.forEach((file) => {
      // Chỉ xử lý các file nhạc
      if (!file.endsWith(".wav") && !file.endsWith(".mp3")) return;

      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        const fileAgeSeconds = (now - stat.mtime.getTime()) / 1000;

        if (fileAgeSeconds > maxAgeSeconds) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Đã xóa file cũ: ${file}`);
        }
      } catch (statErr) {
        // Bỏ qua lỗi nếu file không còn tồn tại (có thể đã bị xóa bởi một request khác)
      }
    });
    console.log("✅ Dọn dẹp xong.");
  } catch (err) {
    console.error("❌ Lỗi trong quá trình dọn dẹp:", err.message);
  }
};

// --- API ---

const handleMusicGeneration = (model, req, res) => {
  // Chạy tác vụ dọn dẹp ở chế độ non-blocking để không làm chậm request
  setTimeout(() => cleanupOldFiles(PUBLIC_DIR, CLEANUP_MAX_AGE_SECONDS), 0);

  const { prompt, duration } = req.body;
  const userPrompt = prompt || "a beautiful song"; // Default prompt chung
  const time = duration || 10;

  console.log(`\n🎵 Đang tạo [${model}]: "${userPrompt}" (${time}s)...`);

  const command = `"${MUSIC_CLI_PATH}" ai play -m ${model} -d ${time} -p "${userPrompt}"`;

  exec(command, (error, stdout, stderr) => {
    // The command can "fail" if playback doesn't work, but the file is still created.
    // We check for this specific error and treat it as a success.
    if (error) {
      if (stderr.includes("Error: Failed to start playback")) {
        console.warn(`⚠️  [${model}] Lỗi phát nhạc (bỏ qua):`, stderr.trim());
        console.log(
          `✅ File đã được tạo với model ${model}, tiếp tục xử lý...`
        );
        // This is not a fatal error, so we proceed.
      } else {
        // This is a different, unexpected error.
        console.error(`❌ Lỗi AI nghiêm trọng [${model}]:`, error.message);
        return res
          .status(500)
          .json({ error: `Lỗi tạo file với model ${model}` });
      }
    }

    // Tìm file vừa tạo ở kho nguồn
    const generatedFile = getNewestFile(SOURCE_DIR);

    if (generatedFile) {
      const oldPath = path.join(SOURCE_DIR, generatedFile);

      // Đặt tên mới kèm timestamp để không bị trùng
      const newFileName = `track_${Date.now()}.wav`;
      const newPath = path.join(PUBLIC_DIR, newFileName);

      try {
        // Di chuyển file sang thư mục public
        fs.renameSync(oldPath, newPath);

        // Tạo Link trả về
        const myIP = getLocalIP();
        const musicUrl = `http://${myIP}:3000/music/${newFileName}`;

        console.log(`✅ Xong! [${model}] Link nhạc: ${musicUrl}`);

        // TRẢ VỀ JSON CHỨA LINK (Đúng ý bác)
        res.json({
          success: true,
          url: musicUrl,
          prompt: userPrompt,
          model: model,
        });
      } catch (err) {
        console.error("❌ Lỗi di chuyển file:", err);
        res.status(500).json({ error: "Không lưu được file" });
      }
    } else {
      res
        .status(500)
        .json({ error: `AI [${model}] chạy xong nhưng không thấy file đâu` });
    }
  });
};

// API gốc, giờ sẽ dùng audioldm-s-full-v2
app.post("/musicAI", (req, res) => {
  handleMusicGeneration("audioldm-s-full-v2", req, res);
});

// API cho musicgen-large
app.post("/musicgen", (req, res) => {
  handleMusicGeneration("musicgen-large", req, res);
});

// API cho audioldm-l-full
app.post("/audioLDM", (req, res) => {
  handleMusicGeneration("audioldm-l-full", req, res);
});

// API cho bark
app.post("/bark", (req, res) => {
  handleMusicGeneration("bark", req, res);
});

const PORT = 3000;

// --- KHỞI ĐỘNG DAEMON & SERVER ---
console.log("🎵 Khởi động music-cli daemon...");
const daemonCommand = `"${MUSIC_CLI_PATH}" daemon start`;

exec(daemonCommand, (err, stdout, stderr) => {
  // Thường thì daemon sẽ không báo lỗi nếu đã chạy, chỉ in ra stdout/stderr
  if (err) {
    console.error("❌ Lỗi khởi động daemon:", err.message);
  }
  if (stderr) {
    // Daemon's "already running" message goes to stderr
    console.info(`ℹ️  Daemon: ${stderr.trim()}`);
  }
  if (stdout && stdout.trim()) {
    console.info(`✅ Daemon: ${stdout.trim()}`);
  }

  // Sau khi có kết quả từ daemon, khởi động server
  app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại: http://${getLocalIP()}:${PORT}`);
  });
});
