import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/lib/i18n'
import { useChatSeedStore } from '@/stores/chat-seed.store'

const MOCK_FILES = [
  { name: 'menu-jar-2026.pdf', size: '240 KB' },
  { name: 'brand-guidelines.pdf', size: '1.2 MB' },
  { name: 'o-nas.md', size: '4 KB' },
]

export const Route = createFileRoute('/_app/company')({
  component: CompanyPage,
})

function CompanyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSeed = useChatSeedStore((s) => s.setSeed)
  const [editing, setEditing] = useState(false)
  const [companyName, setCompanyName] = useState('Kaviareň Srdcom')
  const [companyDesc, setCompanyDesc] = useState(
    'Slovenská kaviareň s domácou atmosférou'
  )
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
    <div className="flex-1 overflow-y-auto p-8">
      <PageHeader title={t('company.title')} subtitle={t('company.subtitle')} />

      <div className="mt-6 flex max-w-2xl flex-col gap-3">
        {/* Názov a popis */}
        <div
          className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          onClick={() => {
            if (!editing) startEdit()
          }}
        >
          <p className="text-[14px] font-medium">{t('company.name_desc')}</p>
          {editing ? (
            <div className="mt-3 flex flex-col gap-2">
              <input
                className="h-8 rounded-none border border-border bg-background px-2.5 text-[14px] outline-none focus:border-primary"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <input
                className="h-8 rounded-none border border-border bg-background px-2.5 text-[14px] outline-none focus:border-primary"
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="mt-1 flex gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    saveEdit()
                  }}
                >
                  {t('company.save')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    cancelEdit()
                  }}
                >
                  {t('company.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {companyName} — {companyDesc}
            </p>
          )}
        </div>

        {/* Tón komunikácie */}
        <div
          className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          onClick={() => {
            setSeed({
              action: 'refine_tone',
              title: t('chat.seed_refining_tone'),
              context: t('chat.seed_refining_tone'),
              fields: {},
            })
            void navigate({ to: '/chat' })
          }}
        >
          <p className="text-[14px] font-medium">{t('company.tone')}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t('company.tone_value')}
          </p>
          <p className="mt-2 font-heading text-[11px] uppercase tracking-[0.5px] text-primary">
            {t('company.tone_edit_hint')}
          </p>
        </div>

        {/* Firemné podklady */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[14px] font-medium">{t('company.knowledge')}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t('company.knowledge_desc')}
          </p>

          <div className="mt-3 border-t border-border pt-3">
            {MOCK_FILES.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-2 py-1.5"
              >
                <span className="text-[14px]">📄</span>
                <span className="flex-1 text-[13px]">{file.name}</span>
                <span className="font-heading text-[11px] text-muted-foreground">
                  {file.size}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <Button variant="outline" size="sm">
              {t('company.upload')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
