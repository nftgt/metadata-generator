import csv from 'csvtojson'
import * as dotenv from 'dotenv'
import { NFTStorage } from 'nft.storage'
import fs from 'node:fs'
import path from 'node:path'
import { InputData } from './types'

const INPUT_DIR = './input'
const IMAGE_DIR = path.join(INPUT_DIR, 'images')
const OUTPUT_DIR = './output'
const TEMPLATE_FILE = path.join(INPUT_DIR, 'template.md')
const DATA_FILENAME = 'data.csv'
const SEARCHING_EXTENSIONS = ['', '.jpg', '.jpeg', '.png', '.gif', '.mov', '.mp4']

dotenv.config()

function getActualImageFilename(filename: string): string {
  if (filename) {
    for (const ext of SEARCHING_EXTENSIONS) {
      const filenameWithExt = `${filename}${ext}`
      if (fs.existsSync(path.join(IMAGE_DIR, filenameWithExt))) {
        return filenameWithExt
      }
    }
  }

  throw new Error(`Image file not found: ${filename}`)
}

async function loadData(filename = DATA_FILENAME): Promise<InputData[]> {
  const data = await csv().fromFile(path.join(INPUT_DIR, filename))
  return data.map((record: InputData, index: number) => {
    const tokenId = record.tokenId || String(index)
    return {
      ...record,
      tokenId,
      filename: getActualImageFilename(record.filename || tokenId),
    }
  })
}

function validateData(data: InputData[]): string[] {
  const errors: string[] = []

  // TODO: validate required keys
  // TODO: validate duplicated filename

  return errors
}

async function uploadImagesToIpfs(filenames: string[]): Promise<string> {
  const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN as string })
  return 'ipfs://' + client.storeDirectory(filenames)
}

function generateDescription(template: string, data: InputData): string {
  for (const key of Object.keys(data)) {
    template = template.replace(RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), data[key] || '')
  }

  return template
}

async function main() {
  // load
  const records = await loadData()

  // validate
  const errors = validateData(records)
  if (errors.length) {
    console.error('Errors:', '\n', errors.join('\n'))
    return
  }

  // upload images
  let ipfsUrl: string
  if (process.env.DRY_RUN) {
    ipfsUrl = 'ipfs://test'
  } else {
    ipfsUrl = await uploadImagesToIpfs(records.map((record) => path.join(IMAGE_DIR, record.filename)))
  }

  // reset output dir
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // generate metadata
  const template = fs.existsSync(TEMPLATE_FILE) ? fs.readFileSync(TEMPLATE_FILE, 'utf8') : ''
  for (const record of records) {
    let description = record.description || generateDescription(template, record)

    const metadata = {
      name: record.name,
      description,
      image: `${ipfsUrl}/${record.filename}`,
    }

    fs.writeFileSync(path.join(OUTPUT_DIR, `${record.tokenId}.json`), JSON.stringify(metadata))
  }
}

main()
