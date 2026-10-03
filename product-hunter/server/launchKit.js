import { chatJson } from "./openai.js";

function round2(n){return Math.round(Number(n||0)*100)/100;}

export async function buildLaunchKit(product = {}) {
  if (!product?.title) throw new Error("Product is required");
  const sell = Number(product.estSellPriceUsd)||Number(product.estAovUsd)||0;
  const landed = Number(product.supplierVerification?.landedCostUsd)||Number(product.estCostUsd)||0;
  const compareAt = sell > 0 ? round2(sell * 1.25) : null;
  const ai = await chatJson(
    `You are a Shopify launch-copy assistant. Return JSON with:
title, description, benefits (4-6 strings), faqs (4 objects {q,a}), seoTitle, metaDescription,
pricing {recommended,compareAt,bundleOffer}, adHooks (5 strings), ugcScript, primaryText, headline, cta, landingPageSections.
Use only supportable product claims. Do not fabricate reviews, certifications, scarcity, medical claims or customer results.`,
    `PRODUCT: ${JSON.stringify({
      title:product.title,category:product.category,problemSolved:product.problemSolved,
      hook:product.hook,pdpBullets:product.pdpBullets,bundleWith:product.bundleWith,
      sellPriceUsd:sell,landedCostUsd:landed,seasonalFit:product.seasonalFit,
      creativeIntel:product.creativeIntel
    })}`
  );
  const fallback = {
    title: product.title,
    description: `${product.title} is positioned around ${product.problemSolved || "a practical everyday use case"}. Focus the page on demonstration, what is included, delivery expectations and returns.`,
    benefits: (product.pdpBullets || []).slice(0,5),
    faqs: [
      {q:"What is included?",a:"List the exact included items from the verified supplier listing before publishing."},
      {q:"How long does delivery take?",a:"Use the verified supplier shipping window for the customer's market."},
      {q:"What is the return policy?",a:"Use your store's published return policy and supplier constraints."},
      {q:"Is this product guaranteed to produce a specific result?",a:"No. Avoid unsupported performance or health guarantees."}
    ],
    seoTitle: product.title,
    metaDescription: `Shop ${product.title}. See features, bundle options, delivery details and returns.`,
    pricing:{recommended:sell||null,compareAt,bundleOffer:(product.bundleWith||[])[0] ? `Bundle with ${product.bundleWith[0]}` : "Create a complementary bundle after supplier verification"},
    adHooks:[product.hook || `Meet ${product.title}`],
    ugcScript:`Open with the everyday problem, demonstrate ${product.title}, show what is included, then use a clear low-pressure CTA.`,
    primaryText: product.hook || `A practical look at ${product.title}.`,
    headline: product.offerLine || product.title,
    cta:"Shop Now",
    landingPageSections:["Hero","Problem","Demo","Benefits","What's included","Shipping & returns","FAQ","Bundle"]
  };
  return {
    ...(ai || fallback),
    pricing:{...fallback.pricing,...(ai?.pricing||{})},
    productId:product.id,
    generatedAt:new Date().toISOString(),
    assetPolicy:"No fabricated reviews. Use only supplier/customer assets you have rights to use.",
    image:product.image||null,
  };
}
