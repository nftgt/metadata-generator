export interface InputData {
  tokenId: string
  name: string
  description?: string
  filename: string
  [key: string]: string | undefined
}
