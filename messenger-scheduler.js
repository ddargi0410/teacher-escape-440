import {REMINDERS} from './messenger-data.js';

/** Active-play time only: menus, minigames, hidden tabs and endings never accrue time. */
export function createReminderScheduler({random=Math.random}={}) {
  let activeTime, nextIn, lastShownAt, quietUntil, message, lastMission;
  const seen=new Set(), variants=new Map();
  const rand=()=>Math.max(0,Math.min(.999999,Number(random())||0));
  const delay=(min,max)=>min+rand()*(max-min);
  function reset(){
    activeTime=0;nextIn=delay(18,26);lastShownAt=-Infinity;quietUntil=0;
    message=null;lastMission=null;seen.clear();variants.clear();
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
  function validate(context){
    const choices=eligible(context);
    if(message&&!choices.includes(message.missionId))dismiss();
    return choices;
  }
  function show(choices){
    if(!choices.length)return null;
    let pool=choices.filter(id=>!seen.has(id));
    if(!pool.length){seen.clear();pool=choices.slice();}
    // Across cycle boundaries, avoid immediately repeating a target if possible.
    if(pool.length>1)pool=pool.filter(id=>id!==lastMission);
    const missionId=pool[Math.floor(rand()*pool.length)];
    const options=REMINDERS[missionId], count=variants.get(missionId)||0;
    const copy=options[count%options.length];
    variants.set(missionId,count+1);seen.add(missionId);lastMission=missionId;
    lastShownAt=activeTime;nextIn=delay(35,60);
    message={missionId,...copy,lines:[...copy.lines]};
    return message;
  }
  function tick(dt,{enabled=false,...context}={}){
    const choices=validate(context);
    if(!enabled||!choices.length)return message;
    activeTime+=Math.max(0,Number.isFinite(dt)?dt:0);
    if(message)return message;
    nextIn-=Math.max(0,Number.isFinite(dt)?dt:0);
    if(nextIn<=1e-6&&activeTime>=quietUntil&&activeTime-lastShownAt>=15)return show(choices);
    return null;
  }
  function request(context={}){
    const choices=validate(context);
    if(message)return message;
    if(activeTime<quietUntil||activeTime-lastShownAt<15)return null;
    return show(choices);
  }
  reset();
  return {reset,tick,request,dismiss,get current(){return message;}};
}
