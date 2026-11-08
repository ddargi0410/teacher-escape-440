/** Rest ambience: synthesized nature sounds and the supplied local piano recording. */
export function createRestRoom({audio, getBed, onEnter, onLeave, onPosture, onView, onResetView, getSchoolTime = () => '--:--'}) {
  const strip=document.createElement('section');
  strip.className='rest-room';strip.hidden=true;
  strip.setAttribute('aria-label','보건실 휴식');
  strip.innerHTML=`<div class="rest-room-heading"><span class="rest-room-symbol" aria-hidden="true">☁</span><div><small>보건실 · 학교 시계 <b class="rest-school-time">--:--</b> · ¼ 속도</small><h2>오늘도 버텼다.</h2><p>쉬는 동안 학교 시계는 ¼ 속도로 흘러요.</p></div><span class="rest-room-clock" aria-label="쉬고 있는 시간">00:00</span></div><div class="rest-room-controls"><div class="rest-room-sounds" role="group" aria-label="휴식 소리"><button type="button" data-rest-sound="forest" aria-pressed="true">♧ 숲소리</button><button type="button" data-rest-sound="music" aria-pressed="false">♫ 잔잔한 음악</button><button type="button" data-rest-sound="moktak" aria-pressed="false">◎ 목탁</button><button type="button" data-rest-sound="silent" aria-pressed="false">♪ 무음</button></div><button type="button" class="rest-room-leave">일어나기 ↗</button></div><div class="rest-room-poses" role="group" aria-label="눕는 자세와 시선"><span>편한 자세</span><button type="button" data-rest-pose="back" aria-pressed="true">☁ 바로 눕기</button><button type="button" data-rest-pose="side" aria-pressed="false">☾ 옆으로 눕기</button><button type="button" class="rest-room-eyes" data-rest-view aria-pressed="false" title="누운 내 눈높이에서 둘러보기">👀 내 눈으로</button></div><span class="rest-room-status" role="status" aria-live="polite">숲소리로 쉬는 중</span><p class="rest-room-look"><span>↔ 화면을 드래그하면 누운 채로 360° 둘러볼 수 있어요 · 방향키 · 휠로 거리</span><button type="button" class="rest-room-reset-view">↺ 시선 처음으로</button></p>`;
  document.body.append(strip);
  const clock=strip.querySelector('.rest-room-clock');
  const schoolClock=strip.querySelector('.rest-school-time');
  const status=strip.querySelector('.rest-room-status');
  const soundButtons=[...strip.querySelectorAll('[data-rest-sound]')];
  const leaveButton=strip.querySelector('.rest-room-leave');
  const poseButtons=[...strip.querySelectorAll('[data-rest-pose]')];
  const viewButton=strip.querySelector('[data-rest-view]');
  const resetViewButton=strip.querySelector('.rest-room-reset-view');
  let view='orbit';
  const cleanup=[];
  let bed=null, disposed=false, elapsed=0, selected='forest', lastSound='forest',posture='back',musicPlayer=null;
  let generation=0, master=null, nodes=new Set(), sources=new Set(), noiseBuffer=null;
  let nextSound=0, starting=false;
  const labels={forest:'숲소리로 쉬는 중',music:'잔잔한 피아노 음악과 쉬는 중',moktak:'목탁 소리로 쉬는 중',silent:'소리 없이 쉬는 중'};
  const listen=(target,type,fn)=>{target.addEventListener(type,fn);cleanup.push(()=>target.removeEventListener(type,fn));};
  const own=node=>{nodes.add(node);return node;};

  function stopAudio() {
    generation++;starting=false;
    musicPlayer?.pause();
    for(const source of sources){source.onended=null;try{source.stop();}catch{}}
    for(const node of nodes){try{node.disconnect();}catch{}}
    sources.clear();nodes.clear();master=null;
  }
  function source(node, connected=[]) {
    own(node);sources.add(node);
    node.onended=()=>{
      sources.delete(node);nodes.delete(node);
      try{node.disconnect();}catch{}
      for(const child of connected){nodes.delete(child);try{child.disconnect();}catch{}}
    };
    return node;
  }
  function noise(context) {
    if(noiseBuffer&&noiseBuffer.sampleRate===context.sampleRate)return noiseBuffer;
    const result=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=result.getChannelData(0);
    let smooth=0;
    for(let i=0;i<data.length;i++){smooth=(smooth+(Math.random()*2-1)*.022)/1.022;data[i]=smooth*3.8;}
    noiseBuffer=result;return result;
  }
  function forest(context) {
    // Soft low-frequency air, plus a second filtered layer for leaf rustle.
    for(const [frequency,volume] of [[580,.65],[2100,.22]]){
      const filter=own(context.createBiquadFilter());filter.type='lowpass';filter.frequency.value=frequency;
      const gain=own(context.createGain());gain.gain.value=volume;
      const wind=source(context.createBufferSource());wind.buffer=noise(context);wind.loop=true;
      wind.connect(filter);filter.connect(gain);gain.connect(master);wind.start();
      const sway=source(context.createOscillator());sway.type='sine';sway.frequency.value=.08+Math.random()*.06;
      const depth=own(context.createGain());depth.gain.value=volume*.22;
      sway.connect(depth);depth.connect(gain.gain);sway.start();
    }
  }
  function bird(context) {
    const now=context.currentTime;
    for(let i=0;i<2;i++){
      const gain=own(context.createGain());const tone=source(context.createOscillator(),[gain]);
      const start=now+i*.18, frequency=2100+Math.random()*700;
      tone.type='sine';tone.frequency.setValueAtTime(frequency,start);
      tone.frequency.exponentialRampToValueAtTime(frequency*1.28,start+.075);
      tone.frequency.exponentialRampToValueAtTime(frequency*.94,start+.18);
      gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(.15,start+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,start+.21);
      tone.connect(gain);gain.connect(master);tone.start(start);tone.stop(start+.23);
    }
  }
  function moktak(context) {
    const now=context.currentTime;
    // Several short, inharmonic decays approximate a hollow wooden moktak.
    for(const [frequency,volume,decay] of [[560,.8,.22],[930,.38,.12],[1470,.16,.055]]){
      const gain=own(context.createGain());const tone=source(context.createOscillator(),[gain]);
      tone.type='sine';tone.frequency.setValueAtTime(frequency,now);
      tone.frequency.exponentialRampToValueAtTime(frequency*.94,now+.08);
      gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(volume,now+.003);
      gain.gain.exponentialRampToValueAtTime(.0001,now+decay);
      tone.connect(gain);gain.connect(master);tone.start(now);tone.stop(now+decay+.02);
    }
    const filter=own(context.createBiquadFilter());filter.type='bandpass';filter.frequency.value=1600;filter.Q.value=1.6;
    const gain=own(context.createGain());gain.gain.setValueAtTime(.2,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.03);
    const strike=source(context.createBufferSource(),[filter,gain]);strike.buffer=noise(context);
    strike.connect(filter);filter.connect(gain);gain.connect(master);strike.start(now);strike.stop(now+.04);
  }
  async function startAudio() {
    stopAudio();
    if(!bed||disposed||document.hidden||selected==='silent')return;
    const ticket=generation;starting=true;
    try{
      if(selected==='music'){
        if(!musicPlayer){
          musicPlayer=document.createElement('audio');
          musicPlayer.src=new URL('./assets/audio/leberch-calm-piano-586711.mp3',import.meta.url).href;
          musicPlayer.preload='none';musicPlayer.loop=true;musicPlayer.volume=.35;
          listen(musicPlayer,'error',()=>{
            if(bed&&selected==='music')status.textContent='음악을 불러오지 못했어요. 잔잔한 음악 버튼을 다시 눌러 주세요.';
          });
        }
        if(musicPlayer.error)musicPlayer.load();
        // Call play in the selection gesture, before awaiting Web Audio unlock.
        await musicPlayer.play();
        if(ticket!==generation||!bed||disposed||document.hidden)return;
        starting=false;status.textContent=labels.music;return;
      }
      const unlocked=await audio.unlock();
      if(ticket!==generation||!bed||disposed||document.hidden||selected==='silent')return;
      starting=false;
      const context=audio.context;
      if(!unlocked||!context||context.state!=='running'){
        status.textContent='소리가 안 들리면 원하는 소리 버튼을 다시 눌러 주세요.';return;
      }
      master=own(context.createGain());master.gain.setValueAtTime(.0001,context.currentTime);
      master.gain.linearRampToValueAtTime(.08,context.currentTime+.5);master.connect(context.destination);
      if(selected==='forest'){forest(context);nextSound=1.6;}
      else{moktak(context);nextSound=2.2;}
      status.textContent=labels[selected];
    }catch{
      if(ticket===generation){stopAudio();status.textContent=selected==='music'?'소리가 안 들리면 잔잔한 음악 버튼을 다시 눌러 주세요.':'소리 없이도 편하게 쉬어 가세요.';}
    }
  }
  function refreshButtons(){
    for(const button of soundButtons)button.setAttribute('aria-pressed',String(button.dataset.restSound===selected));
    status.textContent=labels[selected];
  }
  function choose(value){
    if(!Object.hasOwn(labels,value)||disposed)return;
    if(value!==selected&&musicPlayer)musicPlayer.currentTime=0;
    selected=value;if(value!=='silent')lastSound=value;
    refreshButtons();if(bed)void startAudio();
  }
  function close(){
    if(!bed)return;
    const leaving=bed;bed=null;
    stopAudio();strip.hidden=true;document.body.classList.remove('resting');
    if(musicPlayer)musicPlayer.currentTime=0;
    if(strip.contains(document.activeElement))document.activeElement.blur?.();
    onLeave?.(leaving);
  }
  for(const button of soundButtons)listen(button,'click',()=>choose(button.dataset.restSound));
  for(const button of poseButtons)listen(button,'click',()=>{posture=button.dataset.restPose==='side'?'side':'back';for(const b of poseButtons)b.setAttribute('aria-pressed',String(b.dataset.restPose===posture));if(bed)onPosture?.(bed,posture);});
  listen(leaveButton,'click',close);
  function setView(next){view=next==='eyes'?'eyes':'orbit';viewButton.setAttribute('aria-pressed',String(view==='eyes'));viewButton.textContent=view==='eyes'?'🎥 옆에서 보기':'👀 내 눈으로';if(bed)onView?.(bed,view);}
  listen(viewButton,'click',()=>setView(view==='eyes'?'orbit':'eyes'));
  listen(resetViewButton,'click',()=>{if(bed)onResetView?.(bed);});
  listen(strip,'keydown',event=>{if(event.key!=='Escape')event.stopPropagation();});
  listen(document,'visibilitychange',()=>{
    if(document.hidden)stopAudio();
    else if(bed)void startAudio();
  });

  return {
    open(bedId){
      if(disposed||bed)return false;
      const target=getBed?.(bedId);if(!target?.bedPose||!target?.exitPoint)return false;
      bed=target;elapsed=0;clock.textContent='00:00';schoolClock.textContent=getSchoolTime();refreshButtons();
      strip.hidden=false;document.body.classList.add('resting');
      onEnter?.(bed,posture);onView?.(bed,view);void startAudio();return true;
    },
    close,
    update(dt){
      if(!bed||disposed||document.hidden)return;
      const step=Number.isFinite(dt)?Math.max(0,Math.min(dt,1)):0;
      schoolClock.textContent=getSchoolTime();
      elapsed+=step;clock.textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;
      if(!master||starting||selected==='silent')return;
      if(audio.context?.state!=='running')return;
      nextSound-=step;
      if(nextSound<=0){
        if(selected==='forest'){bird(audio.context);nextSound=3.5+Math.random()*4;}
        else{moktak(audio.context);nextSound=2.1+Math.random()*.5;}
      }
    },
    setMuted(value){choose(value?'silent':lastSound);},
    getPosture:()=>posture,
    getView:()=>view,
    isOpen:()=>!!bed&&!disposed,
    dispose(){if(disposed)return;close();disposed=true;stopAudio();cleanup.forEach(fn=>fn());if(musicPlayer){musicPlayer.removeAttribute('src');musicPlayer.load();musicPlayer=null;}strip.remove();noiseBuffer=null;}
  };
}
