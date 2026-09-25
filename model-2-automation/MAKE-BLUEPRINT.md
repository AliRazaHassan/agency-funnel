# Model 2 — Lead Capture & Nurture

## Stack

WordPress + Fluent Forms (or Gravity Forms) + Make.com + Whapi.cloud / Twilio + ChatGPT API

## Flow (under 60 seconds)

1. Visitor submits form on pSEO site  
   Fields: name, WhatsApp/phone, email, niche/business type, budget (optional)
2. Fluent Forms **Webhook** → Make.com scenario
3. Make.com → OpenAI: generate personalized short proposal
4. Make.com → Whapi/Twilio: WhatsApp/SMS to lead
5. Make.com → Google Sheet / CRM row + email copy to you

## Make.com modules (order)

1. Custom webhook (catch form)
2. OpenAI / HTTP → ChatGPT
3. WhatsApp/SMS send
4. Google Sheets → Add row
5. Email (Gmail/Outlook) → notify you

## Sample WhatsApp copy

```
Hi {{name}}! Thanks for reaching out.
We mapped a quick AI mockup for your {{business}} store —
reply YES and I'll send the 2-min walkthrough + next steps.
```

## OpenAI prompt stub

```
You are a sales assistant for an ecommerce automation agency.
Write a short (80–120 words) personalized WhatsApp-friendly proposal for:
Name: {{name}}
Business: {{business}}
Goal: ready-to-run Shopify store or WordPress automation.
Tone: confident, specific, no fluff. End with one clear CTA.
```

## Sell-the-system upsell

Same automation packaged as a product: **$1,000+** setup for client’s own leads.
