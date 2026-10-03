/* Just Talk — "how it thinks" demo, 3 separate step blocks:
   STEP 1 you ask  ->  STEP 2 routers (stops at Factual + web verify)  ->  STEP 3 answer + 3D black hole */
(function () {
  var CSS =
  '.bh-demo{width:100%;margin:1.6rem 0 2.4rem;font-family:Inter,Arial,sans-serif;color:#e8fff7}' +
  '.bh-grid{display:grid;grid-template-columns:1fr;gap:18px}' +
  '@media(min-width:960px){.bh-grid{grid-template-columns:.8fr auto .95fr auto 1.45fr;gap:0;align-items:stretch}}' +
  '.bh-card{position:relative;background:rgba(2,12,9,.8);border:1px solid rgba(110,231,183,.14);border-radius:18px;padding:18px 18px 20px;opacity:.38;transform:scale(.97);transition:opacity .6s,transform .6s,border-color .6s,box-shadow .6s}' +
  '.bh-card.on{opacity:1;transform:none;border-color:rgba(110,231,183,.5);box-shadow:0 0 0 1px rgba(16,163,127,.25),0 18px 50px rgba(0,0,0,.4)}' +
  '.bh-link{display:flex;align-items:center;justify-content:center;height:64px;opacity:.25;transition:opacity .5s}.bh-link.on{opacity:1}' +
  '.bh-link svg{width:56px;height:46px;transform:rotate(90deg);overflow:visible}' +
  '.bh-ar{fill:none;stroke:#19c37d;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:100;stroke-dashoffset:100;transition:stroke-dashoffset .8s ease}.bh-link.on .bh-ar{stroke-dashoffset:0}' +
  '@media(min-width:960px){.bh-link{height:auto;width:78px;align-self:center}.bh-link svg{width:64px;height:52px;transform:none}}' +
  '.bh-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}' +
  '.bh-no{font:700 11px "Space Grotesk",Arial;letter-spacing:.12em;color:#03130f;background:linear-gradient(135deg,#bef264,#10a37f);padding:4px 9px;border-radius:99px}' +
  '.bh-ttl{font:600 14px "Space Grotesk",Arial;color:#d6fff0}' +
  '.bh-msg{background:#12302a;border-radius:18px 18px 4px 18px;padding:10px 16px;font-size:16px;line-height:1.35;display:inline-block;max-width:100%}' +
  '.bh-msg:after{content:"";display:inline-block;width:2px;height:.9em;background:#6ee7b7;margin-left:2px;vertical-align:middle;animation:bhb 1s steps(2) infinite}' +
  '@keyframes bhb{50%{opacity:0}}' +
  '.bh-hint{margin-top:12px;font-size:12.5px;color:#7fb8a5;line-height:1.5}' +
  '.bh-rt{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:1px solid transparent;color:#5d7d73;transition:.35s;margin-bottom:6px}' +
  '.bh-ic{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font:700 11px ui-monospace,monospace;border:1px solid rgba(255,255,255,.14)}' +
  '.bh-rt b{display:block;font:600 13px "Space Grotesk",Arial}.bh-rt small{display:block;font:11.5px ui-monospace,monospace;opacity:.0;max-height:0;transition:.35s}' +
  '.bh-rt.skip{color:#8db5a7}.bh-rt.skip .bh-ic{border-color:rgba(255,130,130,.5);color:#ff9a9a}.bh-rt.skip small,.bh-rt.hit small{opacity:1;max-height:30px}' +
  '.bh-rt.cur{background:#0f2923;border-color:rgba(110,231,183,.25);color:#d6fff0}' +
  '.bh-rt.hit{background:linear-gradient(135deg,#6ee7b7,#10a37f);color:#03130f;box-shadow:0 0 18px rgba(16,163,127,.55)}.bh-rt.hit .bh-ic{background:#03130f;color:#6ee7b7;border-color:#03130f}' +
  '.bh-ver{margin-top:10px;padding:10px 12px;border-radius:10px;background:#0f2923;font:12px/1.5 ui-monospace,monospace;color:#9fd8c5;opacity:0;transform:translateY(6px);transition:.5s}.bh-ver.on{opacity:1;transform:none}.bh-ver b{color:#bef264}' +
  '.bh-cv{display:block;width:100%;aspect-ratio:8/5;background:#000;border-radius:12px;border:1px solid rgba(255,255,255,.1);margin:0 0 4px;touch-action:pan-y;cursor:grab}' +
  '[data-c3]{background:rgba(0,0,0,.92)}' +
  '.bh-ans{opacity:0;transform:translateY(8px);transition:.6s}.bh-ans.on{opacity:1;transform:none}' +
  '.bh-badge{display:inline-flex;gap:6px;align-items:center;font:600 10.5px ui-monospace,monospace;letter-spacing:.1em;color:#bef264;background:rgba(190,242,100,.1);border:1px solid rgba(190,242,100,.3);padding:4px 9px;border-radius:99px}' +
  '.bh-h{margin:10px 0 6px;font:700 clamp(26px,3vw,36px)/1.1 "Space Grotesk",Arial;letter-spacing:-.02em;background:linear-gradient(90deg,#fff,#ffd29a 55%,#ff9a4d);-webkit-background-clip:text;background-clip:text;color:transparent;min-height:1.1em}' +
  '.bh-p{font-size:15px;line-height:1.6;color:#cfeee3;min-height:4.8em}.bh-p em{font-style:normal;color:#ffd29a;font-weight:600}' +
  '.bh-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.bh-tags span{font:500 11.5px Inter,Arial;padding:4px 10px;border-radius:99px;background:rgba(255,160,70,.1);border:1px solid rgba(255,160,70,.3);color:#ffd29a}' +
  '.bh-note{margin-top:14px;text-align:center;font-size:12px;color:#8fb8aa}.bh-note i{display:inline-block;font-style:normal;color:#19c37d;font-size:15px;animation:bhs 5s linear infinite}@keyframes bhs{to{transform:rotate(360deg)}}';

  var RT = [
    ['Temporal', 'no date / time words \u2192 skip'],
    ['Identity', 'not asking who the bot is \u2192 skip'],
    ['Generation', 'no write / explain / code word \u2192 skip'],
    ['Factual', '\u201Cwhat\u201D found \u2192 factual question \u2192 matched']
  ];
  var MSG = 'What is a black hole?';
  var HEAD = 'Black hole';
  var BODY = 'A region of space where gravity is so strong that <em>nothing \u2014 not even light \u2014</em> can escape once it crosses the <em>event horizon</em>.';

  function build() {
    var d = document.createElement('div');
    d.className = 'bh-demo';
    var rows = RT.map(function (r, i) {
      return '<div class="bh-rt"><span class="bh-ic">' + (i + 1) + '</span><div><b>' + r[0] + '</b><small>' + r[1] + '</small></div></div>';
    }).join('');
    d.innerHTML = '<style>' + CSS + '</style><div class="bh-grid">' +
      '<div class="bh-card" data-c1><div class="bh-head"><span class="bh-no">STEP 1</span><span class="bh-ttl">You ask</span></div>' +
        '<div class="bh-msg" data-msg></div><div class="bh-hint">Any message you type goes to the router first.</div></div>' +
      '<div class="bh-link" data-l1><svg viewBox="0 0 70 56" aria-hidden="true"><path class="bh-ar" d="M6 52 C 10 22 34 10 62 14"/><path class="bh-ar" d="M49 3 L63 14 L50 27"/></svg></div>' +
      '<div class="bh-card" data-c2><div class="bh-head"><span class="bh-no">STEP 2</span><span class="bh-ttl">It routes &amp; verifies</span></div>' + rows +
        '<div class="bh-ver" data-ver>\uD83C\uDF10 web search \u2192 <b>\u2713 verified</b> \u00B7 +50 credits</div></div>' +
      '<div class="bh-link" data-l2><svg viewBox="0 0 70 56" aria-hidden="true"><path class="bh-ar" d="M6 52 C 10 22 34 10 62 14"/><path class="bh-ar" d="M49 3 L63 14 L50 27"/></svg></div>' +
      '<div class="bh-card" data-c3><div class="bh-head"><span class="bh-no">STEP 3</span><span class="bh-ttl">It answers</span></div>' +
        '<canvas class="bh-cv" width="800" height="500"></canvas>' +
        '<div class="bh-ans" data-ans><span class="bh-badge">\u25CF WEB VERIFIED</span><div class="bh-h" data-h></div><div class="bh-p" data-p></div>' +
        '<div class="bh-tags"><span>Event horizon</span><span>Accretion disc</span><span>Gravitational lensing</span></div></div></div>' +
      '</div><div class="bh-note"><i>\u21BB</i> Repeats for every message \u00B7 drag the black hole to tilt &amp; rotate \u00B7 illustrative demo</div>';
    return d;
  }

  // ---------- Real-time black hole on the GPU (WebGL shader): light-ray marching with gravitational bending ----------
  var FS = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH','precision highp float;','#else','precision mediump float;','#endif',
  'uniform vec2 uRes; uniform float uTime, uTilt, uRoll;',
  'float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
  'float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);',
  ' return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),',
  '            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}',
  'void main(){',
  ' vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y; uv.x-=.17;',
  ' float cr=cos(uRoll),sr=sin(uRoll); uv=mat2(cr,-sr,sr,cr)*uv;',
  ' vec3 cam=15.*vec3(0.,sin(uTilt),-cos(uTilt));',
  ' vec3 f=-normalize(cam); vec3 rt=normalize(cross(f,vec3(0.,1.,0.))); vec3 up=cross(rt,f);',
  ' vec3 v=normalize(f+1.35*(uv.x*rt+uv.y*up)); vec3 p=cam;',
  ' vec3 L=cross(p,v); float h2=dot(L,L);',
  ' vec3 col=vec3(0.); float tr=1.;',
  ' for(int i=0;i<110;i++){',
  '  float r2=dot(p,p), r=sqrt(r2);',
  '  if(r<1.){tr=0.;break;}',
  '  if(r>22.&&dot(p,v)>0.)break;',
  '  float dt=clamp(.06*r,.035,.9);',
  '  vec3 a=-1.5*h2*p/(r2*r2*r);',
  '  vec3 vN=normalize(v+a*dt); vec3 pN=p+vN*dt;',
  '  if(p.y*pN.y<0.){',
  '   vec3 hp=mix(p,pN,p.y/(p.y-pN.y)); float rr=length(hp.xz);',
  '   if(rr>3.&&rr<9.){',
  '    float ang=atan(hp.z,hp.x)-uTime*3.2/(rr*sqrt(rr));',
  '    vec3 q=vec3(rr*7.,cos(ang)*3.,sin(ang)*3.);',
  '    float n=vn(q)*.6+vn(q*2.3+7.)*.4;',
  '    float T=pow(3./rr,1.1);',
  '    vec3 c=mix(vec3(1.,.28,.05),vec3(1.,.93,.8),smoothstep(.4,1.,T));',
  '    vec3 gv=normalize(vec3(-hp.z,0.,hp.x)); float beta=sqrt(.5/rr);',
  '    float D=1./(1.-beta*clamp(dot(gv,-v),-1.,1.)); float dop=D*D;',
  '    float edge=smoothstep(3.,3.5,rr)*(1.-smoothstep(7.5,9.,rr));',
  '    float al=clamp((.25+.9*n)*edge,0.,.95);',
  '    col+=tr*al*c*T*3.8*(.5+1.5*n)*dop; tr*=1.-al;',
  '   }',
  '  }',
  '  p=pN; v=vN;',
  ' }',
  ' if(tr>0.){vec3 s=floor(v*220.); float h=hash(s); col+=tr*vec3(smoothstep(.9985,1.,h))*.55;}',
  ' col+=vec3(1.,.45,.15)*.1*exp(-6.*length(uv));',
  ' col=1.-exp(-col*1.5); col=pow(col,vec3(.85));',
  ' gl_FragColor=vec4(col,1.);',
  '}'].join('\n');
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  function blackHoleGL(cv, state) {
    var small = window.matchMedia && matchMedia('(max-width:760px)').matches;
    cv.width = small ? 512 : 640; cv.height = small ? 320 : 400;
    var gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl');
    if (!gl) return false;
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'uRes'), uT = gl.getUniformLocation(pr, 'uTime'), uTi = gl.getUniformLocation(pr, 'uTilt'), uRo = gl.getUniformLocation(pr, 'uRoll');
    gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uR, cv.width, cv.height);
    var tilt = .24, roll = -.16, drag = false, lx = 0, ly = 0, t0 = performance.now();
    cv.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; ly = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (x) {} cv.style.cursor = 'grabbing'; });
    function end() { drag = false; cv.style.cursor = 'grab'; }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      roll = Math.max(-.8, Math.min(.8, roll + (e.clientX - lx) * .006)); lx = e.clientX;
      if (e.pointerType === 'mouse') { tilt = Math.max(.03, Math.min(1.1, tilt + (e.clientY - ly) * .004)); ly = e.clientY; }
    });
    (function frame(now) {
      requestAnimationFrame(frame);
      if (!state.visible) return;
      var t = (now - t0) / 1000;
      gl.uniform1f(uT, t); gl.uniform1f(uTi, drag ? tilt : tilt + Math.sin(t / 2.6) * .03); gl.uniform1f(uRo, drag ? roll : roll + Math.sin(t / 3.4) * .03);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    })(t0);
    return true;
  }

  // ---------- Gargantua-style black hole on pure black: streaked disc rings, lensed arcs, photon ring ----------
  function blackHole(cv, state) {
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W * .6, cy = H * .5, Rh = W * .095, N = 44,
        rings = [], stars = [], i, j, t0 = 0, tilt = .26, roll = -.2, drag = false, lx = 0, ly = 0, k = W / 800;
    for (i = 0; i < 110; i++) stars.push([Math.random() * W, Math.random() * H, Math.random() * 1.2 + .3, Math.random() * .6 + .2]);
    for (i = 0; i < N; i++) {
      var f = i / (N - 1), heat = 1 - Math.pow(f, .75), dash = [], n = 6 + ((Math.random() * 5) | 0) * 2;
      for (j = 0; j < n; j++) dash.push(j % 2 ? 1 + Math.random() * 16 * k : (3 + Math.random() * (28 + (1 - heat) * 50)) * k);
      var g = Math.round(90 + heat * 155), b = Math.round(25 + heat * heat * 210);
      rings.push({ r: 1.3 + Math.pow(f, 1.2) * 4.3, heat: heat, dash: dash, lw: Rh * (.07 + Math.random() * .06), off: Math.random() * 300,
                   sp: 170 * k / Math.pow(1.3 + f * 4, 1.4), rgb: '255,' + g + ',' + b, a: .13 + .42 * heat, grad: null });
    }
    cv.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; ly = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (x) {} cv.style.cursor = 'grabbing'; });
    function end() { drag = false; cv.style.cursor = 'grab'; }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      roll = Math.max(-.6, Math.min(.6, roll + (e.clientX - lx) * .006)); lx = e.clientX;
      if (e.pointerType === 'mouse') { tilt = Math.max(.07, Math.min(.75, tilt + (e.clientY - ly) * .004)); ly = e.clientY; }
    });
    function gradFor(r) {
      var gr = ctx.createLinearGradient(cx - 5 * Rh, 0, cx + 3 * Rh, 0);
      gr.addColorStop(0, 'rgba(' + r.rgb + ',' + r.a + ')'); gr.addColorStop(.55, 'rgba(' + r.rgb + ',' + (r.a * .7) + ')'); gr.addColorStop(1, 'rgba(' + r.rgb + ',' + (r.a * .16) + ')');
      return gr;
    }
    function frame(t) {
      requestAnimationFrame(frame);
      if (!state.visible) return;
      var dt = Math.min(.05, (t - t0) / 1000 || .016); t0 = t;
      var tl = drag ? tilt : tilt + Math.sin(t / 2600) * .05, rl = drag ? roll : roll + Math.sin(t / 3400) * .04, sn = Math.sin(tl);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      for (i = 0; i < stars.length; i++) { ctx.fillStyle = 'rgba(255,255,255,' + stars[i][3] + ')'; ctx.fillRect(stars[i][0], stars[i][1], stars[i][2], stars[i][2]); }
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rl); ctx.translate(-cx, -cy);
      ctx.globalCompositeOperation = 'lighter';
      var hl = ctx.createRadialGradient(cx, cy, Rh, cx, cy, Rh * 4.6);
      hl.addColorStop(0, 'rgba(255,130,50,.22)'); hl.addColorStop(1, 'rgba(255,110,40,0)'); ctx.fillStyle = hl; ctx.fillRect(-W, -H, 3 * W, 3 * H);
      var bl = ctx.createRadialGradient(cx - Rh * 1.9, cy + Rh * .1, 0, cx - Rh * 1.9, cy + Rh * .1, Rh * 2.3);
      bl.addColorStop(0, 'rgba(255,240,215,.55)'); bl.addColorStop(.4, 'rgba(255,170,90,.22)'); bl.addColorStop(1, 'rgba(255,130,50,0)'); ctx.fillStyle = bl; ctx.fillRect(-W, -H, 3 * W, 3 * H);
      ctx.lineCap = 'butt';
      for (i = 0; i < N; i++) {                       // far side of disc + lensed arcs over / under the hole
        var r = rings[i]; if (!r.grad) r.grad = gradFor(r);
        r.off -= r.sp * dt; ctx.setLineDash(r.dash); ctx.lineDashOffset = r.off; ctx.strokeStyle = r.grad; ctx.lineWidth = r.lw;
        ctx.beginPath(); ctx.ellipse(cx, cy, r.r * Rh, r.r * Rh * sn, 0, Math.PI, 2 * Math.PI); ctx.stroke();
        var Rl = Rh * (1.05 + (r.r - 1.3) * .17);
        ctx.beginPath(); ctx.arc(cx, cy, Rl, Math.PI, 2 * Math.PI); ctx.stroke();
        if (r.r < 3.2) { ctx.globalAlpha = .45; ctx.beginPath(); ctx.arc(cx, cy, Rh * (1.04 + (r.r - 1.3) * .07), 0, Math.PI); ctx.stroke(); ctx.globalAlpha = 1; }
      }
      ctx.setLineDash([]);
      ctx.lineWidth = Rh * .22; ctx.strokeStyle = 'rgba(255,170,90,.16)'; ctx.beginPath(); ctx.arc(cx, cy, Rh * 1.06, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = Rh * .07; ctx.strokeStyle = 'rgba(255,246,230,.95)'; ctx.beginPath(); ctx.arc(cx, cy, Rh * 1.02, 0, 6.2832); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      var hz = ctx.createRadialGradient(cx, cy, Rh * .9, cx, cy, Rh * 1.0);
      hz.addColorStop(0, '#000'); hz.addColorStop(1, 'rgba(0,0,0,.96)'); ctx.fillStyle = hz; ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < N; i++) {                       // near side of disc, passes in front of the hole
        var q = rings[i]; ctx.setLineDash(q.dash); ctx.lineDashOffset = -q.off; ctx.strokeStyle = q.grad; ctx.lineWidth = q.lw * 1.1;
        ctx.beginPath(); ctx.ellipse(cx, cy, q.r * Rh, q.r * Rh * sn, 0, 0, Math.PI); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore(); ctx.globalCompositeOperation = 'source-over';
      var vg = ctx.createRadialGradient(W * .55, H * .5, H * .45, W * .55, H * .5, W * .75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  }

  function run(d) {
    var q = function (s) { return d.querySelector(s); }, c = [q('[data-c1]'), q('[data-c2]'), q('[data-c3]')],
        links = [q('[data-l1]'), q('[data-l2]')], msg = q('[data-msg]'), rows = d.querySelectorAll('.bh-rt'),
        ver = q('[data-ver]'), ans = q('[data-ans]'), hh = q('[data-h]'), pp = q('[data-p]'), state = { visible: false };
    new IntersectionObserver(function (e) { state.visible = e[0].isIntersecting; }).observe(d);
    var cvs = q('canvas');
    if (!blackHoleGL(cvs, state)) { // no WebGL: lightweight 2D fallback on a fresh canvas
      var nc = cvs.cloneNode(false); nc.width = 640; nc.height = 400; cvs.parentNode.replaceChild(nc, cvs); blackHole(nc, state);
    }
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    async function wait(ms) { do { await sleep(ms); } while (!state.visible); }
    async function type(el, s, ms) { el.textContent = ''; for (var k = 0; k < s.length; k++) { el.textContent += s[k]; if (!reduce) await sleep(ms); } }
    async function typeHTML(el, html, ms) { // types visible text but keeps <em> tags intact
      var out = '', tag = false; el.innerHTML = '';
      for (var k = 0; k < html.length; k++) { var ch = html[k]; out += ch; if (ch === '<') tag = true; if (ch === '>') { tag = false; continue; }
        if (!tag) { el.innerHTML = out + (out.indexOf('<em>') > out.lastIndexOf('</em>') ? '</em>' : ''); if (!reduce) await sleep(ms); } }
      el.innerHTML = html;
    }
    (async function loop() {
      for (;;) {
        c.forEach(function (x) { x.classList.remove('on'); }); links.forEach(function (x) { x.classList.remove('on'); });
        rows.forEach(function (r, n) { r.className = 'bh-rt'; r.querySelector('.bh-ic').textContent = n + 1; }); ver.classList.remove('on'); ans.classList.remove('on');
        msg.textContent = ''; hh.textContent = ''; pp.innerHTML = '';
        await wait(500);
        c[0].classList.add('on'); await sleep(500); await type(msg, MSG, 65);
        await sleep(700); links[0].classList.add('on'); c[1].classList.add('on'); await sleep(600);
        for (var i = 0; i < 4; i++) {
          rows[i].className = 'bh-rt cur'; await sleep(reduce ? 150 : 700);
          rows[i].className = 'bh-rt ' + (i < 3 ? 'skip' : 'hit');
          rows[i].querySelector('.bh-ic').textContent = i < 3 ? '\u2715' : '\u2713';
          await sleep(reduce ? 150 : 500);
        }
        await sleep(300); ver.classList.add('on'); await sleep(1500);
        links[1].classList.add('on'); c[2].classList.add('on'); await sleep(700); ans.classList.add('on');
        await type(hh, HEAD, 70); await typeHTML(pp, BODY, 20);
        await sleep(10000);
      }
    })();
  }

  var tries = 0, timer = setInterval(function () {
    var hosts = document.querySelectorAll('.rp-copy');
    hosts.forEach(function (h) {
      if (h.querySelector('.bh-demo')) return;
      var f = h.querySelector('.rp-feats'); if (!f) return;
      var d = build(); h.insertBefore(d, f); run(d);
    });
    if ((hosts.length && document.querySelector('.bh-demo')) || ++tries > 40) clearInterval(timer);
  }, 250);
})();
