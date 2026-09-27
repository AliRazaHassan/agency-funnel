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
  const input={
    title:String(product.title),
    descriptionHtml:`<p>${String(product.problemSolved||product.pdpBullets?.join(". ")||"Product candidate from Product Hunter AI").replace(/[<>]/g,"")}</p>`,
    productType:String(product.category||""),
    vendor:"Product Hunter AI",
    status:"DRAFT",
    tags:["product-hunter",product.trendStatus,product.dataConfidence&&`confidence-${String(product.dataConfidence).toLowerCase()}`].filter(Boolean),
    seo:{
      title:String(product.title).slice(0,70),
      description:String(product.hook||product.problemSolved||"").slice(0,320)
    }
  };
  const query=`mutation ProductHunterCreate($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product { id title handle status }
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
  return {ok:true,product:created,store:c.store,note:"Created as DRAFT. Review price, inventory, images and variants in Shopify before publishing."};
}
