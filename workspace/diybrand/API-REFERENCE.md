# DIYBrand API Reference

**Last Updated:** 2026-03-18
**Base URL:** `http://localhost:3000` (development)
**Pricing:** $19 basic / $49 premium (early access promotional pricing)

---

## Table of Contents

1. [Payment Endpoints](#payment-endpoints)
2. [Questionnaire Endpoints](#questionnaire-endpoints)
3. [Generation Endpoints](#generation-endpoints)
4. [Selection Endpoints](#selection-endpoints)
5. [Export Endpoints](#export-endpoints)
6. [Waitlist Endpoints](#waitlist-endpoints)
7. [Error Codes](#error-codes)
8. [Environment Variables](#environment-variables)

---

## Payment Endpoints

### POST `/api/checkout`

Create a Stripe Checkout Session for purchasing a brand kit.

**Request Body:**
```json
{
  "questionnaireId": "uuid",
  "tier": "basic" | "premium"
}
```

**Response (200):**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Response (400):**
```json
{
  "error": "Missing questionnaireId or invalid tier"
}
```

**Implementation Notes:**
- Creates Stripe Checkout Session with metadata: `questionnaireId`, `tier`
- Success URL: `/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `/questionnaire?cancelled=true`
- Pricing: Basic $19, Premium $49 (one-time payment)

---

### GET `/api/checkout/verify`

Verify payment status after Stripe checkout.

**Query Parameters:**
- `session_id` (required): Stripe Checkout Session ID

**Response (200) - Paid:**
```json
{
  "paid": true,
  "tier": "basic" | "premium",
  "questionnaireId": "uuid"
}
```

**Response (200) - Not Paid:**
```json
{
  "paid": false
}
```

**Response (400):**
```json
{
  "error": "Missing session_id"
}
```

**Implementation Notes:**
- Checks database first (webhook may have already recorded the order)
- Falls back to Stripe API verification if webhook hasn't fired yet
- Uses `onConflictDoNothing()` to ensure idempotency

---

### POST `/api/webhooks/stripe`

Stripe webhook endpoint for `checkout.session.completed` events.

**Headers:**
- `stripe-signature` (required): Webhook signature for verification

**Request Body:**
Raw Stripe event payload

**Response (200):**
```json
{
  "received": true
}
```

**Response (400):**
```json
{
  "error": "Missing signature" | "Invalid signature"
}
```

**Implementation Notes:**
- Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
- On `checkout.session.completed`: inserts order record with customer email, tier, questionnaire ID
- **Idempotent**: safe to replay events

---

## Questionnaire Endpoints

### POST `/api/questionnaire`

Create a new brand questionnaire.

**Request Body:**
```json
{
  "businessName": "string (optional)",
  "industry": "string (optional)",
  "businessDescription": "string (optional)",
  "targetAudience": "string (optional)",
  "brandPersonality": "string[] (optional)",
  "competitors": "string (optional)",
  "visualPreferences": "string (optional)",
  "currentStep": "number (default: 1)"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "businessName": "...",
  "currentStep": 1,
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  ...
}
```

**Response (500):**
```json
{
  "error": "Something went wrong"
}
```

---

### GET `/api/questionnaire`

Fetch a questionnaire by ID.

**Query Parameters:**
- `id` (required): Questionnaire UUID

**Response (200):**
```json
{
  "id": "uuid",
  "businessName": "...",
  "currentStep": 3,
  ...
}
```

**Response (400):**
```json
{
  "error": "id is required"
}
```

**Response (404):**
```json
{
  "error": "Not found"
}
```

---

### PUT `/api/questionnaire`

Update an existing questionnaire.

**Request Body:**
```json
{
  "id": "uuid (required)",
  "businessName": "string (optional)",
  "currentStep": "number (optional)",
  ...
}
```

**Response (200):**
Returns updated questionnaire object.

**Response (400):**
```json
{
  "error": "id is required"
}
```

**Response (404):**
```json
{
  "error": "Not found"
}
```

---

## Generation Endpoints

### POST `/api/generate/palette`

Generate color palettes based on brand questionnaire.

**Request Body:**
```json
{
  "questionnaireId": "uuid"
}
```

**Response (200):**
```json
{
  "palettes": [
    {
      "id": "uuid",
      "name": "Palette Name",
      "colors": [
        {
          "role": "primary",
          "hex": "#00F5FF",
          "hsl": { "h": 183, "s": 100, "l": 50 }
        },
        ...
      ]
    }
  ]
}
```

**Implementation Notes:**
- Generates 3 color palette options
- No external API calls (algorithmic generation)
- Zero cost per request

---

### POST `/api/generate/typography`

Generate typography pairings based on brand personality.

**Request Body:**
```json
{
  "questionnaireId": "uuid"
}
```

**Response (200):**
```json
{
  "typographies": [
    {
      "id": "uuid",
      "name": "Pairing Name",
      "headingFamily": "Font Name",
      "headingWeight": 700,
      "headingCategory": "sans-serif",
      "bodyFamily": "Font Name",
      "bodyWeight": 400,
      "bodyCategory": "sans-serif"
    }
  ]
}
```

**Implementation Notes:**
- Generates 3 typography pairings
- Uses Google Fonts
- No external API calls (curated library)

---

### POST `/api/generate/logo`

Generate AI logo concepts using Google Gemini Imagen.

**Request Body:**
```json
{
  "questionnaireId": "uuid",
  "variant": "wordmark" | "icon"
}
```

**Response (200):**
```json
{
  "logos": [
    {
      "id": "uuid",
      "name": "Logo Name",
      "variant": "wordmark",
      "imagePath": "/path/to/stored/image.png",
      "mimeType": "image/png",
      "prompt": "AI generation prompt used"
    }
  ]
}
```

**Response (400):**
```json
{
  "error": "questionnaireId is required" | "variant is required"
}
```

**Implementation Notes:**
- Uses Google Gemini Imagen API
- Requires `GEMINI_API_KEY` environment variable
- Free tier: 50 images/day
- Stores images in file system (not database)
- Returns `imagePath` instead of base64 data

---

## Selection Endpoints

### POST `/api/palette/select`

Mark a color palette as selected for this brand kit.

**Request Body:**
```json
{
  "paletteId": "uuid"
}
```

**Response (200):**
```json
{
  "ok": true
}
```

---

### POST `/api/typography/select`

Mark a typography pairing as selected.

**Request Body:**
```json
{
  "typographyId": "uuid"
}
```

**Response (200):**
```json
{
  "ok": true
}
```

---

### POST `/api/logo/select`

Mark logo(s) as selected.

**Request Body:**
```json
{
  "logoIds": ["uuid", "uuid"]
}
```

**Response (200):**
```json
{
  "ok": true
}
```

---

## Export Endpoints

### GET `/api/export/brand-kit/[id]`

Download complete brand kit as ZIP file (payment-gated).

**Path Parameters:**
- `id`: Questionnaire UUID

**Query Parameters:**
- `session_id` (required): Stripe Checkout Session ID for payment verification

**Response (200):**
Binary ZIP file with:
```
brand-name-brand-kit.zip
├── README.md
├── logos/
│   ├── logo-wordmark.png
│   └── logo-icon.png
├── colors/
│   ├── palette.json
│   ├── palette.css
│   └── palette.html (visual swatch)
└── typography/
    ├── typography.json
    ├── typography.css
    └── typography.html (visual specimen)
```

**Response (402):**
```json
{
  "error": "Payment required" | "Payment not found or not completed"
}
```

**Response (404):**
```json
{
  "error": "Brand kit not found"
}
```

**Response (400):**
```json
{
  "error": "No brand assets selected yet"
}
```

**Implementation Notes:**
- Verifies payment via Stripe session ID
- Generates ZIP on-the-fly (not cached)
- Includes README with generation date and usage instructions
- CSS uses custom properties for easy integration
- JSON format for programmatic access

---

### GET `/api/logos/[id]/image`

Retrieve individual logo image file.

**Path Parameters:**
- `id`: Logo UUID

**Response (200):**
Binary image data (PNG) with proper `Content-Type` header

**Response (404):**
```json
{
  "error": "Logo not found" | "Image not found"
}
```

**Implementation Notes:**
- Reads from file system storage (not database)
- Sets proper MIME type headers
- Fallback to legacy base64 data if file not found

---

## Waitlist Endpoints

### POST `/api/waitlist`

Add email to waitlist.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Response (400):**
```json
{
  "error": "Email is required" | "Invalid email address"
}
```

**Implementation Notes:**
- Email validation: basic RFC pattern
- Case-insensitive (normalized to lowercase)
- `onConflictDoNothing()`: duplicate emails silently succeed
- No confirmation email sent (MVP)

---

## Error Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| 400 | Bad Request | Missing required parameters, invalid format |
| 402 | Payment Required | Attempting to download brand kit without valid payment |
| 404 | Not Found | Resource doesn't exist in database |
| 500 | Internal Server Error | Database connection issues, unexpected exceptions |

All error responses follow this format:
```json
{
  "error": "Human-readable error message"
}
```

---

## Environment Variables

Required environment variables for backend operation:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/diybrand

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (Payment Processing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google Gemini (AI Logo Generation)
GEMINI_API_KEY=...
```

**Setup Instructions:**
1. Copy `.env.example` to `.env.local`
2. Fill in actual values
3. Never commit `.env.local` to version control

**Stripe Configuration:**
- Test mode: Use `sk_test_...` keys during development
- Live mode: Switch to `sk_live_...` keys in production
- Webhook secret: Obtain from Stripe Dashboard → Webhooks → Add endpoint
- Webhook URL: `https://yourdomain.com/api/webhooks/stripe`
- Webhook events to listen for: `checkout.session.completed`

---

## Security Notes

1. **PCI Compliance:** No raw card data ever touches our servers. Stripe handles all payment collection.
2. **Webhook Verification:** All Stripe webhooks verify signature before processing.
3. **Payment Gating:** Brand kit download requires valid Stripe session ID.
4. **Input Validation:** Email addresses validated before database insertion.
5. **Error Messages:** Generic error messages to prevent information leakage.

---

## Rate Limits

- **Gemini API:** 50 logo generations per day (free tier)
- **Stripe:** No rate limits on Checkout Sessions (reasonable use expected)
- **Other endpoints:** No explicit rate limiting (MVP)

---

## Testing

**Local Stripe Testing:**
```bash
# Install Stripe CLI
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Use test card numbers
# Success: 4242 4242 4242 4242
# Decline: 4000 0000 0000 0002
```

**Test Mode vs Live Mode:**
- Test keys: `sk_test_...` and `pk_test_...`
- Live keys: `sk_live_...` and `pk_live_...`
- Never mix test and live keys in same environment
