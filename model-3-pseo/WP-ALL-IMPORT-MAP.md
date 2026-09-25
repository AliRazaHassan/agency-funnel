# WP All Import — Field Map

Use with `keywords-import.csv` and `page-template.html` (or Elementor template).

## Import settings

- **Post type:** Page  
- **Unique key:** `slug`  
- **Status:** Draft for first 50, then publish in batches  
- **Title:** `{h1}`  
- **Slug / post_name:** `{slug}`  
- **Content:** template with placeholders below  

## CSV → template placeholders

| CSV column | Maps to |
|------------|---------|
| `keyword` | `{keyword}`, SEO focus keyphrase |
| `primary_niche` | `{primary_niche}` |
| `city_or_null` | `{city_or_null}` |
| `intent` | `{intent}` |
| `h1` | Page title + `{h1}` |
| `meta_title` | Yoast/RankMath title |
| `meta_description` | Yoast/RankMath description |
| `outline_bullets` | Split on `\|` into 5 list items |
| `cta_variant` | Hidden form field |
| `slug` | Permalink |
| `intro` | Intro paragraph |
| `faq_1_q` … `faq_3_a` | FAQ block |

## Outline split (CodeWP / custom function)

```php
$parts = array_map('trim', explode('|', get_post_meta($post_id, 'outline_bullets', true)));
// $parts[0]..[4] → outline_item_1..5
```

## Recommended custom fields (ACF or meta)

`primary_niche`, `city_or_null`, `intent`, `outline_bullets`, `cta_variant`, `source_keyword`, `intro`, `faq_1_q`, `faq_1_a`, `faq_2_q`, `faq_2_a`, `faq_3_q`, `faq_3_a`

## Batch plan

1. Import 50 drafts → manually QA 10  
2. Publish 50 → submit sitemap  
3. Next batches of 100 until ~500  
