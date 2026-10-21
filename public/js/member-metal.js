// The supplied Liquid Metal Button reference contributes only its 2px metal rim.
// This is a decorative membership-card material: no button role, click or ripple.
const MATERIALS = {
  fan: { speed:0, back:[.82,.83,.80,1], tint:[1,1,.99,1], shift:0 },
  ranked: { speed:.24, back:[.55,.59,.65,1], tint:[.94,.97,1,1], shift:.035 },
  super: { speed:.18, back:[.51,.49,.44,1], tint:[1,.96,.86,1], shift:.02 },
  inner: { speed:.14, back:[.19,.22,.29,1], tint:[.86,.91,1,1], shift:.05 },
};

export function mountMemberMetal(card) {
  if (!card) return () => {};
  const material=MATERIALS[card.dataset.tier] || MATERIALS.fan;
  const rim = document.createElement('div');
  rim.className='member-pass-metal';rim.setAttribute('aria-hidden','true');
  card.prepend(rim);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const connection=navigator.connection;
  const bounds=card.getBoundingClientRect();
  let disposed=false, mount=null, pageHidden=false;
  let visible=bounds.bottom>0 && bounds.top<innerHeight && bounds.right>0 && bounds.left<innerWidth;
  const update=()=>{
    if(disposed) return;
    const speed=!reduced.matches && !pageHidden && !document.hidden && visible && !connection?.saveData ? material.speed : 0;
    card.dataset.passMotion=speed?'flow':'still';
    rim.dataset.motion=speed?'flow':'still';
    mount?.setSpeed(speed);
  };
  const hide=()=>{pageHidden=true;update();};
  const show=()=>{pageHidden=false;update();};
  const observer=typeof IntersectionObserver==='function' ? new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;update();
  }) : null;
  observer?.observe(card);
  reduced.addEventListener('change',update);
  document.addEventListener('visibilitychange',update);
  connection?.addEventListener?.('change',update);
  window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
  update();
  if (material.speed && !connection?.saveData) {
    import('./vendor/paper-metal-0.0.80.js').then(({ShaderMount,liquidMetalFragmentShader})=>{
      if(disposed||!card.isConnected)return;
      try {
        mount=new ShaderMount(rim,liquidMetalFragmentShader,{
          u_colorBack:material.back,u_colorTint:material.tint,
          u_repetition:4,u_softness:.5,u_shiftRed:material.shift,u_shiftBlue:material.shift,
          u_distortion:0,u_contour:0,u_angle:45,u_shape:0,u_isImage:false,
          u_fit:2,u_scale:8,u_rotation:0,u_offsetX:.1,u_offsetY:-.1,
          u_originX:.5,u_originY:.5,u_worldWidth:0,u_worldHeight:0,
        },{alpha:true},0,12000,1,320000);
        rim.dataset.material='liquid-metal';update();
        // Both the CSS surface and the shader follow the same visibility policy.
        // dispose(), not the reference's old destroy(), releases its WebGL context.
      } catch {
        mount?.dispose();mount=null;rim.querySelectorAll('canvas').forEach(canvas=>canvas.remove());
        rim.dataset.material='static-metal';
      }
    }).catch(()=>{if(!disposed)rim.dataset.material='static-metal';});
  } else rim.dataset.material='static-metal';
  return ()=>{
    disposed=true;observer?.disconnect();
    reduced.removeEventListener('change',update);
    document.removeEventListener('visibilitychange',update);
    connection?.removeEventListener?.('change',update);
    window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);
    mount?.dispose();card.dataset.passMotion='still';rim.remove();
  };
}
