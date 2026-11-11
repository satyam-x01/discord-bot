# he he he — Discord group moderation bot

**Bot name:** `he he he`
**Avatar artwork:** [`assets/bot-logo.png`](assets/bot-logo.png) (upload this) · [`assets/bot-logo.svg`](assets/bot-logo.svg) (editable source)

To give the Discord bot this name and avatar, open your app in the Developer Portal, set the app name to **he he he**, then open **Bot** and upload `assets/bot-logo.png`. The bot token is separate from the app name.

This bot deletes image attachments and applies escalating Discord timeouts when a member posts one. It also detects configured profanity and applies escalating timeouts. Image incidents and profanity incidents have separate counts per member and server over a rolling 30-day window:

| Incident | Timeout |
| --- | --- |
| 1 | 1 minute |
| 2 | 5 minutes |
| 3 | 30 minutes |
| 4 | 2 hours |
| 5 or more | 24 hours |

Discord does not have a native “block for one day” action, so the final step is a 24-hour timeout. The bot stores incident history in `data.json` so it survives restarts.

## Setup

1. Install Node.js 18 or newer.
2. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application and add a bot.
3. Enable **Message Content Intent** under the bot's privileged gateway intents.
4. Invite the bot to the server with **View Channels**, **Send Messages**, **Manage Messages**, and **Moderate Members** permissions. Keep its role above the members it needs to moderate.
5. Copy `.env.example` to `.env` and put the bot token in `DISCORD_TOKEN`. Optionally set `GUILD_ID` and add comma-separated terms in `EXTRA_BAD_WORDS`. To enable Gemini checks, add your key as `GEMINI_API_KEY` in `.env`; optionally choose a model with `GEMINI_MODEL`.
6. Run `npm install`, then `npm start`.

The bot loads 82,782 unique terms from `data/profanity-terms.txt`, including available transliterations, plus the built-in and `EXTRA_BAD_WORDS` terms. It also checks single-word terms of 5–16 letters for one-character typos or adjacent transpositions. If `GEMINI_API_KEY` is configured, messages not caught by the offline filter are sent to Gemini for an additional spelling/context check; without a key, detection remains offline-only. Gemini checks share message text with Google and may incur API usage charges. A failed or timed-out Gemini request is logged and falls back to offline detection. The multilingual dataset is not exhaustive, and either detector can occasionally flag ordinary text. Detected profanity messages and image attachments are deleted; linked images and other embeds are not treated as uploaded photo attachments. Discord does not allow timeouts on members with the **Administrator** permission, though the bot will still try to delete their messages. The bot needs **Manage Messages** in each channel where it should remove messages.

## Deploy on Railway

This is a worker process, not a web server: Railway starts it with `npm start`; it does not need a public domain or a `PORT` setting.

1. Push this project to a private GitHub repository, making sure `.env` is not included. It is ignored by `.gitignore`; never commit or paste API keys into source control.
2. In Railway, create a project and deploy a service from that GitHub repository. Railway detects `package.json` and the `start` script.
3. In the service's **Variables**, add `DISCORD_TOKEN` and `GEMINI_API_KEY` using their values from your local `.env`. Optionally add `GEMINI_MODEL`, `GUILD_ID`, and `EXTRA_BAD_WORDS`. Add variables in Railway's dashboard, not in the repository.
4. Attach a Railway Volume to the service and set its mount path to `/data`. Add the service variable `DATA_PATH=/data/data.json` so the 30-day escalation history survives deploys and restarts.
5. Deploy and check the service's logs for `Moderation bot ready` and `Gemini spelling/context moderation enabled.` The service needs the same Discord permissions and Message Content Intent as in the setup above.
6. After confirming the cloud bot is online, stop any copy running on your own computer so two instances do not moderate the same messages.

Railway's restart policy and availability depend on the plan and service settings. Enable automatic restarts in the service settings and monitor deploy logs; platform or provider outages can still interrupt service.
