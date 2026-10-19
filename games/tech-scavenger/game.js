(function () {
  "use strict";

  const CDN = "https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js";
  const $ = (id) => document.getElementById(id);
  const ui = {
    viewport: $("viewport"), loading: $("loading"), start: $("start"), begin: $("begin"), pause: $("pause"), resume: $("resume"), restart: $("restart"),
    error: $("error"), errorMessage: $("error-message"), hud: $("hud"), objective: $("objective"), archiveFill: $("archive-fill"), archiveCount: $("archive-count"),
    signature: $("signature"), scannerNote: $("scanner-note"), signalBars: [...$("signal-bars").children], direction: $("direction").firstElementChild,
    prompt: $("prompt"), holdTrack: $("hold-track"), holdFill: $("hold-fill"), toast: $("toast"), carryLabel: $("carry-label"),
    terminal: $("terminal"), terminalExit: $("terminal-exit"), terminalClock: $("terminal-clock"), terminalProgress: $("terminal-progress"), terminalProgressFill: $("terminal-progress-fill"),
    driveName: $("drive-name"), driveFree: $("drive-free"), fileGrid: $("file-grid"), archiveDock: $("archive-dock"), installDock: $("install-dock"),
    fileWindow: $("file-window"), windowTitle: $("window-title"), windowContent: $("window-content"), windowClose: $("window-close"),
    ending: $("ending"), elapsed: $("elapsed"), endingRestart: $("ending-restart")
  };

  let THREE, scene, camera, renderer, clock, raycaster, audio;
  let yaw = 0, pitch = 0, toastTimer = 0, scanPulse = 0;
  let pendingMouseX = 0, pendingMouseY = 0, mouseSettleUntil = 0;
  const keys = Object.create(null);
  const interactables = [];
  const colliders = [];
  const devices = [];
  const driveMeshes = {};
  const materials = {};
  const home = { x: 0, z: 0 };
  const state = {
    phase: "loading", startedAt: 0, known: [], selected: -1, carried: null, mounted: null,
    archives: 0, upgrade: false, terminalOpen: false, hold: 0, holdKind: "", holdTarget: null, target: null,
    player: { x: 0, y: 1.68, z: 8 }, files: {}, finished: false
  };

  const drives = {
    drive1: {
      name: "XR-04 / OFFICE NODE", files: [
        { id: "memo", name: "SHIFT_MEMO.TXT", type: "txt", content: "SHIFT LOG // NORTH OFFICE\n\nThe emergency uplink is missing a fragment again. Maintenance says the old survey robots cache anything they hear.\n\nOne unit walked east toward the dish field. Tall chassis. Circular head. Orange service stripe. If it is still standing, its local rack may have a copy." },
        { id: "photo", name: "SURVEY_12.IMG", type: "img" },
        { id: "zip1", name: "ARCHIVE_01.ZIP", type: "zip" },
        { id: "exe", name: "SCANNER_PATCH.EXE", type: "exe" }
      ]
    },
    drive2: {
      name: "SV-19 / SURVEY CACHE", files: [
        { id: "report", name: "LAST_ROUTE.TXT", type: "txt", content: "AUTONOMOUS ROUTE REPORT\n\nBeacon voiceprint accepted. Origin disagrees with registered ship position.\n\nInstruction repeated: COME HOME.\n\nCrew followed the signal into the valley. No further crew telemetry was received." },
        { id: "zip2", name: "ARCHIVE_02.ZIP", type: "zip" },
        { id: "diag", name: "VOICE_MATCH.TXT", type: "txt", content: "VOICEPRINT COMPARISON\n\nEmergency beacon: 99.8% match\nCurrent ship system: 99.8% match\n\nTimestamp delta: 46 years, 12 days\n\nWARNING: Current ship launch record postdates beacon source." }
      ]
    }
  };

  function resetState() {
    state.phase = "ready"; state.startedAt = 0; state.known = []; state.selected = -1; state.carried = null; state.mounted = null;
    state.archives = 0; state.upgrade = false; state.terminalOpen = false; state.hold = 0; state.holdKind = ""; state.holdTarget = null; state.target = null;
    state.player.x = 0; state.player.z = 8; state.files = {}; state.finished = false; yaw = 0; pitch = 0;
    devices.forEach((d) => { d.scanned = false; d.resolved = false; d.driveExtracted = false; if (d.drive) resetDriveMesh(d); });
    closeTerminal(); updateUI();
  }

  async function boot() {
    try {
      if (!window.WebGLRenderingContext) throw new Error("This browser does not expose WebGL.");
      THREE = await import(CDN);
      initScene(); buildWorld(); bindEvents(); animate();
      ui.loading.classList.add("hidden"); ui.start.classList.remove("hidden"); state.phase = "ready";
    } catch (err) {
      console.error(err); ui.loading.classList.add("hidden"); ui.error.classList.remove("hidden"); ui.errorMessage.textContent = err.message || "WebGL or the Three.js CDN could not be reached.";
    }
  }

  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4b5350); scene.fog = new THREE.FogExp2(0x4b5350, 0.025);
    camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 180); camera.rotation.order = "YXZ";
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; ui.viewport.appendChild(renderer.domElement);
    clock = new THREE.Clock(); raycaster = new THREE.Raycaster(); raycaster.far = 5;
    materials.ground = mat(0x303b36, .95, 0); materials.dark = mat(0x18201d, .82, .08); materials.metal = mat(0x53605b, .65, .38);
    materials.blue = mat(0x4f6270, .72, .15); materials.rust = mat(0x775c4f, .8, .1); materials.orange = mat(0xa35635, .68, .12);
    materials.screen = mat(0x8fb4a5, .25, .1, 0x355f51); materials.black = mat(0x0d1110, .9, .05); materials.bone = mat(0xa19f7c, .85, .05);
    scene.add(new THREE.HemisphereLight(0xa0b9ba, 0x170e19, 1.35));
    const moon = new THREE.DirectionalLight(0xb8ccd0, 1.45); moon.position.set(-22, 34, 16); moon.castShadow = true; moon.shadow.mapSize.set(1024,1024); moon.shadow.camera.left=-55; moon.shadow.camera.right=55; moon.shadow.camera.top=55; moon.shadow.camera.bottom=-55; scene.add(moon);
  }

  function mat(color, roughness=1, metalness=0, emissive=0) { return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: emissive ? .8 : 0, flatShading: true }); }
  function mesh(geo, material, x=0, y=0, z=0, parent=scene) { const m = new THREE.Mesh(geo, material); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m; }
  function box(w,h,d, material, x,y,z, parent=scene) { return mesh(new THREE.BoxGeometry(w,h,d), material, x,y,z,parent); }
  function cyl(rt,rb,h,segments, material,x,y,z,parent=scene) { return mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material,x,y,z,parent); }
  function addCollider(x,z,r) { colliders.push({x,z,r}); }

  function buildWorld() {
    const ground = mesh(new THREE.PlaneGeometry(180,180,35,35), materials.ground,0,0,0); ground.rotation.x=-Math.PI/2;
    const pos = ground.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){ const x=pos.getX(i), y=pos.getY(i); pos.setZ(i, Math.sin(x*.17)*.13 + Math.cos(y*.13)*.12 + (Math.random()-.5)*.09); }
    pos.needsUpdate=true; ground.geometry.computeVertexNormals();
    buildShip();
    buildComputer(-10, -8, false, "computer_intro");
    buildRuin(-27, -22); buildComputer(-29, -24, true, "office_drive"); buildComputer(-21, -19, false, "office_empty");
    buildCar(-17,-15,.6); buildCar(16,-16,-.7); buildCar(28,5,2.4);
    buildRobot(18,-25,false,"robot_landmark");
    buildRobot(35,-41,true,"robot_drive"); buildRobot(29,-37,false,"robot_empty"); buildRobot(40,-34,false,"robot_empty2");
    buildDish(23,-30); buildDish(39,-46);
    for(let i=0;i<45;i++){ const a=i*2.399, r=13+(i%9)*4.8; const x=Math.cos(a)*r, z=Math.sin(a)*r-13; if(Math.hypot(x,z)<12) continue; buildDebris(x,z,(i*1.77)%6.28,i); }
    for(let i=0;i<18;i++){ const a=i*1.84, r=24+(i%5)*10; buildDeadTree(Math.cos(a)*r,Math.sin(a)*r-12,i); }
    camera.position.set(state.player.x,state.player.y,state.player.z); updateUI();
  }

  function buildShip() {
    const g=new THREE.Group(); g.position.set(0,0,0); scene.add(g);
    box(10,2.7,7,materials.dark,0,1.7,0,g); const nose=box(5.5,2.1,4,materials.metal,0,2.15,-4.3,g); nose.rotation.x=-.18;
    box(12,.35,8,materials.black,0,.35,.2,g); box(2.2,1.4,.5,materials.screen,0,1.8,3.62,g);
    const bay=box(3.8,2.5,.65,materials.metal,3.1,1.55,3.55,g); bay.userData={kind:"bay"}; interactables.push(bay);
    box(2.2,1.25,.18,materials.black,3.1,1.65,3.9,g); const slot=box(1.65,.32,.2,materials.orange,3.1,1.55,4.01,g); slot.material=materials.orange;
    for(const x of [-4.4,4.4]){ const leg=box(.6,1.6,.6,materials.metal,x,.1,1.8,g); leg.rotation.z=x<0?.2:-.2; }
    const mast=cyl(.18,.23,15,8,materials.metal,-3.6,9,-1,g); const beacon=cyl(.42,.42,1.7,8,materials.screen,-3.6,16.7,-1,g); beacon.userData.beacon=true;
    const light=new THREE.PointLight(0x9ad7c4,5,42,1.5); light.position.set(-3.6,15.8,-1); scene.add(light);
    addCollider(0,0,6.3);
  }

  function buildComputer(x,z,hasDrive,id) {
    const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=(x*.37+z*.13)%6.28; scene.add(g);
    box(3.2,1.5,2.4,materials.dark,0,.8,0,g); box(2.5,1.5,1.3,materials.metal,0,2.2,-.1,g);
    const screen=box(1.75,.85,.15,Math.random()>.35?materials.screen:materials.black,0,2.25,.62,g); screen.rotation.x=-.08;
    box(2.5,.14,1.2,materials.black,0,1.4,1.05,g);
    const core=box(3.3,3.7,2.7,new THREE.MeshBasicMaterial({visible:false}),0,1.85,0,g);
    const d={id,type:"COMPUTER",group:g,core,hasDrive,drive:hasDrive?"drive1":null,scanned:false,resolved:false,driveExtracted:false}; core.userData={kind:"device",device:d}; interactables.push(core); devices.push(d);
    if(hasDrive) attachDrive(d,1.72,1.55,.8);
    addCollider(x,z,2.2);
  }

  function buildRobot(x,z,hasDrive,id) {
    const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=(x+z)*.11; scene.add(g);
    const torso=box(2.8,3.1,1.7,materials.metal,0,3.15,0,g); torso.rotation.z=hasDrive?.02:-.13;
    const head=cyl(1.12,1.12,.65,12,materials.dark,0,5.25,0,g); head.rotation.z=Math.PI/2;
    box(1.25,.2,1.18,materials.orange,0,5.25,.42,g); box(.24,.24,.13,materials.screen,-.42,5.28,.72,g); box(.24,.24,.13,materials.screen,.42,5.28,.72,g);
    for(const s of [-1,1]) { const leg=box(.55,2.8,.7,materials.dark,s*.7,1.35,0,g); leg.rotation.z=s*(hasDrive?.05:.19); const arm=box(.4,2.7,.45,materials.rust,s*1.8,3.25,0,g); arm.rotation.z=s*.2; }
    const core=box(4.5,6.5,3,new THREE.MeshBasicMaterial({visible:false}),0,3,0,g);
    const d={id,type:"ROBOT",group:g,core,hasDrive,drive:hasDrive?"drive2":null,scanned:false,resolved:false,driveExtracted:false}; core.userData={kind:"device",device:d}; interactables.push(core); devices.push(d);
    if(hasDrive) attachDrive(d,0,3.25,.98);
    addCollider(x,z,2.1);
  }

  function attachDrive(device,x,y,z){
    const g=new THREE.Group(); g.position.set(x,y,z); device.group.add(g); box(1.45,.78,.46,materials.orange,0,0,0,g); box(1.1,.55,.18,materials.black,0,0,.3,g);
    for(let i=0;i<5;i++) box(.08,.35,.06,materials.bone,-.4+i*.2,-.12,.42,g);
    const handle=cyl(.08,.08,1,8,materials.dark,.78,0,0,g); handle.rotation.z=Math.PI/2;
    g.userData={kind:"drive",device}; driveMeshes[device.drive]=g;
  }

  function resetDriveMesh(device){ const g=driveMeshes[device.drive]; if(!g)return; if(g.parent!==device.group) device.group.add(g); g.position.set(device.type==="COMPUTER"?1.72:0,device.type==="COMPUTER"?1.55:3.25,device.type==="COMPUTER"?.8:.98); g.rotation.set(0,0,0); g.visible=true; }

  function buildRuin(x,z){
    box(11,.3,9,materials.black,x,.15,z); box(.5,5,9,materials.rust,x-5.2,2.5,z); box(10.5,4.5,.45,materials.dark,x,2.25,z-4.2);
    for(let i=0;i<3;i++) box(.35,4.8,.35,materials.metal,x-4+i*4,2.4,z+3.2);
    addCollider(x-5.2,z,1); addCollider(x,z-4.2,1);
  }
  function buildCar(x,z,r){ const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=r; scene.add(g); box(5.2,1.1,2.3,materials.blue,0,1,0,g); box(2.7,1.05,2,materials.dark,-.35,1.9,0,g); for(const sx of [-1.7,1.7])for(const sz of [-1.15,1.15]){const w=cyl(.48,.48,.35,12,materials.black,sx,.62,sz,g);w.rotation.x=Math.PI/2;} addCollider(x,z,3); }
  function buildDish(x,z){ const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);cyl(.7,1.2,2.4,8,materials.rust,0,1.2,0,g);const d=cyl(3.4,.4,.45,20,materials.metal,0,3,0,g);d.rotation.x=.55;addCollider(x,z,2); }
  function buildDebris(x,z,r,i){ const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=r;scene.add(g); const m=i%3===0?materials.rust:materials.dark; if(i%4===0){cyl(.5,.7,2+(i%3),7,m,0,1,0,g);} else {const b=box(1+(i%5)*.35,.5+(i%3)*.3,1.5+(i%4)*.4,m,0,.4,0,g);b.rotation.z=(i%2?1:-1)*.15;} }
  function buildDeadTree(x,z,i){ const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);const trunk=cyl(.15,.38,5+(i%4),6,materials.dark,0,2.5,0,g);trunk.rotation.z=(i%2?1:-1)*.08;for(let b=0;b<2;b++){const branch=cyl(.08,.15,2.2,5,materials.dark,(b?-.5:.5),4+b*.6,0,g);branch.rotation.z=(b?-1:1)*.8;} }

  function bindEvents() {
    ui.begin.addEventListener("click", startGame); ui.resume.addEventListener("click", requestLock); ui.restart.addEventListener("click", () => location.reload()); ui.endingRestart.addEventListener("click",()=>location.reload());
    ui.terminalExit.addEventListener("click", closeTerminal); ui.windowClose.addEventListener("click",()=>ui.fileWindow.classList.add("hidden"));
    renderer.domElement.addEventListener("click",()=>{if(state.phase==="playing"&&!state.terminalOpen)requestLock();});
    document.addEventListener("pointerlockchange",()=>{ if(state.phase!=="playing"||state.terminalOpen)return; const locked=document.pointerLockElement===renderer.domElement; pendingMouseX=0;pendingMouseY=0;mouseSettleUntil=locked?performance.now()+160:0;ui.pause.classList.toggle("hidden",locked); });
    document.addEventListener("mousemove",(e)=>{
      if(document.pointerLockElement!==renderer.domElement||state.terminalOpen)return;
      if(performance.now()<mouseSettleUntil)return;
      const dx=Number.isFinite(e.movementX)?e.movementX:0,dy=Number.isFinite(e.movementY)?e.movementY:0;
      if(Math.abs(dx)>120||Math.abs(dy)>120)return;
      pendingMouseX+=dx;pendingMouseY+=dy;
    });
    addEventListener("blur",()=>{pendingMouseX=0;pendingMouseY=0;});
    document.addEventListener("keydown",(e)=>{
      keys[e.code]=true;
      if(e.code==="KeyQ"&&!e.repeat&&state.phase==="playing"&&!state.carried&&!state.terminalOpen)cycleSignature();
      if(e.code==="KeyE"&&!e.repeat)handleInteractTap();
    });
    document.addEventListener("keyup",(e)=>{keys[e.code]=false;if(e.code==="KeyF"||e.code==="KeyE")resetHold();});
    addEventListener("resize",()=>{if(!camera)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
    [ui.archiveDock,ui.installDock].forEach((dock)=>{dock.addEventListener("dragover",(e)=>{e.preventDefault();dock.classList.add("over");});dock.addEventListener("dragleave",()=>dock.classList.remove("over"));dock.addEventListener("drop",handleDrop);});
  }

  function startGame(){ ui.start.classList.add("hidden");ui.hud.classList.remove("hidden");state.phase="playing";state.startedAt=performance.now();initAudio();requestLock();showToast("FIELD LINK ESTABLISHED"); }
  function requestLock(){ ui.pause.classList.add("hidden");renderer.domElement.requestPointerLock?.(); }
  function initAudio(){ if(audio)return; const C=window.AudioContext||window.webkitAudioContext;if(C){audio=new C();audio.resume();} }
  function tone(freq=440,dur=.06,type="square",gain=.035){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur);}

  function animate(){ requestAnimationFrame(animate); const dt=Math.min(clock.getDelta(),.05); if(state.phase==="playing"&&!state.terminalOpen&&document.pointerLockElement===renderer.domElement){updateCameraLook();updateMovement(dt);updateInteraction(dt);updateScanner(dt);} updateScene(dt);renderer.render(scene,camera); }
  function updateCameraLook(){const dx=Math.max(-32,Math.min(32,pendingMouseX)),dy=Math.max(-32,Math.min(32,pendingMouseY));pendingMouseX=0;pendingMouseY=0;yaw-=dx*.0022;pitch-=dy*.0022;pitch=Math.max(-1.47,Math.min(1.47,pitch));}
  function updateMovement(dt){
    const speed=(state.carried?3.0:4.3)*dt, forward=(keys.KeyW?1:0)-(keys.KeyS?1:0), side=(keys.KeyD?1:0)-(keys.KeyA?1:0); let dx=0,dz=0;
    if(forward||side){const n=1/Math.max(1,Math.hypot(forward,side));dx=(Math.sin(yaw)*-forward+Math.cos(yaw)*side)*speed*n;dz=(Math.cos(yaw)*-forward-Math.sin(yaw)*side)*speed*n;}
    const nx=state.player.x+dx,nz=state.player.z+dz;if(!blocked(nx,state.player.z)){state.player.x=nx;}if(!blocked(state.player.x,nz)){state.player.z=nz;}
    state.player.x=Math.max(-59,Math.min(59,state.player.x));state.player.z=Math.max(-59,Math.min(38,state.player.z));
    camera.position.set(state.player.x,state.player.y,state.player.z);camera.rotation.set(pitch,yaw,0);
    if(state.carried){const g=driveMeshes[state.carried];g.position.set(0,-.48,-1.05);g.rotation.set(.05,0,0);}
  }
  function blocked(x,z){return colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.45);}
  function updateScene(){ scene.traverse((o)=>{if(o.userData.beacon){o.material.emissiveIntensity=.65+Math.sin(performance.now()*.004)*.3;}}); }

  function aimed(){ raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hits=raycaster.intersectObjects(interactables,false);if(!hits.length)return null;const u=hits[0].object.userData;if(u.kind==="device")return {kind:"device",device:u.device,distance:hits[0].distance};if(u.kind==="bay")return {kind:"bay",distance:hits[0].distance};if(u.kind==="pickup")return {kind:"pickup",drive:u.drive,mesh:u.mesh,hitbox:u.hitbox,distance:hits[0].distance};return null; }
  function updateInteraction(dt){
    state.target=aimed();let prompt="",holdKind="",holdTarget=null;
    if(state.carried){ if(state.target?.kind==="bay"&&state.target.distance<4.2){prompt="[E] INSERT DRIVE";} else prompt="[E] DROP DRIVE"; }
    else if(state.target?.kind==="device"){
      const d=state.target.device;if(!d.scanned){prompt="[F] HOLD TO RECORD "+d.type;holdKind="scan";holdTarget=d;}
      else if(d.hasDrive&&!d.driveExtracted){prompt="[E] HOLD TO EXTRACT DRIVE";holdKind="extract";holdTarget=d;}
      else prompt=d.hasDrive?"DRIVE BAY EMPTY":"NO RECOVERABLE MEDIA";
    } else if(state.target?.kind==="pickup"){
      prompt="[E] PICK UP DRIVE";
    } else if(state.target?.kind==="bay"){prompt=state.mounted?"[E] OPEN ARCHIVE TERMINAL":"DRIVE BAY // EMPTY";}
    ui.prompt.textContent=prompt;
    const active=(holdKind==="scan"&&keys.KeyF)||(holdKind==="extract"&&keys.KeyE);
    if(active){if(state.holdKind!==holdKind||state.holdTarget!==holdTarget){state.hold=0;state.holdKind=holdKind;state.holdTarget=holdTarget;}state.hold+=dt;const needed=holdKind==="scan"?1.15:1.25;ui.holdTrack.classList.add("active");ui.holdFill.style.width=Math.min(100,state.hold/needed*100)+"%";if(state.hold>=needed)completeAction(holdKind,holdTarget);} else if(holdKind!==state.holdKind)resetHold();
  }
  function resetHold(){state.hold=0;state.holdKind="";state.holdTarget=null;ui.holdTrack.classList.remove("active");ui.holdFill.style.width="0";}
  function completeAction(kind,target){resetHold();if(kind==="scan")recordSignature(target);else if(kind==="extract")extractDrive(target);}
  function handleInteractTap(){if(state.phase!=="playing"||state.terminalOpen)return;const target=state.target;if(state.carried){if(target?.kind==="bay"&&target.distance<4.2)insertDrive();else dropDrive();return;}if(target?.kind==="pickup")pickUpDrive(target);else if(target?.kind==="bay"&&state.mounted)openTerminal(state.mounted);}

  function recordSignature(device){device.scanned=true;if(!device.hasDrive)device.resolved=true;if(!state.known.includes(device.type)){state.known.push(device.type);state.selected=state.known.length-1;showToast("SIGNATURE RECORDED // "+device.type);tone(680,.12);tone(920,.16);if(device.type==="ROBOT")setObjective("Track a robot carrying recoverable media.");else setObjective("Track COMPUTER signals. Locate recoverable media.");}else{showToast(device.type+" SIGNATURE CONFIRMED");tone(620,.08);}updateUI();}
  function cycleSignature(){if(!state.known.length){showToast("NO RECORDED SIGNATURES");return;}state.selected=(state.selected+1)%state.known.length;showToast("TRACKING // "+state.known[state.selected]+" // "+(state.selected+1)+" OF "+state.known.length);updateUI();tone(510,.06);}
  function extractDrive(device){device.driveExtracted=true;device.resolved=true;state.carried=device.drive;const g=driveMeshes[state.carried];camera.add(g);scene.add(camera);ui.carryLabel.classList.remove("hidden");showToast("MEDIA EXTRACTED // RETURN TO SHIP");setObjective("Carry the drive to the ship's illuminated bay.");tone(190,.18,"sawtooth",.045);}
  function dropDrive(){if(!state.carried)return;const id=state.carried,g=driveMeshes[id],dir=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);scene.add(g);g.position.set(state.player.x+dir.x*1.5,.55,state.player.z+dir.z*1.5);g.rotation.set(0,yaw,0);g.userData={kind:"dropped",drive:id};const hitbox=box(1.8,1.2,1.2,new THREE.MeshBasicMaterial({visible:false}),g.position.x,.6,g.position.z);hitbox.userData={kind:"pickup",drive:id,mesh:g,hitbox};interactables.push(hitbox);state.carried=null;ui.carryLabel.classList.add("hidden");showToast("DRIVE DROPPED");}
  function pickUpDrive(target){const index=interactables.indexOf(target.hitbox);if(index>=0)interactables.splice(index,1);scene.remove(target.hitbox);state.carried=target.drive;camera.add(target.mesh);ui.carryLabel.classList.remove("hidden");showToast("DRIVE RECOVERED");tone(230,.1,"square",.035);}
  function insertDrive(){const id=state.carried;if(!id)return;state.carried=null;state.mounted=id;driveMeshes[id].visible=false;ui.carryLabel.classList.add("hidden");showToast("DRIVE MOUNTED");setObjective("Access the ship terminal.");tone(180,.12,"square",.05);setTimeout(()=>openTerminal(id),400);}

  function updateScanner(dt){
    if(state.carried||state.selected<0){setSignal(0,0);return;}const type=state.known[state.selected],range=state.upgrade?48:31;let best=null,bestD=Infinity;
    for(const d of devices){if(d.type!==type||d.resolved)continue;const dist=Math.hypot(d.group.position.x-state.player.x,d.group.position.z-state.player.z);if(dist<bestD&&dist<=range){best=d;bestD=dist;}}
    if(!best){setSignal(0,0);ui.scannerNote.textContent="NO MATCH IN RANGE";return;}const strength=Math.max(0,1-bestD/range);const bearing=Math.atan2(best.group.position.x-state.player.x,best.group.position.z-state.player.z)-yaw;setSignal(strength,bearing);ui.scannerNote.textContent=state.upgrade?"ENHANCED DIRECTIONAL LOCK":"PROXIMITY RETURN";
    scanPulse-=dt;if(scanPulse<=0){tone(260+strength*520,.025,"square",.012);scanPulse=.95-strength*.72;}
  }
  function setSignal(strength,bearing){const on=Math.round(strength*8);ui.signalBars.forEach((b,i)=>b.classList.toggle("on",i<on));ui.direction.style.transform=`rotate(${bearing}rad)`;}

  function openTerminal(id){if(!id)return;state.terminalOpen=true;document.exitPointerLock?.();ui.hud.classList.add("hidden");ui.pause.classList.add("hidden");ui.terminal.classList.remove("hidden");ui.driveName.textContent=drives[id].name;ui.driveFree.textContent="READ ONLY // "+drives[id].files.length+" FILES";renderFiles(id);updateTerminal();}
  function closeTerminal(){state.terminalOpen=false;ui.terminal.classList.add("hidden");ui.fileWindow.classList.add("hidden");if(state.phase==="playing"&&!state.finished){ui.hud.classList.remove("hidden");setTimeout(requestLock,50);}}
  function renderFiles(id){ui.fileGrid.innerHTML="";drives[id].files.forEach((f)=>{const el=document.createElement("div");el.className="file"+(state.files[f.id]?" processed":"");el.draggable=f.type==="zip"||f.type==="exe";el.dataset.id=f.id;el.dataset.type=f.type;el.innerHTML=`<span class="file-icon">${f.type.toUpperCase()}</span><strong>${f.name}</strong><small>${f.type==="zip"?"ARCHIVE":f.type==="exe"?"EXECUTABLE":"DOCUMENT"}</small>`;el.addEventListener("dblclick",()=>openFile(f));el.addEventListener("dragstart",(e)=>{e.dataTransfer.setData("text/plain",JSON.stringify({id:f.id,type:f.type,drive:id}));});ui.fileGrid.appendChild(el);});}
  function openFile(f){if(f.type==="zip"||f.type==="exe"){showToast("DRAG FILE TO A PROCESSING DOCK");return;}ui.windowTitle.textContent=f.name;if(f.type==="img")ui.windowContent.innerHTML='<div class="surveillance"><i class="sun"></i><i class="bot"></i><label>CAM 12 // EAST DISH FIELD // SURVEY UNIT</label></div><p>Circular-head survey chassis. Service stripe visible. Last telemetry: east of the office ruins.</p>';else ui.windowContent.textContent=f.content;ui.fileWindow.classList.remove("hidden");tone(420,.04);}
  function handleDrop(e){e.preventDefault();const dock=e.currentTarget;dock.classList.remove("over");let data;try{data=JSON.parse(e.dataTransfer.getData("text/plain"));}catch{return;}if(dock.dataset.accept!==data.type){dock.classList.add("reject");terminalNotice("INCOMPATIBLE FILE TYPE");setTimeout(()=>dock.classList.remove("reject"),350);tone(95,.12,"sawtooth");return;}if(state.files[data.id])return;state.files[data.id]=true;if(data.type==="zip"){state.archives++;showToast("ARCHIVE FRAGMENT TRANSMITTED // "+state.archives+" OF 2");terminalNotice("UPLINK COMPLETE // FRAGMENT "+state.archives+" RECEIVED");tone(740,.12);tone(980,.2);if(state.archives===1)setObjective("Read the recovered clue. Locate the survey robot.");}else{state.upgrade=true;showToast("SCANNER RANGE EXTENDED // DIRECTION LOCK ONLINE");terminalNotice("INSTALL COMPLETE // DIRECTION LOCK ONLINE");tone(420,.08);tone(620,.1);tone(840,.15);}renderFiles(data.drive);updateUI();updateTerminal();if(state.archives>=2)setTimeout(finishGame,900);}
  function terminalNotice(text){ui.driveFree.textContent=text;setTimeout(()=>{if(state.mounted)ui.driveFree.textContent="READ ONLY // "+drives[state.mounted].files.length+" FILES";},2200);}
  function updateTerminal(){ui.terminalProgress.textContent=state.archives+" OF 2 FRAGMENTS";ui.terminalProgressFill.style.width=(state.archives*50)+"%";ui.terminalClock.textContent=new Date().toTimeString().slice(0,8);}
  function finishGame(){state.finished=true;closeTerminal();document.exitPointerLock?.();ui.hud.classList.add("hidden");ui.ending.classList.remove("hidden");const secs=Math.max(0,Math.floor((performance.now()-state.startedAt)/1000));ui.elapsed.textContent=`FIELD TIME ${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;tone(150,.6,"sine",.05);}

  function setObjective(text){ui.objective.textContent=text;}
  function updateUI(){ui.signature.textContent=state.selected>=0?state.known[state.selected]+"  ["+(state.selected+1)+"/"+state.known.length+"]":"— NO SIGNAL —";ui.archiveCount.textContent=`ARCHIVES ${state.archives} / 2`;ui.archiveFill.style.width=(state.archives*50)+"%";if(!state.known.length)setObjective("Find a machine. Record its signature.");updateTerminal();}
  function showToast(text){clearTimeout(toastTimer);ui.toast.textContent=text;ui.toast.classList.add("show");toastTimer=setTimeout(()=>ui.toast.classList.remove("show"),2300);}

  boot();
})();
