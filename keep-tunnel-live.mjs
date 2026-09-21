import { spawn } from 'child_process';

function startTunnel() {
  console.log('Connecting TutorPlug public tunnel...');
  const child = spawn('npx.cmd', ['--yes', 'localtunnel', '--port', '5000'], {
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code) => {
    console.log(`Tunnel closed (code ${code}), reconnecting in 3s...`);
    setTimeout(startTunnel, 3000);
  });

  child.on('error', (err) => {
    console.error('Tunnel error:', err);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
