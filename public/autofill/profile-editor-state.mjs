import {CONTACT_FIELDS,ABOUT_FIELDS,SECTIONS,DESCRIPTION_SECTIONS} from './profile.mjs';

export function updateProfileField(profile,path,value){
 if(typeof path!=='string'||typeof value!=='string')throw new Error('资料字段不合法');
 const parts=path.split('.');let parent,key,stable;
 if(parts.length===2&&parts[0]==='contact'&&CONTACT_FIELDS.some(([key])=>key===parts[1])){parent=profile.contact;key=parts[1];stable=path;}
 else if(parts.length===2&&parts[0]==='about'&&ABOUT_FIELDS.some(([key])=>key===parts[1])){profile.about??={introduction:'',other:''};parent=profile.about;key=parts[1];stable=path;}
 else if(parts.length===3&&SECTIONS[parts[0]]&&/^\d+$/.test(parts[1])&&SECTIONS[parts[0]].fields.some(([key])=>key===parts[2])){parent=profile[parts[0]]?.[Number(parts[1])];key=parts[2];if(parent)stable=parts[0]+'.'+parent.id+'.'+key;}
 if(!parent)throw new Error('资料字段不存在');parent[key]=value;
 for(const ref of profile.importData?.fields||[])if(ref.path===stable){ref.edited=true;ref.reviewed=false;}
 return stable;
}
export function removeProfileRecord(profile,section,id){
 if(!SECTIONS[section])throw new Error('未知档案类别');
 const rows=profile[section]||[],index=rows.findIndex(row=>row.id===id);if(index<0)throw new Error('经历已变化，请重新选择');
 rows.splice(index,1);const prefix=section+'.'+id+'.';
 if(profile.importData)profile.importData.fields=profile.importData.fields.filter(ref=>!ref.path.startsWith(prefix));
 for(const variant of profile.variants||[])variant.descriptions=variant.descriptions.filter(entry=>entry.section!==section||entry.recordId!==id);
}
export function moveProfileRecord(profile,section,id,offset){
 if(!SECTIONS[section]||![1,-1].includes(offset))throw new Error('经历移动不合法');
 const rows=profile[section]||[],index=rows.findIndex(row=>row.id===id),next=index+offset;if(index<0||next<0||next>=rows.length)return false;
 [rows[index],rows[next]]=[rows[next],rows[index]];return true;
}
export function addProfileVariant(profile,name){
 if(typeof name!=='string'||!name.trim()||name.length>80)throw new Error('请填写1至80字符的版本名称');
 if((profile.variants||[]).length>=10)throw new Error('描述版本最多10份');
 const selected=profile.variants?.find(variant=>variant.id===profile.activeVariantId),descriptions=[];
 for(const section of DESCRIPTION_SECTIONS)for(const row of profile[section]||[]){const override=selected?.descriptions.find(entry=>entry.section===section&&entry.recordId===row.id);descriptions.push({section,recordId:row.id,description:override?.description??row.description??''});}
 const variant={id:crypto.randomUUID(),name:name.trim(),descriptions,about:{introduction:profile.about?.introduction||'',other:profile.about?.other||'',...selected?.about}};
 profile.variants??=[];profile.variants.push(variant);profile.activeVariantId=variant.id;return variant;
}
export function removeProfileVariant(profile,id){
 if(!profile.variants?.some(variant=>variant.id===id))throw new Error('描述版本已变化');
 profile.variants=profile.variants.filter(variant=>variant.id!==id);if(profile.activeVariantId===id)profile.activeVariantId='';
}
export function confirmProfileSources(profile){for(const ref of profile.importData?.fields||[])ref.reviewed=true;}
export function profileReviewStatus(profile){
 return {missing:[['name','姓名'],['email','电子邮箱'],['phone','手机号码']].filter(([key])=>!profile.contact[key]?.trim()).map(([,label])=>label),pending:new Set((profile.importData?.fields||[]).filter(ref=>!ref.reviewed).map(ref=>ref.path)).size,unresolved:profile.importData?.unresolved.length||0,records:Object.keys(SECTIONS).reduce((count,key)=>count+(profile[key]?.length||0),0)};
}
