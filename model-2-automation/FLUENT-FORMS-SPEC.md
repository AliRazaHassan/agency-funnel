# Fluent Forms + Make.com — Implementation Spec

## Fluent Forms fields

| Field name | Type | Required |
|------------|------|----------|
| `name` | text | yes |
| `whatsapp` | phone | yes |
| `email` | email | yes |
| `business` | text | yes |
| `interest` | select: shopify_store / wp_automation / both | yes |
| `cta_variant` | hidden | no |
| `source_keyword` | hidden | no |
| `page_slug` | hidden | no |

## Webhook

- Fluent Forms → **Webhooks** add-on / integration  
- Method: POST JSON  
- URL: Make.com custom webhook URL (from `scenario.webhook.json`)

### Example payload

```json
{
  "name": "Sara",
  "whatsapp": "+15551234567",
  "email": "sara@example.com",
  "business": "pet supplies",
  "interest": "shopify_store",
  "cta_variant": "store_transfer",
  "source_keyword": "buy ready made Shopify store for pet supplies",
  "page_slug": "buy-ready-made-shopify-store-for-pet-supplies",
  "submitted_at": "2026-03-25T12:00:00Z"
}
```

## Make.com scenario order

See `scenario-steps.md` and `openai-prompt.txt`.

1. Custom webhook  
2. OpenAI (Chat Completions)  
3. HTTP → Whapi.cloud send message  
4. Google Sheets → Add row  
5. Email → notify you  

## Whapi message template

Use output from OpenAI as body. Fallback if API fails:

```
Hi {{name}}! Thanks for reaching out about {{business}}.
We can transfer a ready Shopify store or wire WhatsApp automation on your site.
Reply YES for a 2-min walkthrough.
```
