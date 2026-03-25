# Skills

Agent skills follow the [Agent Skills open standard](https://agentskills.io).

Each skill is a directory with a `SKILL.md` file that teaches an agent a new capability. Same Autopilot kernel, different skills, different company.

```
skill-name/
├── SKILL.md          # Instructions (YAML frontmatter + markdown)
├── scripts/          # Optional executable scripts
├── references/       # Optional lazy-loaded documentation
└── assets/           # Optional templates and resources
```

## Adding a new skill

1. Create a directory: `skills/my-skill/`
2. Create `SKILL.md` with frontmatter:
   ```yaml
   ---
   name: my-skill
   description: What this skill does.
   ---
   ```
3. Write instructions in markdown below the frontmatter.
4. Agents automatically discover it on next session.

## Examples

- Want the DevOps agent to know your k3s cluster? Write a skill.
- Want the marketer to know your brand voice? Write a skill.
- Want the developer to follow your testing patterns? Write a skill.

## Community skills

Install from the ecosystem:
```bash
bunx skills add anthropics/skills#skill-name
```
