import { member, tierOf, safeReturn } from './member-store.js';
import * as ztor from './ztor/state.js';
import { signInHref } from './ztor/session.js';
import { PROFILE_LIMITS, profileOf, sameProfile, validateProfile } from './profile-model.js';
import { esc, dialog, action } from './club-ui.js';

// Saves to the fan's Ztor account (name, bio, photo): the same profile every Ztor site shows.
const dataUrlBlob = dataUrl => fetch(dataUrl).then(r => r.blob());
/** The languages a fan can pick as their Ztor default (lib/account.ts PROFILE_LANGUAGES). */
export const LANGUAGES = [['en-us','English'],['zh-hk','繁體中文（香港）'],['zh-cn','简体中文']];
/** The site follows the account's language: the cookie the React pages and the API calls read (lib/i18n.ts). */
const storeLang = lang => { document.cookie = `ztor_lang=${lang}; path=/; max-age=31536000; samesite=lax`; };

export function mountProfilePage(root, { embedded = false } = {}) {
  const languageOf = () => ztor.account()?.language || '';
  let baseline=profileOf(member()), avatar=baseline.avatar, language=languageOf();
  let busy=false, saving=false, conflicted=false, uploadVersion=0, leaveDialog=null;
  const requested=safeReturn(new URLSearchParams(location.search).get('return'));
  const returnTo=new URL(requested,location.href).pathname.endsWith('/edit-profile') ? '/fan-club' : requested;
  const returnFile=new URL(returnTo,location.href).pathname.replace(/\.html$/,'');
  const backLabel=({'/auction':'Back to auctions','/rewards':'Back to rewards','/account':'Back to account','/leaderboard':'Back to leaderboard','/shop':'Back to shop'})[returnFile] || 'Back to Fan Club';
  const find=selector=>root.querySelector(selector);
  const draft=()=>({name:find('[name="name"]')?.value || '',bio:find('[name="bio"]')?.value || '',avatar,language:find('[name="language"]')?.value || ''});
  const dirty=()=>Boolean(find('[data-profile-form]')) && (busy || ['name','bio','avatar'].some(key=>draft()[key]!==baseline[key]) || draft().language!==language);

  function paintPreview() {
    const value=draft();
    const name=value.name.trim() || 'Your name';
    find('[data-profile-name]').textContent=name;
    const bio=find('[data-profile-bio]');
    bio.textContent=value.bio.trim(); bio.hidden=!value.bio.trim();
    const photo=find('[data-profile-avatar]');
    photo.replaceChildren();
    if(avatar) {
      const img=document.createElement('img'); img.src=avatar; img.alt=''; photo.append(img);
    } else {
      photo.textContent=name.split(/\s+/u).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase();
    }
    find('[data-profile-count]').textContent=value.bio.length+' / '+PROFILE_LIMITS.bio;
    find('[data-profile-remove]').hidden=!avatar;
    find('[data-profile-tier]').textContent=tierOf().name;
  }
  function state(message) {
    if(!find('[data-profile-form]'))return;
    find('[data-profile-save]').disabled=busy || conflicted || !dirty();
    find('[data-profile-upload]').disabled=busy;
    find('[data-profile-remove]').disabled=busy;
    find('[data-profile-status]').textContent=message || (busy?'Preparing your photo…':dirty()?'Unsaved changes':'No unsaved changes');
    paintPreview();
  }
  function errors(values={}) {
    for(const key of ['name','bio','avatar','save']) {
      find(`[data-profile-error="${key}"]`).textContent=values[key] || '';
      find(`[name="${key}"]`)?.setAttribute('aria-invalid',String(Boolean(values[key])));
    }
  }
  function render() {
    uploadVersion++; busy=false; conflicted=false;
    baseline=profileOf(member()); avatar=baseline.avatar; language=languageOf();
    if(!baseline.id) {
      root.innerHTML=`<section class="profile-page club-empty"><h1>Your profile, your place.</h1><p>Join or sign in to add your photo, name and bio.</p>${action('Join / sign in',signInHref(location.pathname+location.search))}<p><a class="profile-back" href="/fan-club">Back to Fan Club</a></p></section>`;
      return;
    }
    root.innerHTML=`<section class="profile-page">
      ${embedded?'':`<a class="profile-back" href="${esc(returnTo)}"><span aria-hidden="true">←</span>${esc(backLabel)}</a><header class="profile-title"><h1>Edit profile.</h1><p>A little more you.</p></header>`}
      <div class="profile-layout">
        <aside aria-label="Profile preview">
          <div class="profile-preview"><button type="button" class="profile-avatar" data-profile-avatar data-profile-upload aria-label="Change profile photo" aria-describedby="profile-photo-help profile-avatar-error" title="Change profile photo"></button><h2 data-profile-name></h2><p class="profile-preview-bio" data-profile-bio></p><span class="profile-tier" data-profile-tier></span></div>
          <input type="file" data-profile-file accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" hidden>
          <span class="club-sr-only" id="profile-photo-help">JPG, PNG or WebP. Up to 5 MB.</span>
          <p class="profile-error" id="profile-avatar-error" data-profile-error="avatar" role="alert"></p>
          <div class="profile-preview-tools"><p class="profile-preview-note">Profile photo · JPG, PNG or WebP · Up to 5 MB</p><button type="button" class="profile-remove" data-profile-remove>Remove photo</button></div>
        </aside>
        <form class="profile-form" data-profile-form novalidate>
          <div class="profile-conflict" data-profile-conflict role="alert" hidden><p>Your profile changed in another window. Your edits are still here; load the latest version before saving.</p><button type="button" data-profile-reload>Load latest profile</button></div>
          <label class="club-field" for="profile-name">Display name<input id="profile-name" name="name" value="${esc(baseline.name)}" autocomplete="nickname" maxlength="40" required aria-describedby="profile-name-help profile-name-error"></label>
          <p class="profile-help" id="profile-name-help">The name on your fan pass and the leaderboard.</p><p class="profile-error" id="profile-name-error" data-profile-error="name" role="alert"></p>
          <details class="profile-about" ${baseline.bio?'open':''}><summary>About you · Optional</summary><label class="club-field" for="profile-bio"><span class="profile-label-row"><span>About you <span class="profile-optional">Optional</span></span><span class="profile-counter" data-profile-count></span></span><textarea id="profile-bio" name="bio" rows="3" maxlength="150" placeholder="What brings you to LLOUD?" aria-describedby="profile-bio-error">${esc(baseline.bio)}</textarea></label>
          <p class="profile-error" id="profile-bio-error" data-profile-error="bio" role="alert"></p></details>
          <label class="club-field" for="profile-language">Default language<select id="profile-language" name="language" aria-describedby="profile-language-help">${language?'':'<option value="">Not set</option>'}${LANGUAGES.map(([code,label])=>`<option value="${code}" ${code===language?'selected':''}>${label}</option>`).join('')}</select></label>
          <p class="profile-help" id="profile-language-help">The language Ztor uses for you on every site you sign in with your Ztor account: product names and details, order emails and Ztor’s own pages.</p>
          <p class="profile-error" data-profile-error="save" role="alert"></p>
          <div class="profile-save-row"><p class="profile-status" data-profile-status role="status" aria-live="polite"></p><div class="club-actions"><button type="button" class="club-button is-secondary" data-profile-cancel>Cancel</button><button type="submit" class="club-button" data-profile-save>Save changes</button></div></div>
        </form>
      </div>
    </section>`;
    find('[data-profile-form]').addEventListener('input',()=>{errors();state();});
    find('[data-profile-form]').addEventListener('submit',async event=>{
      event.preventDefault(); if(busy || conflicted)return;
      const value=draft(), result=validateProfile(value); errors(result.errors);
      if(Object.keys(result.errors).length) { find('[aria-invalid="true"]')?.focus();return; }
      if(!dirty())return;
      saving=true; busy=true; state('Saving…');
      try {
        const patch={};
        if(result.values.name!==baseline.name)patch.name=result.values.name;
        if(result.values.bio!==baseline.bio)patch.bio=result.values.bio||null;
        if(avatar!==baseline.avatar && !avatar)patch.avatarUrl=null;
        if(draft().language && draft().language!==language)patch.language=draft().language;
        if(avatar && avatar.startsWith('data:'))await ztor.saveAvatar(new File([await dataUrlBlob(avatar)],'avatar.jpg',{type:'image/jpeg'}));
        if(Object.keys(patch).length)await ztor.saveProfile(patch);
        busy=false;
        baseline=profileOf(member()); avatar=baseline.avatar; language=languageOf();
        if(language)storeLang(language);
        find('[name="name"]').value=baseline.name; find('[name="bio"]').value=baseline.bio;
        state('Changes saved');
      } catch(error) { busy=false; errors({save:error.message}); state('Not saved'); }
      finally {saving=false;}
    });
    find('[data-profile-upload]').addEventListener('click',()=>find('[data-profile-file]').click());
    find('[data-profile-file]').addEventListener('change',choosePhoto);
    find('[data-profile-remove]').addEventListener('click',()=>{uploadVersion++;avatar='';errors();state();find('[data-profile-upload]').focus();});
    find('[data-profile-cancel]').addEventListener('click',()=>confirmLeave(()=>location.assign(returnTo)));
    find('[data-profile-reload]').addEventListener('click',()=>confirmLeave(()=>{render();find('[name="name"]')?.focus();}));
    state();
  }
  async function choosePhoto(event) {
    const file=event.target.files[0]; event.target.value=''; if(!file)return;
    errors();
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)) {errors({avatar:'Choose a JPG, PNG or WebP photo.'});return;}
    if(file.size>PROFILE_LIMITS.photoBytes) {errors({avatar:'That photo is too large. Choose one under 5 MB.'});return;}
    const token=++uploadVersion, owner=baseline.id;
    busy=true; state();
    const url=URL.createObjectURL(file);
    try {
      const img=new Image(); img.src=url; await img.decode();
      if(!img.naturalWidth || !img.naturalHeight || img.naturalWidth*img.naturalHeight>40000000)throw new Error('Photo dimensions are too large. Choose a smaller image.');
      const canvas=document.createElement('canvas'); canvas.width=384; canvas.height=384;
      const context=canvas.getContext('2d');
      if(!context)throw new Error('Photo processing is unavailable. Try another browser.');
      context.fillStyle='#e4e1da';context.fillRect(0,0,384,384);
      const edge=Math.min(img.naturalWidth,img.naturalHeight);
      context.drawImage(img,(img.naturalWidth-edge)/2,(img.naturalHeight-edge)/2,edge,edge,0,0,384,384);
      const result=canvas.toDataURL('image/jpeg',.82);
      if(result.length>PROFILE_LIMITS.avatarChars)throw new Error('That photo could not be resized. Try another image.');
      if(token===uploadVersion && owner===member().id)avatar=result;
    } catch(error) {
      if(token===uploadVersion)errors({avatar:error.name==='EncodingError'?'That photo could not be opened. Choose another JPG, PNG or WebP.':error.message});
    } finally {
      URL.revokeObjectURL(url);
      if(token===uploadVersion){busy=false;state();}
    }
  }
  function confirmLeave(proceed) {
    if(!dirty()) {proceed();return;}
    if(leaveDialog?.open)return;
    leaveDialog=dialog('Discard your changes?',`<p>Your profile has not been saved. Keep editing, or leave without these changes.</p><div class="club-actions"><button type="button" class="club-button" data-profile-keep>Keep editing</button><button type="button" class="club-button is-secondary" data-profile-discard>Discard changes</button></div>`,node=>{
      node.querySelector('[data-profile-keep]').addEventListener('click',()=>node.close());
      node.querySelector('[data-profile-discard]').addEventListener('click',()=>{
        uploadVersion++; busy=false;
        // Reset the draft before leaving so the browser does not ask twice.
        avatar=baseline.avatar;
        if(find('[name="name"]')) {find('[name="name"]').value=baseline.name;find('[name="bio"]').value=baseline.bio;}
        node.close(); proceed();
      });
      node.querySelector('[data-profile-keep]').focus();
    });
  }
  function onLink(event) {
    const link=event.target.closest('a[href]');
    if(!link || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target==='_blank' || link.hasAttribute('download') || link.getAttribute('href').startsWith('#'))return;
    if(!dirty())return;
    event.preventDefault();confirmLeave(()=>location.assign(link.href));
  }
  const beforeUnload=event=>{if(dirty()){event.preventDefault();event.returnValue='';}};
  function onMemberChange() {
    if(saving)return;
    const next=profileOf(member());
    if(next.id!==baseline.id){leaveDialog?.close();render();return;}
    if(!sameProfile(next,baseline)) {
      if(dirty()) {conflicted=true;find('[data-profile-conflict]').hidden=false;state('Review latest profile');}
      else render();
    } else if(find('[data-profile-form]'))paintPreview();
  }
  document.addEventListener('click',onLink);
  document.addEventListener('member:change',onMemberChange);
  window.addEventListener('beforeunload',beforeUnload);
  render();
  return ()=>{uploadVersion++;leaveDialog?.close();document.removeEventListener('click',onLink);document.removeEventListener('member:change',onMemberChange);window.removeEventListener('beforeunload',beforeUnload);};
}
