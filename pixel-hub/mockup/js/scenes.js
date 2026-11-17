/* Pixel Hub — живі 3D-сцени (Three.js r128). Без WebGL показуються картинки-заглушки. */
/* ---------- 3D scenes ---------- */
(function(){
  if (!window.THREE) return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOISE = `
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }`;
  const FRAG = `
  uniform float uTime; uniform float uDark; varying vec3 vN; varying vec3 vView;
  vec3 pal(float t){ t=fract(t);
    vec3 c0=vec3(.208,.314,.941), c1=vec3(.482,.302,1.), c2=vec3(1.,.416,.271), c3=vec3(1.,.702,.42), c4=vec3(.231,.82,1.);
    float s=t*5.; if(s<1.) return mix(c0,c1,s); if(s<2.) return mix(c1,c2,s-1.); if(s<3.) return mix(c2,c3,s-2.);
    if(s<4.) return mix(c3,c4,s-3.); return mix(c4,c0,s-4.); }
  void main(){ vec3 N=normalize(vN); vec3 V=normalize(vView); float ndv=max(dot(N,V),0.);
    float fr=pow(1.-ndv,1.5);
    float h=dot(N,vec3(.35,.55,.25))*.55+fr*.9+uTime*.035+(vView.x*.11-vView.y*.09);
    vec3 col=pal(h); vec3 L=normalize(vec3(-.5,.8,.7));
    float spec=pow(max(dot(reflect(-L,N),V),0.),70.);
    float spec2=pow(max(dot(reflect(-normalize(vec3(.7,-.3,.6)),N),V),0.),24.)*.35;
    col=mix(col*uDark,col,.5+.5*smoothstep(0.,.85,fr));
    col+=vec3(spec*1.3+spec2)+pow(fr,5.)*.4;
    gl_FragColor=vec4(col,1.); }`;

  function R(canvas, alpha){
    const r = new THREE.WebGLRenderer({canvas, antialias:true, alpha:!!alpha});
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setClearColor(0x05060a, alpha ? 0 : 1);
    return r;
  }

  function graphScene(canvas, opts){
    const renderer = R(canvas);
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x05060a, .09);
    const camera = new THREE.PerspectiveCamera(45,1,.1,100); camera.position.set(opts.x||0,0,opts.z||8.5);
    const n = 150, pos = [], cols = [];
    const cW=new THREE.Color(0xF2F3FA), cB=new THREE.Color(0x7088FF), cC=new THREE.Color(0xFF6A45);
    for(let i=0;i<n;i++){ const y=1-(i/(n-1))*2, r=Math.sqrt(1-y*y), th=i*2.39996, R0=3+(Math.sin(i*12.9898)*.5)*.9;
      pos.push(new THREE.Vector3(Math.cos(th)*r*R0, y*R0, Math.sin(th)*r*R0)); const c=i%11===0?cC:(i%3===0?cW:cB); cols.push(c.r,c.g,c.b); }
    const edges=[]; pos.forEach((p,i)=>{ pos.map((q,j)=>[j,p.distanceToSquared(q)]).filter(a=>a[0]!==i).sort((a,b)=>a[1]-b[1]).slice(0,3).forEach(([j])=>{ if(i<j) edges.push([i,j]); }); });
    for(let k=0;k<n;k+=11) edges.push([k,(k*7+33)%n]);
    const g=new THREE.Group(); scene.add(g);
    const pg=new THREE.BufferGeometry().setFromPoints(pos); pg.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
    g.add(new THREE.Points(pg,new THREE.PointsMaterial({size:.13,vertexColors:true})));
    const lp=[]; edges.forEach(([a,b])=>lp.push(pos[a],pos[b]));
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp),new THREE.LineBasicMaterial({color:0x3A4BC8,transparent:true,opacity:.4})));
    const hub=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),new THREE.MeshBasicMaterial({color:0xFF6A45})); g.add(hub);
    const sp=[]; for(let k=0;k<n;k+=11) sp.push(new THREE.Vector3(),pos[k]);
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp),new THREE.LineBasicMaterial({color:0xFF6A45,transparent:true,opacity:.22})));
    const P=40, pk=[], pkPos=new Float32Array(P*3);
    for(let i=0;i<P;i++) pk.push({e:edges[(i*37)%edges.length], t:(i*.137)%1, s:.25+((i*7)%10)/20});
    const pkG=new THREE.BufferGeometry(); pkG.setAttribute('position',new THREE.BufferAttribute(pkPos,3));
    g.add(new THREE.Points(pkG,new THREE.PointsMaterial({size:.11,color:0xFFB36B})));
    const m=new THREE.Vector2(), tg=new THREE.Vector2(); let last=0;
    return {renderer,camera,move:(x,y)=>tg.set(x,y),tick(t){ const dt=Math.min(t-last,.05); last=t; m.lerp(tg,.05);
      g.rotation.y=t*.07+m.x*.6; g.rotation.x=Math.sin(t*.1)*.15-m.y*.4; hub.rotation.set(t*.6,t*.8,0);
      pk.forEach((p,i)=>{ p.t+=dt*p.s; if(p.t>1){p.t=0;p.e=edges[(Math.random()*edges.length)|0];} const a=pos[p.e[0]],b=pos[p.e[1]];
        pkPos[i*3]=a.x+(b.x-a.x)*p.t; pkPos[i*3+1]=a.y+(b.y-a.y)*p.t; pkPos[i*3+2]=a.z+(b.z-a.z)*p.t; });
      pkG.attributes.position.needsUpdate=true; renderer.render(scene,camera); }};
  }

  const builders = {
    blob(canvas){
      const renderer = R(canvas, true);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35,1,.1,100); camera.position.set(0,0,6.4);
      const uni = {uTime:{value:0}, uDark:{value:.35}, uMouse:{value:new THREE.Vector2()}};
      const mat = new THREE.ShaderMaterial({uniforms:uni, fragmentShader:FRAG, vertexShader: NOISE + `
        uniform float uTime; uniform vec2 uMouse; varying vec3 vN; varying vec3 vView;
        float disp(vec3 n){ return snoise(n*.75+vec3(uTime*.18,0.,uTime*.1))*.3 + snoise(n*1.6-uTime*.14)*.05 + dot(n.xy,uMouse)*.12; }
        vec3 dpos(vec3 n){ return n*(1.+disp(n)); }
        void main(){ vec3 p=normalize(position);
          vec3 t=normalize(cross(p,abs(p.y)>.99?vec3(1.,0.,0.):vec3(0.,1.,0.))); vec3 b=normalize(cross(p,t)); float e=.012;
          vec3 P=dpos(p), P1=dpos(normalize(p+t*e)), P2=dpos(normalize(p+b*e));
          vec3 n=normalize(cross(P1-P,P2-P)); if(dot(n,P)<0.) n=-n;
          vN=normalize(normalMatrix*n); vec4 mv=modelViewMatrix*vec4(P,1.); vView=-mv.xyz; gl_Position=projectionMatrix*mv; }`});
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3,64), mat); scene.add(mesh);
      const cubes=new THREE.Group(), cm=[0xFF6A45,0x7088FF,0xF2F3FA,0x3BD1FF];
      for(let i=0;i<12;i++){ const c=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.08),new THREE.MeshBasicMaterial({color:cm[i%4]}));
        c.userData={a:i/12*Math.PI*2, rr:1.95+(i%3)*.3, y:Math.sin(i*1.7)*.9, s:.2+.1*(i%4)}; cubes.add(c); }
      scene.add(cubes);
      const m=new THREE.Vector2(), tg=new THREE.Vector2();
      return {renderer,camera,move:(x,y)=>tg.set(x,y),tick(t){ uni.uTime.value=t; m.lerp(tg,.05); uni.uMouse.value.copy(m);
        mesh.rotation.y=t*.08+m.x*.5; mesh.rotation.x=-m.y*.4;
        cubes.children.forEach(c=>{ const d=c.userData, a=d.a+t*d.s; c.position.set(Math.cos(a)*d.rr, d.y+Math.sin(t+d.a)*.12, Math.sin(a)*d.rr*.5); c.rotation.set(t,t*.7,0); });
        renderer.render(scene,camera); }};
    },
    graph(canvas){ return graphScene(canvas, {z:8.2}); },
    graph2(canvas){ return graphScene(canvas, {z:7.2, x:-1.5}); },
    field(canvas){
      const renderer = R(canvas);
      const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x05060a, 8, 20);
      const camera = new THREE.PerspectiveCamera(40,1,.1,100); camera.position.set(2,5.5,8.5); camera.lookAt(2,0,0);
      scene.add(new THREE.AmbientLight(0x404a80,.55));
      const d1=new THREE.DirectionalLight(0x7088ff,1.1); d1.position.set(-5,8,3); scene.add(d1);
      const p1=new THREE.PointLight(0xff6a45,2.2,18); p1.position.set(5,3,2); scene.add(p1);
      const N=48, gap=.34, count=N*N;
      const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(.26,.26,.26), new THREE.MeshStandardMaterial({roughness:.3,metalness:.35}), count);
      const dm=new THREE.Object3D(), col=new THREE.Color();
      const cB=new THREE.Color(0x3550F0), cV=new THREE.Color(0x7B4DFF), cC=new THREE.Color(0xFF6A45), cA=new THREE.Color(0xFFB36B);
      for(let i=0;i<count;i++) inst.setColorAt(i,cB);
      scene.add(inst);
      const rip=new THREE.Vector2(99,99); let ripT=-10, now=0;
      const ray=new THREE.Raycaster(), plane=new THREE.Plane(new THREE.Vector3(0,1,0),0), hit=new THREE.Vector3();
      return {renderer,camera,move:(x,y)=>{ ray.setFromCamera({x,y},camera); if(ray.ray.intersectPlane(plane,hit)){ rip.set(hit.x,hit.z); ripT=now; } },
        tick(t){ now=t; let i=0;
          for(let gx=0;gx<N;gx++) for(let gz=0;gz<N;gz++,i++){
            const x=(gx-N/2)*gap+2, z=(gz-N/2)*gap;
            let h=Math.sin(x*.8+t*1.1)*.35+Math.cos(z*.7-t*.8)*.3+Math.sin((x+z)*.45+t*.6)*.25;
            const dx=x-rip.x, dz=z-rip.y, dist=Math.sqrt(dx*dx+dz*dz), age=t-ripT;
            if(age<3) h+=Math.sin(dist*3.2-age*7)*Math.exp(-dist*.5)*Math.exp(-age*1.2)*.9;
            dm.position.set(x,h,z); dm.rotation.set(h*.6,0,h*.4); dm.scale.setScalar(.75+(h+1)*.25); dm.updateMatrix(); inst.setMatrixAt(i,dm.matrix);
            const k=Math.min(Math.max((h+.9)/2,0),1);
            if(k<.4) col.copy(cB).lerp(cV,k/.4); else if(k<.8) col.copy(cV).lerp(cC,(k-.4)/.4); else col.copy(cC).lerp(cA,(k-.8)/.2);
            inst.setColorAt(i,col);
          }
          inst.instanceMatrix.needsUpdate=true; inst.instanceColor.needsUpdate=true; renderer.render(scene,camera); }};
    }
  };

  const live=[];
  document.querySelectorAll('canvas.gl').forEach(canvas=>{
    let s; try { s = builders[canvas.dataset.scene](canvas); } catch(e){ return; }
    if(canvas.dataset.scene==='blob') document.documentElement.classList.add('has-gl');
    s.visible = true;
    const host = canvas.parentElement;
    const resize=()=>{ const w=canvas.clientWidth, h=canvas.clientHeight; if(!w||!h) return; s.renderer.setSize(w,h,false); s.camera.aspect=w/h; s.camera.updateProjectionMatrix(); };
    resize(); if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else addEventListener('resize',resize);
    host.addEventListener('pointermove', e=>{ const r=canvas.getBoundingClientRect(); s.move(((e.clientX-r.left)/r.width)*2-1, -(((e.clientY-r.top)/r.height)*2-1)); });
    if (window.IntersectionObserver) new IntersectionObserver(es=>es.forEach(en=>s.visible=en.isIntersecting),{rootMargin:'120px'}).observe(canvas);
    live.push(s);
  });
  const t0=performance.now(); let first=true;
  (function loop(now){ const t=((now-t0)/1000)*(reduce?.12:1)+3; live.forEach(s=>{ if(s.visible||first) s.tick(t); }); first=false; requestAnimationFrame(loop); })(t0);
})();

