# Event Metadata And Submission

This file stores metadata found outside the main specification text.

## Local Sources

- Page HTML: `UA-SKILLS.html`
- JS bundle: `UA-SKILLS_files/index-DpOUVQlC.js.download`
- User-provided screenshot of the final submission form

## Event Metadata From JS Bundle

Exact values found in the local JS bundle:

```text
title: "AI-Skills — змагання з prompt-інжинірингу"
date_start: "25 травня 2026"
date_end: "12 червня 2026"
prize_pool: "5 000 $"
tech_stack: ["Node.JS", "TypeScript", "react", "tailwind css"]
slug: "ai-skills-prompt-engineering-competition"
```

English copy also exists in the bundle:

```text
title: "AI-Skills — Prompt Engineering Competition"
date_start: "May 25, 2026"
date_end: "June 12, 2026"
prize_pool: "5 000 $"
tech_stack: ["Node.JS", "TypeScript", "react", "tailwind css"]
```

## Submission Links From JS Bundle

The tournament card contains:

```text
registration/link: "https://forms.gle/J9XbefujSxDnWbYu7"
send_link: "https://forms.gle/PH28tBijBAVuwZC96"
```

The `send_link` is the likely final task submission form.

## Submission Form Screenshot

The user-provided screenshot confirms that the final submission is a Google Form
for completed Prompt Engineering tournament work. The practical submission
payload is a GitHub repository URL, and the reviewer account is
`https://github.com/skills-reviewer`.

Visible required fields ask for the contestant name and the work link.

## Practical Interpretation

The specification allows a closed Git repository on GitHub, GitLab, or Bitbucket. The submission form screenshot narrows the practical delivery path to GitHub and asks for the `skills-reviewer` GitHub account to be added for review.

Use a private GitHub repository, push the full commit history throughout development, add `skills-reviewer` with read access before submission, and submit the repository URL through the form.
