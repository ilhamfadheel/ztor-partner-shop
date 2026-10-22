import { t } from './i18n.js';
// Editable presentation fields only. Membership and account records are not profile inputs.
// Ztor's account rules (bio up to 150); a new photo is resized here, then uploaded to Ztor.
export const PROFILE_LIMITS = Object.freeze({name:40, bio:150, photoBytes:5*1024*1024, avatarChars:180000});
// The saved photo is Ztor's https URL; a new one is a resized JPEG data URL until it is saved.
const savedPhoto = value => /^https:\/\/[^\s"<>]+$/.test(value);
export function profileOf(who) {
  const avatar = typeof who?.avatar==='string' && (savedPhoto(who.avatar) || who.avatar.length<=PROFILE_LIMITS.avatarChars && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(who.avatar)) ? who.avatar : '';
  return {
    id:who?.id || null,
    name:typeof who?.name==='string' ? who.name : '',
    bio:typeof who?.bio==='string' ? who.bio.slice(0,PROFILE_LIMITS.bio) : '',
    avatar,
    revision:Number.isSafeInteger(who?.profileRevision) && who.profileRevision>=0 ? who.profileRevision : 0
  };
}
export const sameProfile = (a,b) => ['id','name','bio','avatar','revision'].every(key=>a[key]===b[key]);
export function validateProfile(draft) {
  const name=typeof draft?.name==='string' ? draft.name.trim() : '';
  const bio=typeof draft?.bio==='string' ? draft.bio.trim() : '';
  const errors={};
  if(!name) errors.name=t('Enter a display name.');
  else if(name.length>PROFILE_LIMITS.name) errors.name=t('Keep your name to {max} characters.',{max:PROFILE_LIMITS.name});
  if(bio.length>PROFILE_LIMITS.bio) errors.bio=t('Keep your bio to {max} characters.',{max:PROFILE_LIMITS.bio});
  const avatar=draft?.avatar || '';
  if(avatar && profileOf({avatar}).avatar!==avatar) errors.avatar=t('Choose a new JPG, PNG or WebP photo.');
  return {errors,values:{name,bio,avatar}};
}
