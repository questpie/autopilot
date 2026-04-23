import {
  FileTs,
  FileJs,
  FileJsx,
  FileTsx,
  FileCss,
  FileHtml,
  FileDashed,
  FileMd,
  FilePng,
  FileJpg,
  FileSvg,
  FilePdf,
  FileZip,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  File,
  Folder,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

const EXT_MAP: Record<string, Icon> = {
  // TypeScript / JavaScript
  ts: FileTs,
  tsx: FileTsx,
  js: FileJs,
  jsx: FileJsx,
  mjs: FileJs,
  cjs: FileJs,
  mts: FileTs,
  cts: FileTs,

  // Web
  css: FileCss,
  scss: FileCss,
  html: FileHtml,
  htm: FileHtml,

  // Data
  json: FileDashed,
  yaml: FileCode,
  yml: FileCode,
  toml: FileCode,
  xml: FileCode,
  csv: FileText,

  // Docs
  md: FileMd,
  mdx: FileMd,
  txt: FileText,
  doc: FileText,
  docx: FileText,
  pdf: FilePdf,

  // Images
  png: FilePng,
  jpg: FileJpg,
  jpeg: FileJpg,
  gif: FileImage,
  webp: FileImage,
  svg: FileSvg,
  ico: FileImage,

  // Media
  mp4: FileVideo,
  mov: FileVideo,
  avi: FileVideo,
  mp3: FileAudio,
  wav: FileAudio,
  ogg: FileAudio,

  // Archives
  zip: FileZip,
  tar: FileZip,
  gz: FileZip,
  rar: FileZip,

  // Code
  py: FileCode,
  rs: FileCode,
  go: FileCode,
  rb: FileCode,
  java: FileCode,
  sh: FileCode,
  bash: FileCode,
  zsh: FileCode,
  sql: FileCode,
  graphql: FileCode,
  proto: FileCode,
  dockerfile: FileCode,
}

/**
 * Returns the appropriate Phosphor file icon for a given filename.
 * Falls back to generic File icon.
 */
export function fileIcon(name: string, type?: 'file' | 'directory'): Icon {
  if (type === 'directory') return Folder
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MAP[ext] ?? File
}
