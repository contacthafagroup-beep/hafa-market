import{c as P,H as C,a as F,j as e,n as I,t as E,a8 as T,o as d,L as S,T as D,q as L,P as A,m as l,_ as O,$ as H,z as n,b as z}from"./index-u439Ofdp.js";import{u as N}from"./useMutation-B8ZKVhzZ.js";import{o as k}from"./order.service-Bat0qwQs.js";/**
 * @license lucide-react v0.363.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B=P("Printer",[["polyline",{points:"6 9 6 2 18 2 18 9",key:"1306q4"}],["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["rect",{width:"12",height:"8",x:"6",y:"14",key:"5ipwut"}]]);function R(a){var m,g,h,y,u,f,b,v,j,o,c,x,p,s;const t=window.open("","_blank");if(!t)return;const w=(m=a.items)==null?void 0:m.map(i=>`
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6">${i.productName}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center">${i.quantity} ${i.unit}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right">ETB ${i.unitPrice.toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700">ETB ${i.totalPrice.toFixed(2)}</td>
    </tr>
  `).join("");t.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice #${a.id.slice(-8).toUpperCase()} — Hafa Market</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 700px; margin: 40px auto; color: #1f2937; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .logo { font-size: 1.5rem; font-weight: 900; color: #2E7D32; }
        .logo span { color: #1f2937; }
        .badge { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 4px 12px; border-radius: 50px; font-size: .8rem; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { background: #f9fafb; padding: 10px 8px; text-align: left; font-size: .8rem; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
        .total-row td { padding: 12px 8px; font-weight: 700; font-size: 1.1rem; border-top: 2px solid #2E7D32; color: #2E7D32; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
        .info-box { background: #f9fafb; border-radius: 12px; padding: 16px; }
        .info-box h4 { font-size: .75rem; color: #9ca3af; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 8px; }
        .footer { text-align: center; color: #9ca3af; font-size: .8rem; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">🌿 Hafa <span>Market</span></div>
          <div style="color:#6b7280;font-size:.85rem;margin-top:4px">Farm Fresh Delivered · Hossana, Ethiopia</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.3rem;font-weight:900;color:#1f2937">INVOICE</div>
          <div style="color:#6b7280;font-size:.85rem">#${a.id.slice(-8).toUpperCase()}</div>
          <div style="color:#6b7280;font-size:.85rem">${new Date(a.createdAt).toLocaleDateString("en-ET",{year:"numeric",month:"long",day:"numeric"})}</div>
          <div class="badge" style="display:inline-block;margin-top:8px">${a.status}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h4>Bill To</h4>
          <div style="font-weight:700">${((g=a.address)==null?void 0:g.fullName)||"Customer"}</div>
          <div style="color:#6b7280;font-size:.85rem">${((h=a.address)==null?void 0:h.phone)||""}</div>
          <div style="color:#6b7280;font-size:.85rem">${((y=a.address)==null?void 0:y.street)||""}</div>
          <div style="color:#6b7280;font-size:.85rem">${((u=a.address)==null?void 0:u.city)||""}, ${((f=a.address)==null?void 0:f.country)||"Ethiopia"}</div>
        </div>
        <div class="info-box">
          <h4>Payment</h4>
          <div style="font-weight:700">${((v=(b=a.payment)==null?void 0:b.method)==null?void 0:v.replace(/_/g," "))||"—"}</div>
          <div style="color:#6b7280;font-size:.85rem">Status: ${((j=a.payment)==null?void 0:j.status)||"—"}</div>
          ${(o=a.payment)!=null&&o.paidAt?`<div style="color:#6b7280;font-size:.85rem">Paid: ${new Date(a.payment.paidAt).toLocaleDateString()}</div>`:""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Unit Price</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${w}
          <tr>
            <td colspan="3" style="padding:8px;text-align:right;color:#6b7280">Subtotal</td>
            <td style="padding:8px;text-align:right">ETB ${(c=a.subtotal)==null?void 0:c.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="3" style="padding:8px;text-align:right;color:#6b7280">Delivery</td>
            <td style="padding:8px;text-align:right">${a.deliveryFee===0?"FREE":"ETB "+((x=a.deliveryFee)==null?void 0:x.toFixed(2))}</td>
          </tr>
          ${a.discount>0?`<tr><td colspan="3" style="padding:8px;text-align:right;color:#2E7D32">Discount</td><td style="padding:8px;text-align:right;color:#2E7D32">-ETB ${(p=a.discount)==null?void 0:p.toFixed(2)}</td></tr>`:""}
          <tr class="total-row">
            <td colspan="3" style="text-align:right">Total</td>
            <td style="text-align:right">ETB ${(s=a.total)==null?void 0:s.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <p>Thank you for shopping with Hafa Market 🌿</p>
        <p>Questions? Contact us at hello@hafamarket.com or +251 911 000 000</p>
        <p style="margin-top:8px;font-size:.7rem">This is a computer-generated invoice and does not require a signature.</p>
      </div>

      <script>window.onload = () => { window.print(); }<\/script>
    </body>
    </html>
  `),t.document.close()}function _(){var o,c,x,p;const{id:a}=C(),{data:t,isLoading:w,refetch:m}=F({queryKey:["order",a],queryFn:()=>k.getOrder(a).then(s=>s.data.data),enabled:!!a}),{mutate:g,isPending:h}=N({mutationFn:()=>k.cancelOrder(a,"Cancelled by customer"),onSuccess:()=>{n.success("Order cancelled"),m()}}),{mutate:y,isPending:u}=N({mutationFn:()=>z.post(`/features/reorder/${a}`),onSuccess:()=>n.success("Items added to cart! 🛒"),onError:s=>{var i,r;return n.error(((r=(i=s==null?void 0:s.response)==null?void 0:i.data)==null?void 0:r.message)||"Failed to reorder")}}),{mutate:f,isPending:b}=N({mutationFn:()=>z.post("/payments/retry",{orderId:a}),onSuccess:s=>{var r,$;const i=($=(r=s.data)==null?void 0:r.data)==null?void 0:$.checkoutUrl;i?window.location.href=i:n.success("Payment retry initiated")},onError:s=>{var i,r;return n.error(((r=(i=s==null?void 0:s.response)==null?void 0:i.data)==null?void 0:r.message)||"Failed to retry payment")}}),{mutate:v,isPending:j}=N({mutationFn:()=>z.post(`/features/insurance/claim/${a}`),onSuccess:()=>n.success("Insurance claim submitted! We'll review within 24 hours."),onError:s=>{var i,r;return n.error(((r=(i=s==null?void 0:s.response)==null?void 0:i.data)==null?void 0:r.message)||"Failed to submit claim")}});return w?e.jsx("div",{className:"flex justify-center py-20",children:e.jsx(I,{})}):t?e.jsxs("div",{className:"space-y-5",children:[e.jsxs("div",{className:"bg-white rounded-2xl shadow-card p-5 flex items-center justify-between flex-wrap gap-3",children:[e.jsxs("div",{children:[e.jsxs("h2",{className:"font-extrabold text-gray-900",children:["Order #",t.id.slice(-8).toUpperCase()]}),e.jsx("p",{className:"text-sm text-gray-400",children:E(t.createdAt)})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:`badge ${T(t.status)}`,children:t.status.replace(/_/g," ")}),["PENDING","CONFIRMED"].includes(t.status)&&e.jsx(d,{variant:"danger",size:"sm",loading:h,onClick:()=>g(),children:"Cancel"}),((o=t.delivery)==null?void 0:o.trackingCode)&&e.jsx(S,{to:`/track/${t.delivery.trackingCode}`,children:e.jsxs(d,{size:"sm",variant:"outline",children:[e.jsx(D,{size:14})," Track"]})}),["DELIVERED","CANCELLED"].includes(t.status)&&e.jsx(d,{size:"sm",variant:"outline",loading:u,onClick:()=>y(),children:"🔄 Reorder"}),t.status==="PENDING"&&((c=t.payment)==null?void 0:c.status)==="FAILED"&&e.jsx(d,{size:"sm",loading:b,onClick:()=>f(),children:"💳 Retry Payment"}),t.hasInsurance&&["DELIVERED","CANCELLED"].includes(t.status)&&!t.insuranceClaimed&&e.jsxs(d,{size:"sm",variant:"outline",loading:j,onClick:()=>v(),children:[e.jsx(L,{size:14})," Claim Insurance"]}),e.jsxs(d,{size:"sm",variant:"outline",onClick:()=>R(t),children:[e.jsx(B,{size:14})," Invoice"]})]})]}),e.jsxs("div",{className:"bg-white rounded-2xl shadow-card p-5",children:[e.jsxs("h3",{className:"font-bold text-gray-900 mb-4 flex items-center gap-2",children:[e.jsx(A,{size:18,className:"text-green-primary"})," Items"]}),e.jsx("div",{className:"space-y-3",children:(x=t.items)==null?void 0:x.map(s=>e.jsxs("div",{className:"flex items-center gap-3 py-2 border-b border-gray-50 last:border-0",children:[e.jsx("div",{className:"w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden",children:s.productImg?e.jsx("img",{src:s.productImg,alt:s.productName,className:"w-full h-full object-cover rounded-xl"}):e.jsx("span",{children:"🛒"})}),e.jsxs("div",{className:"flex-1",children:[e.jsx("p",{className:"font-semibold text-sm text-gray-800",children:s.productName}),e.jsxs("p",{className:"text-xs text-gray-400",children:[s.quantity," ",s.unit," × ",l(s.unitPrice)]})]}),e.jsx("span",{className:"font-bold text-gray-900",children:l(s.totalPrice)})]},s.id))}),e.jsxs("div",{className:"mt-4 pt-4 border-t border-gray-100 space-y-1.5",children:[e.jsxs("div",{className:"flex justify-between text-sm text-gray-500",children:[e.jsx("span",{children:"Subtotal"}),e.jsx("span",{children:l(t.subtotal)})]}),e.jsxs("div",{className:"flex justify-between text-sm text-gray-500",children:[e.jsx("span",{children:"Delivery"}),e.jsx("span",{children:t.deliveryFee===0?"FREE":l(t.deliveryFee)})]}),t.discount>0&&e.jsxs("div",{className:"flex justify-between text-sm text-green-primary",children:[e.jsx("span",{children:"Discount"}),e.jsxs("span",{children:["-",l(t.discount)]})]}),e.jsxs("div",{className:"flex justify-between font-extrabold text-gray-900 text-base pt-2 border-t border-gray-100",children:[e.jsx("span",{children:"Total"}),e.jsx("span",{className:"text-green-primary",children:l(t.total)})]})]})]}),t.statusHistory&&t.statusHistory.length>0&&e.jsxs("div",{className:"bg-white rounded-2xl shadow-card p-5",children:[e.jsxs("h3",{className:"font-bold text-gray-900 mb-4 flex items-center gap-2",children:[e.jsx(D,{size:16,className:"text-green-primary"})," Order Timeline"]}),e.jsxs("div",{className:"relative",children:[e.jsx("div",{className:"absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100"}),e.jsx("div",{className:"space-y-4",children:t.statusHistory.map((s,i)=>e.jsxs("div",{className:"flex items-start gap-4 relative",children:[e.jsx("div",{className:`w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0 ${i===0?"bg-green-primary text-white":"bg-gray-100 text-gray-400"}`,children:e.jsx("div",{className:"w-2 h-2 rounded-full bg-current"})}),e.jsxs("div",{className:"flex-1 pb-1",children:[e.jsx("p",{className:"font-semibold text-sm text-gray-800 capitalize",children:s.status.replace(/_/g," ")}),s.note&&e.jsx("p",{className:"text-xs text-gray-500 mt-0.5",children:s.note}),e.jsx("p",{className:"text-xs text-gray-400 mt-0.5",children:E(s.createdAt)})]})]},s.id||i))})]})]}),e.jsxs("div",{className:"grid sm:grid-cols-2 gap-5",children:[t.address&&e.jsxs("div",{className:"bg-white rounded-2xl shadow-card p-5",children:[e.jsxs("h3",{className:"font-bold text-gray-900 mb-3 flex items-center gap-2",children:[e.jsx(O,{size:16,className:"text-green-primary"})," Delivery Address"]}),e.jsx("p",{className:"text-sm text-gray-700 font-semibold",children:t.address.fullName}),e.jsx("p",{className:"text-sm text-gray-500",children:t.address.phone}),e.jsxs("p",{className:"text-sm text-gray-500",children:[t.address.street,", ",t.address.city]}),e.jsx("p",{className:"text-sm text-gray-500",children:t.address.country})]}),t.payment&&e.jsxs("div",{className:"bg-white rounded-2xl shadow-card p-5",children:[e.jsxs("h3",{className:"font-bold text-gray-900 mb-3 flex items-center gap-2",children:[e.jsx(H,{size:16,className:"text-green-primary"})," Payment"]}),e.jsx("p",{className:"text-sm text-gray-700 font-semibold",children:(p=t.payment.method)==null?void 0:p.replace(/_/g," ")}),e.jsxs("p",{className:"text-sm text-gray-500",children:["Status: ",e.jsx("span",{className:t.payment.status==="PAID"?"text-green-primary font-bold":"text-orange-500 font-bold",children:t.payment.status})]}),t.payment.paidAt&&e.jsxs("p",{className:"text-sm text-gray-400",children:["Paid: ",E(t.payment.paidAt)]})]})]})]}):e.jsx("div",{className:"text-center py-20 text-gray-400",children:"Order not found"})}export{_ as default};
