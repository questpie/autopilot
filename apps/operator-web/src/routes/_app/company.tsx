import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { DetailSection } from '@/components/ui/detail-section'
import { useTranslation } from '@/lib/i18n'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import { getCompanyProfile } from '@/api/company.api'
import type { CompanyProfile } from '@/api/types'

export const Route = createFileRoute('/_app/company')({
  component: CompanyPage,
})

function CompanyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSeed = useChatSeedStore((s) => s.setSeed)
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [companyDesc, setCompanyDesc] = useState('')

  useEffect(() => {
    getCompanyProfile().then((p) => {
      setProfile(p)
      setCompanyName(p.name)
      setCompanyDesc(p.description)
    })
  }, [])
  const [draftName, setDraftName] = useState(companyName)
  const [draftDesc, setDraftDesc] = useState(companyDesc)

  function startEdit() {
    setDraftName(companyName)
    setDraftDesc(companyDesc)
    setEditing(true)
  }

  function saveEdit() {
    setCompanyName(draftName)
    setCompanyDesc(draftDesc)
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-border/50 px-5 py-4">
        <PageHeader title={t('company.title')} subtitle={t('company.subtitle')} />
      </div>

      {/* Name & description */}
      <DetailSection
        title={t('company.name_desc')}
        action={
          !editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="font-heading text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Edit
            </button>
          ) : undefined
        }
      >
        {editing ? (
          <div className="mt-3 flex flex-col gap-2">
            <input
              className="h-8 rounded-none border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <input
              className="h-8 rounded-none border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
            />
            <div className="mt-1 flex gap-2">
              <Button size="sm" onClick={saveEdit}>
                {t('company.save')}
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                {t('company.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground">
            {companyName || <span className="italic opacity-50">—</span>}
            {companyName && companyDesc ? ' — ' : ''}
            {companyDesc}
          </p>
        )}
      </DetailSection>

      {/* Communication tone */}
      <DetailSection
        title={t('company.tone')}
        action={
          <button
            type="button"
            onClick={() => {
              setSeed({
                action: 'refine_tone',
                title: t('chat.seed_refining_tone'),
                context: t('chat.seed_refining_tone'),
                fields: {},
              })
              void navigate({ to: '/chat' })
            }}
            className="font-heading text-[11px] text-primary hover:underline transition-colors"
          >
            {t('company.tone_edit_hint')}
          </button>
        }
      >
        <p className="mt-2 text-[13px] text-muted-foreground">
          {t('company.tone_value')}
        </p>
      </DetailSection>

      {/* Company knowledge */}
      <DetailSection
        last
        title={t('company.knowledge')}
        action={
          <Button variant="outline" size="sm">
            {t('company.upload')}
          </Button>
        }
      >
        <p className="mt-2 text-[13px] text-muted-foreground">
          {t('company.knowledge_desc')}
        </p>

        {(profile?.knowledge_files ?? []).length > 0 && (
          <div className="mt-3 flex flex-col gap-0.5">
            {(profile?.knowledge_files ?? []).map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-2 py-1.5"
              >
                <span className="rounded-none bg-muted/40 px-1.5 py-0.5 font-heading text-[10px] text-muted-foreground">
                  DOC
                </span>
                <span className="flex-1 text-[13px] text-foreground">{file.name}</span>
                <span className="font-heading text-[11px] text-muted-foreground">
                  {file.size}
                </span>
              </div>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  )
}
