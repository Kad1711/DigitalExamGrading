const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_WAIT_SECONDS = 120;
const POLL_INTERVAL_MS = 2000;

function isDaemonReady() {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

function isProcessRunning(processName) {
  try {
    const output = execSync(`tasklist /FI "IMAGENAME eq ${processName}" /NH`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return output.toLowerCase().includes(processName.toLowerCase());
  } catch {
    return false;
  }
}

function findDockerDesktopPath() {
  const candidates = [
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, 'Docker', 'Docker', 'Docker Desktop.exe')
      : null,
    'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Docker', 'Docker Desktop.exe')
      : null,
    process.env['ProgramFiles(x86)']
      ? path.join(process.env['ProgramFiles(x86)'], 'Docker', 'Docker', 'Docker Desktop.exe')
      : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const stdout = execSync('where.exe "Docker Desktop.exe"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
    if (stdout && fs.existsSync(stdout.split('\r\n')[0])) {
      return stdout.split('\r\n')[0];
    }
  } catch {
    // ignore
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // 1. Check if Docker CLI is installed
  try {
    execSync('docker --version', { stdio: 'ignore', timeout: 3000 });
  } catch {
    console.error('\n[Docker Error] Lệnh "docker" không tồn tại hoặc chưa được thêm vào PATH.');
    console.error('Vui lòng cài đặt Docker Desktop từ https://www.docker.com/products/docker-desktop/\n');
    process.exit(1);
  }

  // 2. Check if Docker daemon is already ready
  if (isDaemonReady()) {
    console.log('[Docker] Docker daemon đang hoạt động.');
    process.exit(0);
  }

  console.log('[Docker] Docker daemon chưa sẵn sàng.');

  if (process.platform === 'win32') {
    const desktopExe = findDockerDesktopPath();
    const isRunning = isProcessRunning('Docker Desktop.exe');

    if (!desktopExe && !isRunning) {
      console.error('\n[Docker Error] Không tìm thấy ứng dụng Docker Desktop trên máy tính.');
      console.error('Đường dẫn thông thường: "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"');
      console.error('Vui lòng cài đặt hoặc khởi động Docker Desktop thủ công, sau đó thử lại.\n');
      process.exit(1);
    }

    if (isRunning) {
      console.log('[Docker] Docker Desktop đang trong quá trình khởi động. Đang chờ daemon sẵn sàng...');
    } else {
      console.log(`[Docker] Đang tự động khởi chạy Docker Desktop: "${desktopExe}"...`);
      try {
        const child = spawn(desktopExe, [], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } catch (err) {
        console.error(`[Docker Error] Không thể khởi chạy Docker Desktop: ${err.message}`);
        console.error('Vui lòng khởi động Docker Desktop thủ công.');
        process.exit(1);
      }
    }
  } else if (process.platform === 'darwin') {
    console.log('[Docker] Đang khởi chạy Docker Desktop trên macOS...');
    try {
      execSync('open -a Docker', { stdio: 'ignore' });
    } catch {
      console.error('[Docker Error] Không thể mở Docker.app. Vui lòng mở thủ công.');
      process.exit(1);
    }
  } else {
    console.error('\n[Docker Error] Docker daemon chưa chạy trên Linux.');
    console.error('Vui lòng khởi động dịch vụ: sudo systemctl start docker\n');
    process.exit(1);
  }

  // 3. Poll until Docker daemon is ready or timeout
  const startTime = Date.now();
  let dots = 0;

  while (Date.now() - startTime < MAX_WAIT_SECONDS * 1000) {
    await sleep(POLL_INTERVAL_MS);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (isDaemonReady()) {
      console.log(`\n[Docker] Docker daemon đã sẵn sàng sau ${elapsed}s!`);
      process.exit(0);
    }

    dots = (dots + 1) % 4;
    process.stdout.write(`\r[Docker] Đang chờ Docker daemon khởi động (${elapsed}s / ${MAX_WAIT_SECONDS}s)${'.'.repeat(dots)}${' '.repeat(4 - dots)}`);
  }

  console.error(`\n\n[Docker Error] Quá thời gian chờ (${MAX_WAIT_SECONDS}s) để Docker daemon sẵn sàng.`);
  console.error('Vui lòng kiểm tra Docker Desktop và thử lại.\n');
  process.exit(1);
}

main().catch((err) => {
  console.error('[Docker Unexpected Error]', err);
  process.exit(1);
});
