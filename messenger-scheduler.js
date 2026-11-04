import {REMINDERS,BANTER} from './messenger-data.js';

/** Active-play time only: menus, minigames, hidden tabs and endings never accrue time. */
export function createReminderScheduler({random=Math.random}={}) {
  let activeTime, nextIn, lastShownAt, quietUntil, message, lastMission, lastKind, lastBanter;
  const seen=new Set(), variants=new Map();
  const rand=()=>Math.max(0,Math.min(.999999,Number(random())||0));
  const delay=(min,max)=>min+rand()*(max-min);
  function reset(){
    activeTime=0;nextIn=delay(18,26);lastShownAt=-Infinity;quietUntil=0;
    message=null;lastMission=null;lastKind=null;lastBanter=-1;seen.clear();variants.clear();
  }
  function dismiss(seconds){
    message=null;
    if(Number.isFinite(seconds)&&seconds>=0){nextIn=seconds;quietUntil=activeTime+seconds;}
    else nextIn=delay(35,60);
  }
  function eligible({completed=[],finished=false}={}){
    if(finished)return [];
    const done=new Set(completed);
    const remaining=Array.from({length:9},(_,i)=>i+1).filter(id=>!done.has(id));
    return remaining.length?remaining:done.has(10)?[]:[10];
  }
  function show(choices,missionOnly=false){
    if(!choices.length)return null;
    // Start with useful work, keep reminders in the majority, and never send
    // two unrelated notes consecutively. A vice-principal request is task-only.
    if(!missionOnly&&lastKind==='mission'&&rand()>.7){
      const pool=BANTER.map((_,index)=>index).filter(index=>index!==lastBanter);
      lastBanter=pool[Math.floor(rand()*pool.length)];
      const copy=BANTER[lastBanter];
      message={kind:'banter',missionId:null,...copy,lines:[...copy.lines]};
      lastKind='banter';lastShownAt=activeTime;return message;
    }
    let pool=choices.filter(id=>!seen.has(id));
    if(!pool.length){seen.clear();pool=choices.slice();}
    // Across cycle boundaries, avoid immediately repeating a target if possible.
    if(pool.length>1)pool=pool.filter(id=>id!==lastMission);
    const missionId=pool[Math.floor(rand()*pool.length)];
    const options=REMINDERS[missionId], count=variants.get(missionId)||0;
    const copy=options[count%options.length];
    variants.set(missionId,count+1);seen.add(missionId);lastMission=missionId;
    lastShownAt=activeTime;nextIn=delay(35,60);
    message={kind:'mission',missionId,...copy,lines:[...copy.lines]};lastKind='mission';
    return message;
  }
  function tick(dt,{enabled=false,...context}={}){
    // A note stays received even if its task is completed elsewhere. Only an
    // explicit acknowledgment/travel action can remove the current note.
    if(message)return message;
    const choices=eligible(context);
    if(!enabled||!choices.length)return null;
    activeTime+=Math.max(0,Number.isFinite(dt)?dt:0);
    nextIn-=Math.max(0,Number.isFinite(dt)?dt:0);
    if(nextIn<=1e-6&&activeTime>=quietUntil&&activeTime-lastShownAt>=15)return show(choices);
    return null;
  }
  function request(context={}){
    if(message)return message;
    const choices=eligible(context);
    if(activeTime<quietUntil||activeTime-lastShownAt<15)return null;
    return show(choices,true);
  }
  reset();
  return {reset,tick,request,dismiss,
    restore(received){
      if(!received||message)return;
      message=received;lastKind=received.kind;lastShownAt=activeTime;
      if(received.missionId){lastMission=received.missionId;seen.add(received.missionId);}
    },
    get current(){return message;}};
}
