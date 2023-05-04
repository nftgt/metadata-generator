# metadata-generator

## Requirements

- Node
- `nvm`

## Set Up

```bash
nvm use
yarn
```

## Preparation

1. Create `input` directory

   ```bash
   cp input.example input
   ```

2. Create `.env` file

   ```bash
   cp .env.example .env
   ```

3. Update `NFT_STORAGE_TOKEN` in `.env` (`DRY_RUN` can be changed to `false` to skip IPFS upload)
4. Copy images into `input/images`
5. Update `template.md` (You can use `{{ csvColumnName }}` and it will be replaced with data in CSV)
6. Update `input/data.csv` (Required column is `name`)

## Run

```bash
yarn start
```
