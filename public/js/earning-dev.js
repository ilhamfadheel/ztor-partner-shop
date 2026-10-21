import {earningCatalog,saveEarningCatalog,missionState,reviewMissionProof} from './earning-store.js';
import {member} from './member-store.js';
import {esc,dialog,notify} from './club-ui.js';
export function openEarningEditor() {
  const node=dialog('Creator Studio · earning missions','<p class="club-quiet">Local configuration and review preview. These controls do not approve real Instagram posts.</p><div data-earning-editor-list></div><button class="club-button" data-new-earning>Create a mission</button>');
  const render=()=>{
    node.querySelector('[data-earning-editor-list]').innerHTML=earningCatalog().map(m=>{
      const state=missionState(m.id);
      return `<article class="dev-earning-row"><strong>${esc(m.title)}</strong><small>${m.points} points · ${m.published?'Published':'Draft'} · ${esc(state.status)}</small><div class="club-actions"><button class="club-text-link" data-edit-earning="${esc(m.id)}">Edit mission</button>${state.status==='pending'?`<button class="club-text-link" data-review-earning="${esc(m.id)}" data-decision="approved">Approve proof</button><button class="club-text-link" data-review-earning="${esc(m.id)}" data-decision="rejected">Reject proof</button>`:''}</div></article>`;
    }).join('');
  };
  render();
  node.addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit-earning]');if(edit)editMission(edit.dataset.editEarning,render);
    if(e.target.closest('[data-new-earning]'))editMission(null,render);
    const review=e.target.closest('[data-review-earning]');
    if(review){try{reviewMissionProof(review.dataset.reviewEarning,review.dataset.decision,member());render();notify(review.dataset.decision==='approved'?'Preview proof approved. Points awarded once.':'Proof rejected. The member can submit again.');}catch(err){notify(err.message);}}
  });
  return node;
}
function editMission(id,onChange) {
  const current=earningCatalog().find(m=>m.id===id);
  const m=current||{id:'mission-'+Date.now().toString(36),title:'',description:'',points:80,instructions:['Share a post on Instagram.','Submit the post link or a screenshot.'],platformUrl:'https://www.instagram.com/',published:false,kind:'proof'};
  dialog(current?'Edit earning mission':'Create earning mission',`<form data-earning-form><label class="club-field">Title<input name="title" required maxlength="160" value="${esc(m.title)}"></label><label class="club-field">Description<input name="description" maxlength="500" value="${esc(m.description)}"></label><label class="club-field">Points after approval<input name="points" type="number" min="1" max="1000000" step="1" required value="${m.points}"></label><label class="club-field">Instructions · one step per line<textarea name="instructions" required rows="4" maxlength="5000">${esc(m.instructions.join('\n'))}</textarea></label><label class="club-field">Instagram destination<input name="platformUrl" type="url" required value="${esc(m.platformUrl)}"></label><label class="club-field">Visibility<select name="published"><option value="true" ${m.published?'selected':''}>Published</option><option value="false" ${!m.published?'selected':''}>Draft</option></select></label><p class="club-form-error" data-error role="alert"></p><button class="club-button">Save mission</button>${current?'<button class="club-text-link" type="button" data-delete-mission>Delete mission</button>':''}</form>`,node=>{
    const form=node.querySelector('form');
    form.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(form);try{const updated={...m,title:data.get('title'),description:data.get('description'),points:Number(data.get('points')),instructions:data.get('instructions').split('\n').map(s=>s.trim()).filter(Boolean),platformUrl:data.get('platformUrl').trim(),published:data.get('published')==='true'};saveEarningCatalog(current?earningCatalog().map(x=>x.id===id?updated:x):[...earningCatalog(),updated]);node.close();onChange();notify('Earning mission saved.');}catch(err){form.querySelector('[data-error]').textContent=err.message;}});
    form.querySelector('[data-delete-mission]')?.addEventListener('click',()=>dialog('Delete this mission?',`<p>New submissions will stop. Existing earned points and approval records stay with the member.</p><button class="club-button" data-confirm-delete>Delete preview mission</button>`,confirm=>confirm.querySelector('[data-confirm-delete]').addEventListener('click',()=>{try{saveEarningCatalog(earningCatalog().filter(x=>x.id!==id));confirm.close();node.close();onChange();}catch(err){notify(err.message);}})));
  });
}
