import { Command } from 'commander'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { program } from '../program'
import { header, success, dim } from '../utils/format'

const CLI_ROOT = resolve(import.meta.dir, '..', '..')
const TEMPLATE_DIR = resolve(CLI_ROOT, '..', '..', 'templates', 'solo-dev-shop')

program.addCommand(
	new Command('init')
		.description('Create a new QUESTPIE Autopilot company directory')
		.argument('[name]', 'Company name', 'My Company')
		.action(async (name: string) => {
			const slug = name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')

			const targetDir = resolve(process.cwd(), slug)

			console.log(header('QUESTPIE Autopilot'))
			console.log(dim(`Initializing company: ${name}\n`))

			await cp(TEMPLATE_DIR, targetDir, { recursive: true })

			const companyYamlPath = join(targetDir, 'company.yaml')
			let content = await readFile(companyYamlPath, 'utf-8')
			content = content.replace(/name:\s*"My Company"/, `name: "${name}"`)
			content = content.replace(/slug:\s*"my-company"/, `slug: "${slug}"`)
			await writeFile(companyYamlPath, content, 'utf-8')

			console.log(success('Company initialized successfully!'))
			console.log('')
			console.log(`  ${dim('Directory:')}  ${targetDir}`)
			console.log(`  ${dim('Company:')}    ${name}`)
			console.log(`  ${dim('Slug:')}       ${slug}`)
			console.log('')
			console.log(dim('Next steps:'))
			console.log(`  cd ${slug}`)
			console.log('  autopilot status')
			console.log('  autopilot ask "Build me a landing page"')
		}),
)
