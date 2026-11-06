/** Actual Chromium renders, not the unit-test DOM stub.
 * First run: npm install && npx playwright install --with-deps chromium
 * Run: npm run visual
 * Optional: VISUAL_RENDERER=software npm run visual (explicit Canvas fallback)
 * The game accepts these scene shortcuts only at loopback addresses.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile, stat, access, chmod, readdir, unlink} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {createBrotliDecompress} from 'node:zlib';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir=process.env.VISUAL_OUTPUT?path.resolve(root,process.env.VISUAL_OUTPUT):path.join(root,'screenshots');
const viewports=[{name:'laptop-1366x820',width:1366,height:820},{name:'tablet-1024x768',width:1024,height:768}];
const focus=process.env.VISUAL_FOCUS==='environment';
const extraScenes=[['classroom','교실 칠판·교탁·사물함·창문'],['research','학년 연구실 책상과 생활 소품'],['office','교무실 업무 공간과 가구'],['copier','복사기와 주변 서류·용지'],['exterior','학교 외벽·창틀·입구와 주변 풍경'],['broadcast','방송실 모니터·카메라·방송 장비'],['window','투명 유리창 너머 한국식 아파트와 실제 바깥 공간']];
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const report={scope:focus?'environment-focus':'full',startedAt:new Date().toISOString(),browser:'Chromium',launchArgs:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],renderer:null,preflight:{},scenes:[],errors:[]};
let browser,server;
const fail=(message,details={})=>{report.errors.push({message,...details});console.error(message);};

async function browserOptions(){
  const options={headless:true,args:[...report.launchArgs]};
  if(process.env.VISUAL_CHROMIUM_EXECUTABLE){options.executablePath=process.env.VISUAL_CHROMIUM_EXECUTABLE;report.browserSource='VISUAL_CHROMIUM_EXECUTABLE';return options;}
  try{await access(chromium.executablePath());report.browserSource='Playwright Chromium';return options;}catch{}
  // The standard CDN is unavailable in some managed workspaces. This optional,
  // reputable npm-distributed Chromium is still a real local browser, not a mock.
  if(process.platform!=='linux'||process.arch!=='x64')throw new Error('Chromium missing. Run npx playwright install --with-deps chromium.');
  const entry=fileURLToPath(import.meta.resolve('@sparticuz/chromium'));
  const bin=path.resolve(path.dirname(entry),'../bin'),target=path.join(tmpdir(),'teacher-escape-visual-chromium-153');
  await mkdir(target,{recursive:true});
  const executable=path.join(target,'chromium');
  try{assert((await stat(executable)).size>1000000);}catch{
    await pipeline(createReadStream(path.join(bin,'chromium.br')),createBrotliDecompress(),createWriteStream(executable));await chmod(executable,0o755);
  }
  try{await access(path.join(target,'libGLESv2.so'));}catch{
    const tarPath=path.join(target,'swiftshader.tar');
    await pipeline(createReadStream(path.join(bin,'swiftshader.tar.br')),createBrotliDecompress(),createWriteStream(tarPath));
    await promisify(execFile)('tar',['--no-same-owner','-xf',tarPath,'-C',target]);
  }
  options.executablePath=executable;options.args.push('--no-zygote','--in-process-gpu','--use-gl=angle');
  options.env={...process.env,LD_LIBRARY_PATH:[target,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')};
  report.browserSource='npm @sparticuz/chromium 153.0.0';return options;
}

function listen(port){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});}
async function startServer(){
  server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),filename=path.resolve(root,relative);
      if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      if(!(await stat(filename)).isFile()){res.writeHead(404);res.end();return;}
      const data=await readFile(filename);res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  try{await listen(Number(process.env.VISUAL_PORT)||8765);}catch(error){if(error.code!=='EADDRINUSE')throw error;await listen(0);}
  return `http://127.0.0.1:${server.address().port}`;
}

async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function canvasStats(page){
  // Observe actual contexts as the application creates them. Read WebGL during
  // requestAnimationFrame, after the game's draw, before compositing clears it.
  return page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
    const rows=[];
    for(const canvas of document.querySelectorAll('canvas')){
      const rect=canvas.getBoundingClientRect(),style=getComputedStyle(canvas);
      if(!canvas.width||!canvas.height||rect.width<16||rect.height<16||style.display==='none'||style.visibility==='hidden'||canvas.closest('[hidden]'))continue;
      const entry=window.__visualCanvasContexts.get(canvas);if(!entry)continue;
      let pixels;
      try{
        if(entry.type==='2d')pixels=entry.context.getImageData(0,0,canvas.width,canvas.height).data;
        else if(entry.type==='webgl'||entry.type==='webgl2'||entry.type==='experimental-webgl'){
          const gl=entry.context;pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
          gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        }else continue;
        let min=255,max=0,count=0,sum=0,square=0;const colors=new Set();
        const stride=Math.max(4,Math.floor(pixels.length/4/12000)*4);
        for(let i=0;i<pixels.length;i+=stride){if(pixels[i+3]===0)continue;const r=pixels[i],g=pixels[i+1],b=pixels[i+2],v=(r+g+b)/3;min=Math.min(min,v);max=Math.max(max,v);sum+=v;square+=v*v;count++;colors.add((r>>3)*1024+(g>>3)*32+(b>>3));}
        rows.push({id:canvas.id||canvas.className||canvas.getAttribute('aria-label')||'canvas',type:entry.type,width:canvas.width,height:canvas.height,samples:count,colors:colors.size,range:max-min,stddev:count?Math.sqrt(Math.max(0,square/count-(sum/count)**2)):0});
      }catch(error){rows.push({id:canvas.id,error:String(error)});}
    }
    resolve(rows);
  })));
}
async function capture(page,viewport,name,description){
  await settle(page);
  const stats=await canvasStats(page);
  const isBriefing=name.endsWith('-briefing');
  if(!isBriefing)assert(stats.length,`${name}: no rendered canvas was found`);
  // Transparent effect layers may be empty, but the main 3D scene must never be.
  const main=stats.find(row=>row.id==='world');
  if(!name.startsWith('mission-'))assert(main&&!main.error,`${name}: world canvas could not be inspected: ${JSON.stringify(main)}`);
  for(const layer of stats){
    assert(!layer.error,`${name}: canvas read failed: ${JSON.stringify(layer)}`);
    assert(layer.samples>0&&layer.colors>8&&layer.stddev>2,`${name}: visible canvas is blank or a single colour: ${JSON.stringify(layer)}`);
  }
  const filename=path.join(outDir,viewport.name,`${name}.png`);
  await page.screenshot({path:filename,animations:'disabled'});
  const png=PNG.sync.read(await readFile(filename));
  assert.equal(png.width,viewport.width);assert.equal(png.height,viewport.height);
  const layout=await page.evaluate(()=>({
    horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
    wordBreak:getComputedStyle(document.body).wordBreak,
    renderer:document.body.dataset.renderer||'unreported',
    heading:[...document.querySelectorAll('h1,h2')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>e.textContent.trim()),
    visibleButtons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>({text:(e.innerText||e.getAttribute('aria-label')||'').trim(),x:Math.round(e.getBoundingClientRect().x),y:Math.round(e.getBoundingClientRect().y),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)}))
  }));
  assert(!layout.horizontalOverflow,`${name}: horizontal document overflow`);
  const environment=await page.evaluate(()=>window.__visualEnvironment?.()||null);
  if(environment&&!name.startsWith('mission-')){
    assert(environment.textures.every(t=>t.width<=1024&&t.height<=1024),`${name}: texture exceeds 1024px: ${JSON.stringify(environment.textures.filter(t=>t.width>1024||t.height>1024))}`);
    if(name==='07-low-quality'){assert.equal(environment.shadows,false,'Low quality must disable actual renderer shadows');assert.equal(environment.visibleSunPatches,0,'Low quality must hide window sunlight patches');}
    if(name==='window-night')assert.equal(environment.visibleSunPatches,0,'Night must hide window sunlight patches');
  }
  report.scenes.push({viewport:viewport.name,name,description,path:path.relative(root,filename),canvas:stats,layout,environment});
  console.log(`✓ ${viewport.name}/${name} (${layout.renderer}; ${main?.colors??stats[0]?.colors??'DOM briefing'} canvas colours)`);
}
async function go(page,base,query=''){
  await page.goto(`${base}/?test=1${report.renderer==='software'?'&renderer=software':''}${query}`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.dataset.renderer==='webgl'||document.body.dataset.renderer==='software');
  await settle(page);
}
async function runViewport(base,viewport){
  await mkdir(path.join(outDir,viewport.name),{recursive:true});
  for(const name of await readdir(path.join(outDir,viewport.name)))if(name.endsWith('.png'))await unlink(path.join(outDir,viewport.name,name));
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,acceptDownloads:true});
  await context.addInitScript(()=>{
    window.__visualCanvasContexts=new Map();
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){const result=original.call(this,type,...args);if(result&&!window.__visualCanvasContexts.has(this))window.__visualCanvasContexts.set(this,{type,context:result});return result;};
  });
  const page=await context.newPage();
  page.on('console',message=>{if(message.type()==='error')fail(`Console error: ${message.text()}`,{viewport:viewport.name,url:page.url()});});
  page.on('pageerror',error=>fail(`Page error: ${error.message}`,{viewport:viewport.name,url:page.url()}));
  try{
    if(!focus){
    await go(page,base);await capture(page,viewport,'01-home','시작 화면과 학교 전경');
    await page.locator('#start').click();await page.locator('#teacher-name').fill('화면검사 선생님');
    await page.locator('.character-choice').filter({has:page.locator('input[value="sunny"]')}).click();
    assert(await page.locator('.character-choice input[value="sunny"]').isChecked(),'selected character radio did not update');
    await capture(page,viewport,'02-check-in','닉네임 입력과 여섯 캐릭터 선택');
    await page.locator('#confirm-start').click();await page.locator('#begin-walking').click();
    await capture(page,viewport,'03-first-floor','1층 허브의 플레이어와 가까운 3인칭 시점');
    await page.keyboard.down('w');await page.waitForTimeout(2000);await page.keyboard.up('w');
    await capture(page,viewport,'04-walk','W로 2초 이동한 뒤의 건물·플레이어·HUD');
    await page.locator('#view-button').click();assert.equal(await page.locator('#view-button').innerText(),'시점 · 내려다보기');
    await capture(page,viewport,'05-overview','내려다보기 전환 뒤 학교 구조와 플레이어');
    await page.locator('#view-button').click();assert.equal(await page.locator('#view-button').innerText(),'시점 · 1인칭');
    await capture(page,viewport,'06-first-person','1인칭 전환 뒤 복도와 HUD');
    await page.locator('#view-button').click();assert.equal(await page.locator('#view-button').innerText(),'시점 · 어깨높이');
    await page.locator('#pause-button').click();await page.locator('#quality').selectOption('low');
    await page.getByRole('button',{name:'다시 걸어가기 ↗',exact:true}).click();
    await capture(page,viewport,'07-low-quality','실제 설정 메뉴에서 저 품질로 바꾼 복도');
    for(let mission=1;mission<=10;mission++){
      await go(page,base,`&mission=${mission}`);
      const begin=page.locator('.arcade-begin');await begin.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('.arcade-begin')?.disabled);
      const number=String(mission).padStart(2,'0');
      await capture(page,viewport,`mission-${number}-briefing`,`미션 ${mission} 설명·완료 조건·시작 버튼`);
      await begin.click();await page.waitForTimeout(3000);
      await capture(page,viewport,`mission-${number}-play`,`미션 ${mission} 실제 플레이 3초 뒤`);
    }
    }
    for(const posture of ['back','side']){
      await go(page,base,`&scene=rest&bed=4&posture=${posture}`);
      await page.waitForTimeout(900);
      await capture(page,viewport,`rest-${posture}`,`보건실 ${posture==='back'?'바로':'옆으로'} 눕기·침대·화분·호수`);
      if(posture==='back'){
        // Use the real drag control: a half-turn is independent of slow software-GPU FPS.
        await page.mouse.move(viewport.width*.5,viewport.height*.38);await page.mouse.down();await page.mouse.move(viewport.width*.5-Math.PI/.005,viewport.height*.38,{steps:12});await page.mouse.up();await page.waitForTimeout(1200);
        await capture(page,viewport,'rest-reverse','누운 채 반대쪽으로 돌아본 머리·목·어깨 연결');
        await page.locator('.rest-room-reset-view').click();await page.locator('[data-rest-view]').click();await page.waitForTimeout(1200);
        await capture(page,viewport,'rest-eyes','베개 눈높이에서 본 보건실 천장·창문·옆 침대');
      }
    }
    for(const [scene,description] of extraScenes){await go(page,base,`&scene=${scene}`);if(scene==='copier'){await page.mouse.move(viewport.width*.5,viewport.height*.42);await page.mouse.down();await page.mouse.move(viewport.width*.5,viewport.height*.55,{steps:5});await page.mouse.up();}await capture(page,viewport,`room-${scene}`,description);}
    for(const scene of ['window','exterior']){
      await go(page,base,`&scene=${scene}&clock=17:40`);await page.waitForTimeout(900);
      await capture(page,viewport,`${scene}-night`,scene==='window'?'밤의 실제 창밖 아파트와 밝게 유지된 실내':'밤의 아파트·운동장·달·가로등');
    }
    for(const angle of ['front','quarter']){
      await page.goto(`${base}/tests/character-visual-fixture.html?test=1&view=${angle}${report.renderer==='software'?'&renderer=software':''}`,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
      await capture(page,viewport,`characters-${angle}`,angle==='front'?'여섯 실제 3D 캐릭터 정면: 눈과 앞머리 확인':'여섯 실제 3D 캐릭터 45°: 얼굴·귀·목·옆머리 확인');
    }
    if(!focus){
    await go(page,base,'&scene=ending');await page.waitForTimeout(800);
    await capture(page,viewport,'ending','실제 퇴근 엔딩 장면');
    await go(page,base,'&scene=certificate');await page.getByRole('heading',{name:'퇴근 증명서',exact:true}).waitFor();
    const certificateHeading=await page.getByRole('heading',{name:'퇴근 증명서',exact:true}).boundingBox();
    assert(certificateHeading&&certificateHeading.y>=0&&certificateHeading.y+certificateHeading.height<=viewport.height,'certificate heading is scrolled out of the viewport');
    await capture(page,viewport,'certificate','퇴근 증명서의 닉네임·퇴근 시각·야근 시간');
    const download=page.waitForEvent('download');await page.locator('#download-certificate').click();
    const downloaded=await download;await downloaded.saveAs(path.join(outDir,viewport.name,'certificate-export.png'));
    const certificatePng=PNG.sync.read(await readFile(path.join(outDir,viewport.name,'certificate-export.png')));
    assert(certificatePng.width>100&&certificatePng.height>100,'certificate export is empty');
    const exportColours=new Set();for(let i=0;i<certificatePng.data.length;i+=400){const d=certificatePng.data;exportColours.add((d[i]>>3)*1024+(d[i+1]>>3)*32+(d[i+2]>>3));}
    assert(exportColours.size>8,'certificate PNG is a blank or single-colour image');
    report.scenes.push({viewport:viewport.name,name:'certificate-export',description:'실제 저장 버튼으로 내려받은 퇴근 증명서 PNG',path:`screenshots/${viewport.name}/certificate-export.png`,width:certificatePng.width,height:certificatePng.height});
    }
  }catch(error){fail(`${viewport.name}: ${error.stack||error}`);await page.screenshot({path:path.join(outDir,viewport.name,'FAILURE.png')}).catch(()=>{});}
  finally{await context.close().catch(()=>{});}
}

try{
  await mkdir(outDir,{recursive:true});const base=await startServer();
  browser=await chromium.launch(await browserOptions());report.browserVersion=browser.version();
  const probe=await browser.newPage();
  report.preflight=await probe.evaluate(()=>{const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return {webgl:!!gl,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};});
  // Keep the probe tab alive: serverless Chromium exits when its last tab closes.
  report.renderer=process.env.VISUAL_RENDERER==='software'||!report.preflight.webgl?'software':'webgl';
  console.log(`Actual Chromium visual check: ${report.renderer}; ${report.preflight.renderer||'WebGL unavailable, explicit Canvas fallback'}`);
  for(const viewport of viewports)await runViewport(base,viewport);
}catch(error){fail(`Browser visual check could not finish: ${error.stack||error}`);}
finally{
  await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));
  report.finishedAt=new Date().toISOString();report.expectedCaptures=viewports.length*((focus?8:38)+extraScenes.length);report.passed=report.errors.length===0&&report.scenes.length===report.expectedCaptures;
  await mkdir(outDir,{recursive:true});await writeFile(path.join(outDir,'visual-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Visual check ${report.passed?'PASS':'FAIL'}: ${report.scenes.length} captures, ${report.errors.length} errors. See screenshots/visual-report.json.`);
  if(!report.passed)process.exitCode=1;
}
