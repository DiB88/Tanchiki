(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 416, TILE = 16, COLS = 26, ROWS = 26;
const $ = id => document.getElementById(id);
const ui = {level:$('level'), enemies:$('enemies'), lives:$('lives'), overlay:$('overlay'), title:$('overlayTitle'), text:$('overlayText'), start:$('startBtn')};
let map=[], player, enemies=[], bullets=[], particles=[], pickups=[], keys={}, touchDir=null, firing=false;
let running=false, paused=false, level=1, lives=3, score=0, remaining=20, spawnTimer=0, last=0, sound=true, audioCtx=null, frame=0, baseAlive=true;
const DIR={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
const COLORS={grass:'#42633c',brick:'#a65b36',steel:'#89979a',water:'#315b79',ice:'#8bb8bd',base:'#d8bd72'};
function tone(freq=220,duration=.07,type='square',vol=.035){if(!sound)return;try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=vol;g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch(e){}}
function rand(n){return Math.floor(Math.random()*n)}
function tile(x,y){return map[y]?.[x]??1}
function setTile(x,y,v){if(map[y]&&map[y][x]!==undefined)map[y][x]=v}
function makeMap(){
 map=Array.from({length:ROWS},()=>Array(COLS).fill(0));
 // Boundary walls
 for(let x=0;x<COLS;x++){map[0][x]=1;map[ROWS-1][x]=1}
 for(let y=0;y<ROWS;y++){map[y][0]=1;map[y][COLS-1]=1}
 // Symmetric, classic battlefield layout
 const blocks=[
 [3,3,2,2,1],[8,3,2,1,1],[16,3,2,2,1],[21,3,2,2,1],
 [5,7,2,2,1],[11,6,1,3,1],[14,6,1,3,1],[19,7,2,2,1],
 [2,12,2,1,1],[7,11,2,2,1],[17,11,2,2,1],[22,12,2,1,1],
 [4,17,2,2,1],[9,16,1,3,1],[16,16,1,3,1],[20,17,2,2,1],
 [7,21,2,1,1],[17,21,2,1,1]
 ];
 blocks.forEach(([x,y,w,h,v])=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setTile(xx,yy,v)});
 // Steel bunkers
 [[2,5],[23,5],[2,19],[23,19],[12,9],[13,9]].forEach(([x,y])=>setTile(x,y,2));
 // Water strips
 for(let x=10;x<16;x++){setTile(x,13,3)}
 // Base compound, clear area
 for(let y=23;y<25;y++)for(let x=11;x<15;x++)setTile(x,y,0);
}
function entity(x,y,dir='up',kind='player'){return {x,y,dir,kind,hp:kind==='heavy'?3:1,cool:0,move:0,flash:0}}
function resetLevel(){
 makeMap();bullets=[];particles=[];pickups=[];enemies=[];
 player=entity(12*16+4,24*16+4,'up','player');player.speed=kindSpeed('player');
 remaining=20+(level-1)*4;spawnTimer=30;baseAlive=true;
 updateUI();
}
function kindSpeed(k){return k==='player'?1.65:k==='fast'?1.35:k==='heavy'?.75:0.85}
function updateUI(){ui.level.textContent=level;ui.enemies.textContent=remaining+enemies.length;ui.lives.textContent=lives}
function startGame(){level=1;lives=3;score=0;resetLevel();running=true;paused=false;ui.overlay.classList.add('hidden');tone(440,.1)}
function showOverlay(title,text,button='ИГРАТЬ СНОВА'){running=false;ui.title.textContent=title;ui.text.textContent=text;ui.start.innerHTML=button+' <span>▶</span>';ui.overlay.classList.remove('hidden')}
function gameOver(){showOverlay('МИССИЯ ПРОВАЛЕНА','Штаб уничтожен. Очки: '+score+' · Попробуй ещё раз.')}
function nextLevel(){level++;resetLevel();tone(660,.16,'triangle')}
function rectHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function blocked(x,y,w=8,h=8,ignore=null){
 if(x<16||y<16||x+w>W-16||y+h>W-16)return true;
 const x0=Math.floor(x/TILE),x1=Math.floor((x+w-1)/TILE),y0=Math.floor(y/TILE),y1=Math.floor((y+h-1)/TILE);
 for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){const t=tile(tx,ty);if(t===1||t===2||t===3)return true}
 const solids=[player,...enemies].filter(e=>e&&e!==ignore&&e.kind!=='dead');
 return solids.some(e=>rectHit({x,y,w,h},{x:e.x+2,y:e.y+2,w:12,h:12}));
}
function aim(e,dir){e.dir=dir}
function shoot(e){
 if(e.cool>0)return;e.cool=e.kind==='player'?22: e.kind==='heavy'?58:45;
 const [dx,dy]=DIR[e.dir];bullets.push({x:e.x+8+dx*8-2,y:e.y+8+dy*8-2,dx,dy,owner:e.kind,life:95,power:e.kind==='heavy'?2:1});
 tone(e.kind==='player'?260:130,.045,'square',.018);
}
function moveEntity(e,dir,dt){
 const [dx,dy]=DIR[dir];e.dir=dir;
 const speed=(e.speed||kindSpeed(e.kind))*dt;
 const nx=e.x+dx*speed,ny=e.y+dy*speed;
 if(!blocked(nx+2,ny+2,12,12,e)){e.x=nx;e.y=ny}
}
function playerUpdate(dt){
 if(!player)return;
 player.cool=Math.max(0,player.cool-dt);player.flash=Math.max(0,player.flash-dt);
 let dir=touchDir;
 if(keys.ArrowUp||keys.w||keys.W)dir='up';else if(keys.ArrowDown||keys.s||keys.S)dir='down';else if(keys.ArrowLeft||keys.a||keys.A)dir='left';else if(keys.ArrowRight||keys.d||keys.D)dir='right';
 if(dir)moveEntity(player,dir,dt);
 if(keys[' ']||firing)shoot(player);
}
function spawnEnemy(){
 if(remaining<=0||enemies.length>=4)return;
 const spots=[[1,1],[12,1],[23,1]];
 for(let i=0;i<spots.length;i++){const [tx,ty]=spots[(rand(3)+i)%3],x=tx*16+4,y=ty*16+4;
 if(![player,...enemies].some(e=>Math.hypot(e.x-x,e.y-y)<35)){const r=Math.random();const kind=r<.2?'fast':r<.36?'heavy':'enemy';const e=entity(x,y,'down',kind);e.speed=kindSpeed(kind);e.cool=rand(45);enemies.push(e);remaining--;break}}
}
function enemyUpdate(dt){
 spawnTimer-=dt;if(spawnTimer<=0){spawnEnemy();spawnTimer=105}
 enemies.forEach(e=>{
  e.cool=Math.max(0,e.cool-dt);e.move-=dt;
  if(e.move<=0){let dirs=['up','down','left','right'];if(Math.random()<.5){const dx=player.x-e.x,dy=player.y-e.y;dirs.sort((a,b)=>{const va=DIR[a][0]*dx+DIR[a][1]*dy,vb=DIR[b][0]*dx+DIR[b][1]*dy;return vb-va})}e.nextDir=dirs[rand(dirs.length)];e.move=25+rand(55)}
  const old={x:e.x,y:e.y};moveEntity(e,e.nextDir||'down',dt);
  if(old.x===e.x&&old.y===e.y&&Math.random()<.1)e.move=0;
  if(Math.random()<.018|| (e.dir==='down'&&Math.abs(e.x-player.x)<40))shoot(e);
 });
}
function explode(x,y,big=false){
 for(let i=0;i<(big?22:10);i++){const a=Math.random()*Math.PI*2,s=.5+Math.random()*2.5;particles.push({x,y,dx:Math.cos(a)*s,dy:Math.sin(a)*s,life:18+rand(15),max:33,size:1+rand(3)})}
 tone(big?85:110,.12,'sawtooth',.025);
}
function damagePlayer(){lives--;explode(player.x+8,player.y+8,true);updateUI();if(lives<=0){gameOver();return}player.x=12*16+4;player.y=24*16+4;player.dir='up';player.flash=90;player.cool=60}
function hitBullet(b){
 // Enemy fire can destroy the headquarters.
 if(b.owner!=='player' && b.x+2>=12*16 && b.x+2<14*16 && b.y+2>=23*16 && b.y+2<25*16){
  baseAlive=false;explode(13*16,24*16,true);gameOver();return true;
 }
 const tx=Math.floor((b.x+2)/16),ty=Math.floor((b.y+2)/16),t=tile(tx,ty);
 if(t===1){setTile(tx,ty,0);explode(tx*16+8,ty*16+8);return true}
 if(t===2){if(b.power>1){setTile(tx,ty,0);explode(tx*16+8,ty*16+8)}return true}
 if(t===3)return true;
 if(b.owner==='player'){
  const target=enemies.find(e=>rectHit({x:b.x,y:b.y,w:4,h:4},{x:e.x+1,y:e.y+1,w:14,h:14}));
  if(target){target.hp-=1;target.flash=7;if(target.hp<=0){enemies=enemies.filter(e=>e!==target);score+=target.kind==='heavy'?300:100;explode(target.x+8,target.y+8,true);if(Math.random()<.12)pickups.push({x:target.x,y:target.y,type:'star'});updateUI()}return true}
 }else if(rectHit({x:b.x,y:b.y,w:4,h:4},{x:player.x+2,y:player.y+2,w:12,h:12})){
  if(player.flash<=0)damagePlayer();return true
 }
 // Bullets destroy each other
 const other=bullets.find(o=>o!==b&&o.owner!==b.owner&&Math.hypot(o.x-b.x,o.y-b.y)<6);if(other){bullets=bullets.filter(o=>o!==other);return true}
 return false;
}
function bulletsUpdate(dt){
 bullets=bullets.filter(b=>{b.x+=b.dx*4.2*dt;b.y+=b.dy*4.2*dt;b.life-=dt;if(b.life<=0||b.x<0||b.y<0||b.x>W||b.y>W)return false;return !hitBullet(b)});
}
function update(dt){
 frame+=dt;playerUpdate(dt);enemyUpdate(dt);bulletsUpdate(dt);
 particles=particles.filter(p=>{p.x+=p.dx*dt;p.y+=p.dy*dt;p.dx*=.94;p.dy*=.94;p.life-=dt;return p.life>0});
 pickups.forEach(p=>{if(rectHit({x:player.x,y:player.y,w:16,h:16},{x:p.x,y:p.y,w:16,h:16})){lives=Math.min(5,lives+1);p.got=true;updateUI();tone(700,.15,'triangle')}});
 pickups=pickups.filter(p=>!p.got);
 if(remaining===0&&enemies.length===0){nextLevel()}
 updateUI();
}
function drawTank(e){
 const x=Math.round(e.x),y=Math.round(e.y);ctx.save();ctx.translate(x+8,y+8);const angle={up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2}[e.dir]||0;ctx.rotate(angle);
 const playerTank=e.kind==='player',heavy=e.kind==='heavy',fast=e.kind==='fast';
 const body=playerTank?'#b7e76a':heavy?'#c58c55':fast?'#d8c56d':'#d7ded0';
 ctx.fillStyle='#27352b';ctx.fillRect(-8,-8,5,16);ctx.fillRect(3,-8,5,16);
 ctx.fillStyle=playerTank?'#536c36':'#56604d';for(let yy=-6;yy<7;yy+=4){ctx.fillRect(-8,yy,5,2);ctx.fillRect(3,yy,5,2)}
 ctx.fillStyle=body;ctx.fillRect(-4,-7,8,14);ctx.fillStyle=playerTank?'#e2ff9c':'#e6e1bd';ctx.fillRect(-3,-4,6,8);
 ctx.fillStyle='#394b31';ctx.fillRect(-2,-10,4,13);ctx.fillRect(-1,-12,2,7);
 ctx.fillStyle='#fff8c7';ctx.fillRect(-1,-11,2,3);
 if(e.flash>0){ctx.fillStyle='#fff';ctx.globalAlpha=.65;ctx.fillRect(-8,-8,16,16)}
 ctx.restore();
}
function drawTile(x,y,t){
 const px=x*16,py=y*16;
 if(t===0)return;
 if(t===1){ctx.fillStyle='#9b5334';ctx.fillRect(px,py,16,16);ctx.fillStyle='#d18150';ctx.fillRect(px+1,py+1,6,5);ctx.fillRect(px+9,py+1,6,5);ctx.fillRect(px+4,py+9,7,5);ctx.fillStyle='#663b2d';ctx.fillRect(px+7,py+6,2,3);ctx.fillRect(px,py+7,16,1)}
 if(t===2){ctx.fillStyle='#77888a';ctx.fillRect(px,py,16,16);ctx.fillStyle='#b3c0b9';ctx.fillRect(px+2,py+2,12,12);ctx.fillStyle='#657678';ctx.fillRect(px+4,py+4,8,8);ctx.fillStyle='#d1d8ca';ctx.fillRect(px+2,py+2,3,3)}
 if(t===3){ctx.fillStyle='#315c7b';ctx.fillRect(px,py,16,16);ctx.strokeStyle='#6d9eb4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,py+5);ctx.lineTo(px+6,py+3);ctx.lineTo(px+12,py+5);ctx.lineTo(px+16,py+4);ctx.stroke()}
}
function draw(){
 ctx.fillStyle='#17251a';ctx.fillRect(0,0,W,W);
 // subtle ground texture
 for(let y=1;y<25;y++)for(let x=1;x<25;x++){if((x*7+y*11)%19===0){ctx.fillStyle='#263c27';ctx.fillRect(x*16+5,y*16+8,2,2)}}
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)drawTile(x,y,tile(x,y));
 // HQ eagle and protective brick
 ctx.fillStyle='#b49c60';ctx.fillRect(12*16,23*16,32,32);ctx.fillStyle='#e0ca84';ctx.fillRect(12*16+5,23*16+5,22,22);
 ctx.fillStyle='#6e5937';ctx.font='bold 20px monospace';ctx.fillText('★',12*16+7,23*16+22);
 // grass patches overlay
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(tile(x,y)===4){ctx.fillStyle='#42633c';ctx.fillRect(x*16,y*16,16,16)}
 enemies.forEach(drawTank);if(player&&player.flash%10<6)drawTank(player);
 bullets.forEach(b=>{ctx.fillStyle=b.owner==='player'?'#fff1a1':'#ff775e';ctx.fillRect(Math.round(b.x),Math.round(b.y),4,4);ctx.fillStyle='#fff';ctx.fillRect(Math.round(b.x)+1,Math.round(b.y)+1,2,2)});
 particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.life>15?'#f5c76b':'#d75b39';ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1});
 pickups.forEach(p=>{ctx.fillStyle='#ffe477';ctx.fillRect(p.x+3,p.y+3,10,10);ctx.fillStyle='#fff';ctx.font='12px monospace';ctx.fillText('★',p.x+3,p.y+13)});
 // tiny scanline texture
 ctx.fillStyle='#000';ctx.globalAlpha=.07;for(let y=0;y<W;y+=4)ctx.fillRect(0,y,W,1);ctx.globalAlpha=1;
}
function loop(ts){const dt=Math.min(2.2,(ts-last)/16.67||1);last=ts;if(running&&!paused)update(dt);draw();requestAnimationFrame(loop)}
$('startBtn').addEventListener('click',()=>{if(running&&paused){paused=false;ui.overlay.classList.add('hidden')}else if(!running)startGame()});
$('pauseBtn').addEventListener('click',()=>{if(!running)return;paused=!paused;if(paused){ui.title.textContent='ПАУЗА';ui.text.textContent='Нажми продолжить, чтобы вернуться в бой.';ui.start.innerHTML='ПРОДОЛЖИТЬ <span>▶</span>';ui.overlay.classList.remove('hidden')}else ui.overlay.classList.add('hidden')});
$('soundBtn').addEventListener('click',e=>{sound=!sound;e.currentTarget.textContent=sound?'ВКЛ':'ВЫКЛ'});
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[e.key]=true;if(e.key==='Escape'&&running){paused=!paused;ui.overlay.classList.toggle('hidden',!paused);ui.title.textContent='ПАУЗА';ui.text.textContent='Игра приостановлена.';ui.start.innerHTML='ПРОДОЛЖИТЬ <span>▶</span>'}},{passive:false});
window.addEventListener('keyup',e=>{keys[e.key]=false});
function bindHold(el,onDown,onUp){el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('active');el.setPointerCapture?.(e.pointerId);onDown()});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>el.addEventListener(ev,e=>{el.classList.remove('active');onUp()}))}
document.querySelectorAll('[data-dir]').forEach(btn=>bindHold(btn,()=>touchDir=btn.dataset.dir,()=>{if(touchDir===btn.dataset.dir)touchDir=null}));
bindHold($('fireBtn'),()=>firing=true,()=>firing=false);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused){paused=true;ui.title.textContent='ПАУЗА';ui.text.textContent='Игра остановлена, пока вкладка была неактивна.';ui.start.innerHTML='ПРОДОЛЖИТЬ <span>▶</span>';ui.overlay.classList.remove('hidden')}});
resetLevel();showOverlay('ТАНЧИКИ','Защити штаб. Уничтожь все вражеские танки!');requestAnimationFrame(loop);
})();