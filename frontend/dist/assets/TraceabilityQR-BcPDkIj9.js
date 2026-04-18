import{r as g,a as f,j as e,n as j,au as l,af as p,_ as N,t as h,q as w,b}from"./index-u439Ofdp.js";import{L as k}from"./leaf-BIcyyDgC.js";import{D as z}from"./download-p_Sb74wi.js";function d(c){return`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(c)}&bgcolor=ffffff&color=1b5e20&margin=10`}function C(){const[c,q]=g.useState(null),[D,Q]=g.useState(!1),{data:x=[],isLoading:v}=f({queryKey:["seller-products-qr"],queryFn:()=>b.get("/sellers/me/products?limit=50").then(s=>s.data.data)}),{data:r}=f({queryKey:["my-store"],queryFn:()=>b.get("/sellers/me/store").then(s=>s.data.data).catch(()=>null)}),o=s=>({url:`${window.location.origin}/products/${s.slug}?trace=1`,data:{product:s.name,farmer:(r==null?void 0:r.storeName)||"Hafa Market Seller",location:(r==null?void 0:r.city)||"Hossana, Ethiopia",harvestDate:s.harvestDate||s.season||"Not specified",organic:s.isOrganic,certifiedBy:"Hafa Market",verifiedAt:new Date().toISOString()}}),y=s=>{const{url:i}=o(s),t=d(i),a=document.createElement("a");a.href=t,a.download=`qr-${s.slug}.png`,a.target="_blank",a.click()},u=s=>{const{url:i,data:t}=o(s),a=d(i),n=window.open("","_blank");n&&(n.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Traceability Label — ${s.name}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; }
          .label { width: 300px; border: 2px solid #2E7D32; border-radius: 12px; padding: 16px; margin: 0 auto; }
          .header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
          .logo { font-size: 1.1rem; font-weight: 900; color: #2E7D32; }
          .product { font-size: 1.2rem; font-weight: 900; color: #1f2937; margin-bottom: 8px; }
          .info { font-size: .75rem; color: #6b7280; margin: 3px 0; }
          .info strong { color: #1f2937; }
          .qr { text-align: center; margin: 12px 0; }
          .qr img { width: 120px; height: 120px; }
          .footer { font-size: .65rem; color: #9ca3af; text-align: center; margin-top: 8px; }
          .organic { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 2px 8px; border-radius: 50px; font-size: .7rem; font-weight: 700; display: inline-block; margin-bottom: 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">
            <span style="font-size:1.5rem">🌿</span>
            <div class="logo">Hafa Market</div>
          </div>
          <div class="product">${s.name}</div>
          ${s.isOrganic?'<div class="organic">🌿 Certified Organic</div>':""}
          <div class="info">🌾 <strong>Farmer:</strong> ${t.farmer}</div>
          <div class="info">📍 <strong>Origin:</strong> ${t.location}</div>
          <div class="info">📅 <strong>Harvest:</strong> ${t.harvestDate!=="Not specified"?h(t.harvestDate):"Not specified"}</div>
          <div class="info">✅ <strong>Verified by:</strong> ${t.certifiedBy}</div>
          <div class="qr">
            <img src="${a}" alt="QR Code" />
            <div style="font-size:.65rem;color:#9ca3af;margin-top:4px">Scan to verify origin</div>
          </div>
          <div class="footer">
            Farm-to-table traceability powered by Hafa Market<br/>
            hafamarket.com
          </div>
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `),n.document.close())};return v?e.jsx("div",{className:"flex justify-center py-20",children:e.jsx(j,{})}):e.jsxs("div",{className:"space-y-5",children:[e.jsxs("div",{children:[e.jsxs("h2",{className:"text-xl font-extrabold text-gray-900 flex items-center gap-2",children:[e.jsx(l,{size:20,className:"text-green-primary"})," Traceability QR Codes"]}),e.jsx("p",{className:"text-sm text-gray-400",children:"Generate farm-to-table QR codes for your products. Buyers scan to verify origin."})]}),e.jsxs("div",{className:"bg-green-50 border border-green-200 rounded-2xl p-5",children:[e.jsx("h3",{className:"font-bold text-gray-800 mb-3",children:"🔍 How Traceability Works"}),e.jsx("div",{className:"grid sm:grid-cols-4 gap-3 text-center text-sm",children:[{icon:"🌾",step:"1",text:"You set harvest date & location"},{icon:"📱",step:"2",text:"QR code generated for your product"},{icon:"🏷️",step:"3",text:"Print & attach to packaging"},{icon:"✅",step:"4",text:"Buyer scans to verify origin"}].map(s=>e.jsxs("div",{className:"bg-white rounded-xl p-3",children:[e.jsx("div",{className:"text-2xl mb-1",children:s.icon}),e.jsxs("div",{className:"text-xs font-bold text-gray-500 mb-1",children:["Step ",s.step]}),e.jsx("div",{className:"text-xs text-gray-600",children:s.text})]},s.step))})]}),x.length?e.jsx("div",{className:"grid sm:grid-cols-2 lg:grid-cols-3 gap-4",children:x.map(s=>{var m;const{url:i,data:t}=o(s),a=d(i),n=!!(s.harvestDate||s.season);return e.jsxs("div",{className:"bg-white rounded-2xl shadow-card p-4",children:[e.jsxs("div",{className:"flex items-center gap-3 mb-4",children:[e.jsx("div",{className:"w-12 h-12 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0",children:(m=s.images)!=null&&m[0]?e.jsx("img",{src:s.images[0],className:"w-full h-full object-cover",alt:""}):e.jsx("span",{className:"flex items-center justify-center h-full text-xl",children:"🛒"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"font-bold text-gray-800 truncate",children:s.name}),e.jsxs("div",{className:"flex items-center gap-2 mt-0.5",children:[s.isOrganic&&e.jsxs("span",{className:"text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5",children:[e.jsx(k,{size:9})," Organic"]}),n?e.jsxs("span",{className:"text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5",children:[e.jsx(p,{size:9})," Date set"]}):e.jsx("span",{className:"text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full",children:"⚠️ No date"})]})]})]}),e.jsx("div",{className:"flex justify-center mb-4",children:e.jsx("div",{className:"bg-gray-50 rounded-xl p-3 border border-gray-100",children:e.jsx("img",{src:a,alt:"QR Code",className:"w-28 h-28"})})}),e.jsxs("div",{className:"space-y-1 mb-4 text-xs text-gray-500",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx(N,{size:11})," ",t.location]}),n&&e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx(p,{size:11})," Harvested: ",h(t.harvestDate)]}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx(w,{size:11})," Verified by Hafa Market"]})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs("button",{onClick:()=>u(s),className:"flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-primary text-white rounded-xl text-xs font-bold hover:bg-green-dark transition-colors",children:[e.jsx(z,{size:13})," Print Label"]}),e.jsxs("button",{onClick:()=>y(s),className:"flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-green-primary transition-colors",children:[e.jsx(l,{size:13})," QR"]})]})]},s.id)})}):e.jsxs("div",{className:"bg-white rounded-2xl shadow-card p-12 text-center text-gray-400",children:[e.jsx(l,{size:40,className:"mx-auto mb-3 opacity-30"}),e.jsx("p",{children:"No products yet. Add products to generate QR codes."})]})]})}export{C as default};
