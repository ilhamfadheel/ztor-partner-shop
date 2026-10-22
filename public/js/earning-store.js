// Local preview only. Image metadata is not an upload; approval is not Instagram verification.
// Proof, credited points and idempotency receipt share one atomic member-record write.
import { member, updateMember, MEMBER_KEY } from './member-store.js';
import { readJSON, writeJSON } from './util.js';
import { t } from './i18n.js';
export const EARNING_CONFIG_KEY='lloud_earning_config_preview_v1';
export const MISSION_STORAGE_KEY=MEMBER_KEY;
export const DEFAULT_EARNING_MISSIONS=[{id:'instagram-share',title:'Share your LLOUD moment',description:'Sample mission · 80 preview points after approval.',points:80,instructions:['Share your LLOUD moment on Instagram.','Submit the post link or image details for preview review.'],platformUrl:'https://www.instagram.com/',kind:'proof',published:true}];
const fail=message=>{throw new Error(message);};
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
function https(value,instagram=false){
 if(!text(value,2048)||/[\u0000-\u0020\\]/.test(value))fail(t('Invalid HTTPS URL'));
 let u;try{u=new URL(value);}catch{fail(t('Invalid HTTPS URL'));}
 if(u.protocol!=='https:'||u.username||u.password||instagram&&!(u.hostname==='instagram.com'||u.hostname.endsWith('.instagram.com')))fail(t('Use a valid HTTPS Instagram URL'));
 return u.href;
}
export function validateEarningCatalog(list){
 if(!Array.isArray(list)||list.length>20)fail('At most 20 missions are allowed');
 const seen=new Set();
 return list.map(m=>{
  if(!m||!text(m.id,64)||!/^[a-zA-Z0-9][\w-]*$/.test(m.id)||seen.has(m.id))fail('Mission IDs must be valid and unique');seen.add(m.id);
  if(!text(m.title,160)||typeof m.description!=='string'||m.description.length>500||m.kind!=='proof')fail('Invalid mission content');
  if(!Number.isSafeInteger(m.points)||m.points<=0||m.points>1000000)fail('Points must be a positive whole sample value up to 1000000');
  if(!Array.isArray(m.instructions)||m.instructions.length<1||m.instructions.length>10||m.instructions.some(s=>!text(s,500)))fail('Supply 1–10 bounded instructions');
  if(m.published!==undefined&&typeof m.published!=='boolean')fail('Invalid published flag');
  return {id:m.id,title:m.title.trim(),description:m.description,points:m.points,instructions:[...m.instructions],platformUrl:https(m.platformUrl),kind:'proof',published:m.published!==false};
 });
}
// LLOUD's sample proof missions had no backend: points come from Ztor (purchases, co-creations,
// likes and saves; see earning-ui.js), so there are no missions to submit here.
export function earningCatalog(){return [];}
export function saveEarningCatalog(list){const next=validateEarningCatalog(list);if(!writeJSON(EARNING_CONFIG_KEY,next))fail('Mission configuration could not be saved');document.dispatchEvent(new CustomEvent('earnings:config'));return next;}
const mission=id=>earningCatalog().find(m=>m.id===id&&m.published);
function account(who){const current=member();if(!current.id||current.guest||!who?.id||who.id!==current.id)fail(t('Sign in to submit or review preview proof'));return current;}
const records=who=>Array.isArray(who.missionProofs)?who.missionProofs.filter(p=>p&&p.userId===who.id&&text(p.missionId,64)&&['pending','approved','rejected'].includes(p.status)):[];
export function missionState(id,who=member()){
 const m=mission(id);
 if(!who?.id||who.guest)return {id,status:m?'not-submitted':'unavailable',points:m?.points||0,proof:null};
 const p=records(who).find(p=>p.missionId===id);
 return {id,status:p?.status||(m?'not-submitted':'unavailable'),points:p?.points??m?.points??0,proof:p?{...p}:null};
}
export function submitMissionProof(id,input={},who=member()){
 const current=account(who),m=mission(id);if(!m)fail(t('Mission is unavailable'));
 const old=records(current).find(p=>p.missionId===id);if(old&&['pending','approved'].includes(old.status))fail(t('Proof already pending or approved'));
 let url=null,fileName=null,fileSize=null,fileType=null;
 if(input.url)url=https(input.url,true);
 if(input.fileName||input.fileSize||input.fileType){
  if(!text(input.fileName,180)||/[\u0000-\u001f]/.test(input.fileName)||!['image/jpeg','image/png','image/webp'].includes(input.fileType)||!Number.isSafeInteger(input.fileSize)||input.fileSize<=0||input.fileSize>5*1024*1024)fail(t('Use JPEG, PNG or WebP image metadata up to 5 MB'));
  ({fileName,fileSize,fileType}=input);
 }
 if(!url&&!fileName)fail(t('Provide an Instagram URL or image metadata'));
 const proof={missionId:id,userId:current.id,status:'pending',points:m.points,url,fileName,fileSize,fileType,submittedAt:Date.now(),reviewedAt:null};
 const saved=updateMember({missionProofs:[...records(current).filter(p=>p.missionId!==id),proof]});return missionState(id,saved);
}
export function reviewMissionProof(id,decision,who=member()){
 const current=account(who),state=missionState(id,current),choice=['approve','approved'].includes(decision)?'approved':['reject','rejected'].includes(decision)?'rejected':null;
 if(!choice)fail('Choose approved or rejected');
 if(state.status==='approved'&&choice==='approved')return state;
 if(!mission(id)||state.status!=='pending')fail('Only pending proof may be reviewed');
 const receipt=`${current.id}:${id}`;
 const completed=Array.isArray(current.completedMissions)?current.completedMissions.filter(s=>typeof s==='string'):[];
 const credit=choice==='approved'&&!completed.includes(receipt)?state.points:0;
 if(!Number.isSafeInteger(credit)||credit<0||!Number.isSafeInteger(current.lifetime+credit)||!Number.isSafeInteger(current.recent+credit))fail('Invalid point total');
 const proof={...state.proof,status:choice,reviewedAt:Date.now()};
 const saved=updateMember({missionProofs:[...records(current).filter(p=>p.missionId!==id),proof],completedMissions:choice==='approved'?[...new Set([...completed,receipt])]:completed,lifetime:current.lifetime+credit,recent:current.recent+credit});
 return missionState(id,saved);
}
export function resetMissionProof(id,who=member()){
 const current=account(who);if(missionState(id,current).status==='approved')fail('Approved proof cannot be reset or credited twice');
 if(!mission(id))fail('Mission is unavailable');
 return missionState(id,updateMember({missionProofs:records(current).filter(p=>p.missionId!==id)}));
}
