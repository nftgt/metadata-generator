import csv from 'csvtojson'
import * as dotenv from 'dotenv'
import { filesFromPaths } from 'files-from-path'
import { NFTStorage } from 'nft.storage'
import fs from 'node:fs'
import path from 'node:path'
import pino from 'pino'
import { InputData } from './types'

const INPUT_DIR = './input'
const IMAGE_DIR = path.join(INPUT_DIR, 'images')
const OUTPUT_DIR = './output'
const TEMPLATE_FILE = path.join(INPUT_DIR, 'template.md')
const DATA_FILENAME = 'data.csv'
const SEARCHING_EXTENSIONS = ['', '.jpg', '.jpeg', '.png', '.gif', '.mov', '.mp4']

dotenv.config()

const logger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
})

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
  const files = await filesFromPaths(filenames)
  const url = await client.storeDirectory(files)
  return `ipfs://${url}`
}

function generateDescription(template: string, data: InputData): string {
  for (const key of Object.keys(data)) {
    template = template.replace(RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), data[key] || '')
  }

  return template
}

async function main() {
  logger.info('Starting...')
  logger.info(`Input directory: ${INPUT_DIR}`)
  logger.info(`Dry run: ${process.env.DRY_RUN === 'true' ? 'yes' : 'no'}`)
  await new Promise((r) => setTimeout(r, 2000))

  // load
  logger.info('Loading data...')
  const records = await loadData()
  logger.info(`Loaded ${records.length} records.`)

  // validate
  logger.info('Validating data...')
  const errors = validateData(records)
  if (errors.length) {
    logger.error('Errors:', '\n', errors.join('\n'))
    return
  }
  logger.info('Data is valid.')

  // upload images
  logger.info('Uploading images to IPFS...')
  let ipfsUrl: string
  if (process.env.DRY_RUN === 'true') {
    ipfsUrl = 'ipfs://test'
  } else {
    ipfsUrl = await uploadImagesToIpfs(records.map((record) => path.join(IMAGE_DIR, record.filename)))
  }
  logger.info(`Uploaded images to ${ipfsUrl}`)

  // reset output dir
  if (fs.existsSync(OUTPUT_DIR)) {
    logger.info('Resetting output directory...')
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  logger.info(`Output directory is ready: ${OUTPUT_DIR}`)

  // generate metadata
  logger.info('Generating metadata files...')
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
  logger.info('Generated metadata.')

  logger.info('Done.')
}

main()
