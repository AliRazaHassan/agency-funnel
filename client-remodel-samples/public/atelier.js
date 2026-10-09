'use strict';
const q=(s,root=document)=>root.querySelector(s), qa=(s,root=document)=>[...root.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const menu=q('.menu-toggle'), nav=q('#site-nav');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.classList.toggle('open',open)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');nav.classList.remove('open')}});
const toast=q('.toast');let toastTimer;function announce(text){toast.textContent=text;toast.classList.add('active');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('active'),4000)}
const storage={get(key){try{return localStorage.getItem(key)}catch{return null}},set(key,value){try{localStorage.setItem(key,value);return true}catch{return false}},remove(key){try{localStorage.removeItem(key)}catch{}}};
qa('[data-comparison]').forEach(el=>q('input',el).addEventListener('input',e=>el.style.setProperty('--split',e.target.value+'%')));
const home=q('#home-comparison');if(home){const tabs=qa('[data-room]');function choose(button){tabs.forEach(b=>{b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1});const room=button.dataset.room,el=q('.comparison',home);qa('img',el).forEach((im,i)=>{im.src='/'+room+'-'+(i?'before':'after')+'.webp';im.alt=(i?'Before':'After')+': illustrative '+(room==='bath'?'bathroom':'kitchen')+' design study'});el.style.setProperty('--split','50%');q('input',el).value='50';q('input',el).setAttribute('aria-label','Reveal '+(room==='bath'?'bathroom':'kitchen')+' before and after');home.setAttribute('aria-label',room==='bath'?'Bathroom transformation':'Kitchen transformation');q('.transformation-copy>.link-arrow').href='/atelier/projects/'+(room==='bath'?'bathroom':'kitchen')}
 tabs.forEach((b,i)=>{b.tabIndex=i? -1:0;b.addEventListener('click',()=>choose(b));b.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const target=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];choose(target);target.focus()}})})}
qa('[data-filter]').forEach(b=>b.addEventListener('click',()=>{qa('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));qa('[data-category]').forEach(x=>x.hidden=b.dataset.filter!=='all'&&x.dataset.category!==b.dataset.filter)}));
const photo=q('#photo-dialog');qa('[data-photo]').forEach(b=>b.addEventListener('click',()=>{q('#expanded-photo').src=b.dataset.photo;q('#expanded-photo').alt=q('img',b)?.alt||'Expanded interior design study';photo.showModal()}));q('[data-close-photo]').addEventListener('click',()=>photo.close());
const disclosure=q('#disclosure');q('[data-open-disclosure]').addEventListener('click',()=>disclosure.showModal());q('[data-close-disclosure]').addEventListener('click',()=>disclosure.close());[photo,disclosure].forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
const moods={natural:{title:'Warmth, with balance.',name:'Natural modern',image:'kitchen-after',caption:'NATURAL MODERN / THE GATHERING PLACE',copy:'Natural oak brings warmth. Expressive stone adds character. A restrained bronze detail connects the room.',swatches:[['Natural oak','linear-gradient(110deg,#9a7a53,#d0b18b)'],['Expressive stone','linear-gradient(40deg,#e5e0d3,#b3a08b 45%,#eae7dd 60%)'],['Brushed bronze','linear-gradient(120deg,#a99161,#78603e)']]},quiet:{title:'A calmer daily ritual.',name:'Quiet luxury',image:'bath-after',caption:'QUIET LUXURY / A QUIETER RITUAL',copy:'Warm limestone creates a soft foundation. Walnut adds depth. Gentle brass details bring a quiet warmth.',swatches:[['Warm limestone','linear-gradient(120deg,#d5cbb8,#bfb39e)'],['Walnut','linear-gradient(110deg,#674934,#9e7653)'],['Soft brass','linear-gradient(110deg,#c5b17c,#9c8757)']]},minimal:{title:'Space for the essentials.',name:'Warm minimalism',image:'living',caption:'WARM MINIMALISM / SPACE TO EXHALE',copy:'Pale limestone connects the floor and architecture. Linen softens the room. Warm walnut gives a restrained palette its depth.',swatches:[['Pale limestone','linear-gradient(140deg,#e3ddd0,#cbc5b7)'],['Natural linen','linear-gradient(90deg,#dfd9c9,#eae5d7)'],['Warm walnut','linear-gradient(110deg,#785b42,#ab8a64)']]}};
let selectedMood='natural';function renderMood(id){const m=moods[id];selectedMood=id;qa('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mood===id)));q('#mood-image').src='/'+m.image+'.webp';q('#mood-image').alt=m.name+' illustrative interior inspiration';q('#mood-caption').textContent=m.caption;q('#mood-title').textContent=m.title;q('#mood-copy').textContent=m.copy;const swatches=q('#recipe-swatches');swatches.replaceChildren();m.swatches.forEach(([label,colour])=>{const d=document.createElement('div'),i=document.createElement('i'),s=document.createElement('span');i.style.background=colour;s.textContent=label;d.append(i,s);swatches.append(d)})}
if(q('#mood-image')){const prior=storage.get('atelier-mood');renderMood(moods[prior]?prior:'natural');qa('[data-mood]').forEach(b=>b.addEventListener('click',()=>renderMood(b.dataset.mood)));q('#save-mood').addEventListener('click',()=>{if(storage.set('atelier-mood',selectedMood)){announce('Design direction saved. Add your project details next.');setTimeout(()=>location.assign('/atelier/contact'),600)}else{announce('Storage unavailable. You can select your mood in the project brief.')}})}
const form=q('#project-form');if(form){let step=0,referenceUrls=[],lastBrief='';const fields=qa('input:not([type=file]):not([type=checkbox]),textarea,select',form),error=q('.form-error');
 function read(){const values={};for(const el of fields){if(el.type==='radio'){if(el.checked)values[el.name]=el.value}else values[el.name]=el.value}return values}
 function save(){storage.set('atelier-project-draft',JSON.stringify(read()))}
 let draft={};try{draft=JSON.parse(storage.get('atelier-project-draft')||'{}')}catch{}
 for(const el of fields){const val=draft[el.name];if(typeof val==='string'){if(el.type==='radio')el.checked=el.value===val;else if(el.tagName==='SELECT'){if([...el.options].some(o=>o.value===val))el.value=val}else el.value=val.slice(0,el.maxLength>0?el.maxLength:3000)}}
 const mood=storage.get('atelier-mood');if(moods[mood])form.elements.mood.value=moods[mood].name;
 fields.forEach(el=>{el.addEventListener('input',save);el.addEventListener('change',save)});
 function review(){const d=read(),r=q('#brief-review');r.replaceChildren();for(const [label,name] of [['Space','space'],['Location','location'],['Mood','mood'],['Investment','budget'],['Timing','timing']]){const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=d[name]||'To be discussed';row.append(a,b);r.append(row)}const p=document.createElement('p');p.textContent=d.goals||'';r.append(p)}
 function show(){qa('[data-step]',form).forEach(el=>el.hidden=Number(el.dataset.step)!==step);q('#step-label').textContent=['01 / YOUR SPACE','02 / YOUR DIRECTION','03 / YOUR BRIEF'][step];q('#step-count').textContent='Step '+(step+1)+' of 3';q('#step-fill').style.width=((step+1)/3*100)+'%';q('#previous-step').hidden=step===0;q('#next-step').hidden=step===2;q('#download-brief').hidden=step!==2;error.textContent='';if(step===2)review()}
 function validate(){const controls=qa('input,select,textarea',q('[data-step="'+step+'"]'));for(const el of controls){if((el.name==='goals' && el.value.trim().length<10)||!el.checkValidity()){error.textContent=step===0?'Choose a space and describe your goals in at least 10 characters.':'Please complete the required fields.';el.reportValidity();el.focus();return false}}return true}
 q('#next-step').addEventListener('click',()=>{if(validate()){save();step++;show();q('legend',q('[data-step="'+step+'"]')).setAttribute('tabindex','-1');q('legend',q('[data-step="'+step+'"]')).focus()}});q('#previous-step').addEventListener('click',()=>{save();step--;show()});
 function download(text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ARQORA-Project-Brief.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
 function makeBrief(){const d=read();return 'ARQORA — YOUR PROJECT BRIEF\nPrepared: '+new Date().toLocaleDateString()+'\n\n'+[['Name','name'],['Space','space'],['Location','location'],['Design mood','mood'],['Investment range','budget'],['Ideal timing','timing']].map(([label,key])=>label+': '+(d[key]||'To be discussed')).join('\n')+'\n\nYOUR PRIORITIES\n'+d.goals+'\n\nNEXT CONVERSATION\nConfirm the scope, site conditions, material samples and project-specific budget with your designer.\n\nIllustrative proposal preview. This brief has not been sent. Photos stay on your device and are not included in this file. Investment ranges are your planning inputs, not a quotation.'}
 form.addEventListener('submit',e=>{e.preventDefault();if(step!==2||!validate())return;save();lastBrief=makeBrief();download(lastBrief);form.hidden=true;q('#brief-success').hidden=false;announce('Your brief is ready. No enquiry has been sent.')});
 q('#download-again').addEventListener('click',()=>download(lastBrief||makeBrief()));q('#edit-brief').addEventListener('click',()=>{q('#brief-success').hidden=true;form.hidden=false;show()});q('#clear-draft').addEventListener('click',()=>{storage.remove('atelier-project-draft');storage.remove('atelier-mood');form.reset();referenceUrls.forEach(URL.revokeObjectURL);referenceUrls=[];q('#photo-previews').replaceChildren();step=0;show();announce('Your saved draft has been cleared.')});
 q('#reference-photos').addEventListener('change',e=>{referenceUrls.forEach(URL.revokeObjectURL);referenceUrls=[];q('#photo-previews').replaceChildren();const files=[...e.target.files];if(files.length>3||files.some(f=>f.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(f.type))){e.target.value='';error.textContent='Choose up to three JPG, PNG or WebP images, each no larger than 8 MB.';return}error.textContent='';files.forEach(f=>{const url=URL.createObjectURL(f);referenceUrls.push(url);const d=document.createElement('div'),im=document.createElement('img');im.src=url;im.alt='Local reference: '+f.name;d.append(im);q('#photo-previews').append(d)})});window.addEventListener('pagehide',()=>referenceUrls.forEach(URL.revokeObjectURL));show();
}
const companion=q('#companion');let liveAI=false,history=[];
if(companion){q('[data-open-companion]').addEventListener('click',()=>companion.showModal());q('[data-close-companion]').addEventListener('click',()=>companion.close());fetch('/api/status').then(r=>r.ok?r.json():{liveAI:false}).then(d=>{liveAI=d.liveAI===true;if(liveAI)q('#companion-status').textContent='Live AI design guidance'}).catch(()=>{});
 function addMessage(text,role='assistant'){const d=document.createElement('div');d.className='companion-message '+role;d.textContent=text;q('#companion-conversation').append(d);d.scrollIntoView({block:'nearest',behavior:reduced?'instant':'smooth'});return d}
 function preview(text){const lower=text.toLowerCase();let room=lower.includes('bath')?'bathroom':lower.includes('living')||lower.includes('whole')?'whole home':'kitchen';const priorities=room==='bathroom'?['A calmer palette of warm stone, walnut and soft metal details.','Storage for daily essentials, with less visible clutter.','A lighting plan that supports your daily routine.']:room==='whole home'?['A consistent material language between the rooms.','A clear role for each space, with comfortable transitions.','A restrained furniture plan that leaves room for daily life.']:['A clear preparation area and storage grouped around daily tasks.','Natural timber balanced with quieter surfaces.','An island or gathering zone explored within the room’s actual dimensions.'];return 'Guided preview — a starting direction for your '+room+':\n\n'+priorities.map((x,i)=>(i+1)+'. '+x).join('\n')+'\n\nBring a few photos, your top priorities and a starting budget into your project brief. A measured review is needed before confirming a layout. This response uses preset guidance, not live AI.'}
 q('#companion-form').addEventListener('submit',async e=>{e.preventDefault();const input=q('#companion-input'),text=input.value.trim();if(!text)return;const button=q('button[type=submit]',e.target);addMessage(text,'user');input.value='';button.disabled=true;button.textContent='Considering your direction…';let message;
 try{if(liveAI){const res=await fetch('/api/design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history})});const data=await res.json();if(!res.ok)throw Error(data.error||'The advisor is unavailable.');message=data.reply;history.push({role:'user',content:text},{role:'assistant',content:message});history=history.slice(-6)}else {const context=history.filter(x=>x.role==='user').map(x=>x.content).join(' ');message=preview(/bath|kitchen|living|whole/i.test(text)?text:context+' '+text);history.push({role:'user',content:text});history=history.slice(-6)}addMessage(message)}catch(err){addMessage(err.message+' Your ideas have not been lost. Try again or continue to the project brief.')}finally{button.disabled=false;button.textContent='Explore my direction ↗'}});
 qa('[data-companion-prompt]').forEach(b=>b.addEventListener('click',()=>{q('#companion-input').value=b.dataset.companionPrompt;q('#companion-input').focus()}));
}


/* ARQORA progressive-enhancement scroll reveals */
if(!reduced && 'IntersectionObserver' in window){
 const candidates=qa('.intro-band, .section-head, .project-card, .signature-gallery, .editorial-strip, .studio-philosophy, .values, .service-card, .process, .arq-closing-copy, .arq-closing-art, .contact-direct, .transformation, .client-trust, .collection-grid');
 const scrollObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('arq-visible');scrollObserver.unobserve(entry.target)}});
 },{threshold:0,rootMargin:'0px 0px 60px 0px'});
 candidates.forEach((el,i)=>{el.classList.add('arq-reveal');scrollObserver.observe(el)});
 document.documentElement.classList.add('arq-motion-enabled');
}


/* Three distinct ARQORA motion studies, inserted only where editorial whitespace permits. */
(function(){
 const scenes=[
  {selector:'.expertise .section-head',kind:'plan',label:'Planning geometry',svg:'<svg viewBox="0 0 260 160" aria-hidden="true"><g class="arq-motion-trace" fill="none" stroke="currentColor" stroke-width="1.5"><path pathLength="1" d="M23 25H235V138H23Z"/><path pathLength="1" d="M111 25V84H235M23 87H112M160 84V138M23 115H85V138"/><path pathLength="1" d="M112 52H160V83M190 25V65"/></g><path class="arq-motion-highlight" pathLength="1" d="M111 25V84H235" fill="none" stroke="#b29b7f" stroke-width="3"/></svg>'},
  {selector:'.material-feature-copy',kind:'material',label:'Material layers',svg:'<svg viewBox="0 0 260 150" aria-hidden="true"><g class="arq-layer-one"><path d="M34 99L105 58L186 99L114 139Z" fill="#cdbca3" stroke="#8c7b67"/></g><g class="arq-layer-two"><path d="M56 72L126 31L208 73L136 114Z" fill="#e3dbce" stroke="#908b80"/></g><g class="arq-layer-three"><path d="M86 46L139 15L213 52L159 86Z" fill="#a6aaa0" stroke="#747d71"/></g><path d="M30 99L114 145L213 89" stroke="#999184" stroke-dasharray="3 5" fill="none"/></svg>'},
  {selector:'.process .section-head',kind:'craft',label:'Craftsmanship detailing',svg:'<svg viewBox="0 0 260 160" aria-hidden="true"><g class="arq-motion-trace" fill="none" stroke="currentColor" stroke-width="1.5"><path pathLength="1" d="M28 121H231M63 121V27H181V121M87 121V52H157V121"/><path pathLength="1" d="M29 140H231M37 130V150M220 130V150M204 121V44H229V121"/></g><circle class="arq-craft-orbit" cx="122" cy="85" r="18" fill="none" stroke="#b29b7f" stroke-width="2"/><path class="arq-motion-highlight" pathLength="1" d="M87 52H157V121" fill="none" stroke="#b29b7f" stroke-width="3"/></svg>'}
 ];
 for(const scene of scenes){
  const target=q(scene.selector);if(!target||q('.arq-motion-study',target))continue;
  const wrapper=document.createElement('div');wrapper.className='arq-motion-study arq-motion-'+scene.kind;
  wrapper.setAttribute('role','img');wrapper.setAttribute('aria-label',scene.label+' animated illustration');
  wrapper.innerHTML=scene.svg;
  target.appendChild(wrapper);
 }
})();


/* Explicit handoff of the locally generated brief — never sends without user action. */
(function(){
 const success=document.querySelector('#brief-success');
 if(!success||success.querySelector('.brief-send-actions'))return;
 const actions=document.createElement('div');actions.className='brief-send-actions';
 const email=document.createElement('a');email.className='button dark';email.textContent='Email the team ↗';
 email.href='mailto:service@blueheavenconstructions.com?subject='+encodeURIComponent('Remodeling consultation — ARQORA design brief');
 email.addEventListener('click',()=>{
  const form=document.querySelector('#project-form');if(!form)return;
  const data=new FormData(form);const parts=['Hello, I would like to discuss a remodeling consultation.','',
   'Name: '+(data.get('name')||'Not provided'),
   'Space: '+(data.get('space')||'Not selected'),
   'Location: '+(data.get('location')||'Not provided'),
   'Design direction: '+(data.get('mood')||'Not selected'),
   'Budget: '+(data.get('budget')||'Not selected'),
   'Timing: '+(data.get('timing')||'Not selected'),
   'Goals: '+(data.get('goals')||'Not provided'),'',
   'Please let me know the next steps.'];
  email.href='mailto:service@blueheavenconstructions.com?subject='+encodeURIComponent('Remodeling consultation — ARQORA design brief')+'&body='+encodeURIComponent(parts.join('\n'));
 });
 const call=document.createElement('a');call.className='link-arrow';call.href='tel:+19165479596';call.textContent='Or call (916) 547-9596 ↗';
 actions.append(email,call);
 const note=document.createElement('p');note.className='brief-send-disclaimer';note.textContent='The email button opens your email app with your project details. Please review and send it yourself. No photos are attached automatically.';
 const again=success.querySelector('#download-again');if(again)again.before(actions,note);else success.append(actions,note);
})();


/* Consistent navigation and focus behavior across ARQORA. */
(function(){
 const nav=document.querySelector('#site-nav'),toggle=document.querySelector('.menu-toggle');
 if(nav&&toggle){
   nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
     nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');
     toggle.setAttribute('aria-label','Open navigation');
   }));
   document.addEventListener('click',event=>{
     if(toggle.getAttribute('aria-expanded')==='true'&&!nav.contains(event.target)&&!toggle.contains(event.target)){
       nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation');
     }
   });
 }
 const allDialogs=[...document.querySelectorAll('dialog')];
 allDialogs.forEach(dialog=>{
   dialog.addEventListener('close',()=>{const opener=dialog.id==='companion'?document.querySelector('[data-open-companion]'):dialog.id==='disclosure'?document.querySelector('[data-open-disclosure]'):null;if(opener&&opener.isConnected)opener.focus({preventScroll:true})});
 });
})();

/* Shared brand and current-page state. */
qa('.site-header nav a').forEach(a=>{if(a.pathname===location.pathname)a.setAttribute('aria-current','page')});
const companionMark=q('.companion-trigger>span');if(companionMark)companionMark.textContent='A';
