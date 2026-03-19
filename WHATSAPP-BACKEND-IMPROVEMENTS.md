# WhatsApp Bot Accuracy — Backend Improvements

Apply these changes in the **backend** (transporto-backend) webhook handler to improve message parsing and UX.

## 1. Better regex patterns for trip messages

- Handle Hindi/Marathi mixed with English.
- Accept common misspellings and variants:
  - **TRIP START:** `trip start`, `trip started`, `trip suru`, `trip shuru`, `maine trip start kiya`, `start trip`, `trip start kiya`
  - **TRIP END:** `trip end`, `trip end kiya`, `trip khatam`, `end trip`
- Use case-insensitive matching and normalize spaces.

## 2. Confirmation replies

After parsing a message, send a confirmation to the driver:

- **Success:** `✅ Trip Started — Vehicle: MH46CU9567, Time: 10:30 AM`
- **Not understood:** `❌ Could not understand. Reply with: TRIP START / TRIP END / FUEL / EMERGENCY`

## 3. Command menu (HELP / MENU)

If the driver sends `HELP` or `MENU`, reply with:

```
TRIP START — Start a new trip
TRIP END — End current trip
FUEL [amount] — Log fuel entry
EMERGENCY — Report emergency
STATUS — Check current trip status
```

## 4. Photo messages

When the driver sends a photo, reply:

`Photo received! Reply with: DELIVERY / DAMAGE / FUEL RECEIPT / OTHER`

Then handle the follow-up text to tag the photo accordingly.

---

Implement these in the WhatsApp webhook handler (e.g. `POST /api/whatsapp/webhook` or equivalent) that receives incoming messages and sends replies.
