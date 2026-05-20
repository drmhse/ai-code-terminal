import { spawn } from 'node:child_process';
import { networkInterfaces, platform } from 'node:os';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const frontendDir = join(rootDir, 'frontend');

const mode = process.argv[2] ?? 'web';
const frontendPort = process.env.ACT_FRONTEND_PORT ?? '4000';
const frontendHost = process.env.ACT_FRONTEND_HOST ?? 'localhost';
const apiBaseUrl = process.env.ACT_API_BASE_URL ?? defaultApiBaseUrl();

const supportedModes = new Set([
  'web',
  'desktop',
  'ios',
  'android',
  'simulator:ios',
  'simulator:ipad',
]);

let shuttingDown = false;
const children = [];

function defaultApiBaseUrl() {
  if (mode === 'android') {
    return 'http://10.0.2.2:3001';
  }
  if (mode === 'ios') {
    return `http://${localLanIp()}:3001`;
  }
  return 'http://127.0.0.1:3001';
}

function prefixStream(stream, label) {
  const lines = createInterface({ input: stream });
  lines.on('line', (line) => {
    process.stdout.write(`[${label}] ${line}\n`);
  });
}

function run(label, command, args, options) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  children.push(child);
  prefixStream(child.stdout, label);
  prefixStream(child.stderr, label);

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      const suffix = signal ? `signal ${signal}` : `code ${code}`;
      process.stderr.write(`[dev] ${label} exited with ${suffix}\n`);
      shutdown(code ?? 1);
    }
  });

  child.on('error', (error) => {
    process.stderr.write(`[dev] failed to start ${label}: ${error.message}\n`);
    shutdown(1);
  });
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed with code ${code}\n${stderr}`,
        ),
      );
    });
  });
}

async function flutterDevices() {
  const { stdout } = await runCapture('flutter', ['devices', '--machine'], {
    cwd: frontendDir,
  });
  return JSON.parse(stdout);
}

function isIosDevice(device) {
  return device.targetPlatform?.startsWith('ios') === true;
}

function isAndroidDevice(device) {
  return device.targetPlatform?.startsWith('android') === true;
}

function deviceLabel(device) {
  return `${device.name} (${device.id}, ${device.targetPlatform}, ${
    device.emulator ? 'simulator/emulator' : 'physical'
  })`;
}

function printDevices(devices) {
  if (devices.length === 0) {
    process.stderr.write('[dev] Flutter reported no available devices.\n');
    return;
  }
  process.stderr.write('[dev] Available Flutter devices:\n');
  for (const device of devices) {
    process.stderr.write(`[dev] - ${deviceLabel(device)}\n`);
  }
}

function localLanIp() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return '127.0.0.1';
}

function desktopDeviceId() {
  const currentPlatform = platform();
  if (currentPlatform === 'darwin') {
    return 'macos';
  }
  if (currentPlatform === 'win32') {
    return 'windows';
  }
  return 'linux';
}

async function simulatorFromXcode(kind) {
  if (platform() !== 'darwin') {
    return null;
  }

  let devicesJson;
  try {
    const { stdout } = await runCapture('xcrun', [
      'simctl',
      'list',
      'devices',
      'available',
      '--json',
    ]);
    devicesJson = JSON.parse(stdout);
  } catch {
    return null;
  }

  const wantsIpad = kind === 'ipad';
  const devices = Object.values(devicesJson.devices ?? {})
    .flat()
    .filter((device) => {
      const isIpad = device.name.toLowerCase().includes('ipad');
      return wantsIpad
        ? isIpad
        : !isIpad && device.name.toLowerCase().includes('iphone');
    });

  const simulator =
    devices.find((device) => device.state === 'Booted') ?? devices[0] ?? null;
  if (!simulator) {
    return null;
  }

  if (simulator.state !== 'Booted') {
    process.stdout.write(`[dev] Booting ${simulator.name} simulator...\n`);
    await runCapture('xcrun', ['simctl', 'boot', simulator.udid]).catch(
      () => {},
    );
  }
  await runCapture('open', ['-a', 'Simulator']).catch(() => {});

  return simulator.udid;
}

async function resolveTarget() {
  if (!supportedModes.has(mode)) {
    process.stderr.write(
      `[dev] Unsupported mode "${mode}". Use one of: ${[...supportedModes].join(', ')}\n`,
    );
    process.exit(1);
  }

  if (mode === 'web') {
    return {
      label: `http://${frontendHost}:${frontendPort}`,
      flutterArgs: [
        'run',
        '-d',
        'web-server',
        `--web-hostname=${frontendHost}`,
        `--web-port=${frontendPort}`,
      ],
    };
  }

  if (mode === 'desktop') {
    const deviceId = process.env.ACT_FLUTTER_DEVICE_ID ?? desktopDeviceId();
    return {
      label: deviceId,
      flutterArgs: ['run', '-d', deviceId],
    };
  }

  const devices = await flutterDevices();

  if (mode === 'ios' || mode === 'android') {
    const matcher = mode === 'ios' ? isIosDevice : isAndroidDevice;
    const device = devices.find(
      (candidate) => matcher(candidate) && !candidate.emulator,
    );
    if (!device) {
      process.stderr.write(`[dev] No connected physical ${mode} device found.\n`);
      printDevices(devices);
      process.exit(1);
    }
    return {
      label: deviceLabel(device),
      flutterArgs: ['run', '-d', device.id],
    };
  }

  const wantsIpad = mode === 'simulator:ipad';
  const simulator = devices.find((candidate) => {
    if (!isIosDevice(candidate) || !candidate.emulator) {
      return false;
    }
    const name = candidate.name.toLowerCase();
    return wantsIpad ? name.includes('ipad') : !name.includes('ipad');
  });
  const simulatorId =
    simulator?.id ?? (await simulatorFromXcode(wantsIpad ? 'ipad' : 'ios'));

  if (!simulatorId) {
    process.stderr.write(
      `[dev] No available ${wantsIpad ? 'iPad' : 'iOS'} simulator found.\n`,
    );
    printDevices(devices);
    process.exit(1);
  }

  return {
    label: simulator ? deviceLabel(simulator) : simulatorId,
    flutterArgs: ['run', '-d', simulatorId],
  };
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed && child.exitCode === null) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed && child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }
    process.exit(code);
  }, 1500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const target = await resolveTarget();

process.stdout.write(`[dev] Mode:    ${mode}\n`);
process.stdout.write(`[dev] API URL: ${apiBaseUrl}\n`);
if (mode === 'web') {
  process.stdout.write(`[dev] Web:     ${target.label}\n`);
  process.stdout.write(
    `[dev] Auth redirect origin: http://${frontendHost}:${frontendPort}/auth/callback\n`,
  );
} else {
  process.stdout.write(`[dev] Device:  ${target.label}\n`);
}

run(
  'frontend',
  'flutter',
  [
    ...target.flutterArgs,
    `--dart-define=ACT_API_BASE_URL=${apiBaseUrl}`,
  ],
  {
    cwd: frontendDir,
    env: {
      ...process.env,
      ACT_API_BASE_URL: apiBaseUrl,
    },
  },
);
