import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { PlusIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  getTemplatesForDirectory,
  genericFileTemplate,
  type FileTemplate,
} from "@/lib/template-registry"
import { useCreateFile } from "./files.mutations"

interface ContextNewButtonProps {
  currentDir: string
}

export function ContextNewButton({ currentDir }: ContextNewButtonProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const createFile = useCreateFile()
  const [selectedTemplate, setSelectedTemplate] = useState<FileTemplate | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  const templates = getTemplatesForDirectory(currentDir)
  const allTemplates = [...templates, genericFileTemplate]

  const handleOpenTemplate = (template: FileTemplate) => {
    setSelectedTemplate(template)
    setFieldValues({})
  }

  const handleCreate = () => {
    if (!selectedTemplate) return

    const outputPath = selectedTemplate.outputPath(fieldValues, currentDir || ".")
    const content = selectedTemplate.outputContent(fieldValues)

    createFile.mutate(
      { path: outputPath, content },
      {
        onSuccess: () => {
          toast.success(t("files.file_created"))
          setSelectedTemplate(null)
          setFieldValues({})
          void navigate({ to: "/files/$", params: { _splat: outputPath } })
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  // If only one option (generic), show directly
  if (allTemplates.length === 1) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="flex-1 gap-1 rounded-none font-heading text-[10px]"
        onClick={() => handleOpenTemplate(genericFileTemplate)}
      >
        <PlusIcon size={12} />
        {t("files.new")}
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-none border border-border bg-background px-3 py-1.5 font-heading text-[10px] text-foreground hover:bg-muted/50"
        >
          <PlusIcon size={12} />
          {t("files.new")}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 rounded-none">
          {allTemplates.map((tmpl, i) => (
            <DropdownMenuItem
              key={`${tmpl.pattern}-${i}`}
              onClick={() => handleOpenTemplate(tmpl)}
              className="gap-2 rounded-none font-heading text-xs"
            >
              {t(tmpl.label)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Template form dialog */}
      <Dialog open={selectedTemplate !== null} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">
              {selectedTemplate ? t(selectedTemplate.label) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {selectedTemplate?.fields.map((field) => (
              <div key={field.name} className="flex flex-col gap-1">
                <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t(field.label)}
                  {field.required && <span className="text-destructive"> *</span>}
                </label>
                {field.type === "textarea" ? (
                  <Textarea
                    value={fieldValues[field.name] ?? ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    placeholder={field.placeholder ? t(field.placeholder) : undefined}
                    className="rounded-none font-sans text-xs"
                    rows={3}
                  />
                ) : (
                  <Input
                    value={fieldValues[field.name] ?? ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    placeholder={field.placeholder ? t(field.placeholder) : undefined}
                    className="rounded-none font-heading text-xs"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedTemplate(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={
                createFile.isPending ||
                (selectedTemplate?.fields.some(
                  (f) => f.required && !fieldValues[f.name]?.trim(),
                ) ?? false)
              }
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
