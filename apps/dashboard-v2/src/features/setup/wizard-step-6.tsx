import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileUpload } from "@/components/file-upload"
import { ArrowLeftIcon, PlusIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useWizardState } from "./use-wizard-state"

interface KnowledgeCategory {
  id: string
  label: string
  description: string
  path: string
  files: string[]
}

interface WizardStep6Props {
  onComplete: () => void
  onBack: () => void
  onSkip: () => void
}

export function WizardStep6({ onComplete, onBack, onSkip }: WizardStep6Props) {
  const { t } = useTranslation()
  const { completeStep, skipStep } = useWizardState()

  const [categories, setCategories] = useState<KnowledgeCategory[]>([
    {
      id: "brand",
      label: t("setup.step_6_brand"),
      description: t("setup.step_6_brand_desc"),
      path: "/knowledge/brand",
      files: [],
    },
    {
      id: "technical",
      label: t("setup.step_6_technical"),
      description: t("setup.step_6_technical_desc"),
      path: "/knowledge/technical",
      files: [],
    },
    {
      id: "business",
      label: t("setup.step_6_business"),
      description: t("setup.step_6_business_desc"),
      path: "/knowledge/business",
      files: [],
    },
  ])
  const [newCategoryName, setNewCategoryName] = useState("")

  const handleUpload = (categoryId: string, paths: string[]) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? { ...cat, files: [...cat.files, ...paths] }
          : cat
      )
    )
  }

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    const id = newCategoryName.toLowerCase().replace(/\s+/g, "-")
    setCategories((prev) => [
      ...prev,
      {
        id,
        label: newCategoryName,
        description: "",
        path: `/knowledge/${id}`,
        files: [],
      },
    ])
    setNewCategoryName("")
  }

  const handleContinue = () => {
    completeStep(6)
    onComplete()
  }

  const handleSkip = () => {
    skipStep(6)
    onSkip()
  }

  const totalFiles = categories.reduce((sum, cat) => sum + cat.files.length, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          {t("setup.step_6_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_6_description")}
        </p>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="flex flex-col gap-2 border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-heading text-xs font-semibold uppercase">
                {cat.label}
              </span>
              {cat.description && (
                <span className="text-xs text-muted-foreground">
                  {cat.description}
                </span>
              )}
              <span className="text-xs text-muted-foreground/60">
                {cat.path}
              </span>
            </div>

            {cat.files.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {cat.files.map((f, i) => (
                  <span
                    key={`${f}-${i}`}
                    className="border border-border bg-muted px-1.5 py-0.5 font-heading text-xs"
                  >
                    {f.split("/").pop()}
                  </span>
                ))}
              </div>
            )}

            <FileUpload
              targetPath={cat.path}
              compact
              onUpload={(paths) => handleUpload(cat.id, paths)}
            />
          </div>
        ))}
      </div>

      {/* Add category */}
      <div className="flex gap-2">
        <Input
          placeholder={t("setup.step_6_add_category")}
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAddCategory()
            }
          }}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={handleAddCategory}
          disabled={!newCategoryName.trim()}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>

      {/* Supported formats */}
      <p className="text-xs text-muted-foreground">
        {t("setup.step_6_supported_formats")}
      </p>

      {/* AI chat placeholder */}
      <div className="border border-dashed border-primary/20 p-3">
        <Input
          placeholder={t("setup.ai_placeholder")}
          disabled
          className="border-0 bg-transparent text-xs"
        />
      </div>

      {/* CLI hint */}
      <p className="text-xs text-muted-foreground/60">
        {t("setup.cli_hint")}: autopilot knowledge upload
      </p>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
          {t("common.back")}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={handleSkip}>
          {t("common.skip")}
        </Button>
        <Button type="button" size="lg" className="flex-1" onClick={handleContinue}>
          {totalFiles > 0
            ? `${t("common.continue")} (${totalFiles} ${totalFiles === 1 ? "file" : "files"})`
            : t("common.continue")}
        </Button>
      </div>
    </div>
  )
}
