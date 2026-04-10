import type { CompanyProfile } from '../types'

export const mockCompanyProfile: CompanyProfile = {
  name: 'Kavi\u00e1re\u0148 Srdcom',
  description: 'Slovensk\u00e1 kavi\u00e1re\u0148 s dom\u00e1cou atmosf\u00e9rou',
  tone: 'Priate\u013esk\u00fd, osobn\u00fd, m\u00e1lo form\u00e1lny',
  knowledge_files: [
    { name: 'menu-jar-2026.pdf', size: '240 KB', uri: 'company://menu-jar-2026.pdf' },
    { name: 'brand-guidelines.pdf', size: '1.2 MB', uri: 'company://brand-guidelines.pdf' },
    { name: 'o-nas.md', size: '4 KB', uri: 'company://o-nas.md' },
  ],
}
