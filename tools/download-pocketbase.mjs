import fs from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const REPO_API_LATEST = 'https://api.github.com/repos/pocketbase/pocketbase/releases/latest';

function parseArguments() {
  const args = process.argv.slice(2);
  const result = { platform: null, arch: null };

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--platform' && i + 1 < args.length) {
      result.platform = args[++i];
    } else if (args[i] === '--arch' && i + 1 < args.length) {
      result.arch = args[++i];
    }
  }

  return result;
}

function resolveTarget(overridePlatform = null, overrideArch = null) {
  const platformMap = { win32: 'windows', linux: 'linux', darwin: 'darwin' };
  const archMap = { x64: 'amd64', arm64: 'arm64' };

  const platform = overridePlatform ?? platformMap[process.platform];
  const arch = overrideArch ?? archMap[process.arch];

  if (!platform || !['windows', 'linux', 'darwin'].includes(platform)) {
    throw new Error(`Unsupported platform: ${overridePlatform ?? process.platform}`);
  }
  if (!arch || !['amd64', 'arm64'].includes(arch)) {
    throw new Error(`Unsupported architecture: ${overrideArch ?? process.arch}`);
  }

  return { platform, arch };
}

async function fetchLatestRelease() {
  const response = await fetch(REPO_API_LATEST, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'snesflix-download-pocketbase',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch release metadata: ${response.status}`);
  }

  return response.json();
}

function findAsset(release, platform, arch) {
  const expected = `_${platform}_${arch}.zip`;
  const asset = release.assets?.find((item) => item.name?.includes(expected));
  if (!asset?.browser_download_url) {
    throw new Error(`No release asset for ${platform}/${arch}`);
  }
  return asset;
}

function findEndOfCentralDirectory(buffer) {
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('Invalid ZIP: end of central directory not found');
}

function extractEntryBuffer(zipBuffer, matcher) {
  const eocdOffset = findEndOfCentralDirectory(zipBuffer);
  const centralDirectorySize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  let cursor = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (cursor < end) {
    if (zipBuffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Invalid ZIP: central directory signature mismatch');
    }

    const compressionMethod = zipBuffer.readUInt16LE(cursor + 10);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(cursor + 24);
    const fileNameLength = zipBuffer.readUInt16LE(cursor + 28);
    const extraLength = zipBuffer.readUInt16LE(cursor + 30);
    const commentLength = zipBuffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);

    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const entryName = zipBuffer.toString('utf8', fileNameStart, fileNameEnd);

    if (matcher(entryName)) {
      if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error('Invalid ZIP: local header signature mismatch');
      }
      const localFileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) return compressedData;
      if (compressionMethod === 8) {
        const result = inflateRawSync(compressedData);
        if (result.length !== uncompressedSize) {
          throw new Error(`Invalid ZIP: unexpected size for ${entryName}`);
        }
        return result;
      }
      throw new Error(`Unsupported ZIP compression method ${compressionMethod}`);
    }

    cursor = fileNameEnd + extraLength + commentLength;
  }

  throw new Error('PocketBase binary not found in ZIP');
}

async function downloadAsset(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'snesflix-download-pocketbase',
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Failed to download PocketBase: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const args = parseArguments();
  const { platform, arch } = resolveTarget(args.platform, args.arch);
  const release = await fetchLatestRelease();
  const asset = findAsset(release, platform, arch);

  process.stdout.write(`Downloading ${asset.name} (${release.tag_name})...\n`);
  const zipBuffer = await downloadAsset(asset.browser_download_url);
  const binaryName = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
  const binary = extractEntryBuffer(
    zipBuffer,
    (entry) => entry.endsWith(`/${binaryName}`) || entry === binaryName,
  );

  const binDir = path.join(process.cwd(), 'bin');
  await fs.mkdir(binDir, { recursive: true });
  const outputPath = path.join(binDir, binaryName);
  await fs.writeFile(outputPath, binary);
  if (process.platform !== 'win32') await fs.chmod(outputPath, 0o755);

  process.stdout.write(`PocketBase installed at ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
