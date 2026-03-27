---
name: add-language
description: |
  How to add a new language translation to the dashboard.
  Use when asked to translate the dashboard or add locale support.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [i18n, localization, translation, language]
  roles: [developer, design, meta]
---

# Add Language

The dashboard uses i18next for internationalization. English (`en.json`) is the default and fallback language. To add a new language, create a translation file with the same key structure.

---

## 1. Create the Translation File

Create `company/dashboard/locales/{lang}.json` where `{lang}` is the ISO 639-1 code (e.g. `sk`, `de`, `ja`, `ko`, `es`, `fr`, `zh`).

Copy the structure from `en.json` and translate every value.

---

## 2. Full Key Inventory

The following is the complete key inventory from `en.json`. Every key must be present in your translation file. Keys use dot-notation grouping.

### `app` — Application metadata
- `app.name` — Application name (may keep as-is)
- `app.version` — Version label

### `nav` — Navigation labels
- `nav.dashboard`, `nav.tasks`, `nav.team`, `nav.chat`, `nav.files`
- `nav.artifacts`, `nav.skills`, `nav.inbox`, `nav.settings`
- `nav.more`, `nav.activity`, `nav.sessions`, `nav.search`

### `auth` — Authentication flow
- `auth.sign_in`, `auth.sign_in_description`, `auth.sign_up`, `auth.sign_out`
- `auth.email`, `auth.password`, `auth.full_name`, `auth.confirm_password`
- `auth.forgot_password`
- `auth.two_factor_title`, `auth.two_factor_description`
- `auth.two_factor_use_backup`, `auth.two_factor_use_totp`
- `auth.two_factor_backup_placeholder`, `auth.two_factor_trust_device`
- `auth.two_factor_failed_attempts`
- `auth.verify`, `auth.verifying`, `auth.signing_in`, `auth.creating_account`
- `auth.error_invalid_credentials`, `auth.error_too_many_attempts`
- `auth.error_2fa_required`, `auth.error_2fa_invalid`, `auth.error_signup_failed`
- `auth.error_invite_invalid`
- `auth.welcome_back`, `auth.create_account`, `auth.invite_only`
- `auth.invited_as`, `auth.already_have_account`
- `auth.password_requirements`, `auth.password_strength_weak`
- `auth.password_strength_fair`, `auth.password_strength_good`
- `auth.password_strength_strong`

### `tasks` — Task management
- `tasks.title`, `tasks.new_task`, `tasks.no_tasks`, `tasks.no_tasks_description`
- Status: `tasks.status_draft`, `tasks.status_backlog`, `tasks.status_assigned`, `tasks.status_in_progress`, `tasks.status_blocked`, `tasks.status_review`, `tasks.status_done`, `tasks.status_cancelled`
- Priority: `tasks.priority_critical`, `tasks.priority_high`, `tasks.priority_medium`, `tasks.priority_low`
- `tasks.assign_to`, `tasks.due_date`, `tasks.description`
- `tasks.task_created`, `tasks.task_updated`, `tasks.task_deleted`
- Views: `tasks.view_list`, `tasks.view_board`
- Filters: `tasks.filter_status`, `tasks.filter_agent`, `tasks.filter_workflow`, `tasks.filter_project`, `tasks.filter_priority`, `tasks.filter_all`
- Sort: `tasks.sort_created`, `tasks.sort_updated`, `tasks.sort_priority`
- Grouping: `tasks.group_by_status`, `tasks.group_by_assignee`, `tasks.group_by_workflow`, `tasks.group_by_priority`, `tasks.group_by_project`
- `tasks.search_placeholder`
- Detail: `tasks.detail_status`, `tasks.detail_assigned`, `tasks.detail_workflow`, `tasks.detail_created`, `tasks.detail_depends_on`, `tasks.detail_blocks`, `tasks.detail_workflow_progress`, `tasks.detail_description`, `tasks.detail_outputs`, `tasks.detail_activity`, `tasks.detail_comments`
- Actions: `tasks.actions_reassign`, `tasks.actions_duplicate`, `tasks.actions_delete`, `tasks.actions_copy_link`
- `tasks.approve`, `tasks.reject`, `tasks.reject_reason_placeholder`, `tasks.reject_confirm`
- `tasks.no_description`, `tasks.no_activity`, `tasks.unassigned`
- Plurals: `tasks.items_count_one`, `tasks.items_count_other`
- Create: `tasks.create_title`, `tasks.create_title_label`, `tasks.create_title_placeholder`, `tasks.create_description_label`, `tasks.create_description_placeholder`, `tasks.create_type_label`, `tasks.create_priority_label`, `tasks.create_assignee_label`, `tasks.create_project_label`, `tasks.create_project_placeholder`, `tasks.create_workflow_label`, `tasks.create_submit`

### `team` — Team and agent management
- `team.title`, `team.agents`, `team.humans`, `team.add_agent`
- `team.no_agents`, `team.no_agents_description`
- Status: `team.status_online`, `team.status_offline`, `team.status_busy`, `team.status_working`, `team.status_idle`
- Plurals: `team.agent_count_one`, `team.agent_count_other`, `team.tasks_count`
- Detail: `team.detail_tools`, `team.detail_fs_scope`, `team.detail_read_paths`, `team.detail_write_paths`, `team.detail_model`, `team.detail_provider`, `team.detail_triggers`, `team.detail_memory`, `team.detail_memory_facts`, `team.detail_memory_decisions`, `team.detail_memory_mistakes`, `team.detail_memory_patterns`, `team.detail_recent_tasks`, `team.detail_no_tasks`, `team.detail_description`, `team.detail_mcps`
- `team.attach`, `team.edit_config`
- Session: `team.session_live`, `team.session_detach`, `team.session_full`, `team.session_compact`, `team.session_tools_only`, `team.session_auto_scroll`, `team.session_thinking`, `team.session_tool_call`, `team.session_tool_result`, `team.session_text`, `team.session_error`, `team.session_waiting`, `team.session_no_events`, `team.session_no_events_description`, `team.session_replay`, `team.session_select`, `team.session_no_sessions`, `team.session_no_sessions_description`, `team.session_actions`, `team.session_send_message`, `team.session_add_blocker`, `team.session_cancel`, `team.session_cancel_confirm`, `team.session_message_placeholder`, `team.session_message_sent`, `team.session_blocker_added`, `team.session_cancelled`, `team.session_view_diff`, `team.session_lines`

### `chat` — Chat and messaging
- `chat.title`, `chat.channels`, `chat.direct_messages`, `chat.task_threads`, `chat.context`
- `chat.new_channel`, `chat.no_channels`, `chat.no_channels_description`
- `chat.no_messages`, `chat.no_messages_description`
- `chat.no_dms`, `chat.no_dms_description`
- `chat.no_task_threads`, `chat.no_task_threads_description`
- `chat.type_message`, `chat.send`, `chat.sending`, `chat.send_failed`, `chat.retry_send`
- Members: `chat.members`, `chat.member_count_one`, `chat.member_count_other`
- `chat.unread_one`, `chat.unread_other`, `chat.messages_count`
- `chat.today`, `chat.yesterday`, `chat.via_primitive`, `chat.system_message`
- Channel create: `chat.create_channel`, `chat.channel_name`, `chat.channel_name_placeholder`, `chat.channel_type`, `chat.channel_type_group`, `chat.channel_type_direct`, `chat.channel_type_broadcast`, `chat.channel_description`, `chat.channel_description_placeholder`, `chat.channel_created`, `chat.channel_settings`, `chat.channel_leave`, `chat.add_member`, `chat.remove_member`, `chat.message_sent`
- Mentions: `chat.mention_agents`, `chat.mention_humans`
- Slash commands: `chat.slash_ask`, `chat.slash_dm`, `chat.slash_status`, `chat.slash_task`, `chat.slash_attach`, `chat.slash_approve`, `chat.slash_reject`
- Paste: `chat.paste_as_text`, `chat.paste_as_file`, `chat.paste_large_prompt`
- `chat.upload_progress`, `chat.context_task_thread`, `chat.context_dm`, `chat.context_file`, `chat.context_channel`, `chat.panel_toggle`

### `files` — File browser
- `files.title`, `files.no_files`, `files.no_files_description`
- Actions: `files.upload`, `files.create_file`, `files.create_folder`, `files.delete`, `files.rename`, `files.download`, `files.copy_path`
- Navigation: `files.root`, `files.quick_access`, `files.all_files`
- `files.new`, `files.file_deleted`, `files.file_created`
- Delete confirm: `files.delete_confirm_title`, `files.delete_confirm_message`
- `files.filename_placeholder`, `files.column_name`, `files.column_size`, `files.file_count`
- Views: `files.view_raw`, `files.view_rendered`, `files.raw`, `files.parse_error`
- Media: `files.image_load_error`, `files.pdf_load_error`, `files.open_new_tab`
- Bookmarks: `files.bookmark_knowledge`, `files.bookmark_workflows`, `files.bookmark_skills`, `files.bookmark_projects`, `files.bookmark_config`
- Workflow: `files.no_workflow_steps`, `files.untitled_workflow`
- Agents: `files.no_agents`, `files.agent_team`
- Company: `files.company_settings`, `files.company_name`, `files.company_description`, `files.company_timezone`, `files.company_language`
- Secrets: `files.secret_locked_title`, `files.secret_locked_description`, `files.secret_entries`, `files.secret_hidden`, `files.no_secrets`
- Skills: `files.untitled_skill`, `files.skill_roles`, `files.skill_scripts`
- Templates: `files.new_workflow`, `files.new_workflow_desc`, `files.workflow_name`, `files.workflow_description`, `files.workflow_description_placeholder`, `files.new_document`, `files.new_document_desc`, `files.document_title`, `files.document_topic`, `files.new_skill`, `files.skill_name`, `files.skill_description`, `files.new_widget`, `files.widget_name`, `files.new_file`, `files.filename`
- Conflict: `files.conflict_title`, `files.conflict_description`, `files.conflict_yours`, `files.conflict_theirs`, `files.conflict_keep_mine`, `files.conflict_keep_theirs`, `files.conflict_merge`
- `files.locked_by`

### `dashboard` — Dashboard home
- `dashboard.title`, `dashboard.welcome`, `dashboard.quick_actions`, `dashboard.recent_activity`
- `dashboard.active_tasks`, `dashboard.no_activity`, `dashboard.no_activity_description`
- `dashboard.needs_attention`, `dashboard.all_clear`, `dashboard.all_clear_description`
- `dashboard.agents_title`, `dashboard.agents_count`, `dashboard.agent_working`, `dashboard.agent_idle`
- `dashboard.attach`, `dashboard.pinned`, `dashboard.no_pins`, `dashboard.no_pins_description`
- `dashboard.open_artifact`, `dashboard.view_all`
- `dashboard.quick_ask_placeholder`, `dashboard.ask`, `dashboard.intent_submitted`
- `dashboard.widget_error`

### `inbox` — Inbox notifications
- `inbox.title`, `inbox.no_items`, `inbox.no_items_description`
- `inbox.mark_read`, `inbox.mark_all_read`
- Plurals: `inbox.item_count_one`, `inbox.item_count_other`
- `inbox.approve`, `inbox.reject`, `inbox.task_approved`, `inbox.task_rejected`
- `inbox.filter_all`, `inbox.resolved`, `inbox.no_resolved`

### `settings` — Settings pages
- Navigation: `settings.title`, `settings.general`, `settings.company`, `settings.agents`, `settings.channels`, `settings.security`, `settings.api_keys`, `settings.appearance`, `settings.profile`, `settings.team`, `settings.providers`, `settings.workflows`, `settings.git`, `settings.budget`, `settings.danger`, `settings.two_factor`, `settings.secrets`, `settings.integrations`
- `settings.save`, `settings.saved`
- Descriptions: `settings.general_description`, `settings.profile_description`, `settings.team_description`, `settings.agents_description`, `settings.providers_description`, `settings.workflows_description`, `settings.security_description`, `settings.appearance_description`, `settings.git_description`, `settings.budget_description`, `settings.danger_description`
- Company: `settings.company_name`, `settings.company_description`, `settings.company_timezone`, `settings.company_language`, `settings.company_logo`, `settings.company_logo_hint`, `settings.company_id`, `settings.company_id_description`
- Profile: `settings.display_name`, `settings.user_email`, `settings.user_timezone`
- Sessions: `settings.active_sessions`, `settings.revoke_session`, `settings.revoke_all_sessions`, `settings.current_session`, `settings.session_revoked`
- Team: `settings.team_members`, `settings.team_invited`, `settings.team_banned`, `settings.team_roles`, `settings.team_invite`, `settings.team_invite_email`, `settings.team_invite_role`, `settings.team_invite_added`, `settings.team_invite_removed`, `settings.team_role_changed`, `settings.team_user_banned`, `settings.team_user_unbanned`
- Roles: `settings.team_role_owner`, `settings.team_role_owner_desc`, `settings.team_role_admin`, `settings.team_role_admin_desc`, `settings.team_role_member`, `settings.team_role_member_desc`, `settings.team_role_viewer`, `settings.team_role_viewer_desc`
- Team actions: `settings.team_remove_invite`, `settings.team_ban`, `settings.team_unban`, `settings.team_change_role`, `settings.team_2fa_enabled`, `settings.team_2fa_disabled`, `settings.team_no_banned`, `settings.team_no_invites`, `settings.team_invite_hint`
- Providers: `settings.provider_claude`, `settings.provider_claude_desc`, `settings.provider_openai`, `settings.provider_openai_desc`, `settings.provider_api_key`, `settings.provider_api_key_placeholder`, `settings.provider_model`, `settings.provider_embeddings`, `settings.provider_embeddings_gemini`, `settings.provider_embeddings_local`, `settings.provider_embeddings_none`, `settings.provider_test_connection`, `settings.provider_connected`, `settings.provider_not_configured`, `settings.provider_testing`, `settings.provider_test_success`, `settings.provider_test_failed`
- Secrets: `settings.secret_count_one`, `settings.secret_count_other`, `settings.secret_add`, `settings.secret_name`, `settings.secret_value`, `settings.secret_type`, `settings.secret_type_api_token`, `settings.secret_type_oauth`, `settings.secret_type_webhook`, `settings.secret_type_other`, `settings.secret_allowed_agents`, `settings.secret_created`, `settings.secret_edit_permissions`, `settings.secret_rotate`, `settings.secret_delete`, `settings.secret_added`, `settings.secret_updated`, `settings.secret_rotated`, `settings.secret_deleted`, `settings.secret_delete_confirm`, `settings.secret_encrypted_notice`, `settings.secret_never_shown`
- 2FA: `settings.tfa_status`, `settings.tfa_enabled`, `settings.tfa_disabled`, `settings.tfa_method`, `settings.tfa_method_totp`, `settings.tfa_issuer`, `settings.tfa_issuer_value`, `settings.tfa_enable`, `settings.tfa_disable`, `settings.tfa_reconfigure`, `settings.tfa_backup_codes`, `settings.tfa_backup_single_use`, `settings.tfa_view_backup`, `settings.tfa_regenerate_backup`, `settings.tfa_trusted_devices`, `settings.tfa_trusted_desc`, `settings.tfa_revoke_all`, `settings.tfa_disable_confirm`, `settings.tfa_disabled_success`, `settings.tfa_revoked_success`
- Appearance: `settings.appearance_theme`, `settings.appearance_theme_dark`, `settings.appearance_theme_light`, `settings.appearance_theme_system`, `settings.appearance_density`, `settings.appearance_density_comfortable`, `settings.appearance_density_compact`, `settings.appearance_sidebar`, `settings.appearance_sidebar_expanded`, `settings.appearance_sidebar_collapsed`, `settings.appearance_sidebar_auto`, `settings.appearance_font_size`, `settings.appearance_font_small`, `settings.appearance_font_default`, `settings.appearance_font_large`, `settings.appearance_language`
- Git: `settings.git_auto_commit`, `settings.git_auto_commit_desc`, `settings.git_commit_interval`, `settings.git_auto_push`, `settings.git_auto_push_desc`, `settings.git_remote`, `settings.git_remote_placeholder`
- Budget: `settings.budget_daily_limit`, `settings.budget_daily_limit_desc`, `settings.budget_alert_threshold`, `settings.budget_alert_threshold_desc`, `settings.budget_tokens`
- Danger: `settings.danger_export`, `settings.danger_export_desc`, `settings.danger_export_button`, `settings.danger_reset`, `settings.danger_reset_desc`, `settings.danger_reset_button`, `settings.danger_reset_confirm`, `settings.danger_delete`, `settings.danger_delete_desc`, `settings.danger_delete_button`, `settings.danger_delete_confirm`, `settings.danger_delete_placeholder`, `settings.danger_resetting`, `settings.danger_reset_success`, `settings.danger_exporting`
- Security: `settings.security_overview`, `settings.security_2fa_link`, `settings.security_secrets_link`
- Workflows: `settings.workflow_list`, `settings.workflow_new`, `settings.workflow_name`, `settings.workflow_version`, `settings.workflow_steps`, `settings.workflow_edit_yaml`, `settings.workflow_view_diagram`, `settings.workflow_saved`, `settings.workflow_validation_error`, `settings.workflow_created`, `settings.workflow_template`, `settings.workflow_no_workflows`, `settings.workflow_no_workflows_desc`

### `artifacts` — Artifact previews
- `artifacts.title`, `artifacts.no_artifacts`, `artifacts.no_artifacts_description`
- Status: `artifacts.status_running`, `artifacts.status_stopped`, `artifacts.status_building`
- Actions: `artifacts.open`, `artifacts.stop`, `artifacts.start`, `artifacts.restart`
- `artifacts.started`, `artifacts.stopped`, `artifacts.not_found`
- `artifacts.not_running_message`, `artifacts.start_preview`, `artifacts.view_source`
- `artifacts.open_new_tab`, `artifacts.artifact_count`
- `artifacts.viewport_desktop`, `artifacts.viewport_tablet`, `artifacts.viewport_mobile`

### `skills` — Skills listing
- `skills.title`, `skills.no_skills`, `skills.no_skills_description`
- `skills.install`, `skills.uninstall`, `skills.enabled`, `skills.disabled`

### `common` — Shared labels
- `common.loading`, `common.error`, `common.retry`, `common.cancel`, `common.save`
- `common.delete`, `common.edit`, `common.create`, `common.confirm`, `common.close`
- `common.back`, `common.next`, `common.skip`, `common.continue`, `common.finish`
- `common.search`, `common.no_results`, `common.empty`
- `common.copy`, `common.copied`, `common.go_to_dashboard`
- `common.connection_error`, `common.connection_error_description`
- `common.page_not_found`, `common.page_not_found_description`
- `common.server_error`, `common.server_error_description`
- `common.or`, `common.optional`

### `command_palette` — Command palette
- `command_palette.placeholder`, `command_palette.navigate`, `command_palette.agent`
- `command_palette.task`, `command_palette.file`, `command_palette.action`
- `command_palette.settings_category`, `command_palette.intent_hint`
- `command_palette.no_results`

### `status_bar` — Bottom status bar
- `status_bar.agents`, `status_bar.sqlite_size`, `status_bar.git_commits`
- `status_bar.version`, `status_bar.connected`, `status_bar.reconnecting`
- `status_bar.offline`

### `setup` — Setup wizard
- (50+ keys for the multi-step setup wizard — copy from en.json)

### `markdown` — Markdown renderer
- `markdown.toc`, `markdown.show_less`, `markdown.show_more_lines`

### `activity` — Activity feed
- `activity.filter_agent`, `activity.filter_action`, `activity.load_more`

### `upload` — File uploads
- `upload.drag_drop`, `upload.drag_active`, `upload.uploading`, `upload.extracting`
- `upload.upload_complete`, `upload.upload_failed`
- `upload.file_too_large`, `upload.batch_too_large`, `upload.unsupported_type`
- `upload.files_uploaded_one`, `upload.files_uploaded_other`
- `upload.paste_as_text`, `upload.paste_as_file`, `upload.paste_prompt`
- `upload.browse_files`, `upload.upload_folder`

---

## 3. Pluralization

i18next uses `_one` / `_other` suffixes for plurals. Use `{{count}}` as the variable:

```json
{
  "tasks": {
    "items_count_one": "{{count}} item",
    "items_count_other": "{{count}} items"
  }
}
```

Usage in code: `t("tasks.items_count", { count: 5 })` returns "5 items".

### Language-specific plural rules

Some languages need additional forms. i18next supports:
- **English, German, etc.:** `_one`, `_other`
- **French:** `_one` (0 and 1), `_other`
- **Czech, Slovak:** `_one`, `_few`, `_other`
- **Arabic:** `_zero`, `_one`, `_two`, `_few`, `_many`, `_other`
- **Japanese, Korean, Chinese:** `_other` only (no plural distinction)

Check the [CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html) for your language.

Example for Slovak:
```json
{
  "tasks": {
    "items_count_one": "{{count}} polozka",
    "items_count_few": "{{count}} polozky",
    "items_count_other": "{{count}} poloziek"
  }
}
```

---

## 4. Dates and Numbers

### Date/time formatting

Use the browser's `Intl.DateTimeFormat` or `Intl.RelativeTimeFormat` with the active locale:

```typescript
const formatter = new Intl.DateTimeFormat(i18n.language, {
  dateStyle: "medium",
  timeStyle: "short",
})
```

### Number formatting

```typescript
const numberFormatter = new Intl.NumberFormat(i18n.language, {
  style: "decimal",
  maximumFractionDigits: 2,
})
```

Do NOT hardcode date/number formats. Always use `Intl` formatters with the current language.

---

## 5. Variable Interpolation

Use double curly braces for variables:

```json
{
  "auth": {
    "error_too_many_attempts": "Too many attempts. Try again in {{seconds}}s"
  }
}
```

Usage: `t("auth.error_too_many_attempts", { seconds: 30 })`

---

## 6. Testing

1. Create your translation file at `company/dashboard/locales/{lang}.json`
2. Open the dashboard in a browser
3. Go to **Settings > Appearance > Language**
4. Select the new language from the dropdown
5. Verify all UI elements are translated
6. Check for:
   - Text overflow (some languages produce longer strings)
   - RTL layout if applicable (Arabic, Hebrew)
   - Pluralization in task counts, member counts, etc.
   - Date/time formatting in activity feeds
   - Missing translations (will fall back to English key)

### Quick validation

Run a quick check that all keys exist:

```bash
# Compare keys between en.json and your language
diff <(jq -r '[paths(scalars)] | .[] | join(".")' en.json | sort) \
     <(jq -r '[paths(scalars)] | .[] | join(".")' {lang}.json | sort)
```

Any keys present in `en.json` but missing in your file will fall back to English automatically.

---

## 7. File Naming Convention

| Language | Code | Filename |
|----------|------|----------|
| English | en | `en.json` |
| Slovak | sk | `sk.json` |
| German | de | `de.json` |
| French | fr | `fr.json` |
| Spanish | es | `es.json` |
| Japanese | ja | `ja.json` |
| Korean | ko | `ko.json` |
| Chinese (Simplified) | zh | `zh.json` |
| Portuguese (Brazil) | pt-BR | `pt-BR.json` |
| Arabic | ar | `ar.json` |
