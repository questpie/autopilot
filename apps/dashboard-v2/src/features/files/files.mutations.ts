import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"

interface CreateFileParams {
  path: string
  content: string
}

interface DeleteFileParams {
  path: string
}

interface RenameFileParams {
  oldPath: string
  newPath: string
  content: string
}

async function createFile(params: CreateFileParams): Promise<void> {
  const cleanPath = params.path.replace(/^\/+/, "")
  const res = await api.api.files[":path{.+}"].$post({
    param: { path: cleanPath },
    json: { content: params.content },
  })
  if (!res.ok) {
    const data = (await res.json()) as { error?: string }
    throw new Error(data.error ?? "Failed to create file")
  }
}

async function updateFile(params: CreateFileParams): Promise<void> {
  const cleanPath = params.path.replace(/^\/+/, "")
  const res = await api.api.files[":path{.+}"].$put({
    param: { path: cleanPath },
    json: { content: params.content },
  })
  if (!res.ok) {
    const data = (await res.json()) as { error?: string }
    throw new Error(data.error ?? "Failed to update file")
  }
}

async function deleteFile(params: DeleteFileParams): Promise<void> {
  const cleanPath = params.path.replace(/^\/+/, "")
  const res = await api.api.files[":path{.+}"].$delete({
    param: { path: cleanPath },
  })
  if (!res.ok) {
    const data = (await res.json()) as { error?: string }
    throw new Error(data.error ?? "Failed to delete file")
  }
}

export function useCreateFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createFile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
  })
}

export function useUpdateFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateFile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
  })
}

export function useMoveFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { sourcePath: string; targetPath: string; content?: string }) => {
      // If content not provided, read source first
      let content = params.content ?? ""
      if (!content) {
        const cleanPath = params.sourcePath.replace(/^\/+/, "")
        const res = await api.api.fs[":path{.+}"].$get({ param: { path: cleanPath } })
        if (res.ok) {
          content = await res.text()
        }
      }
      // Create at new path, then delete old path
      await createFile({ path: params.targetPath, content })
      await deleteFile({ path: params.sourcePath })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
  })
}

export function useRenameFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: RenameFileParams) => {
      await createFile({ path: params.newPath, content: params.content })
      await deleteFile({ path: params.oldPath })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
  })
}

export function useDuplicateFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { sourcePath: string; targetPath: string }) => {
      const cleanPath = params.sourcePath.replace(/^\/+/, "")
      const res = await api.api.fs[":path{.+}"].$get({
        param: { path: cleanPath },
      })
      if (!res.ok) {
        throw new Error("Failed to read source file")
      }
      const content = await res.text()
      await createFile({ path: params.targetPath, content })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
  })
}

export function useCreateDirectory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { path: string }) => {
      // Create a directory by creating a .gitkeep file inside it
      const keepPath = `${params.path}/.gitkeep`
      await createFile({ path: keepPath, content: "" })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
  })
}
