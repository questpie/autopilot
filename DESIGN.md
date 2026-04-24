---
version: alpha
name: QUESTPIE Neutral Soft
description: "Neutral-first QuestPie product design system: soft rounded geometry, layered neutral surfaces, Geist typography, JetBrains Mono identifiers, and company-primary color reserved only for CTA elements."
colors:
  background: "#121212"
  foreground: "#ECECEC"
  foreground-muted: "#A0A0A0"
  foreground-subtle: "#737373"
  foreground-disabled: "#5A5A5A"
  surface: "#161616"
  surface-low: "#1B1B1B"
  surface-mid: "#222222"
  surface-high: "#2A2A2A"
  surface-highest: "#333333"
  card: "#1B1B1B"
  card-foreground: "#ECECEC"
  popover: "#1B1B1B"
  popover-foreground: "#ECECEC"
  muted: "#222222"
  muted-foreground: "#A0A0A0"
  accent: "#2A2A2A"
  accent-foreground: "#ECECEC"
  secondary: "#222222"
  secondary-foreground: "#ECECEC"
  border-subtle: "#262626"
  border: "#343434"
  border-strong: "#4A4A4A"
  input: "#343434"
  ring: "#737373"
  selection: "#333333"
  primary: "#B700FF"
  primary-hover: "#B700FF"
  primary-pressed: "#B700FF"
  on-primary: "#FFFFFF"
  status-surface: "#222222"
  status-border: "#343434"
  status-foreground: "#ECECEC"
  status-muted: "#A0A0A0"
  destructive-surface: "#222222"
  destructive-border: "#4A4A4A"
  destructive-foreground: "#ECECEC"
  light-background: "#FAFAFA"
  light-foreground: "#1C1C1C"
  light-foreground-muted: "#616161"
  light-foreground-subtle: "#858585"
  light-surface: "#F7F7F7"
  light-surface-low: "#FFFFFF"
  light-surface-mid: "#F0F0F0"
  light-surface-high: "#E8E8E8"
  light-card: "#FFFFFF"
  light-border-subtle: "#EBEBEB"
  light-border: "#E2E2E2"
  light-border-strong: "#C9C9C9"
  light-input: "#E2E2E2"
  light-ring: "#858585"
typography:
  display:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 40px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: "600"
    lineHeight: 36px
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.02em
  title-lg:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: -0.02em
  title-md:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 26px
    letterSpacing: -0.02em
  body:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: "400"
    lineHeight: 23px
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 22px
  label:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: "500"
    lineHeight: 20px
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 20px
    fontFeature: "tnum"
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
    fontFeature: "tnum"
  mono-xs:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: "600"
    lineHeight: 14px
    letterSpacing: 0.08em
    fontFeature: "tnum"
rounded:
  none: 0px
  xs: 4px
  sm: 8px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 28px
  full: 9999px
radii:
  none: 0px
  micro: 4px
  control: 8px
  card: 12px
  panel: 16px
  shell: 20px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 40px
  5xl: 48px
  shell-gap: 12px
  shell-padding: 12px
  card-padding: 16px
  panel-padding: 20px
  section-padding: 24px
  composer-padding: 16px
  input-padding-x: 12px
  hit-target-min: 40px
  touch-target-min: 44px
shadows:
  none: "none"
  xs: "0 1px 2px rgba(0, 0, 0, 0.18)"
  sm: "0 1px 2px rgba(0, 0, 0, 0.18), 0 1px 3px rgba(0, 0, 0, 0.16)"
  DEFAULT: "0 8px 20px -14px rgba(0, 0, 0, 0.45)"
  md: "0 12px 28px -18px rgba(0, 0, 0, 0.55)"
  lg: "0 18px 40px -24px rgba(0, 0, 0, 0.60)"
  xl: "0 28px 56px -32px rgba(0, 0, 0, 0.65)"
elevation:
  canvas:
    backgroundColor: "{colors.background}"
    shadow: "{shadows.none}"
  surface:
    backgroundColor: "{colors.surface}"
    shadow: "{shadows.none}"
  card:
    backgroundColor: "{colors.card}"
    shadow: "{shadows.xs}"
  raised:
    backgroundColor: "{colors.card}"
    shadow: "{shadows.sm}"
  floating:
    backgroundColor: "{colors.popover}"
    shadow: "{shadows.lg}"
  modal:
    backgroundColor: "{colors.popover}"
    shadow: "{shadows.xl}"
motion:
  duration-fast: 100ms
  duration-normal: 150ms
  duration-moderate: 200ms
  duration-slow: 300ms
  duration-exit: 150ms
  easing-enter: "cubic-bezier(0.22, 1, 0.36, 1)"
  easing-move: "cubic-bezier(0.25, 1, 0.5, 1)"
  easing-drawer: "cubic-bezier(0.32, 0.72, 0, 1)"
  easing-state: "ease-out"
  press-scale: "0.96"
  subtle-press-scale: "0.99"
components:
  primary-cta:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 0 16px
  primary-cta-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  primary-cta-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
  neutral-action:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 0 14px
  quiet-action:
    backgroundColor: transparent
    textColor: "{colors.foreground-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 0 12px
  quiet-action-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  field-surface:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 12px
  field-surface-focus:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
  surface-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.md}"
    padding: "{spacing.card-padding}"
  shell-panel:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "{spacing.shell-padding}"
  left-rail:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "{spacing.shell-padding}"
  left-rail-row:
    backgroundColor: transparent
    textColor: "{colors.foreground-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 32px
    padding: 8px
  left-rail-row-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  left-rail-row-active:
    backgroundColor: "{colors.surface-high}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 32px
    padding: 8px
  assistant-rail:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    shadow: "{shadows.xs}"
    borderColor: "{colors.border-subtle}"
    width: 420px
    padding: 0px
  conversation-surface:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.composer-padding}"
  assistant-message-surface:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  work-list-row:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: 40px
    padding: 12px
  work-list-row-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
  work-list-group-header:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground-muted}"
    typography: "{typography.mono-xs}"
    borderColor: "{colors.border-subtle}"
    height: 32px
    padding: 12px
  detail-pane:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: 20px
  detail-metadata-panel:
    backgroundColor: transparent
    textColor: "{colors.foreground-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
  metadata-pill:
    backgroundColor: "{colors.status-surface}"
    textColor: "{colors.status-foreground}"
    typography: "{typography.mono-xs}"
    rounded: "{rounded.xs}"
    height: 20px
    padding: 0 8px
  status-pill:
    backgroundColor: "{colors.status-surface}"
    textColor: "{colors.status-foreground}"
    typography: "{typography.mono-label}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  destructive-action:
    backgroundColor: "{colors.destructive-surface}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 0 14px
  document-surface:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "{spacing.section-padding}"
---

## Overview

QUESTPIE Neutral Soft is a neutral-first product design system. It should feel composed, functional, and durable: a serious operator surface that users can keep open all day.

The brand is present through structure, typography, spacing, the square-build mark, and a single company-primary CTA color. The UI must not become purple-themed. Purple is not a decorative tint, not a hover color for ordinary controls, not a focus color, and not a status color. It is reserved for the primary CTA moment.

## Colors

The palette is almost entirely neutral. Dark mode is canonical: a near-black canvas, slightly raised neutral surfaces, neutral borders, and softened foreground text. Light mode mirrors the same hierarchy with off-white surfaces and gray borders.

Primary `#B700FF` is the only non-neutral color. Use it only for solid primary CTA elements such as "Sign in", "Create", "Save", "Approve", or the single action that advances the workflow. Do not use primary for left rail active states, passive links, badges, focus rings, hover backgrounds, decorative glows, or status indicators.

Statuses are neutral. Communicate state through text, icon shape, position, grouping, and copy. If a status needs urgency, use stronger neutral contrast, not red/yellow/green/blue.

## Typography

Geist is the main product font. It is used for headings, prose, labels, task titles, conversation text, descriptions, field text, and helper text.

JetBrains Mono is only for identifiers and copyable facts: file paths, task IDs, run IDs, timestamps, keyboard shortcuts, code, diffs, configuration keys, and compact numeric metadata. Mono should help users scan operational facts without making the whole UI feel like a terminal.

Headings use tight tracking and balanced wrapping. Body text uses generous line height. Numeric metadata should use tabular figures.

## Layout

The shell is a calm operator workspace. Navigation is compact, content is primary, and inspectors or rails support the active task without competing for attention.

The strongest visual examples are the left rail, the right assistant rail, the work list, and the task detail view. They show the intended hierarchy: narrow persistent context on the sides, dense scannable work in the middle, and detail views that read like operational documents rather than dashboards.

Use a 4px spacing base. Controls typically step in 8px and 12px increments. Cards and panels get enough padding to feel touchable, but lists remain dense enough for operational scanning.

Whitespace should be neutral and purposeful. Avoid dashboard-style decorative hero sections, ornamental gradients, and colored backgrounds in product mode.

## Elevation & Depth

Depth is created with neutral tonal layering first and shadow second. Use shadows sparingly: cards can have small separation, floating menus and dialogs can use stronger elevation, and list rows usually only need hover surface changes.

Shadows are neutral black alpha only. Do not tint shadows with primary or any chromatic color.

## Shapes

This is the soft QuestPie system, not the sharp brutalist system. Interactive controls use 8px radius. Cards and document panels use 12px. Larger shell surfaces can use 16px or 20px. Keep raw editors, grid lines, dividers, and code surfaces structurally clean.

Pills are allowed for compact metadata and status labels, but they must remain neutral unless they are the single primary CTA, which they usually are not.

## Product Patterns

A primary action is the only solid brand-primary moment in a local context. Everything else is neutral: secondary actions, quiet actions, tabs, badges, status pills, alerts, fields, rails, list rows, document surfaces, and detail panes.

The left rail is narrow, persistent, and utilitarian. It should feel like a calm index of current work, not a colorful navigation system. Rows are compact, softly rounded, and active through neutral surface strength. The best version uses short labels, small icons, tight metadata, and restrained section rhythm.

The right assistant rail is a companion surface. It is visually present through a 20px shell radius, a translucent neutral card tone, subtle border, and a tiny shadow. It should feel docked beside the work, not like a separate app. Empty states, prompt suggestions, context chips, conversation history, and message flow all stay neutral. The send action may use primary only when it is the active CTA.

Work lists are dense and grouped. Rows should scan horizontally: priority or state marker, title, compact metadata, and timestamp. Group headers use uppercase mono text, sticky positioning when useful, and neutral dividers. Hover and selected states use stronger neutral surfaces, not primary tint.

Detail panes are reading-first. The title and description carry the page, followed by timeline, thread, relations, and compact key-value metadata. Side information should feel secondary and quiet. Workflow actions can become primary CTAs only when they are the next explicit user decision.

Fields are neutral card surfaces with neutral borders. Focus states should be visible through neutral border or ring strength, not primary color. Error states should use copy and stronger neutral treatment, not red.

Markdown and document content render as Geist prose with JetBrains Mono for inline code and references. Editable long-form markdown uses a rich editor. Raw code, YAML, JSON, CSV, diffs, PDFs, and images do not use rich text editing.

## Do's and Don'ts

Do build from neutral surfaces, neutral borders, and neutral text hierarchy.

Do reserve `#B700FF` for the primary CTA only.

Do use labels, icons, grouping, and copy to communicate status.

Do keep active navigation and selected rows neutral.

Do use Geist for human-readable content and JetBrains Mono for identifiers.

Don't use purple glows, lavender fills, purple focus rings, purple badges, or purple active left rail rows.

Don't introduce green, yellow, red, blue, or other semantic colors into the product UI.

Don't make the UI look like a purple dashboard.

Don't use decorative gradients in the operating shell.

Don't use color as the primary communication mechanism.
