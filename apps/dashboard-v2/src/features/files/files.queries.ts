import { queryOptions } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"

export interface FsEntry {
  name: string
  type: "file" | "directory"
  size: number
}

async function fetchDirectory(dirPath: string): Promise<FsEntry[] | null> {
  const cleanPath = dirPath.replace(/^\/+/, "")
  const res = cleanPath
    ? await api.api.fs[":path{.+}"].$get({ param: { path: cleanPath } })
    : await api.api.fs.$get()
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Failed to fetch directory: ${res.statusText}`)
  }
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    return null
  }
  return res.json() as Promise<FsEntry[]>
}

async function fetchFileContent(filePath: string): Promise<string> {
  const cleanPath = filePath.replace(/^\/+/, "")
  const res = cleanPath
    ? await api.api.fs[":path{.+}"].$get({ param: { path: cleanPath } })
    : await api.api.fs.$get()
  if (!res.ok) {
    throw new Error(`Failed to fetch file: ${res.statusText}`)
  }
  return res.text()
}

async function fetchFileBlob(filePath: string): Promise<{ blob: Blob; contentType: string }> {
  const cleanPath = filePath.replace(/^\/+/, "")
  const res = cleanPath
    ? await api.api.fs[":path{.+}"].$get({ param: { path: cleanPath } })
    : await api.api.fs.$get()
  if (!res.ok) {
    throw new Error(`Failed to fetch file: ${res.statusText}`)
  }
  const blob = await res.blob()
  return { blob, contentType: res.headers.get("content-type") ?? "application/octet-stream" }
}

export function directoryQuery(dirPath: string) {
  return queryOptions({
    queryKey: [...queryKeys.files.list(), dirPath],
    queryFn: () => fetchDirectory(dirPath),
    staleTime: 30_000,
  })
}

export function fileContentQuery(filePath: string) {
  return queryOptions({
    queryKey: [...queryKeys.files.detail(filePath), "content"],
    queryFn: () => fetchFileContent(filePath),
    staleTime: 30_000,
    enabled: filePath.length > 0,
  })
}

export function fileBlobQuery(filePath: string) {
  return queryOptions({
    queryKey: [...queryKeys.files.detail(filePath), "blob"],
    queryFn: () => fetchFileBlob(filePath),
    staleTime: 60_000,
    enabled: filePath.length > 0,
  })
}
