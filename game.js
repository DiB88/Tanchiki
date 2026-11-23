(()=>{'use strict';
const C=document.getElementById('game'),g=C.getContext('2d'),N=26,T=16,S=416;
const $=id=>document.getElementById(id);
const ui={menu:$('menu'),title:$('menuTitle'),desc:$('menuDesc'),buttons:$('menuButtons'),editor:$('editorPanel'),level:$('hudLevel'),enemies:$('hudEnemies'),lives:$('hudLives'),score:$('hudScore')};
const D={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
let map=[],players=[],enemies=[],shots=[],fx=[],items=[],keys={},touch={1:null,2:null},fire={1:false,2:false};
let active=false,paused=false,mode='menu',level=1,lives=[3,3],score=0,left=0,spawnWait=0,last=0,sound=true,audio=null,selectedTile=0,editorMap=null,editorDrawing=false;
const levels=[
 {name:'ПЕРВЫЙ РУБЕЖ',blocks:[[3,3,3,1],[8,3,2,1],[16,3,2,2],[21,3,2,2],[5,7,2,2],[11,6,1,3],[14,6,1,3],[19,7,2,2],[2,12,2,1],[7,11,2,2],[17,11,2,2],[22,12,2,1],[4,17,2,2],[9,16,1,3],[16,16,1,3],[20,17,2,2],[7,20,2,1],[17,20,2,1]],water:[[10,13,6,1]]},
 {name:'СТАЛЬНОЙ КОРИДОР',blocks:[[2,3,4,1],[8,3,1,4],[17,3,1,4],[20,3,4,1],[3,9,3,2],[10,8,1,5],[15,8,1,5],[20,9,3,2],[2,16,4,1],[8,16,1,4],[17,16,1,4],[20,16,4,1],[5,21,4,1],[17,21,4,1]],water:[[12,3,2,3],[12,19,2,3]]},
 {name:'ВОДНЫЙ РУБЕЖ',blocks:[[3,4,2,2],[7,4,2,1],[17,4,2,1],[21,4,2,2],[4,10,3,1],[9,9,1,4],[16,9,1,4],[19,10,3,1],[3,17,2,2],[8,17,2,1],[16,17,2,1],[21,17,2,2]],water:[[10,6,6,2],[10,15,6,2]]},
 {name:'КРЕПОСТЬ',blocks:[[2,3,2,3],[6,3,2,1],[18,3,2,1],[22,3,2,3],[4,9,4,1],[9,8,1,4],[16,8,1,4],[18,9,4,1],[2,16,3,1],[7,15,2,2],[17,15,2,2],[21,16,3,1],[5,21,3,1],[18,21,3,1]],water:[[12,5,2,3],[12,17,2,3]]},
 {name:'ПОСЛЕДНИЙ РУБЕЖ',blocks:[[3,3,2,2],[7,3,1,4],[18,3,1,4],[21,3,2,2],[2,10,4,1],[8,9,2,2],[16,9,2,2],[20,10,4,1],[3,17,2,2],[8,16,1,3],[17,16,1,3],[21,17,2,2]],water:[[11,7,4,2],[11,17,4,2]]}
];
function blank(){let m=Array.from({length:N},()=>Array(N).fill(0));for(let i=0;i<N;i++)m[0][i]=m[N-1][i]=m[i][0]=m[i][N-1]=2;return m}
function putRect(m,x,y,w,h,v){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(xx>0&&xx<N-1&&yy>0&&yy<N-1)m[yy][xx]=v}
function protectBase(m){ // HQ is a real solid tile group, separated from player spawn
 putRect(m,11,23,4,2,0);putRect(m,11,23,4,1,1);m[24][12]=4;m[24][13]=4;
 // opening at the centre of the wall so the HQ is reachable only after wall damage
 m[23][12]=0;m[23][13]=0;
}
function makeLevel(n){let m=blank(),d=levels[(n-1)%levels.length];d.blocks.forEach(a=>putRect(m,...a,1));(d.water||[]).forEach(a=>putRect(m,...a,3));
 // steel anchor points
 [[2,6],[23,6],[2,18],[23,18]].forEach(([x,y])=>m[y][x]=2);
 // keep all spawn lanes and base approach clear
 for(let y=1;y<6;y++)for(let x=1;x<5;x++)m[y][x]=0;
 for(let y=1;y<6;y++)for(let x=11;x<15;x++)m[y][x]=0;
 for(let y=1;y<6;y++)for(let x=21;x<25;x++)m[y][x]=0;
 for(let y=19;y<23;y++)for(let x=10;x<16;x++)m[y][x]=0;
 protectBase(m);return m}
function soundFx(f=220,d=.06,type='square'){if(!sound)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();let o=audio.createOscillator(),a=audio.createGain();o.type=type;o.frequency.value=f;a.gain.value=.025;a.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(a);a.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch(e){}}
function tank(x,y,dir,kind,id){return{x,y,dir,kind,id,hp:kind==='heavy'?3:1,cool:0,flash:0,turn:0,speed:kind==='p1'||kind==='p2'?1.55:kind==='fast'?1.35:kind==='heavy'?.72:.9}}
function init(n=1,two=false,custom=null){level=n;map=custom?custom.map(r=>r.slice()):makeLevel(n);players=[tank(12*T+0,20*T,'up','p1',1)];if(two)players.push(tank(14*T,20*T,'up','p2',2));enemies=[];shots=[];fx=[];items=[];left=two?20:20;spawnWait=25;active=true;paused=false;mode='game';ui.menu.classList.add('hidden');ui.editor.classList.add('hidden');hud();soundFx(500,.1,'triangle')}
function hud(){ui.level.textContent=level+(mode==='editor'?'*':'');ui.enemies.textContent=left+enemies.length;ui.lives.textContent=lives[0]+(players.length>1?'/'+lives[1]:'');ui.score.textContent=score}
function overlay(title,desc,buttons){active=false;paused=false;ui.title.textContent=title;ui.desc.textContent=desc;ui.buttons.innerHTML=buttons;ui.menu.classList.remove('hidden');ui.editor.classList.add('hidden');mode='menu'}
function mainMenu(){overlay('ТАНЧИКИ','Защити штаб. Уничтожь вражеские танки.',`<button data-action="start" class="primary">ИГРАТЬ · 1 ИГРОК ▶</button><button data-action="two">ИГРАТЬ · 2 ИГРОКА</button><button data-action="levels">ВЫБОР УРОВНЯ</button><button data-action="editor">РЕДАКТОР КАРТ</button><button data-action="records">ТАБЛИЦА РЕКОРДОВ</button><button data-action="howto">УПРАВЛЕНИЕ</button>`)}
function levelMenu(){let b=levels.map((l,i)=>`<button data-level="${i+1}">${String(i+1).padStart(2,'0')} · ${l.name}</button>`).join('');overlay('ВЫБОР УРОВНЯ','Выбери поле боя.',b+'<button data-action="home">← ГЛАВНОЕ МЕНЮ</button>')}
function records(){let a=[];try{a=JSON.parse(localStorage.getItem('bc_records')||'[]')}catch(e){}let body=a.length?a.slice(0,8).map((r,i)=>`<button>${i+1}. ${escapeHtml(r.name)} — ${r.score} · УР. ${r.level}</button>`).join(''):'<button>Рекордов пока нет — начни игру!</button>';overlay('РЕКОРДЫ','Лучшие результаты на этом устройстве.',body+'<button data-action="home">← ГЛАВНОЕ МЕНЮ</button>')}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function saveRecord(){let a=[];try{a=JSON.parse(localStorage.getItem('bc_records')||'[]')}catch(e){}a.push({name:players.length>1?'2 ИГРОКА':'ИГРОК',score,level});a.sort((x,y)=>y.score-x.score);try{localStorage.setItem('bc_records',JSON.stringify(a.slice(0,10)))}catch(e){}}
function howto(){overlay('УПРАВЛЕНИЕ','Игрок 1: WASD или стрелки + пробел. Игрок 2: IJKL + Enter. На телефоне — экранные крестовины и кнопки огня. P / Esc — пауза.','<button data-action="home">← НАЗАД</button>')}
function editor(){active=false;mode='editor';editorMap=makeLevel(1);map=editorMap;ui.menu.classList.add('hidden');ui.editor.classList.remove('hidden');draw()}
function startEditorGame(){let m=editorMap.map(r=>r.slice());protectBase(m);init(1,false,{map:m})}
function solidAt(px,py){if(px<0||py<0||px+14>S||py+14>S)return true;let x0=Math.floor(px/T),x1=Math.floor((px+13)/T),y0=Math.floor(py/T),y1=Math.floor((py+13)/T);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){let v=map[y]?.[x]??2;if(v===1||v===2||v===3||v===4)return true}return false}
function overlaps(a,b){return a.x<b.x+14&&a.x+14>b.x&&a.y<b.y+14&&a.y+14>b.y}
function blocked(e,nx,ny){if(solidAt(nx+1,ny+1))return true;for(let p of players)if(p!==e&&overlaps({x:nx,y:ny},p))return true;for(let q of enemies)if(q!==e&&overlaps({x:nx,y:ny},q))return true;return false}
function move(e,dir,dt){if(!dir)return;let [dx,dy]=D[dir],step=e.speed*dt;e.dir=dir;let nx=e.x+dx*step,ny=e.y+dy*step;
 // axis-separated collision allows sliding along walls
 if(!blocked(e,nx,e.y))e.x=nx;if(!blocked(e,e.x,ny))e.y=ny}
function shoot(e){if(e.cool>0)return;e.cool=e.kind==='p1'||e.kind==='p2'?23:e.kind==='heavy'?56:43;let [dx,dy]=D[e.dir];shots.push({x:e.x+7+dx*8-2,y:e.y+7+dy*8-2,dx,dy,owner:e.kind,power:e.kind==='heavy'?2:1,life:90});soundFx(e.kind==='p1'||e.kind==='p2'?270:130,.04)}
function playerStep(p,dt){p.cool=Math.max(0,p.cool-dt);p.flash=Math.max(0,p.flash-dt);let d=touch[p.id];if(p.id===1){if(keys.ArrowUp||keys.w||keys.W)d='up';else if(keys.ArrowDown||keys.s||keys.S)d='down';else if(keys.ArrowLeft||keys.a||keys.A)d='left';else if(keys.ArrowRight||keys.d||keys.D)d='right';if(keys[' '])fire[1]=true}else{if(keys.i||keys.I)d='up';else if(keys.k||keys.K)d='down';else if(keys.j||keys.J)d='left';else if(keys.l||keys.L)d='right';if(keys.Enter)fire[2]=true}
 if(d)move(p,d,dt);if(fire[p.id])shoot(p)}
function spawn(){if(left<=0||enemies.length>=4)return;let spots=[[1,1],[12,1],[23,1]],made=false;for(let i=0;i<3;i++){let [tx,ty]=spots[(Math.random()*3|0+i)%3],x=tx*T,y=ty*T;if(![...players,...enemies].some(e=>Math.hypot(e.x-x,e.y-y)<36)){let r=Math.random(),kind=r<.22?'fast':r<.4?'heavy':'enemy';enemies.push(tank(x,y,'down',kind,0));left--;made=true;break}}if(!made)spawnWait=15}
function enemyStep(dt){spawnWait-=dt;if(spawnWait<=0){spawn();spawnWait=95}for(let e of enemies){e.cool=Math.max(0,e.cool-dt);e.turn-=dt;if(e.turn<=0){let opts=['down','left','right','up'];let dx=players[0].x-e.x,dy=players[0].y-e.y;opts.sort((a,b)=>(D[b][0]*dx+D[b][1]*dy)-(D[a][0]*dx+D[a][1]*dy));e.next=Math.random()<.65?opts[0]:opts[Math.random()*4|0];e.turn=25+Math.random()*45}let ox=e.x,oy=e.y;move(e,e.next,dt);if(ox===e.x&&oy===e.y)e.turn=0;if(Math.random()<.018||e.cool===0&&Math.random()<.008)shoot(e)}}
function burst(x,y,big=false){for(let i=0;i<(big?20:9);i++){let a=Math.random()*6.28,s=.5+Math.random()*2.5;fx.push({x,y,dx:Math.cos(a)*s,dy:Math.sin(a)*s,life:22+Math.random()*12})}soundFx(90,.12,'sawtooth')}
function playerHit(p){lives[p.id-1]--;burst(p.x+7,p.y+7,true);if(lives[p.id-1]<=0){players=players.filter(q=>q!==p);if(!players.length)finish(false);return}p.x=p.id===1?12*T:14*T;p.y=20*T;p.dir='up';p.flash=90;p.cool=60}
function hitShot(b){let tx=Math.floor((b.x+2)/T),ty=Math.floor((b.y+2)/T),v=map[ty]?.[tx]??2;if(v===1){map[ty][tx]=0;burst(tx*T+8,ty*T+8);return true}if(v===2){if(b.power>1){map[ty][tx]=0;burst(tx*T+8,ty*T+8)}return true}if(v===3||v===4)return true;
 if(b.owner==='p1'||b.owner==='p2'){let e=enemies.find(q=>overlaps({x:b.x,y:b.y},q));if(e){e.hp-=b.power;e.flash=6;if(e.hp<=0){enemies=enemies.filter(q=>q!==e);score+=e.kind==='heavy'?300:100;burst(e.x+7,e.y+7,true);if(Math.random()<.1)items.push({x:e.x,y:e.y});hud()}return true}}
 else {let p=players.find(q=>overlaps({x:b.x,y:b.y},q));if(p){if(p.flash<=0)playerHit(p);return true}}
 return false}
function shotsStep(dt){shots=shots.filter(b=>{b.x+=b.dx*4.3*dt;b.y+=b.dy*4.3*dt;b.life-=dt;if(b.life<=0||b.x<0||b.y<0||b.x>S||b.y>S)return false;return !hitShot(b)})}
function update(dt){players.forEach(p=>playerStep(p,dt));enemyStep(dt);shotsStep(dt);fx=fx.filter(p=>{p.x+=p.dx*dt;p.y+=p.dy*dt;p.life-=dt;return p.life>0});for(let it of items){if(players.some(p=>overlaps(p,{x:it.x,y:it.y})))it.got=true}items=items.filter(i=>!i.got);if(left===0&&enemies.length===0){if(level<5){level++;map=makeLevel(level);players.forEach((p,i)=>{p.x=(i?14:12)*T;p.y=20*T;p.dir='up'});left=20;spawnWait=30;shots=[];hud();soundFx(700,.2,'triangle')}else finish(true)}hud()}
function finish(win){saveRecord();overlay(win?'ПОБЕДА!':'ИГРА ОКОНЧЕНА',`Очки: ${score} · Достигнутый уровень: ${level}`,`<button class="primary" data-action="start">ЕЩЁ РАЗ ▶</button><button data-action="records">ТАБЛИЦА РЕКОРДОВ</button><button data-action="home">ГЛАВНОЕ МЕНЮ</button>`)}
function tileDraw(x,y,v){let px=x*T,py=y*T;if(v===0)return;if(v===1){g.fillStyle='#9b5435';g.fillRect(px,py,16,16);g.fillStyle='#d18450';g.fillRect(px+1,py+1,6,5);g.fillRect(px+9,py+1,6,5);g.fillRect(px+4,py+9,7,5);g.fillStyle='#633b2e';g.fillRect(px,py+7,16,1)}else if(v===2){g.fillStyle='#687b7c';g.fillRect(px,py,16,16);g.fillStyle='#b4c1b8';g.fillRect(px+2,py+2,12,12);g.fillStyle='#607173';g.fillRect(px+4,py+4,8,8)}else if(v===3){g.fillStyle='#315d7b';g.fillRect(px,py,16,16);g.strokeStyle='#80aabd';g.beginPath();g.moveTo(px,py+5);g.lineTo(px+7,py+3);g.lineTo(px+16,py+5);g.stroke()}else if(v===4){g.fillStyle='#426d3d';g.fillRect(px,py,16,16);g.fillStyle='#7ba454';g.fillRect(px+3,py+4,3,7);g.fillRect(px+10,py+8,3,6)}else if(v===5){g.fillStyle='#cbb878';g.fillRect(px,py,16,16);g.fillStyle='#6a5839';g.font='13px monospace';g.fillText('★',px+2,py+13)}}
function drawTank(e){g.save();g.translate(Math.round(e.x+7),Math.round(e.y+7));g.rotate(({up:0,right:Math.PI/2,down:Math.PI,left:-Math.PI/2})[e.dir]||0);let player=e.kind==='p1'||e.kind==='p2',color=e.kind==='p1'?'#b9eb6c':e.kind==='p2'?'#70c6ed':e.kind==='heavy'?'#c48c55':e.kind==='fast'?'#d8c66e':'#d9dfcf';g.fillStyle='#27362b';g.fillRect(-7,-7,4,14);g.fillRect(3,-7,4,14);g.fillStyle='#64734f';for(let y=-5;y<7;y+=4){g.fillRect(-7,y,4,2);g.fillRect(3,y,4,2)}g.fillStyle=color;g.fillRect(-3,-6,6,12);g.fillStyle='#e9efc8';g.fillRect(-2,-3,4,6);g.fillStyle='#3a4b32';g.fillRect(-2,-10,4,12);g.fillStyle='#fff4c6';g.fillRect(-1,-10,2,3);if(e.flash>0){g.fillStyle='#fff';g.fillRect(-7,-7,14,14)}g.restore()}
function draw(){g.fillStyle='#17251a';g.fillRect(0,0,S,S);for(let y=1;y<25;y++)for(let x=1;x<25;x++)if((x*7+y*11)%19===0){g.fillStyle='#263c27';g.fillRect(x*T+5,y*T+8,2,2)}for(let y=0;y<N;y++)for(let x=0;x<N;x++)tileDraw(x,y,map[y]?.[x]||0);
 // HQ is at bottom centre, solid tiles, not a player spawn tile
 g.fillStyle='#d4bd79';g.fillRect(12*T,24*T,32,16);g.fillStyle='#6c5939';g.font='bold 17px monospace';g.fillText('★',12*T+7,24*T+14);
 enemies.forEach(drawTank);players.forEach(p=>{if(p.flash%10<6)drawTank(p)});shots.forEach(b=>{g.fillStyle=b.owner==='p1'||b.owner==='p2'?'#fff1a1':'#ff785f';g.fillRect(b.x,b.y,4,4)});fx.forEach(p=>{g.globalAlpha=Math.max(0,p.life/34);g.fillStyle=p.life>15?'#f4c76b':'#d85c39';g.fillRect(p.x,p.y,3,3);g.globalAlpha=1});items.forEach(i=>{g.fillStyle='#ffe477';g.fillRect(i.x+3,i.y+3,10,10);g.fillStyle='#fff';g.font='12px monospace';g.fillText('★',i.x+2,i.y+13)});g.globalAlpha=.07;g.fillStyle='#000';for(let y=0;y<S;y+=4)g.fillRect(0,y,S,1);g.globalAlpha=1}
function loop(t){let dt=Math.min(2.2,(t-last)/16.67||1);last=t;if(active&&!paused)update(dt);draw();requestAnimationFrame(loop)}
function pointerCell(e){let r=C.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*N),y=Math.floor((e.clientY-r.top)/r.height*N);return{x,y}}
function paint(e){if(mode!=='editor')return;let{x,y}=pointerCell(e);if(x<1||x>24||y<1||y>22)return;editorMap[y][x]=selectedTile;map=editorMap;draw()}
C.addEventListener('pointerdown',e=>{if(mode==='editor'){editorDrawing=true;C.setPointerCapture(e.pointerId);paint(e)}});C.addEventListener('pointermove',e=>{if(editorDrawing)paint(e)});C.addEventListener('pointerup',()=>editorDrawing=false);C.addEventListener('pointercancel',()=>editorDrawing=false);
ui.buttons.addEventListener('click',e=>{let b=e.target.closest('button');if(!b)return;let a=b.dataset.action;if(a==='start')init(1,false);if(a==='two')init(1,true);if(a==='levels')levelMenu();if(a==='editor')editor();if(a==='records')records();if(a==='howto')howto();if(a==='home')mainMenu();if(b.dataset.level)init(+b.dataset.level,false)});
$('pause').onclick=()=>{if(!active)return;paused=!paused;if(paused){overlay('ПАУЗА','Игра остановлена.','<button class="primary" data-action="resume">ПРОДОЛЖИТЬ ▶</button><button data-action="home">ГЛАВНОЕ МЕНЮ</button>');active=true;paused=true}else{ui.menu.classList.add('hidden');active=true}};
ui.buttons.addEventListener('click',e=>{if(e.target.closest('[data-action="resume"]')){ui.menu.classList.add('hidden');active=true;paused=false}});
$('editorClose').onclick=mainMenu;$('clearMap').onclick=()=>{editorMap=blank();map=editorMap;draw()};
$('saveMap').onclick=()=>{try{localStorage.setItem('bc_custom_map',JSON.stringify(editorMap));alert('Карта сохранена на этом устройстве.')}catch(e){alert('Не удалось сохранить карту в браузере.')}};
$('playMap').onclick=startEditorGame;
document.querySelectorAll('[data-tile]').forEach(b=>b.onclick=()=>{selectedTile=+b.dataset.tile;document.querySelectorAll('[data-tile]').forEach(x=>x.classList.toggle('selected',x===b))});
function hold(el,down,up){el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('active');el.setPointerCapture(e.pointerId);down()});['pointerup','pointercancel','lostpointercapture'].forEach(k=>el.addEventListener(k,()=>{el.classList.remove('active');up()}))}
document.querySelectorAll('[data-dir]').forEach(b=>hold(b,()=>touch[+b.dataset.player]=b.dataset.dir,()=>{if(touch[+b.dataset.player]===b.dataset.dir)touch[+b.dataset.player]=null}));
hold($('fire1'),()=>fire[1]=true,()=>fire[1]=false);hold($('fire2'),()=>fire[2]=true,()=>fire[2]=false);
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[e.key]=true;if((e.key==='Escape'||e.key==='p'||e.key==='P')&&active){paused=!paused;if(paused){overlay('ПАУЗА','Игра остановлена.','<button class="primary" data-action="resume">ПРОДОЛЖИТЬ ▶</button><button data-action="home">ГЛАВНОЕ МЕНЮ</button>');active=true;paused=true}else ui.menu.classList.add('hidden')}},{passive:false});
window.addEventListener('keyup',e=>{keys[e.key]=false;if(e.key===' ')fire[1]=false;if(e.key==='Enter')fire[2]=false});
$('sound').onclick=e=>{sound=!sound;e.currentTarget.textContent=sound?'ВКЛ':'ВЫКЛ'};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!paused){paused=true;overlay('ПАУЗА','Вкладка была неактивна.','<button class="primary" data-action="resume">ПРОДОЛЖИТЬ ▶</button>');active=true;paused=true}});
try{let saved=JSON.parse(localStorage.getItem('bc_custom_map')||'null');if(saved&&saved.length===N)editorMap=saved}catch(e){}
map=makeLevel(1);mainMenu();hud();requestAnimationFrame(loop);
})();