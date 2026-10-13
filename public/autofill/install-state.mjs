export function installationState(state,expectedVersion){
 const installed=state?.installed===true,version=typeof state?.version==='string'?state.version:null;
 if(!installed)return {kind:'missing',installed:false,connected:false,version:null};
 if(version!==expectedVersion)return {kind:'update',installed:true,connected:false,version};
 return {kind:'ready',installed:true,connected:state.connected===true,version};
}
