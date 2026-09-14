const { execSync } = require('child_process');
const fs = require('fs');

if (process.platform === 'win32') {
  const defaultDockerBin = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
  if (fs.existsSync(defaultDockerBin) && !(process.env.PATH || '').toLowerCase().includes('docker\\docker\\resources\\bin')) {
    process.env.PATH = `${defaultDockerBin};${process.env.PATH}`;
  }
}

const action = process.argv[2] === 'stop' ? 'stop postgres redis' : 'up -d --wait postgres redis';

try {
  execSync(`docker compose ${action}`, { stdio: 'inherit', env: process.env });
} catch (err) {
  process.exit(err.status || 1);
}
