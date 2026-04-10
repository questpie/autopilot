// Resource view models with UI-enriched fields (preview, relations, versions).
// These extend VFS list entries with locally-maintained metadata until
// the backend serves richer resource metadata.

export type ResourceType = 'PDF' | 'MD' | 'XLSX' | 'CSV' | 'ZIP' | 'PNG'
export type ResourceStatus = 'indexed' | 'processing' | 'unprocessed'

export interface ResourceVersion {
  version: number
  date: string
  current: boolean
}

export interface ResourceRelation {
  kind: string
  label: string
  sublabel?: string
}

export interface ResourceData {
  id: string
  filename: string
  type: ResourceType
  size: string
  status: ResourceStatus
  date: string
  description: string | null
  contextActive: boolean
  contextSource: string
  contextIndexed: string | null
  relations: ResourceRelation[]
  versions: ResourceVersion[]
}

export const mockResources: ResourceData[] = [
  {
    id: 'r1',
    filename: 'menu-jar-2026.pdf',
    type: 'PDF',
    size: '240 KB',
    status: 'indexed',
    date: '8. apr',
    description:
      'Aktu\u00e1lne jarn\u00e9 menu s cenami a alerg\u00e9nmi. Pou\u017e\u00edva sa pri tvorbe content pl\u00e1nu a odpoved\u00ed na ot\u00e1zky o ponuke.',
    contextActive: true,
    contextSource: 'Manu\u00e1lny upload',
    contextIndexed: '8. apr 2026, 14:22',
    relations: [
      { kind: 'Postup', label: 'T\u00fd\u017edenn\u00fd content pl\u00e1n' },
      { kind: '\u00daloha', label: 'Content pl\u00e1n na apr\u00edl', sublabel: 'T-142' },
      { kind: 'Automatiz\u00e1cia', label: 'T\u00fd\u017edenn\u00fd content pl\u00e1n', sublabel: 'S-021' },
      { kind: '\u00daloha', label: 'Newsletter k svadobnej sez\u00f3ne', sublabel: 'T-147' },
    ],
    versions: [
      { version: 2, date: '8. apr 2026', current: true },
      { version: 1, date: '15. mar 2026', current: false },
    ],
  },
  {
    id: 'r2',
    filename: 'brand-guidelines.pdf',
    type: 'PDF',
    size: '1.2 MB',
    status: 'indexed',
    date: '2. apr',
    description:
      'Firemn\u00fd brand manu\u00e1l \u2014 farby, typografia, logo pou\u017eitie. Pou\u017e\u00edva sa pri tvorbe vizu\u00e1lov a kontrole konzistencie.',
    contextActive: true,
    contextSource: 'Manu\u00e1lny upload',
    contextIndexed: '2. apr 2026, 09:15',
    relations: [
      { kind: 'Postup', label: 'T\u00fd\u017edenn\u00fd content pl\u00e1n' },
    ],
    versions: [
      { version: 3, date: '2. apr 2026', current: true },
      { version: 2, date: '10. jan 2026', current: false },
      { version: 1, date: '5. nov 2025', current: false },
    ],
  },
  {
    id: 'r3',
    filename: 'o-nas.md',
    type: 'MD',
    size: '4 KB',
    status: 'indexed',
    date: '15. mar',
    description:
      'Stru\u010dn\u00fd popis firmy, hist\u00f3ria, hodnoty. Z\u00e1kladn\u00fd kontext pre v\u0161etky odpovede agenta.',
    contextActive: true,
    contextSource: 'Manu\u00e1lny upload',
    contextIndexed: '15. mar 2026, 11:00',
    relations: [
      { kind: '\u00daloha', label: 'Aktualiz\u00e1cia webov\u00e9ho textu', sublabel: 'T-098' },
    ],
    versions: [
      { version: 1, date: '15. mar 2026', current: true },
    ],
  },
  {
    id: 'r4',
    filename: 'cennik-2026.xlsx',
    type: 'XLSX',
    size: '56 KB',
    status: 'indexed',
    date: '10. mar',
    description: 'Kompletn\u00fd cenn\u00edk produktov a slu\u017eieb na rok 2026.',
    contextActive: true,
    contextSource: 'Manu\u00e1lny upload',
    contextIndexed: '10. mar 2026, 16:45',
    relations: [],
    versions: [
      { version: 1, date: '10. mar 2026', current: true },
    ],
  },
  {
    id: 'r5',
    filename: 'dodavatelia.csv',
    type: 'CSV',
    size: '12 KB',
    status: 'processing',
    date: '1. mar',
    description: 'Zoznam dod\u00e1vate\u013eov s kontaktmi a podmienkami.',
    contextActive: false,
    contextSource: 'Manu\u00e1lny upload',
    contextIndexed: null,
    relations: [],
    versions: [
      { version: 1, date: '1. mar 2026', current: true },
    ],
  },
  {
    id: 'r6',
    filename: 'foto-kaviaren-2026.zip',
    type: 'ZIP',
    size: '8.4 MB',
    status: 'unprocessed',
    date: '28. feb',
    description: 'Fotografie interi\u00e9ru a exteri\u00e9ru kavi\u00e1rne pre marketing.',
    contextActive: false,
    contextSource: 'Manu\u00e1lny upload',
    contextIndexed: null,
    relations: [],
    versions: [
      { version: 1, date: '28. feb 2026', current: true },
    ],
  },
  {
    id: 'r7',
    filename: 'svadobna-sezona-brief.md',
    type: 'MD',
    size: '2.1 KB',
    status: 'indexed',
    date: '20. mar',
    description:
      'Brief pre svadobn\u00fa sez\u00f3nu \u2014 \u0161peci\u00e1lna ponuka, komunik\u00e1cia, cie\u013eov\u00e1 skupina.',
    contextActive: true,
    contextSource: 'Manu\u00e1lny upload',
    contextIndexed: '20. mar 2026, 08:30',
    relations: [
      { kind: '\u00daloha', label: 'Newsletter k svadobnej sez\u00f3ne', sublabel: 'T-147' },
      { kind: 'Postup', label: 'Pr\u00edprava newslettera' },
    ],
    versions: [
      { version: 1, date: '20. mar 2026', current: true },
    ],
  },
]
