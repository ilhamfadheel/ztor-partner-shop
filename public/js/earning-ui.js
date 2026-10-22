import * as state from './ztor/state.js';
import {esc,dialog,action,notify,motionOK,trackMotion} from './club-ui.js';
import {member} from './member-store.js';
import {earningCatalog,missionState,submitMissionProof} from './earning-store.js';
const num=n=>Number(n||0).toLocaleString('en-US');
const join=mission=> {
  const url=new URL(location.href); if(mission)url.searchParams.set('mission',mission);
  return '/signup?return='+encodeURIComponent(url.pathname.split('/').pop()+url.search+url.hash);
};
const drafts=new Map(); // Same-tab drafts only; never persist proof image bytes.
function step(parent,title,content) {
  if(!parent)return {node:dialog(title,content),back:null};
  const body=parent.querySelector('.club-dialog-body'),heading=parent.querySelector('.club-dialog-head h2');
  const priorTitle=heading.textContent,priorClass=parent.className,previous=document.createDocumentFragment();
  const priorBack=parent.querySelector('[data-step-back]');priorBack?.remove();
  while(body.firstChild)previous.append(body.firstChild);
  heading.textContent=title;body.innerHTML=content;
  parent.classList.remove('reward-dialog');
  const button=document.createElement('button');button.type='button';button.className='club-text-link';button.dataset.stepBack='';button.textContent='← Back';button.setAttribute('aria-label','Back to '+priorTitle);
  const back=()=>{body.replaceChildren(previous);heading.textContent=priorTitle;parent.className=priorClass;button.remove();if(priorBack)heading.before(priorBack);parent.scrollTop=0;body.querySelector('button,a[href],input')?.focus({preventScroll:true});};
  button.addEventListener('click',back);heading.before(button);parent.scrollTop=0;
  return {node:parent,back};
}

export function openEarnPoints(parent=null) {
  const origin=document.activeElement;
  const {node}=step(parent,'How to earn points','<div data-earning-content></div>');
  node.addEventListener('close',()=>{
    // Earning points can re-render the home hero while this overlay is open.
    if(!origin?.isConnected && document.activeElement===document.body && !document.querySelector('dialog[open]')) document.querySelector('[data-earn-points]')?.focus({preventScroll:true});
  },{once:true});
  node.classList.add('earning-dialog');
  const render=()=>{
    const who=member();
    const slot=node.querySelector('[data-earning-content]');if(!slot)return;
    const rules=state.rules();
    const earn=type=>rules?.earn?.find(e=>e.type===type);
    const per=e=>e?.pointsPerNtd!=null?`+${num(e.pointsPerNtd)} <small>points / NT$1</small>`:`+${num(e?.points)} <small>points</small>`;
    const shopRule=earn('A4'),pledgeRule=earn('A1'),like=earn('B4'),save=earn('B5');
    const options=[
      shopRule&&`<article class="earning-option"><div><span class="earning-points">${per(shopRule)}</span><h4>Find your next favourite.</h4><p>Every piece from the artist’s store earns points on its price. Other currencies are converted to NT$ first.</p></div>${action(who.id?'Go to the shop':'Join to earn',who.id?'/shop':join())}</article>`,
      pledgeRule&&`<article class="earning-option"><div><span class="earning-points">${per(pledgeRule)}</span><h4>Back a co-creation.</h4><p>Support the artist’s projects on Ztor. Points arrive when your pledge is charged.</p></div></article>`,
      (like||save)&&`<article class="earning-option"><div><span class="earning-points">${like?`+${num(like.points)}`:''}${like&&save?' / ':''}${save?`+${num(save.points)}`:''} <small>points</small></span><h4>Love the artist’s posts.</h4><p>Like${save?' or save':''} the artist’s own posts on Ztor. Once per post — taking a like back keeps your points, liking again adds none.</p></div></article>`,
    ].filter(Boolean).join('');
    slot.innerHTML=`<span class="club-kicker">A little support goes a long way.</span><h3 class="earning-title">Choose your next move.</h3><p>Every way you support the artist adds to your story.</p>${options?`<div class="earning-options">${options}</div>`:`<p class="club-quiet">How points are earned will appear here shortly.</p>`}<p class="club-quiet earning-disclaimer">Points are added to your lifetime total with this artist. Refunded orders and pledges take their points back.</p>`;
  };
  render();
  // The published rules, once per page.
  if(!state.rules())state.hydrate(['rules']).then(render);
  node._earningEvents?.abort();
  const events=new AbortController();node._earningEvents=events;
  node.addEventListener('close',()=>events.abort(),{once:true});
  node.addEventListener('earning-return',render,{signal:events.signal});
  document.addEventListener('member:change',render,{signal:events.signal});
  document.addEventListener('earnings:config',render,{signal:events.signal});
  node.addEventListener('click',e=>{
    const target=e.target.closest('[data-proof-mission]');if(!target)return;
    const id=target.dataset.proofMission;
    openMissionProof(id,node);
  },{signal:events.signal});
  return node;
}

export function openMissionProof(id,parent=null) {
  let mission=earningCatalog().find(m=>m.id===id&&m.published);
  if(!mission){notify('This mission is no longer available.');return;}
  const {node,back}=step(parent,mission.title,'<div data-proof-content></div>');
  const key=(member().id||'guest')+':'+id;
  const draft=drafts.get(key)||{url:'',file:null};
  let imageURL=null,submitting=false,lastState=missionState(id).status,lastIdentity=member().id;
  const events=new AbortController();
  const cleanup=()=>{release();events.abort();};
  const release=()=>{if(imageURL){URL.revokeObjectURL(imageURL);imageURL=null;}};
  const render=()=>{
    release();const who=member(),state=missionState(id,who),slot=node.querySelector('[data-proof-content]');
    if(!slot)return;lastState=state.status;lastIdentity=who.id;
    if(!who.id){slot.innerHTML=`<p>Join the club to keep your missions and earn points.</p>${action('Join to begin',join(id))}`;return;}
    if(['pending','approved','unavailable'].includes(state.status)){
      const approved=state.status==='approved',unavailable=state.status==='unavailable';
      slot.innerHTML=`<div class="proof-status" role="status"><span class="proof-status-mark" aria-hidden="true">${approved?'✓':state.status==='pending'?'…':'—'}</span><span class="club-state" data-state="${approved?'complete':state.status==='pending'?'pending':'locked'}">${approved?'Mission complete':state.status==='pending'?'Submitted · In review':'Mission unavailable'}</span><h3>${approved?'Your support counts.':unavailable?'This mission has closed.':'You’ve done your part.'}</h3><p>${approved?`${num(state.points)} preview points have been added. They will only be awarded once.`:unavailable?'No proof was submitted. Go back to choose another mission.':'No points have been added yet. The creator reviews your proof before approving it.'}</p>${state.proof?.fileName?`<p class="proof-file-name">${esc(state.proof.fileName)}</p>`:''}${state.proof?.url?`<a class="club-text-link" href="${esc(state.proof.url)}" target="_blank" rel="noopener noreferrer">View submitted post ↗</a>`:''}<button class="club-button" data-proof-close>Got it</button></div><p class="club-quiet">Local prototype only. The floating “i” controls can simulate a review. No file was uploaded and Instagram was not verified.</p>`;
      slot.querySelector('[data-proof-close]').addEventListener('click',()=>{if(back){cleanup();back();node.dispatchEvent(new Event('earning-return'));}else node.close();});return;
    }
    slot.innerHTML=`<span class="earning-points">+${num(mission.points)} <small>preview points after approval</small></span>${state.status==='rejected'?'<p class="proof-rejected club-state" data-state="failed" role="status">Your last proof was not approved. Check the steps and submit a new post link or image.</p>':''}<ol class="proof-instructions">${mission.instructions.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><a class="club-text-link" href="${esc(mission.platformUrl)}" target="_blank" rel="noopener noreferrer">Open Instagram ↗</a><form data-proof-form><h4>Send your proof</h4><label class="club-field">Instagram post link<input type="url" name="url" placeholder="https://www.instagram.com/p/…" maxlength="2048" value="${esc(state.proof?.url||'')}"></label><label class="proof-upload">Or add a screenshot<input type="file" name="proof" accept="image/jpeg,image/png,image/webp"><span>JPEG, PNG or WebP · up to 5 MB</span></label><div class="proof-file-preview" hidden><img class="proof-image-preview" alt="Your selected proof image"><div><p class="proof-file-name" data-proof-filename></p><button class="club-text-link" type="button" data-proof-replace>Replace image</button><button class="club-text-link" type="button" data-proof-remove>Remove image</button></div></div><p class="club-form-error" data-proof-error role="alert"></p><button class="club-button" type="submit">Submit for review<span aria-hidden="true">↗</span></button><p class="club-quiet earning-disclaimer">Preview: only the link and file details are saved in this browser. The image is not uploaded. Points are awarded after approval, not after opening Instagram.</p></form>`;
    const form=slot.querySelector('form'),input=form.elements.proof,error=slot.querySelector('[data-proof-error]');
    if(draft.url)form.elements.url.value=draft.url;
    form.elements.url.addEventListener('input',()=>{draft.url=form.elements.url.value;drafts.set(key,draft);});
    const previewBox=slot.querySelector('.proof-file-preview'),preview=slot.querySelector('.proof-image-preview');
    const showFile=file=>{release();previewBox.hidden=!file;slot.querySelector('[data-proof-filename]').textContent=file?.name||'';if(file){imageURL=URL.createObjectURL(file);preview.src=imageURL;}else preview.removeAttribute('src');};
    if(draft.file){const transfer=new DataTransfer();transfer.items.add(draft.file);input.files=transfer.files;showFile(draft.file);}
    slot.querySelector('[data-proof-replace]').addEventListener('click',()=>input.click());
    slot.querySelector('[data-proof-remove]').addEventListener('click',()=>{input.value='';draft.file=null;drafts.set(key,draft);showFile(null);input.focus();});
    input.addEventListener('change',()=>{
      error.textContent='';const file=input.files[0];showFile(null);
      draft.file=null;drafts.set(key,draft);
      if(!file)return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||file.size===0){error.textContent='Choose a JPEG, PNG or WebP image up to 5 MB.';input.value='';return;}
      draft.file=file;drafts.set(key,draft);showFile(file);
    });
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(submitting)return;error.textContent='';const file=input.files[0];
      const latest=earningCatalog().find(m=>m.id===id&&m.published);
      if(!latest){error.textContent='This mission is no longer available. Your proof has not been submitted.';return;}
      if(JSON.stringify(latest)!==JSON.stringify(mission)){
        mission=latest;
        node.querySelector('.club-dialog-head h2').textContent=mission.title;
        slot.querySelector('.earning-points').innerHTML=`+${num(mission.points)} <small>preview points after approval</small>`;
        slot.querySelector('.proof-instructions').innerHTML=mission.instructions.map(s=>`<li>${esc(s)}</li>`).join('');
        slot.querySelector('a[target="_blank"]').href=mission.platformUrl;
        error.textContent='This mission was updated. Review the new steps and points, then submit again. Your proof has not been submitted.';
        return;
      }
      const button=form.querySelector('[type="submit"]'),label=button.innerHTML;
      submitting=true;button.disabled=true;button.textContent='Submitting…';form.setAttribute('aria-busy','true');
      try{
        await new Promise(resolve=>setTimeout(resolve,0));
        if(!node.open || events.signal.aborted)return;
        if(JSON.stringify(earningCatalog().find(m=>m.id===id&&m.published))!==JSON.stringify(mission))throw new Error('This mission changed. Review the latest steps before submitting again.');
        submitMissionProof(id,{url:form.elements.url.value.trim(),...(file?{fileName:file.name,fileSize:file.size,fileType:file.type}:{})},who);
        drafts.delete(key);render();node.querySelector('[data-proof-close]')?.focus();
        if(window.gsap&&motionOK())trackMotion(gsap.fromTo(node.querySelector('.proof-status'),{opacity:0},{opacity:1,duration:.18}));
      } catch(err){error.textContent=err.message;}
      finally{submitting=false;button.disabled=false;button.innerHTML=label;form.removeAttribute('aria-busy');}
    });
  };
  render();
  document.addEventListener('member:change',()=>{
    if(member().id!==lastIdentity){cleanup();node.close();notify('Your account changed. Open the mission again to continue.');return;}
    const state=missionState(id);if(submitting||state.status===lastState)return;
    const approved=state.status==='approved';render();
    if(approved && window.gsap && motionOK())trackMotion(gsap.fromTo(node.querySelector('.proof-status-mark'),{opacity:0,scale:.94},{opacity:1,scale:1,duration:.18,ease:'power2.out'}));
  },{signal:events.signal});
  document.addEventListener('earnings:config',()=>{if(!earningCatalog().some(m=>m.id===id&&m.published))render();},{signal:events.signal});
  node.querySelector('[data-step-back]')?.addEventListener('click',()=>{cleanup();node.dispatchEvent(new Event('earning-return'));},{once:true});node.addEventListener('close',cleanup,{once:true});return node;
}
