# Make.com Scenario Steps (build in UI)

Create a new scenario → save webhook URL into Fluent Forms.

## 1. Webhooks → Custom webhook

- Immediate response: yes  
- Copy URL → Fluent Forms webhook

## 2. OpenAI → Create a Chat Completion

- Model: `gpt-4o-mini` (cheap) or `gpt-4.1-mini`  
- System + user: paste from `openai-prompt.txt`  
- Map: name, business, interest, source_keyword  

## 3. HTTP → Make a request (Whapi.cloud)

- Method: POST  
- URL: `https://gate.whapi.cloud/messages/text` (confirm in Whapi docs)  
- Headers: `Authorization: Bearer YOUR_TOKEN`  
- Body JSON:
  - `to`: normalized WhatsApp from webhook  
  - `body`: OpenAI message text  

## 4. Google Sheets → Add a row

Columns: timestamp, name, whatsapp, email, business, interest, keyword, slug, ai_message, status

## 5. Email → Send (optional)

Subject: `New lead: {{name}} — {{business}}`  
Body: dump webhook + AI text

## Test checklist

- [ ] Submit form from sample page  
- [ ] Webhook received in Make  
- [ ] WhatsApp arrives &lt; 60s  
- [ ] Sheet row created  
- [ ] You get email  

## Secrets (never commit)

Store in Make connections / `.env.local` (gitignored):  
`OPENAI_API_KEY`, `WHAPI_TOKEN`, webhook URL
