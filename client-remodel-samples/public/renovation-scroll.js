/* ARQORA: a reversible, scroll-scrubbed renovation story. */
(()=>{
 const target=document.querySelector('.intro-band');
 if(!target||document.querySelector('.arq-spatial-section'))return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const section=document.createElement('section');
 section.className='arq-spatial-section';section.id='renovation-story';
 section.setAttribute('aria-labelledby','arq-spatial-heading');
 section.innerHTML=`<div class="arq-spatial-inner"><div class="arq-spatial-title arq-spatial-reveal"><div><span class="kicker">THE MAKING OF A HOME / 001</span><h2 id="arq-spatial-heading">A home.<br><em>In the making.</em></h2></div><p>Scroll through the transformation. From the first measure to the final detail, watch a familiar space become somewhere new.</p></div><div class="arq-spatial-stage arq-spatial-reveal" id="arq-spatial-stage"><img class="arq-renovation-before" src="/kitchen-before.webp" alt="Illustrative kitchen before renovation" loading="lazy" decoding="async"><img class="arq-renovation-after" src="/kitchen-after.webp" alt="Illustrative finished oak and stone kitchen" loading="lazy" decoding="async"><div class="arq-spatial-blueprint" aria-hidden="true"><svg viewBox="0 0 900 470" preserveAspectRatio="xMidYMid meet"><g><rect x="88" y="52" width="730" height="349" pathLength="1"/><path d="M88 401L37 439H863L818 401M88 52L37 15H863L818 52M88 52V401M818 52V401" pathLength="1"/><rect x="118" y="88" width="265" height="276" pathLength="1"/><path d="M162 88V364M340 88V364M118 225H383" pathLength="1"/><rect x="432" y="90" width="324" height="154" pathLength="1"/><path d="M432 142H756M432 190H756M533 90V244M649 90V244" pathLength="1"/><path d="M457 402V292H736V402M476 292V267H716V292M552 292V402M664 292V402" pathLength="1"/><path d="M452 420H746M452 413V429M746 413V429" pathLength="1"/></g></svg></div><div class="arq-renovation-treatment" aria-hidden="true"></div><div class="arq-renovation-workers" aria-hidden="true"></div><div class="arq-renovation-phase"><span class="arq-renovation-phase-dot" aria-hidden="true"></span><span data-renovation-phase>01 / The existing space</span></div><div class="arq-spatial-vignette"></div><div class="arq-spatial-caption"><span>THE SPACE WE START WITH</span><span>WELCOME TO WHAT COMES NEXT</span></div></div><ol class="arq-renovation-steps" aria-label="Renovation stages"><li aria-current="step"><span>01</span> Existing</li><li><span>02</span> Design</li><li><span>03</span> Build</li><li><span>04</span> Finish</li><li><span>05</span> Reveal</li></ol><div class="arq-spatial-controls"><label for="arq-spatial-slider">SCROLL TO RENOVATE</label><input id="arq-spatial-slider" type="range" min="0" max="100" value="0" aria-label="Explore the renovation from existing space to finished interior"><output for="arq-spatial-slider">0% COMPLETE</output></div><p class="arq-spatial-note">Illustrative renovation story. Design imagery and animated craftspeople; not footage of a completed client project.</p></div>`;
 target.after(section);
 const stage=section.querySelector('.arq-spatial-stage');
 const slider=section.querySelector('input');
 const output=section.querySelector('output');
 const workerContainer=section.querySelector('.arq-renovation-workers');
 const steps=[...section.querySelectorAll('.arq-renovation-steps li')];
 const phases=['The existing space','Survey & design','Craft & installation','Finish & detail','Welcome home'];
 const thresholds=[0,.15,.34,.6,.88];
 let animation=null,currentProgress=0,manualReveal=false,scrollFrame=0,pinTop=0,scrollSpan=0,loading=false;
 const clamp=(v)=>Math.min(1,Math.max(0,v));
 function render(pct){
  currentProgress=clamp(pct/100);const p=currentProgress;
  slider.value=String(Math.round(p*100));
  stage.style.setProperty('--progress',p.toFixed(4));
  stage.style.setProperty('--interior',clamp((p-.28)/.62).toFixed(4));
  stage.style.setProperty('--blueprint',(clamp((.32-p)/.22)*.78).toFixed(4));
  stage.style.setProperty('--work-tone',(clamp((.9-p)/.14)*.38).toFixed(4));
  stage.style.setProperty('--crew',reduced?'0':clamp((.9-p)/.08).toFixed(4));
  output.textContent=Math.round(p*100)+'% COMPLETE';
  const phase=thresholds.reduce((index,t,i)=>p>=t?i:index,0);
  section.dataset.renovationPhase=String(phase+1);
  section.querySelector('[data-renovation-phase]').textContent='0'+(phase+1)+' / '+phases[phase];
  steps.forEach((step,i)=>{step.classList.toggle('is-complete',i<phase);if(i===phase)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current')});
  const captions=section.querySelectorAll('.arq-spatial-caption span');
  captions[0].style.opacity=clamp(1-p*3);captions[1].style.opacity=clamp((p-.78)/.15);
  if(animation?.isLoaded){const frame=p*(animation.totalFrames-1);animation.goToAndStop(frame,true);workerContainer.dataset.frame=frame.toFixed(1)}
 }
 slider.addEventListener('input',()=>{manualReveal=true;render(Number(slider.value))});
 function measure(){
  pinTop=document.querySelector('.site-header')?.getBoundingClientRect().height||0;
  // Mobile browser chrome can resize the visual viewport during a swipe. svh
  // keeps the scene height stable, so the fade doesn't jump backwards.
  const viewport=document.documentElement.clientHeight;
  scrollSpan=viewport*2.6;
  section.style.setProperty('--pin-top',pinTop+'px');
  section.style.setProperty('--pin-height',Math.max(240,viewport-pinTop)+'px');
  section.style.setProperty('--scroll-span',scrollSpan+'px');
  animation?.resize();
 }
 function syncScroll(){scrollFrame=0;const bounds=section.getBoundingClientRect();document.body.classList.toggle('arq-renovation-active',bounds.top<=pinTop&&bounds.bottom>innerHeight-20);if(manualReveal)return;render((pinTop-bounds.top)/(scrollSpan*.92)*100)}
 function scheduleScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(syncScroll)}
 function resumeScroll(){manualReveal=false;scheduleScroll()}
 async function loadWorkers(){
  if(loading||reduced||!window.lottie)return;loading=true;
  try{
   const response=await fetch('/renovation-workers.json?v=2');
   if(!response.ok)throw new Error('Renovation artwork unavailable');
   const data=await response.json();
   animation=window.lottie.loadAnimation({container:workerContainer,renderer:'svg',loop:false,autoplay:false,animationData:data,rendererSettings:{preserveAspectRatio:'xMidYMid meet',progressiveLoad:false,hideOnTransparent:true}});
   animation.addEventListener('DOMLoaded',()=>{workerContainer.dataset.loaded='true';render(currentProgress*100)});
   animation.addEventListener('data_failed',()=>{workerContainer.hidden=true});
  }catch{workerContainer.hidden=true}
 }
 render(reduced?100:0);
 if(!reduced){
  section.classList.add('is-scroll-pinned');measure();
  addEventListener('wheel',resumeScroll,{passive:true});
  addEventListener('touchmove',resumeScroll,{passive:true});
  addEventListener('keydown',e=>{if(e.target!==slider&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))resumeScroll()});
  addEventListener('scroll',scheduleScroll,{passive:true});
  addEventListener('resize',()=>{measure();scheduleScroll()},{passive:true});
  addEventListener('pageshow',scheduleScroll);
  scheduleScroll();
  if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){loadWorkers();observer.disconnect()}},{rootMargin:'1000px'});observer.observe(section)}else loadWorkers();
 }
 section.querySelectorAll('.arq-spatial-reveal').forEach(el=>el.classList.add('is-visible'));
})();
