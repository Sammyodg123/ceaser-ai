/* CEASER AI — lightweight visual effects (no dependencies) */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce)return;

  // 1) subtle binary rain
  var c=document.createElement('canvas');c.id='ce-rain';document.body.prepend(c);
  var x=c.getContext('2d'),w,h,cols,drops,size=16;
  function fit(){w=c.width=innerWidth;h=c.height=innerHeight;cols=Math.ceil(w/size);drops=[];for(var i=0;i<cols;i++)drops[i]=Math.random()*h/size}
  fit();addEventListener('resize',fit);
  var last=0;
  function rain(t){
    if(t-last>55&&!document.hidden){last=t;
      x.fillStyle='rgba(5,7,12,.14)';x.fillRect(0,0,w,h);
      x.fillStyle='#00ff96';x.font=size+'px "JetBrains Mono Variable",monospace';
      for(var i=0;i<cols;i++){
        x.fillText(Math.random()>.5?'1':'0',i*size,drops[i]*size);
        if(drops[i]*size>h&&Math.random()>.975)drops[i]=0;drops[i]++;
      }}
    requestAnimationFrame(rain);
  }
  requestAnimationFrame(rain);

  // 2) cursor glow
  var g=document.createElement('div');g.id='ce-glow';document.body.prepend(g);
  addEventListener('pointermove',function(e){g.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)'},{passive:true});

  // 3) scroll reveal (uses a data attribute so React re-renders never remove it)
  var sel='.feature,.plan,.faq,.step,.stat,.project-card,.card,.hero-cta,.section-head,.endpoint,.sponsor-section';
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.setAttribute('data-rv','in');io.unobserve(e.target)}})},{threshold:.12});
  function scan(){document.querySelectorAll(sel).forEach(function(el){
    if(el.hasAttribute('data-rv'))return;
    if(el.closest('.msg,.composer,.modal,.sidebar,.thread'))return; // never hide chat UI
    el.setAttribute('data-rv','');io.observe(el)})}
  scan();
  var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(scan,120)}).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
})();
