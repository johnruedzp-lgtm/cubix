import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const $ = s => document.querySelector(s);
const host = $('#canvasHost');
const palette = {U:0xf5f5f2,D:0xffd928,F:0x1dbb68,B:0x2875e8,R:0xe84444,L:0xff8b32,core:0x11151c};
let scene, camera, renderer, cubeGroup, cubies = [], size = 3, spacing = 1.035, cubieSize = .97;
let busy = false, moveHistory = [], allMoves = 0, startedAt = 0, timerFrame = 0, elapsedBefore = 0, timerRunning = false;
let best = Number(localStorage.getItem('cubix-best-ms') || 0), soundOn = false, audioCtx = null;
let orbit = {down:false,x:0,y:0,rx:-.48,ry:.62}, toastTimeout;
const moveAxes = {
 U:{axis:'y',layer:1,dir:-1}, D:{axis:'y',layer:-1,dir:1},
 R:{axis:'x',layer:1,dir:-1}, L:{axis:'x',layer:-1,dir:1},
 F:{axis:'z',layer:1,dir:-1}, B:{axis:'z',layer:-1,dir:1}
};

function init(){
 scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d1420);
 camera = new THREE.PerspectiveCamera(37,1,.1,100); camera.position.set(5.7,5.1,7.2);
 renderer = new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15; host.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xc4ddff,0x273040,2.1));
 const key = new THREE.DirectionalLight(0xffffff,3.2); key.position.set(5,8,7); scene.add(key);
 const rim = new THREE.DirectionalLight(0x78c9ff,2.3); rim.position.set(-5,3,-6); scene.add(rim);
 const fill = new THREE.PointLight(0xc9f36b,12,20); fill.position.set(-4,1,4); scene.add(fill);
 cubeGroup = new THREE.Group(); scene.add(cubeGroup);
 makeCube(size); resize(); window.addEventListener('resize',resize); bindOrbit(); animate();
}

function materialFor(hex, rough=.28){ return new THREE.MeshStandardMaterial({color:hex,roughness:rough,metalness:.04}); }
function makeCubie(x,y,z){
 const geometry = new THREE.BoxGeometry(cubieSize,cubieSize,cubieSize);
 const mats = [
  materialFor(x===size-1?palette.R:palette.core), materialFor(x===0?palette.L:palette.core),
  materialFor(y===size-1?palette.U:palette.core), materialFor(y===0?palette.D:palette.core),
  materialFor(z===size-1?palette.F:palette.core), materialFor(z===0?palette.B:palette.core)
 ];
 // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
 const mesh = new THREE.Mesh(geometry,mats); mesh.position.set((x-(size-1)/2)*spacing,(y-(size-1)/2)*spacing,(z-(size-1)/2)*spacing);
 mesh.userData.coord={x,y,z}; mesh.userData.home={x,y,z}; mesh.castShadow=true; mesh.receiveShadow=true;
 // Rounded-looking bevel made from a dark edge shell plus face stickers.
 const edges = new THREE.EdgesGeometry(geometry,25);
 const outline = new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0x05070b,transparent:true,opacity:.85}));
 mesh.add(outline);
 return mesh;
}
function makeCube(n){
 size=n; cubies=[]; while(cubeGroup.children.length) { const o=cubeGroup.children[0]; cubeGroup.remove(o); if(o.geometry)o.geometry.dispose(); }
 for(let x=0;x<n;x++)for(let y=0;y<n;y++)for(let z=0;z<n;z++){const c=makeCubie(x,y,z);cubies.push(c);cubeGroup.add(c);}
 $('#puzzleLabel').textContent=`${n} × ${n} × ${n}`;
 document.querySelectorAll('[data-size]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.size)===n));
 orbit.rx=-.48;orbit.ry=.62; cubeGroup.rotation.set(orbit.rx,orbit.ry,0);
 camera.position.set(5.7+n*.35,5.1+n*.3,7.2+n*.35); camera.lookAt(0,0,0);
 updateSolved(); resize();
}
function resize(){if(!renderer)return; const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera);}
function bindOrbit(){
 const el=renderer.domElement;
 el.addEventListener('pointerdown',e=>{if(busy)return;orbit.down=true;orbit.x=e.clientX;orbit.y=e.clientY;el.setPointerCapture(e.pointerId);});
 el.addEventListener('pointermove',e=>{if(!orbit.down)return;const dx=e.clientX-orbit.x,dy=e.clientY-orbit.y;orbit.x=e.clientX;orbit.y=e.clientY;orbit.ry+=dx*.008;orbit.rx=Math.max(-1.25,Math.min(1.25,orbit.rx+dy*.008));cubeGroup.rotation.set(orbit.rx,orbit.ry,0);});
 el.addEventListener('pointerup',()=>orbit.down=false);el.addEventListener('pointercancel',()=>orbit.down=false);
 el.addEventListener('wheel',e=>{e.preventDefault();const factor=e.deltaY>0?1.08:.92;camera.position.multiplyScalar(factor);const len=camera.position.length();if(len<4)camera.position.setLength(4);if(len>14)camera.position.setLength(14);},{passive:false});
}
function playTone(freq=440,duration=.045){if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}}
function turnFace(notation,record=true){
 if(busy)return;
 const face=notation[0];if(!moveAxes[face])return;
 const inverse=notation.includes("'"), spec=moveAxes[face], axis=spec.axis, layer=spec.layer===1?size-1:0, dir=spec.dir*(inverse?-1:1);
 // Outer layer for the chosen face, works with any cube size.
 const selected=cubies.filter(c=>Math.round(c.position[axis]/spacing+(size-1)/2)===layer);
 if(!selected.length)return;
 busy=true; $('#stateLabel').textContent='TURNING…';
 const pivot=new THREE.Group();cubeGroup.add(pivot);
 selected.forEach(c=>{cubeGroup.remove(c);pivot.add(c);});
 const angle=dir*Math.PI/2, start=performance.now(), duration=155;
 function step(now){const t=Math.min(1,(now-start)/duration);pivot.rotation[axis]=angle*(t*t*(3-2*t));if(t<1){requestAnimationFrame(step);return;}
  pivot.updateMatrixWorld(true);
  const moved=[...pivot.children];
  moved.forEach(c=>{c.applyMatrix4(pivot.matrix);c.position.set(Math.round(c.position.x/spacing)*spacing,Math.round(c.position.y/spacing)*spacing,Math.round(c.position.z/spacing)*spacing);c.position.x=Math.abs(c.position.x)<.01?0:c.position.x;c.position.y=Math.abs(c.position.y)<.01?0:c.position.y;c.position.z=Math.abs(c.position.z)<.01?0:c.position.z;c.quaternion.normalize();cubeGroup.add(c);});
  cubeGroup.remove(pivot);moved.forEach(c=>{const p=c.position;c.userData.coord={x:Math.round(p.x/spacing+(size-1)/2),y:Math.round(p.y/spacing+(size-1)/2),z:Math.round(p.z/spacing+(size-1)/2)};});
  busy=false;if(record){moveHistory.push(notation);allMoves++;addHistory(notation);$('#lastMove').textContent=notation;$('#moveCount').textContent=String(allMoves).padStart(3,'0');$('#sessionMoves').textContent=`${allMoves} MOVES`;$('#undoBtn').disabled=moveHistory.length===0;if(!timerRunning)startTimer();}playTone(220+Math.random()*220);updateSolved();$('#stateLabel').textContent='READY TO PLAY';
 }
 requestAnimationFrame(step);
}
function addHistory(m){const box=$('#historyBox');const empty=box.querySelector('.history-empty');if(empty)empty.remove();const chip=document.createElement('span');chip.className='history-chip';chip.textContent=m;box.appendChild(chip);box.scrollTop=box.scrollHeight;}
function inverseMove(m){return m.endsWith("'")?m[0]:m+"'";}
function clearHistory(){moveHistory=[];$('#historyBox').innerHTML='<span class="history-empty">Your turns will appear here.</span>';$('#undoBtn').disabled=true;}
function scramble(){
 if(busy)return; resetTimer();clearHistory();allMoves=0;$('#moveCount').textContent='000';$('#sessionMoves').textContent='0 MOVES';$('#lastMove').textContent='—';
 const faces=Object.keys(moveAxes);let seq=[],last='';
 for(let i=0;i<(size===2?14:size===3?23:size===4?35:45);i++){let f;do{f=faces[Math.floor(Math.random()*faces.length)];}while(f===last);last=f;seq.push(f+(Math.random()<.5?"'":''));}
 runSequence(seq,0,()=>{moveHistory=[];allMoves=0;$('#moveCount').textContent='000';$('#sessionMoves').textContent='0 MOVES';$('#lastMove').textContent='SCR';$('#stateLabel').textContent='SCRAMBLED';$('#solvedStatus').textContent='SCRAMBLED';startTimer();});
}
function runSequence(seq,index,done){if(index>=seq.length){done?.();return;}const wait=()=>{if(!busy){turnFace(seq[index],false);const check=()=>{if(!busy)runSequence(seq,index+1,done);else requestAnimationFrame(check);};check();}else requestAnimationFrame(wait);};wait();}
function undo(){if(busy||!moveHistory.length)return;const last=moveHistory.pop();const inv=inverseMove(last);const chips=$('#historyBox').querySelectorAll('.history-chip');chips[chips.length-1]?.remove();turnFace(inv,false);const poll=()=>{if(busy){requestAnimationFrame(poll);return;}allMoves=Math.max(0,allMoves-1);$('#moveCount').textContent=String(allMoves).padStart(3,'0');$('#sessionMoves').textContent=`${allMoves} MOVES`;$('#lastMove').textContent=inv;$('#undoBtn').disabled=!moveHistory.length;updateSolved();};poll();}
function solve(){if(busy)return;if(!moveHistory.length){showToast('No recorded moves to reverse.');return;}const seq=moveHistory.slice().reverse().map(inverseMove);clearHistory();$('#stateLabel').textContent='SOLVING…';runSequence(seq,0,()=>{allMoves=0;$('#moveCount').textContent='000';$('#sessionMoves').textContent='0 MOVES';$('#lastMove').textContent='SOLVED';$('#stateLabel').textContent='SOLVED';stopTimer(true);updateSolved(true);showToast('Cube restored using move history.');});}
function resetTimer(){cancelAnimationFrame(timerFrame);timerRunning=false;elapsedBefore=0;startedAt=0;$('#timer').innerHTML='00<span>:</span>00<span class="milliseconds">.00</span>';$('#timerState').textContent='STANDBY';}
function startTimer(){if(timerRunning)return;timerRunning=true;startedAt=performance.now();$('#timerState').textContent='RUNNING';tick();}
function tick(){if(!timerRunning)return;const ms=elapsedBefore+performance.now()-startedAt;const cent=Math.floor(ms/10)%100,sec=Math.floor(ms/1000)%60,min=Math.floor(ms/60000);$('#timer').innerHTML=`${String(min).padStart(2,'0')}<span>:</span>${String(sec).padStart(2,'0')}<span class="milliseconds">.${String(cent).padStart(2,'0')}</span>`;timerFrame=requestAnimationFrame(tick);}
function stopTimer(save=false){if(timerRunning){elapsedBefore+=performance.now()-startedAt;timerRunning=false;cancelAnimationFrame(timerFrame);}$('#timerState').textContent='STOPPED';if(save&&elapsedBefore>0&&(!best||elapsedBefore<best)){best=elapsedBefore;localStorage.setItem('cubix-best-ms',String(best));}renderBest();}
function renderBest(){if(!best){$('#bestTime').textContent='BEST —';return;}const s=Math.floor(best/1000),m=Math.floor(s/60);$('#bestTime').textContent=`BEST ${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function updateSolved(force=false){const solved=force||isSolved();$('#solvedStatus').textContent=solved?'SOLVED':'UNSOLVED';if(solved){$('#stateLabel').textContent='SOLVED';stopTimer(true);} }
function isSolved(){// A solved cube has every cubie in its home position and orientation.
 for(const c of cubies){const h=c.userData.home;if(Math.abs(c.position.x-(h.x-(size-1)/2)*spacing)>.08||Math.abs(c.position.y-(h.y-(size-1)/2)*spacing)>.08||Math.abs(c.position.z-(h.z-(size-1)/2)*spacing)>.08)return false;const e=new THREE.Euler().setFromQuaternion(c.quaternion,'XYZ');if(Math.abs(e.x)>.08||Math.abs(e.y)>.08||Math.abs(e.z)>.08)return false;}return true;}
function resetCube(){if(busy)return;resetTimer();makeCube(size);clearHistory();allMoves=0;$('#moveCount').textContent='000';$('#sessionMoves').textContent='0 MOVES';$('#lastMove').textContent='—';$('#stateLabel').textContent='READY TO PLAY';$('#solvedStatus').textContent='SOLVED';showToast('Cube reset. Fresh start.');}
function showToast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),2300);}

document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>turnFace(b.dataset.move)));
document.querySelectorAll('[data-size]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;makeCube(Number(b.dataset.size));resetTimer();clearHistory();allMoves=0;$('#moveCount').textContent='000';$('#sessionMoves').textContent='0 MOVES';$('#lastMove').textContent='—';$('#stateLabel').textContent='READY TO PLAY';}));
$('#scrambleBtn').addEventListener('click',scramble);$('#resetBtn').addEventListener('click',resetCube);$('#undoBtn').addEventListener('click',undo);$('#solveBtn').addEventListener('click',solve);$('#clearHistoryBtn').addEventListener('click',clearHistory);
$('#viewBtn').addEventListener('click',()=>{orbit.rx=-.48;orbit.ry=.62;cubeGroup.rotation.set(orbit.rx,orbit.ry,0);camera.position.set(5.7+size*.35,5.1+size*.3,7.2+size*.35);camera.lookAt(0,0,0);});
$('#soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('#soundLabel').textContent=soundOn?'SOUND ON':'SOUND OFF';$('#soundBtn').style.borderColor=soundOn?'var(--lime)':'';if(soundOn)playTone(660);});
$('#helpBtn').addEventListener('click',()=>$('#helpModal').hidden=false);$('#closeHelp').addEventListener('click',()=>$('#helpModal').hidden=true);$('#helpModal').addEventListener('click',e=>{if(e.target.id==='helpModal')$('#helpModal').hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#helpModal').hidden=true;if(e.target.matches('input,textarea,select'))return;const k=e.key.toUpperCase();if(moveAxes[k])turnFace(k+(e.shiftKey?"'":''));if(e.key===' '&&e.target===document.body){e.preventDefault();scramble();}});
renderBest();init();
