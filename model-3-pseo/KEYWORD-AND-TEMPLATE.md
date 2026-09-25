# Model 3 — Programmatic SEO

## Goal

One site that ranks for problem-aware searches → form → Make.com nurture → sell Model 1 stores.

## Do NOT do thin spam

Prefer **quality templates + real modifiers** over 2,000 empty pages on day 1.  
Ship **100–500 strong pages** first, then scale.

## Keyword formula (ChatGPT / Claude)

```
Act as an SEO keyword researcher for an agency that sells:
1) ready-made automated Shopify stores
2) WordPress + Make.com lead automation

Generate 500 long-tail keywords using these patterns:
- "how to automate inventory in [niche] Shopify store"
- "best automated WordPress setup for [city] [profession]"
- "buy ready made Shopify store for [niche]"
- "[niche] dropshipping store setup cost"
- "WhatsApp lead automation for [profession]"

Niches: pet supplies, home fitness, eco kitchen gadgets, beauty, baby products
Cities: mix of US + UK + Gulf mid-size cities (not only mega cities)
Professions: realtor, dentist, gym owner, salon, restaurant

Output CSV columns:
keyword, primary_niche, city_or_null, intent (informational|commercial|transactional),
h1, meta_title, meta_description, outline_bullets, cta_variant
```

## Page template structure (one PHP/Elementor template)

1. **H1** = keyword / problem statement  
2. **Intro** (80–120 words) — problem + who this is for  
3. **Solution block** — what you deliver (store / automation)  
4. **Checklist** — 5–7 steps unique per niche  
5. **Proof / process** — “ready in 24–72h transfer”  
6. **FAQ** — 3 questions (generated per row)  
7. **CTA form** — Fluent Forms (feeds Model 2)

## WP All Import

1. Design one page template with mapped custom fields  
2. Import `keywords-import.csv`  
3. Set unique slug from `keyword`  
4. Post status: draft first 50 → review → publish batches of 50–100

## Files in this folder

- `keywords-import.sample.csv` — column format + 10 example rows  
- Expand to 500 using the formula above before bulk import
