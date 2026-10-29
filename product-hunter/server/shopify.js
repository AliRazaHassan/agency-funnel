import { createShopifyConnection } from './shopifyConnection.js';
const connection = createShopifyConnection();
export const shopifyStatus = connection.status;
export const verifyShopifyConnection = connection.verify;
export async function createShopifyDraft(product={}){
  const c=connection.status();
  if(!c.configured) throw new Error("Shopify is not connected. Install the Signal Desk app and configure its credentials in Render.");
  if(!product.title) throw new Error("Product title required");
  const kit=product.launchKit||{};
  const descriptionText=String(kit.description||product.problemSolved||product.pdpBullets?.join(". ")||"Product candidate from Product Hunter AI").replace(/[<>]/g,"");
  const benefits=Array.isArray(kit.benefits)?kit.benefits:[];
  const faq=Array.isArray(kit.faqs)?kit.faqs:[];
  const descriptionHtml=[
    `<p>${descriptionText}</p>`,
    benefits.length?`<h3>Benefits</h3><ul>${benefits.map(x=>`<li>${String(x).replace(/[<>]/g,"")}</li>`).join("")}</ul>`:"",
    faq.length?`<h3>FAQ</h3>${faq.map(x=>`<h4>${String(x.q||"").replace(/[<>]/g,"")}</h4><p>${String(x.a||"").replace(/[<>]/g,"")}</p>`).join("")}`:""
  ].join("");
  const input={
    title:String(kit.title||product.title),
    descriptionHtml,
    productType:String(product.category||""),
    vendor:"Product Hunter AI",
    status:"DRAFT",
    tags:["product-hunter",product.trendStatus,product.dataConfidence&&`confidence-${String(product.dataConfidence).toLowerCase()}`].filter(Boolean),
    seo:{
      title:String(kit.seoTitle||kit.title||product.title).slice(0,70),
      description:String(kit.metaDescription||product.hook||product.problemSolved||"").slice(0,320)
    }
  };
  const query=`mutation ProductHunterCreate($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product { id title handle status variants(first: 1) { nodes { id price } } }
      userErrors { field message }
    }
  }`;
  const body=await connection.graphql(query,{product:input});
  const errors=body?.data?.productCreate?.userErrors||[];
  if(errors.length) throw new Error(errors.map(x=>x.message).join("; "));
  const created=body?.data?.productCreate?.product;
  if(!created) throw new Error("Shopify did not return a created product");

  const variantId=created.variants?.nodes?.[0]?.id;
  const price=Number(kit.pricing?.recommended ?? product.estSellPriceUsd)||0;
  const compareAt=Number(kit.pricing?.compareAt ?? product.compareAtPriceUsd)||0;
  if(variantId&&price>0){
    const updateQuery=`mutation ProductHunterPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price compareAtPrice }
        userErrors { field message }
      }
    }`;
    const priceBody=await connection.graphql(updateQuery,{productId:created.id,variants:[{
        id:variantId,
        price:Number(price.toFixed(2)),
        ...(compareAt>price ? {compareAtPrice:Number(compareAt.toFixed(2))} : {})
      }]
    });
    const priceErrors=priceBody?.data?.productVariantsBulkUpdate?.userErrors||[];
    if(priceErrors.length) throw new Error(`Product draft ${created.id} was created but pricing failed: ${priceErrors.map(x=>x.message).join("; ")}. Review this draft before importing again.`);
    created.variants={nodes:priceBody?.data?.productVariantsBulkUpdate?.productVariants||created.variants.nodes};
  }
  return {ok:true,product:created,store:c.store,note:"Created as DRAFT with launch copy and pricing when available. Review inventory, image licensing, supplier variant mapping and claims before publishing."};
}
