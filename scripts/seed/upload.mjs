// Uploads NFT-SAMPLES images + metadata to IPFS via Pinata and writes the manifest that
// contracts/script/Seed.s.sol reads.
//
//   node --env-file=.env scripts/seed/upload.mjs
//
// Needs VITE_PINATA_JWT in the environment. Re-runnable: finished
// uploads are cached in scripts/seed/.uploads.json and skipped.
import { openAsBlob } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const samplesDir = join(root, 'NFT-SAMPLES')
const cachePath = join(here, '.uploads.json')
const manifestPath = join(root, 'contracts', 'script', 'seed-manifest.json')

const jwt = process.env.VITE_PINATA_JWT
if (!jwt) throw new Error('Set VITE_PINATA_JWT in .env')

const MODE = { hold: 0, sale: 1, auction: 2 }
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

async function pinata(path, body) {
  const res = await fetch(`https://api.pinata.cloud${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, ...(typeof body === 'string' && { 'Content-Type': 'application/json' }) },
    body,
  })
  if (!res.ok) throw new Error(`Pinata ${path} failed: ${res.status} ${await res.text()}`)
  return (await res.json()).IpfsHash
}

async function uploadImage(file) {
  const ext = file.split('.').pop().toLowerCase()
  const blob = await openAsBlob(join(samplesDir, file), { type: MIME[ext] })
  const form = new FormData()
  form.append('file', blob, basename(file))
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))
  form.append('pinataMetadata', JSON.stringify({ name: `darkroom-image-${file.slice(0, 40)}` }))
  return pinata('/pinning/pinFileToIPFS', form)
}

function uploadMetadata(item, imageCid) {
  return pinata(
    '/pinning/pinJSONToIPFS',
    JSON.stringify({
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: { name: `darkroom-meta-${item.name}` },
      pinataContent: {
        name: item.name,
        description: item.description,
        image: `ipfs://${imageCid}`,
        attributes: [{ trait_type: 'Medium', value: 'AI-generated' }],
      },
    }),
  )
}

const catalog = JSON.parse(await readFile(join(here, 'catalog.json'), 'utf8'))
const cache = JSON.parse(await readFile(cachePath, 'utf8').catch(() => '{}'))

for (const [i, item] of catalog.items.entries()) {
  const tag = `[${String(i + 1).padStart(2)}/${catalog.items.length}] ${item.name}`
  if (cache[item.file]?.metadataCid) {
    console.log(`${tag}: cached`)
    continue
  }
  const imageCid = cache[item.file]?.imageCid ?? (await uploadImage(item.file))
  cache[item.file] = { imageCid }
  cache[item.file].metadataCid = await uploadMetadata(item, imageCid)
  await writeFile(cachePath, JSON.stringify(cache, null, 2))
  console.log(`${tag}: ${cache[item.file].metadataCid}`)
}

const toWei = (eth) => {
  const [whole, frac = ''] = eth.split('.')
  return (BigInt(whole) * 10n ** 18n + BigInt(frac.padEnd(18, '0'))).toString()
}

// Parallel arrays: easy to read with vm.parseJson*Array in Solidity.
const manifest = {
  uris: catalog.items.map((it) => `ipfs://${cache[it.file].metadataCid}`),
  modes: catalog.items.map((it) => MODE[it.mode]),
  prices: catalog.items.map((it) => (it.priceEth ? toWei(it.priceEth) : '0')),
  durations: catalog.items.map((it) => (it.durationHours ?? 0) * 3600),
  royaltyBps: catalog.royaltyBps,
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`\nWrote ${manifestPath}`)
