import * as THREE from './vendor/three.module.js';
import {createWorld} from './world.js?v=20261110-yard1';
import {SoftwareRenderer} from './software-renderer.js?v=20261106-immersive1';
import {createPlayer} from './player.js?v=20261110-yard1';
import * as MissionData from './missions-data.js';
import {createMissionUI} from './missions-ui.js';
import {createMinigameRunner} from './minigames/runner.js?v=20261106-immersive1';
import {chooseNPCLine,getKnowledgeDetails,getArcadeData} from './minigames/content.js';
import {createWorldFeedback} from './world-feedback.js';
import {createSchoolMessenger} from './messenger.js';
import {createLearningRoom} from './learning-room.js';
import {createRestRoom} from './rest-room.js?v=20261108-stay1';
import {createPresence} from './presence.js?v=20261106-cute1';
import {createChannels} from './channels.js?v=20261108-stay1';
import {createChannelUI} from './channels-ui.js?v=20261104-nickname2';
import {PRESENCE_ENDPOINT as CONFIGURED_PRESENCE_ENDPOINT} from './presence-config.js';
import {freshState,loadGame as loadSavedGame,saveGame as saveSavedGame,storageAvailable} from './save.js?v=20261110-yard1';
import {AudioManager} from './audio.js';
import {downloadCertificate,copyText} from './certificate.js?v=20261108-stay1';
import {schoolTime,schoolMinutes,overtimeMinutes,overtimeLabel,advanceSchoolClock,actualPlaySeconds,freezeDeparture,departureState} from './school-clock.js?v=20261108-stay1';
import {daylight,lightingFor} from './daylight.js?v=20261106-cute1';
import {adjacentFloors,canUseStairs} from './stairs.js';
import {getMissionBriefing} from './minigames/briefings.js';
import {createHonors} from './honors.js?v=20261106-honors1';
import {createHallOfFameView} from './hall-of-fame-view.js?v=20261106-immersive1';
import {createCharacterPicker} from './character-picker.js?v=20261106-environment2';
import {publishAnalyticsNickname} from './analytics-identity.js?v=20261106-nicknames1';

import {readVisualTestRoute} from './visual-test.js?v=20261110-yard1';
import {createCommunity} from './community/index.js?v=20261110-yard1';
import {teacherTitle} from './community/core.js';
import {createYardUI,describeError} from './yard-ui.js?v=20261110-yard1';
import {YARD_ORIGIN} from './playground-world.js?v=20261110-yard1';

const visualTest=readVisualTestRoute();
const PRESENCE_ENDPOINT=visualTest.enabled?'':CONFIGURED_PRESENCE_ENDPOINT;
// Playground records: the server's /api/community when it exists, otherwise this device only.
const community=createCommunity({base:PRESENCE_ENDPOINT?new URL('./community',PRESENCE_ENDPOINT).href:''});
const loadGame=()=>visualTest.enabled?null:loadSavedGame();
const saveGame=value=>visualTest.enabled?true:saveSavedGame(value);
const {MISSIONS}=MissionData;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const departure=()=>schoolTime(state);
const floorNames={5:'교실 · 학년 연구실',4:'교무실 · 도서관',3:'컴퓨터실 · 과학실',2:'행정실 · 방송실',1:'급식실 · 배움터 · 보건실 · 교문'};
const canvas=$('#world'),overlay=$('#app-overlay'),audio=new AudioManager();
let state=loadGame()||freshState(),mode='home',world,player,renderer,scene,camera,teacher,nearest=null,activeMission=null;
if(visualTest.enabled)state.settings.quality=visualTest.quality;
let frame=0,saveClock=0,toastTimer,tutorialTime=0,endingTime=0,lastFocus=null,overlayKind='',nightAmount=0,goldenAmount=0,outdoorAmount=0;
const lighting={};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let sun,ambient,feedback,greetingFeedbackTimer;
let encounter=null,npcSpeechClock=0,lastSpokenNPC=null;
const previousNPCLines=new Map();
let honors,hallOfFame,characterPicker=null,certificateReturnPoint=null;
let yardUI=null,zoneSwitching=false,yardWelcomed=false;
// The plaza spot just inside the playground arch; also where others see me while I'm outside.
const YARD_GATE_SPOT=Object.freeze({x:12.1,y:0,z:13.5});
let presence,channels,restingBed=null,restView='shoulder',wantsChannelRest=false,pendingDestination=null;
const channelUI=createChannelUI({container:$('#channels-overlay'),onSelect:selectChannel,onClose:()=>{wantsChannelRest=false;player?.setActive(mode==='play'&&!busy());},onRefresh:()=>channels?.refresh(),onSolo:()=>{channels?.stop();channelUI.close();},onReconnect:reconnectChannels});
const learning=createLearningRoom({container:$('#learning-overlay'),onClose:()=>{player?.setActive(mode==='play'&&overlay.hidden);},onLearned:()=>{state.beginnerLearned=true;$('#learning-button').textContent='🌱 배움터 ✓';persist();toast('기초 체험 완료 · 이제 미션에서 써먹어 봐요.')}});
const rest=createRestRoom({audio,getSchoolTime:()=>schoolTime(state),getBed:id=>world?.getBed(id),onView:(bed,view)=>{player?.setRestView?.(view);},onResetView:()=>{player?.resetRestLook?.();},onEnter:(bed,posture)=>{clearEncounter();messenger.suspend();restView=player.cameraMode;player.setCameraMode('shoulder');player.setActive(false);player.teleport(bed.bedPose,{preserveCamera:true});world.setRestPose(teacher,bed.id,posture);restingBed=bed;updateClock();honors?.sync();},onPosture:(bed,posture)=>{world.setRestPose(teacher,bed.id,posture);},onLeave:bed=>{world?.clearRestPose(teacher);restingBed=null;updateClock();honors?.sync();if(player){player.endRestCamera?.();player.teleport(bed.exitPoint);player.setCameraMode(restView);player.setActive(mode==='play'&&overlay.hidden);}}});
const messenger=createSchoolMessenger({getState:()=>state,onLocate:id=>{if(!busy())jumpToMission(id)},onSound:()=>{audio.play('notify');world?.notifyMessage?.();},onArchiveChange:open=>player?.setActive(!open&&!busy()),onHistoryChange:count=>{$('#messenger-count').textContent=String(count)}});
const arcade=createMinigameRunner({container:$('#minigame-overlay'),onSuccess:recordSuccess,onFailure:missionFailure,onDraft:text=>{state.bossDraft=text;persist();},onClose:finishMissionView});
function missionFailure(id,payload){state.penalty=Math.min(360,state.penalty+5);persist();audio.play('error');updateHUD();}
function recordSuccess(id,payload){
 if(!state.completed.includes(id)){state.completed.push(id);state.completed.sort((a,b)=>a-b);world.setCompleted(state.completed);audio.play('success');messenger.notifyMissionSuccess(id);}
 if(id===10){if(typeof payload?.prompt==='string')state.bossDraft=payload.prompt;state.finished=true;freezeDeparture(state);}
 persist();updateHUD();
 if(id===10)honors?.finish();else honors?.sync(true);
}
function clearEncounter(){encounter=null;document.body.classList.remove('stumbling');if(teacher)teacher.rotation.z=0;feedback?.clear();}
function onCrowdEvent(event){
 if(busy())return;
 if(event.type==='complaint'){feedback.speak(()=>world.getCharacterAnchor(event.actor),event.text);audio.play('notify');return;}
 if(event.type==='message'){if(tutorialTime<=0)messenger.request();return;}
 encounter={...event,remaining:event.duration};feedback.speak(()=>world.getCharacterAnchor(event.actor),event.text);
 if(event.type==='principal'&&!state.finished){state.penalty=Math.min(360,state.penalty+1);persist();updateHUD();audio.play('notify');}
 else if(event.type!=='principal'){document.body.classList.add('stumbling');audio.play('error');}
 player.setActive(false);
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500)}
function clearGreetingFeedback(){clearTimeout(greetingFeedbackTimer);$('#social-feedback').hidden=true;$('#social-feedback').textContent='';}
function showGreetingFeedback(message){clearTimeout(greetingFeedbackTimer);const box=$('#social-feedback');box.textContent=message;box.hidden=false;greetingFeedbackTimer=setTimeout(clearGreetingFeedback,3000);}
function sendGreeting(type){if(mode!=='play')return;if(presence?.greet(type))showGreetingFeedback('인사를 보내는 중…');else showGreetingFeedback(presence?.isConnected()?'잠깐만요! 2초마다 보낼 수 있어요.':'채널에 연결되면 인사할 수 있어요.');}
function greetingSent({type}){if(mode!=='play')return;const messages={wave:'👋 인사를 보냈어요!',cheer:'🙌 응원을 보냈어요!',thanks:'💚 감사 인사를 보냈어요!'};if(messages[type])showGreetingFeedback(messages[type]);}
function persist(){saveGame(state);if(!visualTest.enabled&&community.matches(state.name))community.queueSave(state);}
function busy(){return !overlay.hidden||missions.isOpen()||arcade.isOpen()||!!encounter||learning.isOpen()||rest.isOpen()||channelUI.isOpen()||messenger.isArchiveOpen()||mode!=='play'||document.hidden}
const missions=createMissionUI({container:$('#mission-overlay'),getDraft:()=>state.bossDraft,getRelaxed:()=>state.settings.relaxed,
 onDraft:text=>{state.bossDraft=text;persist()},
 onFailure:missionFailure,
 onSuccess:recordSuccess,
 onClose:finishMissionView
});

function finishMissionView(){activeMission=null;player?.setActive(mode==='play'&&overlay.hidden);if(state.finished&&mode==='play')beginEnding();else if(state.completed.length===9)toast('결재 9건 완료! 1층 교문 앞에서 마지막 업무를 확인하세요.');}

const inYard=()=>world?.zone==='yard';
function fadeThrough(change,instant){
 if(instant||reduced){change();return;}
 const shade=$('#zone-fade');zoneSwitching=true;shade.classList.add('on');
 setTimeout(()=>{try{change();}finally{requestAnimationFrame(()=>{shade.classList.remove('on');zoneSwitching=false;});}},270);
}
/** Map shortcuts and stairs always start from inside the school. */
function exitYardSilently(){if(!inYard())return;world.setZone('school');state.zone='school';}
function enterYard({instant=false,spot=null}={}){
 if(mode!=='play'||zoneSwitching)return;
 fadeThrough(()=>{
  rest.close();learning.close();clearEncounter();messenger.suspend();
  if(state.floor!==1){state.floor=1;player.setFloor(1);}
  world.setZone('yard');state.zone='yard';
  const target=(spot&&world.playground.approach(spot))||world.playground.arrival();
  player.teleport(target,{lookYaw:target.lookYaw});
  updateHUD();persist();
  if(!yardWelcomed&&!visualTest.enabled){yardWelcomed=true;toast('운동장 도착! 수돗가 퀴즈 → 커피나무에 물 주기 → 느티나무 쪽지 걸기');}
  void yardUI.refresh().then(updateHUD);
 },instant);
}
function leaveYard({instant=false}={}){
 if(!inYard()||zoneSwitching)return;
 fadeThrough(()=>{world.setZone('school');state.zone='school';world.setFloor(1);player.teleport(YARD_GATE_SPOT,{lookYaw:Math.PI/2});updateHUD();persist();toast('학교 앞마당 · 중앙현관으로 들어가면 업무가 기다려요.');},instant);
}
function travelToYard(spot=null){
 if(mode!=='play'||!overlay.hidden&&overlayKind!=='map')return;
 if(inYard()){closePanel();if(spot){const target=world.playground.approach(spot);if(target)player.teleport(target,{lookYaw:target.lookYaw});}else toast('지금 운동장에 있어요.');return;}
 closePanel();pendingDestination=null;if(state.floor!==1)changeFloor(1);enterYard({spot});
}
/** Panels ask to move: faucet, farm, my tree or a found tree. */
function yardTravel(kind,id,tree){
 const go=()=>{
  if(kind==='tree'||kind==='my-tree'){
   const mine=yardUI.trees.find(t=>t.mine),targetId=kind==='my-tree'?mine?.id:id;
   let target=targetId?world.playground.approachTree(targetId):null;
   if(!target&&tree){const list=[...yardUI.trees.filter(t=>t.mine),tree,...yardUI.trees.filter(t=>!t.mine&&t.id!==tree.id)];world.playground.setTrees(withVisualTrees(list));target=world.playground.approachTree(tree.id);}
   if(!target)target=world.playground.approach('farm');
   player.teleport(target,{lookYaw:target.lookYaw});
  }else{const target=world.playground.approach(kind);if(target)player.teleport(target,{lookYaw:target.lookYaw});}
 };
 if(inYard())go();else{travelToYard();setTimeout(go,320);}
}
function adoptAccount(result){
 const nickname=result?.account?.nickname;
 if(nickname&&nickname!==state.name){state.name=nickname;try{publishAnalyticsNickname(state.name);}catch{}persist();}
}
/** Gifts and water hearts from colleagues also arrive as a messenger note. */
function yardMail(inbox){
 const names=list=>{const unique=[...new Set(list.map(item=>item.from))];return unique.slice(0,2).map(teacherTitle).join(', ')+(unique.length>2?' 외':'');};
 const gifts=inbox.filter(item=>item.type==='gift'),water=inbox.filter(item=>item.type==='water');
 if(gifts.length)messenger.notify('yard-gift-'+gifts.at(-1).at,{sender:'운동장 · 생태 밭',subject:'[생태 밭] 믹스커피가 도착했어요 ☕',lines:[`${names(gifts)}이 내 커피나무 앞에 믹스커피 ${gifts.length}잔을 두고 갔어요.`,'가방에 넣어 두었어요. 5층 학년 연구실 부장님께 드리거나 보건실에서 마셔요.'],reply:'잘 마실게요 ☕'});
 if(water.length)messenger.notify('yard-water-'+water.at(-1).at,{sender:'운동장 · 생태 밭',subject:`[생태 밭] 물방울 하트 ${water.length}개`,lines:[`${names(water)}이 내 커피나무에 물을 주고 갔어요.`,'하트 3개마다 수확할 때 믹스커피가 1잔씩 늘어요.'],reply:'고마워요 💧'});
}
function yardObjective(){
 const account=yardUI?.account;
 if(!community.signedIn||!community.matches(state.name))return '출근 코드로 출근하고 내 커피나무를 심어요 · 표식에서 E';
 if(!account?.quizSolvedToday)return '수돗가에서 오늘의 퀴즈를 맞히고 물뿌리개 채우기';
 if(account.can?.own)return '생태 밭 입구의 내 커피나무에 물 주기 💧';
 return '다른 선생님 나무에 물 주기 · 느티나무에 쪽지 걸기';
}
function updateCoffeeUI(){const coffee=yardUI?.account?.coffee||0;restCoffee.textContent=`☕ 믹스커피 마시기 (${coffee})`;}
async function drinkCoffee(){
 try{await yardUI.useCoffee('rest');updateCoffeeUI();toast('따뜻한 믹스커피 한 잔. 오늘도 버틴 나에게 건배 ☕');const steam=document.createElement('span');steam.className='coffee-steam';steam.textContent='☕';document.body.append(steam);setTimeout(()=>steam.remove(),1700);audio.play('success');}
 catch(error){toast(describeError(error));}
}
const restCoffee=document.createElement('button');restCoffee.type='button';restCoffee.className='rest-coffee';restCoffee.hidden=true;restCoffee.onclick=drinkCoffee;
document.querySelector('.rest-room-controls')?.append(restCoffee);
function showPanel(kind,html,wide=false){
 messenger.suspend();characterPicker?.dispose();characterPicker=null;
 lastFocus=document.activeElement;overlayKind=kind;overlay.innerHTML=`<section class="panel${wide?' wide':''}" role="dialog" aria-modal="true" aria-labelledby="panel-title">${html}</section>`;overlay.hidden=false;player?.setActive(false);
 overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=closePanel);
 requestAnimationFrame(()=>{overlay.querySelector('input,button,select,textarea')?.focus({preventScroll:true});overlay.scrollTop=0;const panel=overlay.querySelector('.panel');if(panel)panel.scrollTop=0;});
}
function closePanel(){characterPicker?.dispose();characterPicker=null;overlay.hidden=true;overlay.innerHTML='';overlayKind='';player?.setActive(mode==='play'&&!missions.isOpen());if(lastFocus instanceof HTMLElement&&lastFocus.isConnected)lastFocus.focus()}
const closeButton='<button class="close-button" data-close aria-label="닫기">×</button>';
function guide(){showPanel('guide',`${closeButton}<div class="eyebrow">HOW TO GO HOME</div><h2 id="panel-title">업무는 10개.<br>퇴근은 한 번이면 충분합니다.</h2><p>5층 학교를 걸으며 빛나는 업무 표식에 다가가세요. 미션 1–9는 원하는 순서로, 10번은 마지막에 열립니다. 각 미션을 끝내면 노하우 카드가 가방에 쌓입니다.</p><div class="controls-table"><kbd>W A S D</kbd><span>걷기 · Shift를 누르면 빠르게</span><kbd>드래그 · 휠</kbd><span>시선 돌리기 · 휠로 거리 조절 · 방향키로도 회전 가능</span><kbd>E</kbd><span>가까운 NPC · 중앙계단 살펴보기</span><kbd>F · G</kbd><span>복도 방해꾼에게 한마디 · 호루라기</span><kbd>🌱 · ✚ · ♧</kbd><span>선택 배움터 · 침대 5개 보건실 · 채널 바꾸기</span><kbd>H · J · M</kbd><span>무료 힌트 · 노하우 가방 · 학교 지도</span><kbd>0 · Esc</kbd><span>어깨높이/내려다보기/1인칭 · 일시정지와 설정</span><kbd>태블릿</kbd><span>왼쪽 조이스틱으로 이동 · 화면 드래그로 시선 · 조사 버튼</span></div><div class="notice">길 찾기가 어려우면 <strong>지도에서 목적지를 선택해 안내받기</strong>할 수 있어요. 오후 4시에 시작하며 학교 시계는 실제 플레이 시간의 2배로 흘러요. 계속 활동하면 실제 20분에 목표 시각인 4시 40분이 됩니다. 보건실에 누우면 시계가 평소의 ¼ 속도로 흐르고, 일어나면 원래 속도로 돌아와요. 오답은 게임 시계를 5분 앞으로 보내요. 목표는 4시 40분 이전! 16:40을 넘겨도 게임오버 없이 야근이 시작돼요. 창밖이 어두워지고 복도 불이 차례로 꺼지며 경비 선생님이 순찰합니다. 미션 10개를 끝내면 바로 퇴근하고, 증명서에 퇴근 시각과 야근 시간이 남습니다. 증명서를 받은 뒤에도 학교에 남아 놀거나 보건실에서 쉴 수 있어요. 완료 기록은 그대로 유지됩니다. 시계는 최대 22:00까지 표시됩니다.</div><div class="actions"><button class="primary" data-close>이제 알겠어요 ↗</button></div>`)}
function newGame(){showPanel('new',`${closeButton}<div class="eyebrow">EMPLOYEE CHECK-IN</div><h2 id="panel-title">오늘도 출근하셨군요.</h2><p>가상의 퇴근초등학교에 오신 것을 환영합니다.<br>오후 4시부터 시작해요. 10개 업무를 끝내면 곧바로 퇴근!<br>다른 동료에게 보이고 퇴근 증명서에도 넣을 닉네임을 적어 주세요.</p><label for="teacher-name">오늘의 퇴근 도전자</label><input id="teacher-name" type="text" maxlength="24" autocomplete="off" placeholder="예: 정시퇴근 선생님" value="${esc(state.name==='퇴근희망 교사'?'':state.name)}"><label for="teacher-code">출근 코드 · 숫자 4자리</label><input id="teacher-code" class="code-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••"><p class="start-code-hint">다른 PC·휴대폰에서 같은 닉네임과 출근 코드로 이어 하고, 운동장 커피나무도 이 코드로 키워요. 실제 비밀번호는 쓰지 마세요.</p><p class="yard-error" id="start-error" role="alert" hidden></p><div id="start-character-picker"></div><div class="option-row"><label for="start-relaxed">느긋하게 배우기<small>급식실에서 60초가 지나도 연습을 이어갑니다.</small></label><input type="checkbox" id="start-relaxed" ${state.settings.relaxed?'checked':''}></div><div class="notice">게임을 시작하면 채널에 자동 입장해요. 입력한 닉네임과 캐릭터 위치가 같은 채널의 동료에게 보여요. 입력한 닉네임과 방문 기록은 90일간 보관하며 공개 방문 통계에는 인원수만 표시해요. 오늘의 명예의 전당 1위가 되면 닉네임과 퇴근·휴식 기록이 동상에 공개돼요. 순위를 위해 완료한 미션 번호와 플레이 시간·오답 가산 시간·휴식 상태를 서버에 보내요. 서버가 연결되어 있으면 진행 기록(완료 미션·시계·마지막 프롬프트)도 출근 코드에 함께 저장해 다른 기기에서 이어 해요. 운동장 커피나무·쪽지는 마지막 출근 후 1년간 보관하고, 일시정지 메뉴의 ‘내 운동장 기록 지우기’로 언제든 지울 수 있어요. 새 게임은 미션 진행만 새로 시작하고, 커피나무와 쪽지는 그대로예요.</div><div class="actions"><button class="primary" id="confirm-start">출근 도장 찍기 →</button></div>`);
 characterPicker=createCharacterPicker({container:$('#start-character-picker'),value:state.avatarId});
 const codeInput=$('#teacher-code');codeInput.addEventListener('input',()=>{codeInput.value=codeInput.value.replace(/\D/g,'').slice(0,4);});
 const startError=message=>{const box=$('#start-error');box.textContent=message;box.hidden=!message;};
 $('#confirm-start').onclick=async()=>{
  const button=$('#confirm-start');if(button.disabled)return;
  const name=$('#teacher-name').value.trim(),code=codeInput.value;
  if(!name){startError('닉네임을 적어 주세요.');$('#teacher-name').focus();return;}
  if(!/^\d{4}$/.test(code)){startError('출근 코드는 숫자 4자리예요.');codeInput.focus();return;}
  button.disabled=true;startError('');
  let result;
  try{result=await community.login({nickname:name,code});}
  catch(error){startError(describeError(error));button.disabled=false;audio.play('error');codeInput.select();codeInput.focus();$('#start-error').scrollIntoView({block:'center',behavior:reduced?'auto':'smooth'});return;}
  const relaxed=$('#start-relaxed').checked;const avatarId=characterPicker.getValue();const settings=state.settings;
  state=freshState(result.account?.nickname||name);state.avatarId=avatarId;state.settings={...settings,relaxed};yardUI?.remember(result.account);persist();closePanel();start(false);opening();
  if(result.migrated)toast('이 기기에서 키우던 커피나무와 쪽지를 서버로 옮겼어요.');
 };
 for(const input of [$('#teacher-name'),codeInput])input.addEventListener('keydown',e=>{if(e.key==='Enter')$('#confirm-start').click()});}
/** Home screen: continue on another PC or phone with nickname + check-in code. */
function remoteContinue(){
 yardUI.openLogin({reason:community.deviceOnly?'지금은 서버 연결 전이라 이 기기에 저장된 진행만 이어 할 수 있어요.':'다른 PC나 휴대폰에서 하던 진행을 이어 해요.',then:async(result,name)=>{
  const saved=result.save?.state;
  if(saved&&typeof saved==='object'){
   const merged={...saved,settings:state.settings,name:result.account?.nickname||name};
   if(saveSavedGame(merged)){closePanel();start(true);toast('출근 완료! 하던 곳에서 이어 해요.');return;}
  }
  const local=loadSavedGame();
  if(local&&community.matches(local.name)){closePanel();start(true);toast('출근 완료! 이 기기에 저장된 진행을 이어 해요.');return;}
  closePanel();toast('이 닉네임으로 저장된 진행이 없어요. ‘게임 시작’으로 새로 출근해 주세요.');
 }});
}
function opening(){
 const lines=(MissionData.STORY?.opening||[]).filter((_,index)=>[1,3,4].includes(index));
 showPanel('opening',`<div class="eyebrow">PROLOGUE · 16:00</div><h2 id="panel-title">오늘은 진짜로,<br>제시간에 나간다.</h2>${lines.map(d=>`<p><strong>${esc(d.speaker)}</strong><br>${esc(d.text)}</p>`).join('')}<div class="notice">오늘 만들 자료: 초등 과학 생태계·먹이사슬 활동<br>학생이 생물을 놓고 화살표를 연결하는 웹자료를 AI에게 부탁해 봅시다. 10개 미션에서 제작 요령을 배우면 교문이 열려요.</div><div class="actions"><button class="primary" id="begin-learning">처음이라면 · 배움터 체험</button><button class="secondary" id="begin-walking">이미 알아요 · 바로 시작 ↗</button></div>`);
 $('#begin-learning').onclick=()=>{closePanel();if(travelToRoom('learning-room'))openLearning()};
 $('#begin-walking').onclick=()=>{closePanel();tutorialTime=30;$('#tutorial').hidden=false;audio.unlock();};
}
function start(resume=true){
 honors?.stopRun();
 pendingDestination=null;certificateReturnPoint=null;
 if(resume)state=loadGame()||state;
 try{publishAnalyticsNickname(state.name);}catch{}
 rest.close();learning.close();channelUI.close();channels?.stop();messenger.reset({clearHistory:!resume});if(resume&&state.completed.includes(5)&&!state.finished)messenger.notifyMissionSuccess(5);
 clearEncounter();world.applyTeacherAppearance?.(teacher,state.avatarId);world.resetCrowd?.();if(!state.finished)world.reset?.();player.setCameraMode?.(state.settings.cameraMode||'shoulder');player.resetCamera();$('#view-button').textContent='시점 · '+({shoulder:'어깨높이',overview:'내려다보기',first:'1인칭'}[state.settings.cameraMode]||'어깨높이');$('#tutorial-title').textContent='W A S D로 걸어 보세요';$('#tutorial-text').textContent='빛나는 표식이 오늘 처리할 업무입니다.';
 mode='play';$('#home').hidden=true;$('#hud').hidden=false;document.body.classList.add('playing');world.setCompleted(state.completed);world.setFloor(state.floor);player.setFloor(state.floor);teacher.visible=true;applyQuality();audio.setEnabled(state.settings.sound);updateSound();updateHUD();persist();
 if(state.finished)showCertificate();
 else {honors?.startRun();void channels?.start();if(!storageAvailable())toast('이 브라우저에서는 자동 저장이 제한됩니다. 현재 창을 유지해 주세요.');}
 resumeYard(resume);
}
/** A save made outside returns outside; a returning teacher hears about the playground once. */
function resumeYard(resume){
 if(mode==='play'&&state.zone==='yard')enterYard({instant:true});
 if(!resume||visualTest.enabled)return;
 if(community.signedIn&&community.matches(state.name))void yardUI.refresh().then(updateHUD);
 else setTimeout(()=>{if(mode==='play'&&!busy())toast('출근 코드를 정하면 운동장에서 커피나무를 키울 수 있어요. 🏃 운동장 버튼을 눌러 보세요.');},2500);
}
function home(){honors?.stopRun();exitYardSilently();rest.close();learning.close();channelUI.close();channels?.stop();persist();messenger.reset();clearEncounter();arcade.close();closePanel();missions.close();mode='home';$('#social-bar').hidden=true;$('#home').hidden=false;$('#hud').hidden=true;document.body.classList.remove('playing');world.setFloor(null);teacher.visible=false;player.setActive(false);$('#continue-game').hidden=!loadGame();$('#tutorial').hidden=true}
function changeFloor(floor){exitYardSilently();rest.close();learning.close();clearEncounter();lastSpokenNPC=null;state.floor=floor;world.setFloor(floor);player.setFloor(floor);updateHUD();persist();audio.play('click')}
function stairs(){
 const landing=world.interactables.find(i=>i.kind==='stairs');
 if(!landing||Math.hypot(player.position.x-landing.x,player.position.z-landing.z)>3.2){toast('중앙계단 표식에 다가가 E를 눌러 주세요.');return;}
 const destination=pendingDestination;
 showPanel('stairs',`${closeButton}<div class="eyebrow">CENTRAL STAIRS · ${state.floor}층</div><h2 id="panel-title">층 이동은 중앙계단으로.</h2><p>${destination?`목적지: <strong>${esc(destination.label)} · ${destination.floor}층</strong><br>계단을 한 층씩 이용해 주세요.`:'올라가거나 내려갈 층을 골라 주세요.'}</p><div class="elevator-floors">${adjacentFloors(state.floor).map(f=>`<button data-stair-floor="${f}"><b>${f>state.floor?'↗':'↙'}</b><span>${f}층으로 ${f>state.floor?'올라가기':'내려가기'}<small>${floorNames[f]}</small></span></button>`).join('')}</div><p class="notice">계단을 이용하는 동안 게임 시계는 잠깐 멈춥니다.</p>`);
 $$('[data-stair-floor]').forEach(button=>button.onclick=()=>{
  const next=Number(button.dataset.stairFloor);if(!canUseStairs(state.floor,next))return;
  changeFloor(next);player.teleport({x:0,y:(next-1)*4,z:4.7});
  if(pendingDestination?.floor===next){const target=pendingDestination;pendingDestination=null;target.kind==='mission'?travelToMission(target.id):travelToRoom(target.id);}
  else if(pendingDestination)stairs();else{closePanel();toast(`${next}층 도착 · 중앙계단`);}
 });
}
function routeViaStairs(destination){
 exitYardSilently();
 pendingDestination=destination;closePanel();player.teleport({x:0,y:(state.floor-1)*4,z:4.7});stairs();return false;
}
function openMission(id){
 if(state.completed.includes(id)){showKnowledge(id);return}
 if(id===10&&state.completed.length<9){toast(`교문 결재 대기 · 먼저 1–9번 업무를 마쳐 주세요. (${state.completed.length}/9)`);return}
 messenger.suspend();
 activeMission=id;$('#tutorial').hidden=true;tutorialTime=0;player.setActive(false);audio.play('click');arcade.open({...MISSIONS.find(m=>m.id===id),initialPrompt:id===10?state.bossDraft:undefined,runtime:{playSound:type=>audio.play(type),relaxed:state.settings.relaxed}});
}
const PODIUM_LINES=['(마이크 톡톡) 아아, 짧게 하겠습니다… 라고 말하려다 참았다.','구령대에서 보니 운동장이 넓다. 퇴근길은 더 넓다.','“여러분, 오늘도 정시 퇴근합시다!” 어디선가 박수 소리가 들리는 것 같다.','조회 시간마다 여기 서 계시던 분은 훈화가 몇 분이었을까…'];
const SHED_LINES=['체육 창고: 공 세 개, 줄넘기 마흔 개, 작년 운동회의 추억이 들어 있어요.','바람 빠진 피구공이 “선생님, 저도 퇴근하고 싶어요”라고 말하는 것 같다.','매트 냄새가 난다. 운동회 준비 기간의 기억이 떠오른다.'];
function yardInteract(item){
 if(item.kind==='yard-gate'){enterYard();return true;}
 if(item.kind==='yard-exit'){leaveYard();return true;}
 if(item.kind==='faucet'){void yardUI.openFaucet();return true;}
 if(item.kind==='zelkova'){void yardUI.openZelkova();return true;}
 if(item.kind==='farm'){void yardUI.openFarm();return true;}
 if(item.kind==='farm-plot'){yardUI.openPlant();return true;}
 if(item.kind==='coffee-tree'){void yardUI.openTree(item.treeId);return true;}
 if(item.kind==='podium'||item.kind==='shed'){const lines=item.kind==='podium'?PODIUM_LINES:SHED_LINES;toast(lines[Math.floor(Math.random()*lines.length)]);audio.play('click');return true;}
 return false;
}
function interact(){if(busy())return;updateInteraction();if(nearest&&yardInteract(nearest))return;if(nearest?.kind==='stairs')stairs();else if(nearest?.kind==='learning')openLearning();else if(nearest?.kind==='bed')lieDown(nearest.id);else if(nearest?.missionId)openMission(nearest.missionId);else toast('빛나는 표식 가까이 다가가세요. 지도(M)에서 바로 이동할 수도 있어요.')}
function showMap(){showPanel('map',`${closeButton}<div class="eyebrow">SCHOOL MAP · 중앙계단 안내</div><h2 id="panel-title">업무 동선은 짧을수록 좋습니다.</h2><p>같은 층은 방 입구로 안내해요. 다른 층은 중앙계단으로 한 층씩 이동합니다. 도착 후 표식에서 E를 누르세요.</p><div class="campus-room-list"><button data-room="learning-room">🌱 배움터 <small>선택 · 기초부터 3분</small></button><button data-room="nurse-room">✚ 보건실 <small>미션 없음 · 잠깐 쉬기</small></button><button data-room="yard">🏃 운동장 <small>수돗가 퀴즈 · 커피나무 · 쪽지</small></button></div><div class="mission-list">${MISSIONS.map(m=>`<button class="mission-row ${state.completed.includes(m.id)?'done':''} ${m.id===10?'boss':''}" data-go="${m.id}"><span class="number">${String(m.id).padStart(2,'0')}</span><div><h3>${esc(getArcadeData(m).arcade?.title||m.shortTitle||m.title)}</h3><p class="mission-learning">${esc(getMissionBriefing(m).learn)}</p><small>${m.floor}F · ${esc(m.room)}</small></div><span class="status">${state.completed.includes(m.id)?'✓ 결재':m.id===10&&state.completed.length<9?'잠김':'→'}</span></button>`).join('')}</div><div class="notice">10번 업무는 1–9번을 모두 완료하면 열립니다. 길을 잃어도 걱정 마세요. 계단 안내에는 벌칙이 없습니다.</div>`,true);
 $$('[data-go]').forEach(b=>b.onclick=()=>travelToMission(+b.dataset.go));$$('[data-room]').forEach(b=>b.onclick=()=>travelToRoom(b.dataset.room))}
function travelToMission(id){const m=MISSIONS.find(m=>m.id===id);if(!m)return;exitYardSilently();if(m.floor!==state.floor)return routeViaStairs({kind:'mission',id,label:m.room,floor:m.floor});const item=world.interactables.find(i=>i.missionId===id);if(item)player.teleport(world.getApproachPoint?.(item)||{x:item.x,y:item.y,z:item.z+2.2});closePanel();toast(`${m.room} 도착 · 가까운 표식에서 E를 눌러 주세요.`)}
// The messenger is an explicit shortcut, including messages from other floors.
function jumpToMission(id){
 const mission=MISSIONS.find(m=>m.id===id);if(!mission)return;
 pendingDestination=null;
 if(mission.floor!==state.floor)changeFloor(mission.floor);
 travelToMission(id);
}

function repel(kind){if(busy())return;const hit=world.useCorridorAction?.(kind,player.position);if(!hit?.ok){if(hit?.reason!=='cooldown')toast('가까운 복도 방해꾼에게 써 보세요.');return}const anchor=world.getCharacterAnchor(hit.actor);feedback.speak(anchor,hit.text);audio.play(kind==='whistle'?'whistle':'click');const burst=document.createElement('span');burst.className='corridor-burst';burst.textContent=kind==='whistle'?'삐익! ♪':'차례대로! ✧';document.body.append(burst);setTimeout(()=>burst.remove(),750);}
function lieDown(id){const occupied=presence?.getOccupiedBeds?.()||[];const inUse=occupied.find(b=>b.bedId===id);if(inUse){const free=[1,2,3,4,5].map(n=>'bed-'+n).find(b=>!occupied.some(p=>p.bedId===b));if(!free){wantsChannelRest=true;showTogether();toast('침대가 모두 쉬는 중이에요. 빈 채널로 옮겨 볼까요?');return}toast(`${inUse.nickname} 선생님 옆 빈 침대로 갈게요.`);id=free;}rest.open(id)}
function travelToRoom(id){if(id==='yard'){travelToYard();return false;}exitYardSilently();const room=world.specialRooms.find(r=>r.id===id);if(!room)return false;if(room.floor!==state.floor)return routeViaStairs({kind:'room',id,label:room.label,floor:room.floor});player.teleport(room.entry);closePanel();toast(id==='learning-room'?'배움터 도착 · E로 기초 체험':'보건실 도착 · 침대 앞에서 E로 눕기');return true;}
function openLearning(){if(mode!=='play')return;messenger.suspend();tutorialTime=0;$('#tutorial').hidden=true;player.setActive(false);learning.open()}
function onPresenceStatus(next){channels?.handlePresenceStatus(next);}
function onChannelChange(next){
 if(!next.connected)clearGreetingFeedback();
 const label=next.connected?`채널 ${next.selected} · 함께 ${next.count}명`:next.loading?'채널 연결 중…':next.offline?'혼자 쉬는 중':'연결을 확인 중…';
 $('#social-status').textContent=label;const nickname=next.connected?next.nickname:state.name;$('#social-nickname').textContent=`내 닉네임 · ${nickname||state.name}`;$('#social-nickname').title=nickname||state.name;$('#social-bar').hidden=mode!=='play';
 $('#social-connect-label').textContent=next.connected?`채널 ${next.selected}`:'채널';
 $$('[data-greet]').forEach(button=>button.disabled=!next.connected);
 channelUI.update({...next,nickname:next.nickname||state.name});
}
function showTogether(){
 if(mode!=='play'||!overlay.hidden||missions.isOpen()||arcade.isOpen()||learning.isOpen()||encounter)return;
 messenger.suspend();player?.setActive(false);channelUI.open({...channels.getSnapshot(),nickname:channels.getSnapshot().nickname||state.name});void channels.refresh();
}
async function reconnectChannels(){const bed=restingBed?.id;const ok=await channels.start();if(ok&&mode==='play'){channelUI.close();if(bed)lieDown(bed);}}
async function selectChannel(id){
 const bed=restingBed?.id||(wantsChannelRest?'bed-1':null);
 const ok=await channels.select(id);
 if(mode!=='play')return;
 if(!ok){if(bed&&channels.getSnapshot().connected)lieDown(bed);return;}
 channelUI.close();
 if(bed)lieDown(bed);
 else toast(`채널 ${id}로 이동했어요. 같은 층의 동료에게 인사해요.`);
}

function cardMarkup(m){return `<article class="knowledge-card"><div class="card-top"><span>KNOW-HOW ${String(m.id).padStart(2,'0')}</span><span>✓ 결재 완료</span></div><h3>${esc(m.card.title.replace(/^\d+\s*·\s*/,''))}</h3><p>${esc(m.card.body)}</p>${`<details class="knowledge-details"><summary>문항·정답·해설 펼치기</summary>${getKnowledgeDetails(m).map(x=>`<p><strong>${esc(x.question)}</strong>${x.answer?`<br>정답: ${esc(x.answer)}`:''}<br>${esc(x.explanation)}</p>`).join('')}</details>`}</article>`}
const MENTOR_LINES=['어머, 이거 선생님이 운동장에서 직접 키운 커피야? …내년 학년부장은 선생님이 딱이네~ 농담이야, 농담. 커피나 마셔.','세 봉지째인데 이건 맛이 다르네. 정성이 들어가서 그런가. 고마워요, 선생님.','믹스커피는 역시 동료가 타 준 게 제일 맛있지. 오늘은 정시 퇴근해요!'];
function showKnowledge(id){const m=MISSIONS.find(m=>m.id===id);const coffee=yardUI?.account?.coffee||0;showPanel('card',`${closeButton}<div class="eyebrow">KNOW-HOW CARD</div><h2 id="panel-title">이미 훌륭하게 처리한 업무예요.</h2>${cardMarkup(m)}${id===2?`<p class="yard-feedback" id="mentor-line" role="status" aria-live="polite"></p>`:''}<div class="actions"><button class="primary" data-close>다음 업무로 →</button>${id===2&&coffee?`<button class="secondary" id="mentor-coffee">☕ 부장님께 믹스커피 드리기 (${coffee})</button>`:''}</div>`);
 if($('#mentor-coffee'))$('#mentor-coffee').onclick=async()=>{const button=$('#mentor-coffee');button.disabled=true;try{const result=await yardUI.useCoffee('mentor');$('#mentor-line').textContent='학년부장님: '+MENTOR_LINES[(result.used-1)%MENTOR_LINES.length];button.textContent=`☕ 부장님께 믹스커피 드리기 (${result.coffee})`;button.disabled=!result.coffee;audio.play('success');}catch(error){$('#mentor-line').textContent=describeError(error);button.disabled=false;}};
}
function bag(){showPanel('bag',`${closeButton}<div class="eyebrow">MY KNOW-HOW · ${state.completed.length} / 10</div><h2 id="panel-title">퇴근길에 챙겨 갈 것들.</h2><p>어디서나 다시 보는 바이브 코딩 노하우. 수업자료 실습에서도 꺼내 쓰세요.</p><div class="yard-bag"><span class="yard-cup">☕</span><div><b>운동장 믹스커피 ${yardUI?.account?.coffee||0}개</b><small>수돗가 퀴즈로 물을 받아 커피나무를 키우면 수확할 수 있어요. 학년 연구실 부장님께 드리거나 보건실에서 마셔요.</small></div><button class="secondary" id="bag-yard">🏃 운동장</button></div>${state.finished?'<div class="actions"><button class="primary" id="bag-certificate">퇴근 증명서 다시 보기</button></div>':''}<div class="bag-grid">${MISSIONS.map(m=>state.completed.includes(m.id)?cardMarkup(m):`<div class="empty-card">${String(m.id).padStart(2,'0')} · ${esc(m.room)}<br><br>이 업무를 마치면 카드가 열립니다.</div>`).join('')}</div>${state.bossDraft?'<div class="actions"><button class="secondary" id="bag-copy">내 프롬프트 복사하기 ↗</button></div>':''}`,true);if($('#bag-copy'))$('#bag-copy').onclick=copyPrompt;if($('#bag-certificate'))$('#bag-certificate').onclick=showCertificate;$('#bag-yard').onclick=()=>{closePanel();travelToYard();}}
function hint(){if(learning.isOpen()||rest.isOpen())return;if(arcade.isOpen()){arcade.hint();return}if(missions.isOpen()){missions.hint();return}if(mode!=='play')return;if(inYard()){toast('운동장: '+yardObjective());return}const next=nearest?.missionId?MISSIONS.find(m=>m.id===nearest.missionId):MISSIONS.find(m=>!state.completed.includes(m.id)&&m.floor===state.floor)||MISSIONS.find(m=>!state.completed.includes(m.id));if(next)toast(`${next.room}: ${next.hint}`)}
function pause(){if(mode!=='play'||missions.isOpen()||arcade.isOpen()||learning.isOpen()||rest.isOpen())return;showPanel('pause',`${closeButton}<div class="eyebrow">COFFEE BREAK</div><h2 id="panel-title">잠깐 쉬어도 퇴근은 옵니다.</h2><p>이 메뉴에서는 시간이 멈춰요. 보건실에 누우면 학교 시계가 평소의 ¼ 속도로 흐릅니다. 완료한 업무는 자동 저장돼요.</p><div class="option-row"><label for="camera-mode">카메라 시점<small>어깨높이로 걷거나 학교를 내려다볼 수 있어요.</small></label><select id="camera-mode"><option value="shoulder">어깨높이 · 몰입형</option><option value="overview">내려다보기 · 기존 시점</option><option value="first">1인칭 · 내 눈높이</option></select></div><div class="option-row"><label for="quality">그래픽 품질<small>학교 PC에서 느리면 '저'를 선택하세요.</small></label><select id="quality"><option value="low">저 · 가볍게</option><option value="medium">중 · 균형</option><option value="high">고 · 선명하게</option></select></div><div class="option-row"><label for="relaxed">느긋하게 배우기<small>급식실에서 60초가 지나도 연습을 이어갑니다.</small></label><input id="relaxed" type="checkbox" ${state.settings.relaxed?'checked':''}></div><div class="option-row"><label for="sound-check">효과음<small>직접 만든 짧은 전자음만 사용합니다.</small></label><input id="sound-check" type="checkbox" ${state.settings.sound?'checked':''}></div><div class="actions"><button class="primary" data-close>다시 걸어가기 ↗</button><button class="secondary" id="pause-character">캐릭터 바꾸기</button><button class="secondary" id="pause-guide">조작법</button>${state.finished?'<button class="secondary" id="review-certificate">퇴근 증명서 다시 보기</button>':''}<button class="secondary" id="pause-home">저장하고 첫 화면</button></div><div class="option-row"><label for="forget-yard">내 운동장 기록 지우기<small>출근 코드·커피나무·쪽지·믹스커피를 지워요. 미션 진행은 이 기기에 남아요.</small></label><button class="secondary" id="forget-yard">지우기</button></div><p class="yard-error" id="forget-yard-note" role="status" hidden></p>`);
 $('#camera-mode').value=player.cameraMode;$('#camera-mode').onchange=e=>selectCameraMode(e.target.value);
 $('#quality').value=state.settings.quality;$('#quality').onchange=e=>{state.settings.quality=e.target.value;applyQuality();persist()};$('#relaxed').onchange=e=>{state.settings.relaxed=e.target.checked;persist()};$('#sound-check').onchange=e=>{state.settings.sound=e.target.checked;audio.setEnabled(state.settings.sound);updateSound();persist()};$('#pause-home').onclick=home;$('#pause-guide').onclick=guide;
 $('#forget-yard').onclick=async()=>{const button=$('#forget-yard'),note=$('#forget-yard-note');
  if(!community.signedIn){note.textContent='지울 운동장 기록이 없어요. (출근 코드로 출근하지 않았어요)';note.hidden=false;return;}
  if(button.dataset.confirm!=='1'){button.dataset.confirm='1';button.textContent='정말 지우기';note.textContent='한 번 더 누르면 커피나무·쪽지·믹스커피가 모두 사라지고 되돌릴 수 없어요.';note.hidden=false;return;}
  button.disabled=true;try{await community.deleteAccount();yardUI.remember({coffee:0});note.textContent='내 운동장 기록을 지웠어요.';if(inYard())void yardUI.refresh();}catch(error){note.textContent=describeError(error);button.disabled=false;}note.hidden=false;};$('#pause-character').onclick=chooseCharacter;if($('#review-certificate'))$('#review-certificate').onclick=showCertificate;
}
function chooseCharacter(){
 showPanel('character',`${closeButton}<div class="eyebrow">MY TEACHER</div><h2 id="panel-title">오늘의 나를 골라 보세요.</h2><p>진행 중인 업무와 기록은 그대로 이어져요.</p><div id="change-character-picker"></div><div class="actions"><button class="primary" id="confirm-character">이 선생님으로 걸어가기 ↗</button></div>`);
 characterPicker=createCharacterPicker({container:$('#change-character-picker'),value:state.avatarId});
 $('#confirm-character').onclick=()=>{state.avatarId=characterPicker.getValue();world.applyTeacherAppearance?.(teacher,state.avatarId);persist();closePanel();toast('내 캐릭터를 바꿨어요. 오늘도 무사 퇴근!');};
}
function selectCameraMode(value,{announce=true}={}){
 if(!player.setCameraMode(value))return;
 state.settings.cameraMode=value;persist();
 const label={shoulder:'어깨높이',overview:'내려다보기',first:'1인칭'}[value];
 $('#view-button').textContent='시점 · '+label;
 if(announce)toast(label+' · 드래그로 둘러보세요. 일시정지 메뉴에서 직접 고를 수도 있어요.');
}
function toggleView(){if(busy())return;const modes=['shoulder','overview','first'];selectCameraMode(modes[(modes.indexOf(player.cameraMode)+1)%modes.length]);}
function updateClock(){
 $('#departure').textContent=departure();
 const overtime=overtimeMinutes(state);
 $('.clock-panel').classList.toggle('overtime',!state.finished&&overtime>0);
 $('#clock-status').textContent=rest.isOpen()?(state.finished?'퇴근 완료 · 휴식 중 · ¼ 속도':'보건실 휴식 · 시계 ¼ 속도'):state.finished?'퇴근 완료 · 자유시간':overtime>0?`야근 ${overtimeLabel(state)} · 끝내면 바로 퇴근`:'목표 16:40 · 끝내면 바로 퇴근';
}
function updateHUD(){
 $('#playtime').textContent=time(actualPlaySeconds(state));
 $('#learning-button').textContent=state.beginnerLearned?'🌱 배움터 ✓':'🌱 배움터';
 $('#floor-label').textContent=inYard()?'운동장':state.floor+'F';$('#location-title').textContent=inYard()?'운동장 · 생태 밭 · 느티나무':floorNames[state.floor];$('#progress-label').textContent=`${state.completed.length} / 10`;
 $('#progress-stamps').innerHTML=MISSIONS.map(m=>`<span class="stamp ${m.id===10?'boss':''} ${state.completed.includes(m.id)?'done':''}" title="${esc(m.title)}"></span>`).join('');
 $('#progress-caption').textContent=state.completed.length===9?'교문 앞 최종 업무가 열렸습니다.':state.completed.length===10?'모든 업무가 결재되었습니다.':'도장 10개를 모으면 교문이 열립니다.';
 $('#objective').textContent=inYard()?yardObjective():state.finished?'업무 끝! 학교를 둘러보거나 보건실에서 쉬어요.':state.completed.length===9?'1층 교문 앞에서 마지막 결재를 받으세요.':'먹이사슬 자료 만들기 · 표식에서 E';updateClock();$('#bag-count').textContent=state.completed.length;updateCoffeeUI();
 $('#floor-buttons').innerHTML=[5,4,3,2,1].map(f=>`<button class="${state.floor===f&&!inYard()?'active':''}" data-rail-floor="${f}" aria-label="${f}층 지도">${f}<em>F</em></button>`).join('');$$('[data-rail-floor]').forEach(b=>b.onclick=()=>{if(busy())return;showMap()});
}
function updateSound(){$$('.sound-toggle').forEach(b=>{b.querySelector('span').textContent=state.settings.sound?'ON':'OFF';b.setAttribute('aria-label',state.settings.sound?'소리 끄기':'소리 켜기')})}
function applyQuality(){const quality=state.settings.quality;if(visualTest.enabled)document.body.dataset.quality=quality;world?.setQuality?.(quality);renderer.setPixelRatio(renderer.isSoftware?(quality==='low'?.65:quality==='high'?1:.85):Math.min(devicePixelRatio,quality==='low'?1:quality==='high'?2:1.35));renderer.shadowMap.enabled=quality!=='low'&&!renderer.isSoftware;sun.shadow.mapSize.set(quality==='high'?2048:1024,quality==='high'?2048:1024);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}renderer.setSize(innerWidth,innerHeight);scene.traverse(o=>{if(o.material)o.material.needsUpdate=true})}
async function copyPrompt(){const ok=await copyText(state.bossDraft);toast(ok?'프롬프트를 복사했습니다. AI 대화창에 붙여 넣고 실습을 시작하세요.':'복사가 제한되었습니다. 아래 프롬프트를 길게 눌러 복사해 주세요.')}
function beginEnding(){freezeDeparture(state);exitYardSilently();certificateReturnPoint=null;rest.close();learning.close();channelUI.close();channels?.stop();messenger.reset();clearEncounter();arcade.close();missions.close();closePanel();mode='ending';$('#social-bar').hidden=true;endingTime=0;$('#hud').hidden=true;$('#ending-caption').hidden=false;world.setFloor(null);world.openGate();world.car.position.set(7,0,22);world.car.rotation.y=Math.PI/2;teacher.visible=false;player.setActive(false);audio.play('ending');persist()}
function showCertificate(){
 freezeDeparture(state);
 if(mode==='play'){rest.close();certificateReturnPoint={floor:state.floor,position:{...player.position},yaw:player.yaw};}
 const record=departureState(state);persist();
 mode='certificate';$('#social-bar').hidden=true;messenger.suspend();$('#ending-caption').hidden=true;$('#hud').hidden=true;player.setActive(false);
 showPanel('certificate',`<div class="certificate-header"><div class="seal">↗</div><div class="eyebrow" style="justify-content:center;margin-top:20px">OFFICIALLY OFF DUTY</div><h2 id="panel-title">퇴근 증명서</h2><p><strong>${esc(state.name.endsWith('선생님')?state.name:state.name+' 선생님')}</strong>,<br>업무 10건을 모두 처리하셨습니다.<br>이제 당신의 저녁을 즐기세요. 더 머물러도 좋아요.</p></div><div class="departure-record ${overtimeMinutes(record)>0?'worked-late':'on-time'}"><div><small>퇴근 시각</small><strong>${schoolTime(record)}</strong></div><div><small>야근 시간 · 16:40 기준</small><strong>${overtimeLabel(record)}</strong><span>${overtimeMinutes(record)>0?'경비 선생님도 퇴근을 응원합니다.':'정시 퇴근 성공! 오늘의 저녁을 지켰습니다.'}</span></div></div><div class="actions certificate-stay-actions"><button class="primary" id="end-stay">학교에 남아 놀기 ↗</button><button class="secondary" id="end-rest">✚ 보건실에서 쉬기</button></div><p class="notice">퇴근 시각과 야근 기록은 확정됐어요. 더 놀거나 쉬어도 이 증명서는 바뀌지 않아요.</p><div class="end-stats"><div><small>실제 플레이</small><strong>${time(actualPlaySeconds(record))}</strong></div><div><small>모은 노하우</small><strong>10 / 10</strong></div></div><p class="notice">${esc(MissionData.STORY?.ending?.[0]||'오늘 배운 내용을 내일의 수업으로. 마지막 단계는 저장하고 퇴근하기입니다.')}</p><div class="actions"><button class="primary" id="download-certificate">퇴근 증명서 이미지 저장 ↓</button><button class="secondary" id="copy-final">내 프롬프트 복사 ↗</button></div><label for="final-prompt">실습에 바로 쓰는 나의 프롬프트</label><textarea id="final-prompt" readonly>${esc(state.bossDraft)}</textarea><p>아래 프롬프트는 내가 작성한 요청문입니다. 실제 교육자료 생성·실행·내용 검증은 이어지는 실습에서 진행해 주세요.</p><div class="bag-grid">${MISSIONS.map(cardMarkup).join('')}</div><div class="actions"><button class="secondary" id="end-home">첫 화면으로</button><button class="secondary" id="end-replay">다시 도전하기</button></div>`,true);
 $('#download-certificate').onclick=async()=>{try{await downloadCertificate(record,MISSIONS);toast('퇴근 증명서를 PNG 이미지로 저장했습니다.')}catch{toast('이미지 저장이 제한됩니다. 현재 화면을 캡처해 주세요.')}};$('#copy-final').onclick=copyPrompt;$('#end-home').onclick=home;$('#end-replay').onclick=newGame;$('#end-stay').onclick=()=>stayAtSchool();$('#end-rest').onclick=()=>stayAtSchool({nurseRoom:true});
}
function stayAtSchool({nurseRoom=false}={}){
 if(!state.finished)return;
 freezeDeparture(state);
 const returnPoint=certificateReturnPoint;certificateReturnPoint=null;
 pendingDestination=null;activeMission=null;tutorialTime=0;clearEncounter();
 mode='play';closePanel();$('#home').hidden=true;$('#ending-caption').hidden=true;$('#tutorial').hidden=true;$('#hud').hidden=false;
 document.body.classList.add('playing');teacher.visible=true;
 state.floor=nurseRoom?1:returnPoint?.floor||1;world.setFloor(state.floor);world.setCompleted(state.completed);world.openGate();
 player.setCameraMode(state.settings.cameraMode||'shoulder');player.setFloor(state.floor);
 if(returnPoint&&!nurseRoom)player.teleport(returnPoint.position,{lookYaw:returnPoint.yaw});
 player.resetCamera();player.setActive(true);updateHUD();persist();
 onChannelChange(channels.getSnapshot());void channels.start();
 if(nurseRoom){travelToRoom('nurse-room');lieDown('bed-1');}
 else toast('업무 끝! 자유롭게 둘러보세요. 증명서는 노하우 가방이나 일시정지 메뉴에서 다시 볼 수 있어요.');
}

function init(){
 try{renderer=visualTest.renderer==='software'?new SoftwareRenderer({canvas}):new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){try{renderer=new SoftwareRenderer({canvas});console.info('WebGL unavailable: using Canvas 3D compatibility renderer.')}catch(fallbackError){$('#boot-error').hidden=false;$('#boot-error').innerHTML='<h2>3D 화면을 열 수 없어요.</h2><p>Chrome·Edge·웨일에서 하드웨어 가속을 켜고 다시 실행해 주세요. 이 게임은 WebGL을 사용하는 3D 게임입니다.</p>';console.error(error,fallbackError);return}}
 document.body.dataset.renderer=renderer.isSoftware?'software':'webgl';canvas.dataset.renderer=document.body.dataset.renderer;
 if(visualTest.enabled)document.body.dataset.visualTest='true';
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();scene.background=new THREE.Color('#e9eef0');scene.fog=new THREE.Fog('#e9eef0',70,170);
 camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,220);
 ambient=new THREE.HemisphereLight('#fff4e6','#d8c8b4',2.7);scene.add(ambient);
 sun=new THREE.DirectionalLight('#ffdbac',3.1);sun.position.set(-18,42,28);sun.castShadow=true;sun.shadow.camera.left=-42;sun.shadow.camera.right=42;sun.shadow.camera.top=42;sun.shadow.camera.bottom=-42;sun.shadow.camera.near=1;sun.shadow.camera.far=100;sun.shadow.bias=-.00045;sun.shadow.normalBias=.04;scene.add(sun);scene.add(sun.target);
 const fill=new THREE.DirectionalLight('#d6e2f2',1);fill.position.set(25,16,-18);scene.add(fill);
 world=createWorld(scene);feedback=createWorldFeedback({camera});hallOfFame=createHallOfFameView({camera,world});
 yardUI=createYardUI({community,showPanel,esc,getState:()=>state,toast,playSound:type=>audio.play(type),onSplash:()=>world.playground.splash(),onLogin:adoptAccount,onTravel:yardTravel,
  onTrees:list=>world.playground.setTrees(withVisualTrees(list)),
  onNotes:(decor,palette)=>world.playground.setNotes(visualTest.enabled?VISUAL_NOTES.decor:decor,visualTest.enabled?VISUAL_NOTES.palette:palette),
  onInbox:yardMail,
  onAccount:()=>{updateCoffeeUI();if(mode==='play')$('#objective').textContent=inYard()?yardObjective():$('#objective').textContent;}});
 honors=createHonors({endpoint:PRESENCE_ENDPOINT?new URL('./honors',PRESENCE_ENDPOINT).href:'',getState:()=>state,getActivity:()=>({visible:mode==='play'&&!state.finished&&overlay.hidden&&!document.hidden,resting:!!restingBed&&rest.isOpen()}),onStateChange:persist,onData:data=>hallOfFame.setData(data),onStatus:status=>hallOfFame.setStatus(status)});honors.start();
 teacher=world.createTeacher('#d9bc75',{avatarId:state.avatarId});scene.add(teacher);teacher.visible=false;
 player=createPlayer({camera,canvas,model:teacher,world,onMove:()=>{}});player.setActive(false);world.setFloor(null);applyQuality();updateSound();$('#continue-game').hidden=!loadGame();
 presence=createPresence({scene,world,camera,endpoint:PRESENCE_ENDPOINT,getLocal:()=>inYard()?{...YARD_GATE_SPOT,yaw:Math.PI/2,floor:1,action:'idle',avatarId:state.avatarId}:({x:player.position.x,y:restingBed?teacher.position.y:player.position.y,z:player.position.z,yaw:teacher.rotation.y,floor:state.floor,action:rest.isOpen()?'rest':learning.isOpen()?'learn':activeMission?'mission':player.moving?'walk':'idle',bedId:restingBed?.id,avatarId:state.avatarId,restPosture:rest.getPosture()}),onStatus:onPresenceStatus,onGreetingSent:greetingSent,onGreeting:({nickname,text})=>{if(!busy())toast(`${nickname}: ${text}`)}});
 channels=createChannels({presence,endpoint:PRESENCE_ENDPOINT,getNickname:()=>state.name,onChange:onChannelChange,onBeforeSwitch:({automatic})=>{if(rest.isOpen()&&!automatic)rest.close();}});
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();persist();toast('그래픽 연결이 잠시 끊겼어요. 새로고침하면 저장한 진행으로 이어 할 수 있습니다.')});
 requestAnimationFrame(loop);
}
const YARD_KINDS={'yard-gate':'운동장으로 나가기','yard-exit':'학교 안으로','faucet':'오늘의 퀴즈','zelkova':'쪽지 방명록','farm':'생태 밭','farm-plot':'빈 밭','coffee-tree':'동료의 커피나무','podium':'구령대','shed':'체육 창고'};
function updateInteraction(){
 nearest=null;let dist=3.0;for(const item of world.interactables){const d=Math.hypot(player.position.x-item.x,player.position.z-item.z);if(d<dist){dist=d;nearest=item}}
 $('#interaction').hidden=!nearest||busy();if(nearest){$('#interact-kind').textContent=YARD_KINDS[nearest.kind]?(nearest.kind==='coffee-tree'&&nearest.mine?'내 커피나무':YARD_KINDS[nearest.kind]):nearest.kind==='learning'?'선택형 기초 체험':nearest.kind==='bed'?'미션 없는 휴식':nearest.kind==='stairs'?'중앙계단':state.completed.includes(nearest.missionId)?'결재 완료 · 노하우 다시 보기':nearest.missionId===10?'최종 결재':'업무 접수';$('#interact-label').textContent=nearest.label}
}
function renderWorld(){world.setViewPosition?.(camera.position);renderer.render(scene,camera);}
function loop(ms){requestAnimationFrame(loop);if(visualTest.enabled)document.body.dataset.gameMode=mode;const elapsedDt=Math.min(1,(ms-(frame||ms))/1000);const dt=Math.min(.05,elapsedDt);frame=ms;const t=ms/1000;
 if(mode==='home'){
  if(camera.fov!==42){camera.fov=42;camera.updateProjectionMatrix();}
  const pos=world.heroCamera.clone();pos.x+=reduced?0:Math.sin(t*.11)*1.2;camera.position.copy(pos);
  const target=world.heroTarget.clone();const offset=innerWidth<800?8:14;target.x-=offset;target.y+=innerWidth<800?2:0;camera.lookAt(target);
 }else if(mode==='play'){
  if(encounter&&!document.hidden&&overlay.hidden&&!missions.isOpen()&&!arcade.isOpen()){
   encounter.remaining-=elapsedDt;
   if(encounter.type==='principal')player.focusOn(encounter.actor,dt);
   else teacher.rotation.z=Math.sin(encounter.remaining*25)*.17;
   feedback.status(encounter.type,encounter.remaining);
   if(encounter.remaining<=0){encounter=null;teacher.rotation.z=0;document.body.classList.remove('stumbling');}
  }
  const active=!busy();player.setActive(active);player.update(dt,active);
  if(restingBed)player.updateRestCamera(restingBed,dt);
  world.updateCrowd(dt,{position:player.position,floor:state.floor,enabled:active&&!inYard(),onEvent:onCrowdEvent});
  if(active&&!encounter&&!zoneSwitching){if(world.wantsYard(player.position))enterYard();else if(inYard()&&world.playground.wantsExit(player.position))leaveYard();}
  if(active&&!encounter&&!inYard()){npcSpeechClock-=elapsedDt;const near=world.interactables.find(i=>i.missionId&&Math.hypot(player.position.x-i.x,player.position.z-i.z)<2.6);if(near&&(lastSpokenNPC!==near.missionId||npcSpeechClock<=0)){lastSpokenNPC=near.missionId;npcSpeechClock=14;const line=chooseNPCLine(near.missionId,Math.random,previousNPCLines.get(near.missionId));previousNPCLines.set(near.missionId,line);feedback.speak(()=>world.getNPCAnchor(near.missionId),line);}}if(!document.hidden&&overlay.hidden&&!learning.isOpen()&&!channelUI.isOpen()&&!messenger.isArchiveOpen()&&(!arcade.isOpen()||arcade.isPlaying())){advanceSchoolClock(state,elapsedDt,{resting:rest.isOpen()});$('#playtime').textContent=time(actualPlaySeconds(state));updateClock();saveClock+=elapsedDt;if(saveClock>4){persist();saveClock=0}}
  if(tutorialTime>0&&active){tutorialTime-=elapsedDt;$('#tutorial-time').textContent=Math.ceil(tutorialTime)+'초';if(tutorialTime<20){$('#tutorial-title').textContent='화면을 드래그해 둘러보세요';$('#tutorial-text').textContent='빛나는 업무 표식에 가까이 가서 E를 눌러 보세요.'}if(tutorialTime<10){$('#tutorial-title').textContent='길을 잃으면 M · 힌트는 H';$('#tutorial-text').textContent='지도에서 바로 이동할 수 있어요. 모은 카드는 J로 다시 봅니다.'}if(tutorialTime<=0)$('#tutorial').hidden=true}updateInteraction();
 }else if(mode==='ending'){
  if(camera.fov!==42){camera.fov=42;camera.updateProjectionMatrix();}
  endingTime+=elapsedDt;const p=Math.min(1,endingTime/5);world.car.position.x=7+p*30;camera.position.set(31+p*8,15,37);camera.lookAt(8+p*16,2,20);if(endingTime>5.5)showCertificate();
 }
 const overtime=mode==='home'?0:overtimeMinutes(state);
 // The sky follows the school clock: golden from 16:15, sunset at 16:40, night by 17:15.
 const sunTarget=mode==='home'?{golden:0,night:0}:daylight(schoolMinutes(state));
 const ease=Math.min(1,elapsedDt*.8);
 goldenAmount+=(sunTarget.golden-goldenAmount)*ease;nightAmount+=(sunTarget.night-nightAmount)*ease;
 if(mode==='home'){goldenAmount=0;nightAmount=0;}
 const outdoorTarget=mode==='ending'||mode==='certificate'?1:world.isOutdoors?.(camera.position)?1:0;
 outdoorAmount+=(outdoorTarget-outdoorAmount)*Math.min(1,elapsedDt*2.5);
 lightingFor({golden:goldenAmount,night:nightAmount,outdoors:outdoorAmount,resting:!!restingBed,home:mode==='home'},lighting);
 scene.background.copy(lighting.sky);scene.fog.color.copy(lighting.sky);scene.userData.schoolNight=nightAmount*(.55+.45*outdoorAmount);
 ambient.intensity=lighting.ambient;ambient.color.copy(lighting.ambientColor);ambient.groundColor.copy(lighting.ground);
 sun.intensity=lighting.sunIntensity;sun.color.copy(lighting.sunColor);sun.position.copy(lighting.sunPosition);
 // Outside, the shadow camera follows the playground instead of the school.
 if(inYard()){sun.position.x+=YARD_ORIGIN.x;sun.position.z+=YARD_ORIGIN.z;sun.target.position.set(YARD_ORIGIN.x,0,YARD_ORIGIN.z);}else sun.target.position.set(0,0,0);
 sun.target.updateMatrixWorld();
 world.setDaylight?.({golden:goldenAmount,night:nightAmount,window:lighting.window});
 world.updateOvertime(overtime,dt,{active:mode==='play'&&!busy()});
 rest.update(elapsedDt);channels?.update(elapsedDt,{visible:mode==='play'&&!document.hidden});presence?.update(elapsedDt,{visible:mode==='play'&&!inYard()&&overlay.hidden&&!missions.isOpen()&&!arcade.isOpen()&&!learning.isOpen()&&!document.hidden,floor:state.floor});
 if(restingBed){const conflict=presence?.getBedConflict?.(restingBed.id);if(conflict){rest.close();if(conflict.freeBedId)lieDown(conflict.freeBedId);toast(conflict.freeBedId?'같이 눕다가 겹쳤네요. 옆 빈 침대로 이동했어요.':'침대가 모두 쉬는 중이에요. 잠깐만 기다려 주세요.');}}
 world.update(dt,t,state.completed);world.updateResting?.(dt,reduced?0:t);world.updateYard(dt,reduced?0:t,player.position);
 if(rest.isOpen())restCoffee.hidden=!(yardUI?.account?.coffee>0);if(!arcade.isOpen()){if(mode==='play')player.withCameraOcclusion(renderWorld);else renderWorld();}feedback?.update(elapsedDt,mode==='play'&&overlay.hidden&&!missions.isOpen()&&!arcade.isOpen()&&!document.hidden);
 honors?.update();hallOfFame?.update({visible:mode==='play'&&!inYard()&&overlay.hidden&&!missions.isOpen()&&!arcade.isOpen()&&!learning.isOpen()&&!rest.isOpen()&&!channelUI.isOpen()&&!document.hidden,floor:state.floor,position:player.position});
 messenger.update(elapsedDt,!busy()&&tutorialTime<=0&&!state.finished);
}
$('#messenger-button').onclick=()=>{if(!busy())messenger.openArchive()};
$('#talk-button').onclick=()=>repel('talk');$('#whistle-button').onclick=()=>repel('whistle');
$('#learning-button').onclick=()=>{if(!busy()){if(travelToRoom('learning-room'))openLearning()}};$('#nurse-button').onclick=()=>{if(!busy())travelToRoom('nurse-room')};$('#together-button').onclick=showTogether;$('#social-channel-button').onclick=showTogether;$$('[data-greet]').forEach(b=>b.onclick=()=>sendGreeting(b.dataset.greet));
$('#start').onclick=newGame;$('#continue-game').onclick=()=>start(true);$('#remote-continue').onclick=remoteContinue;$('#yard-button').onclick=()=>{if(!busy())travelToYard();};
$('#touch-jump').addEventListener('pointerdown',event=>{event.preventDefault();if(!busy())player.jump();});$('#home-guide').onclick=guide;$('#pause-button').onclick=pause;$('#map-button').onclick=()=>{if(!busy())showMap()};$('#bag-button').onclick=()=>{if(!busy())bag()};$('#hint-button').onclick=hint;$('#view-button').onclick=toggleView;$('#interact-button').onclick=interact;$('#touch-interact').onclick=interact;$('#tutorial-skip').onclick=()=>{tutorialTime=0;$('#tutorial').hidden=true};
$$('.sound-toggle').forEach(b=>b.onclick=()=>{state.settings.sound=!state.settings.sound;audio.setEnabled(state.settings.sound);audio.unlock();audio.play('click');updateSound();persist()});
window.addEventListener('keydown',e=>{
 const input=e.target.closest?.('input,textarea,select,[contenteditable=true]');
 if(e.key==='Tab'&&(!overlay.hidden||missions.isOpen()||arcade.isOpen())){const root=arcade.isOpen()?$('#minigame-overlay'):missions.isOpen()?$('#mission-overlay'):overlay;const focusable=[...root.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea,select,[tabindex="0"]')].filter(x=>x.offsetParent!==null);if(focusable.length){const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}
 if(e.code==='Escape'){if(messenger.isArchiveOpen()){messenger.closeArchive();return}if(channelUI.isOpen()){channelUI.close();return}if(rest.isOpen()){rest.close();return}if(learning.isOpen()){learning.close();return}if(arcade.isOpen()){arcade.close();return}if(missions.isOpen()){missions.close();activeMission=null;if(!state.finished)player.setActive(true)}else if(!overlay.hidden&&overlayKind!=='certificate'&&overlayKind!=='opening')closePanel();else pause();return}
 if(input||e.repeat)return;
 if(!input&&e.code==='KeyH'&&mode==='play'){e.preventDefault();hint();return}
 if(busy())return;
 if(e.code==='Space'){e.preventDefault();if(document.activeElement instanceof HTMLButtonElement)document.activeElement.blur();player.jump();return}
 if(e.code==='KeyF'){e.preventDefault();repel('talk')}else if(e.code==='KeyG'){e.preventDefault();repel('whistle')}else if(e.code==='KeyE'){e.preventDefault();interact()}else if(e.code==='KeyJ'){e.preventDefault();bag()}else if(e.code==='KeyM'){e.preventDefault();showMap()}else if(e.code==='Digit0'){toggleView()}else if(e.code==='KeyP')pause();
});
window.addEventListener('pagehide',()=>{persist();void community.flushSave({keepalive:true});});document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();messenger.suspend();player?.setActive(false)}});
function runVisualTestRoute(){
 if(!visualTest.enabled||!renderer)return;
 // Read-only diagnostics exist solely inside the explicit localhost QA route.
 window.__visualSession=()=>({mode,zone:world.zone,jumping:player.airborne,elapsed:state.elapsed,playElapsed:actualPlaySeconds(state),penalty:state.penalty,finished:state.finished,completed:[...state.completed],floor:state.floor,resting:rest.isOpen(),position:{...player.position},departureRecord:state.departureRecord?{...state.departureRecord}:null,schoolMinutes:schoolMinutes(state),departureMinutes:schoolMinutes(departureState(state))});
 window.__visualEnvironment=()=>{
  const textures=new Set(),patches=[];
  scene.traverse(node=>{if(node.name==='window-sun-patch')patches.push(node);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)for(const key of ['map','normalMap','roughnessMap','alphaMap','emissiveMap'])if(material[key])textures.add(material[key]);});
  return {shadows:renderer.shadowMap.enabled,toneMapping:renderer.toneMapping,colorSpace:renderer.outputColorSpace,sunPatches:patches.length,visibleSunPatches:patches.filter(p=>p.visible).length,textures:[...textures].map(t=>({name:t.name,width:t.image?.width||0,height:t.image?.height||0}))};
 };
 if(!visualTest.mission&&visualTest.scene==='home')return;
 state=freshState('화면확인 선생님');state.settings.relaxed=true;state.settings.quality=visualTest.quality;
 if(visualTest.mission){
  const mission=MISSIONS.find(item=>item.id===visualTest.mission);
  state.floor=mission.floor;
  if(mission.id===10)state.completed=Array.from({length:9},(_,index)=>index+1);
  start(false);jumpToMission(mission.id);clearTimeout(toastTimer);$('#toast').classList.remove('show');
  renderWorld();openMission(mission.id);
 }else{
  start(false);
  if(['yard','yard-school','faucet','farm','zelkova'].includes(visualTest.scene)){
   state.floor=1;changeFloor(1);enterYard({instant:true,spot:{yard:null,'yard-school':'overview',faucet:'faucet',farm:'farm',zelkova:'zelkova'}[visualTest.scene]});
   world.playground.setTrees(withVisualTrees([]));world.playground.setNotes(VISUAL_NOTES.decor,VISUAL_NOTES.palette);
   // Device-only fixture account inside this isolated test browser; never the real server.
   void (async()=>{
    const login=await community.login({nickname:'화면확인 선생님',code:'0000'});yardUI.remember(login.account);
    if(visualTest.scene==='farm')await community.plant('정시퇴근 아메리카노');
    if(visualTest.scene==='zelkova')await community.writeNote('오늘도 아이들 하교시키고 겨우 앉았어요. 다들 4시 40분엔 꼭 퇴근하세요!','mint');
    await yardUI.refresh();updateHUD();
   })().catch(error=>console.warn('visual yard fixture',error)).finally(()=>{window.__visualYardReady=true;});
  }else if(visualTest.scene==='yard-gate'){
   changeFloor(1);player.teleport({x:9,y:0,z:13.5},{lookYaw:-Math.PI/2});
  }else if(['classroom','research','office','copier','exterior','broadcast','window'].includes(visualTest.scene)){
   const view=world.getRoomView(visualTest.scene==='research'?'staff':visualTest.scene);
   if(!view)throw new Error('Missing local visual scene: '+visualTest.scene);
   changeFloor(view.floor);if(view.cameraMode)selectCameraMode(view.cameraMode,{announce:false});player.teleport(view.position,{lookYaw:view.lookYaw});
  }else if(visualTest.scene==='rest'){
   travelToRoom('nurse-room');lieDown(visualTest.bed);
   if(visualTest.posture==='side')document.querySelector('[data-rest-pose="side"]')?.click();
  }else if(visualTest.scene==='ending'||visualTest.scene==='certificate'){
   state.completed=Array.from({length:10},(_,index)=>index+1);state.finished=true;state.elapsed=1110;state.playElapsed=1110;state.penalty=5;
   state.bossDraft='초등학교 5학년이 생물 카드를 놓고 먹이사슬 화살표를 연결하는 웹자료를 만들어 줘. 글씨는 크게, 틀리면 이유를 보여 주고 HTML 파일 하나로 만들어 줘.';
   world.setCompleted(state.completed);beginEnding();
   if(visualTest.scene==='certificate'){camera.position.set(31,15,37);camera.lookAt(8,2,20);renderWorld();showCertificate();}
  }
 }
 if(visualTest.clock!==null&&visualTest.clock!==undefined&&mode!=='home'){
  state.elapsed=Math.max(0,(visualTest.clock-16*60)*60/2);state.playElapsed=state.elapsed;updateClock();
  const sky=daylight(visualTest.clock);goldenAmount=sky.golden;nightAmount=sky.night;
 }
 document.body.dataset.gameMode=mode;
}
// Localhost QA fixtures only: a busy coffee farm and a guestbook past 100 notes.
const VISUAL_TREES=visualTest.enabled?[
 {id:'fixture-mine',name:'정시퇴근 아메리카노',owner:'화면확인',stage:3,stageName:'하얀 꽃',hearts:4,harvests:1,mine:true},
 ...[['라떼는 말이야','믹스커피',4,6,2],['오늘도 버틴다','교무부장',2,1,0],['한 잔의 여유','과학전담',4,9,3],['4시 40분','정보부장',1,0,0],['칼퇴 원두','방송실',3,2,1],['교실 창가','5학년',0,0,0],['쉬는 시간','사서',2,3,0],['결재 완료','행정실',4,2,4],['퇴근 시럽','급식실',1,1,0],['연구실 커피','학년부',3,5,0],['새싹 선생님','신규',1,0,0],['운동회 끝','체육',2,0,1],['방학 D-40','6학년',4,12,2]].map(([name,owner,stage,hearts,harvests],index)=>({id:'fixture-'+index,name,owner,stage,stageName:['씨앗','새싹','묘목','하얀 꽃','빨간 열매'][stage],hearts,harvests,mine:false}))
]:[];
const withVisualTrees=list=>visualTest.enabled?[...list,...VISUAL_TREES.filter(tree=>!tree.mine||!list.some(t=>t.mine))]:list;
const VISUAL_NOTES=Object.freeze({decor:{total:128,hanging:128,lights:true,bigTree:false},palette:Array.from({length:128},(_,index)=>['yellow','pink','mint','sky','white'][(index*7)%5])});
init();
runVisualTestRoute();
