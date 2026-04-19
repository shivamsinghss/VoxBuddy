# VoxBuddy — Kick Viewer Guide

> **Hey chat!** You can control the character on stream by typing commands. No downloads, no setup — just type in Kick chat.

---

## How It Works

When you type a command in Kick chat, the 3D character on screen reacts **live**.
Every viewer can participate — the character will wave, fight, look around and more based on what chat types.

---

## How to Use a Command

Type a command in Kick chat starting with `~` (tilde):

```
~wave
~kick
~lookbehind
```

That's it. The character responds within a second.

---

## Commands — Free for Everyone 👀

These work for **all viewers**, no subscription needed:

| Command | What happens |
|---|---|
| `~wave` | Character waves at chat |
| `~kick` | Character throws an MMA kick |
| `~lookbehind` | Character looks behind suspiciously |

---

## Commands — Subscribers Only 🟡

Subs unlock **exclusive animations** — type them in chat and the character performs them live:

| Command | What happens |
|---|---|
| `~walk` | Character starts walking |
| `~run` | Character breaks into a run |
| `~knockout` | Character gets knocked out |

> If you try a sub command without a subscription, chat will reply:
> `🔒 ~knockout is for subscribers — sub to unlock!`

---

## How to Know Who's Who in Chat

Every Kick message shows a badge next to the username:

| Badge | Who |
|---|---|
| *(no badge)* | Regular chatter |
| 🟡 **SUB** | Subscriber |
| 🟣 **MOD** | Moderator |
| 🔴 **OWNER** | The streamer |

Subscriber messages also have a **gold-tinted bubble** so they stand out in chat.

---

## Quick Tips

- **No prefix?** Just typing the command name works too — `walk`, `wave`, etc.
- **Partial names work** — `~knock` triggers the knockout animation
- **`~commands`** — type this anytime to see the full list split by tier
- Commands are **not** case-sensitive

---

## For the Streamer

### Setup (one time)

1. Open `kick.config.json` and set your channel name:
   ```json
   {
     "enabled": true,
     "channel": "your_kick_username"
   }
   ```
2. Run `node server.js` — the **KICK LIVE** badge lights up when connected

### Adding animations

| Folder | Who can use it |
|---|---|
| `animate/` | All viewers (free commands) |
| `subs/` | Subscribers, mods, and you |

Drop any `.fbx` file into either folder and restart the server.
The filename becomes the command — `Mma Kick.fbx` → `~mma kick`.

### Access levels

| Role | Free commands | Sub commands |
|---|---|---|
| Viewer | ✅ | ❌ |
| Subscriber | ✅ | ✅ |
| Moderator | ✅ | ✅ |
| You (broadcaster) | ✅ | ✅ |

---

## How It Works Technically

Every Kick chat message includes a `badges` list. The server reads it automatically:

```
broadcaster badge  →  OWNER  (full access)
moderator badge    →  MOD    (full access)
subscriber badge   →  SUB    (animate/ + subs/)
no badge           →  viewer (animate/ only)
```

Badge types Kick sends: `subscriber`, `founder`, `og`, `sub_gifter`, `moderator`, `broadcaster`, `vip`

---

*Built with Three.js + Kick Pusher WebSocket*
