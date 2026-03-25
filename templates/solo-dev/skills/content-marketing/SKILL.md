---
name: content-marketing
description: |
  Content planning, social media management, and scheduling.
  Use when creating posts, managing content calendars, or tracking engagement.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [content, marketing, social-media, scheduling]
  roles: [marketing]
---

# Content Marketing

How to plan content, write social media posts, schedule publishing, and track analytics.

---

## Content Calendar Pattern

Maintain a content calendar as YAML files in the filesystem:

```
projects/marketing/
├── posts/                    # Individual post files
│   ├── 2026-03-24-launch-announcement.yaml
│   ├── 2026-03-25-feature-highlight.yaml
│   └── 2026-03-26-customer-story.yaml
├── calendar.yaml             # Monthly overview
├── templates/                # Reusable post templates
│   ├── product-launch.yaml
│   └── weekly-tip.yaml
└── assets/                   # Images, banners
    └── launch-banner.png
```

---

## Post File Format

```yaml
# projects/marketing/posts/2026-03-24-launch-announcement.yaml
title: "QUESTPIE Autopilot is here"
platform: twitter
scheduled_for: "2026-03-24T14:00:00Z"
status: draft                           # draft | review | scheduled | published
content: |
  Introducing QUESTPIE Autopilot

  AI-native company operating system.
  Your company is a container. Your employees are agents.

  Open source. CLI-first. Ships today.

  github.com/questpie/autopilot
hashtags: [ai, agents, opensource, devtools]
image: /projects/marketing/assets/launch-banner.png
created_by: content-writer
reviewed_by: null
published_at: null
engagement:
  likes: 0
  shares: 0
  comments: 0
```

Status transitions: `draft → review → scheduled → published`

---

## Social Media Best Practices

### Twitter/X
- Keep under 280 characters (or use thread format)
- Use 2-5 relevant hashtags
- Include an image or link for higher engagement
- Best posting times: 9 AM, 1 PM, 5 PM (audience timezone)
- Thread format for longer content: hook → detail → CTA

### LinkedIn
- Professional tone, first-person perspective
- 1300 characters max for preview (before "see more")
- Use line breaks for readability
- Include a clear call-to-action
- Best posting times: Tuesday-Thursday, 8-10 AM

### Instagram
- Visual-first: always include a high-quality image
- Caption under 2200 characters
- Use 5-10 hashtags in first comment
- Stories for time-sensitive content

### General
- One key message per post
- Always include a call-to-action (CTA)
- Vary content types: educational, promotional, engagement, behind-the-scenes
- 80/20 rule: 80% value, 20% promotional

---

## Scheduling via Cron

Set up automated publishing schedules:

```yaml
# team/schedules.yaml
- id: daily-posting
  agent: social-manager
  cron: "0 9,13,17 * * 1-5"
  description: "Check scheduled posts, publish, monitor engagement"

- id: weekly-analytics
  agent: analytics-agent
  cron: "0 10 * * 1"
  description: "Generate weekly performance report"

- id: monthly-calendar
  agent: content-writer
  cron: "0 9 1 * *"
  description: "Draft next month's content calendar"
```

---

## Analytics Tracking

After publishing, update the post file with engagement data:

```yaml
# Updated after publishing
status: published
published_at: "2026-03-24T14:02:00Z"
engagement:
  likes: 142
  shares: 38
  comments: 12
  clicks: 256
  impressions: 4500
```

Track weekly metrics in a report:

```yaml
# projects/marketing/reports/week-12-2026.yaml
period: "2026-03-18 to 2026-03-24"
posts_published: 12
total_impressions: 45000
total_engagement: 1250
top_post: "2026-03-24-launch-announcement.yaml"
top_platform: twitter
growth:
  twitter_followers: +150
  linkedin_connections: +45
recommendations:
  - "Twitter threads performing 3x better than single posts"
  - "LinkedIn posts before 9 AM getting higher engagement"
```

---

## Workflow

The standard content workflow:

1. **Brief** — strategist defines topic, audience, goal
2. **Research** — gather data, examples, references
3. **Write** — draft the content
4. **Design** — create visuals (if needed)
5. **Review** — client/manager approval
6. **Schedule** — set publishing date/time
7. **Publish** — post goes live
8. **Monitor** — track engagement, respond to comments
