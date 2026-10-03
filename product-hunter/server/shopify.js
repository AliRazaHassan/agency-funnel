function config(){
  const raw=String(process.env.SHOPIFY_STORE_DOMAIN||"").trim();
  const store=raw.replace(/^https?:\/\//,"").replace(/\/$/,"");
  const token=String(process.env.SHOPIFY_ADMIN_TOKEN||"").trim();
  return {store,token,configured:Boolean(store&&token)};
}
export function shopifyStatus(){
  const c=config();
  return {configured:c.configured,store:c.store||null,apiVersion:"2026-07",requiredScopes:["write_products"]};
}
export async function createShopifyDraft(product={}){
  const c=config();
  if(!c.configured) throw new Error("Shopify is not connected. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN.");
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
  const res=await fetch(`https://${c.store}/admin/api/2026-07/graphql.json`,{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Shopify-Access-Token":c.token},
    body:JSON.stringify({query,variables:{product:input}})
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(`Shopify API failed (${res.status})`);
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
    const priceRes=await fetch(`https://${c.store}/admin/api/2026-07/graphql.json`,{
      method:"POST",
      headers:{"Content-Type":"application/json","X-Shopify-Access-Token":c.token},
      body:JSON.stringify({query:updateQuery,variables:{productId:created.id,variants:[{
        id:variantId,
        price:Number(price.toFixed(2)),
        ...(compareAt>price ? {compareAtPrice:Number(compareAt.toFixed(2))} : {})
      }]}})
    });
    const priceBody=await priceRes.json().catch(()=>({}));
    const priceErrors=priceBody?.data?.productVariantsBulkUpdate?.userErrors||[];
    if(!priceRes.ok||priceErrors.length) throw new Error(priceErrors.map(x=>x.message).join("; ")||`Shopify price update failed (${priceRes.status})`);
    created.variants={nodes:priceBody?.data?.productVariantsBulkUpdate?.productVariants||created.variants.nodes};
  }
  return {ok:true,product:created,store:c.store,note:"Created as DRAFT with launch copy and pricing when available. Review inventory, image licensing, supplier variant mapping and claims before publishing."};
}
