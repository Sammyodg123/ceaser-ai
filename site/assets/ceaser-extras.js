/* v21.5: adds Blog/About/Privacy/Contact links to the landing menu + footer (survives re-render) */
(function(){
  var L=[['Blog','/blog/'],['About','/about.html'],['Privacy Policy','/privacy.html'],['Contact','/contact.html']];
  function add(){
    var nl=document.querySelector('.navlinks');
    if(nl&&!nl.querySelector('[data-x]')){
      var first=nl.querySelector('.acct,.btn');
      L.slice(0,1).concat([L[1],L[3]]).forEach(function(l){
        var a=document.createElement('a');a.className='nl';a.href=l[1];a.textContent=l[0];a.setAttribute('data-x','1');
        nl.insertBefore(a,first);
      });
    }
    var f=document.querySelector('.foot');
    if(f&&!f.querySelector('.xlinks')){
      var d=document.createElement('div');d.className='xlinks';
      d.innerHTML=L.map(function(l){return '<a href="'+l[1]+'">'+l[0]+'</a>'}).join('');
      f.insertBefore(d,f.firstChild);
    }
  }
  var mo=new MutationObserver(add);
  function start(){add();var a=document.getElementById('app')||document.body;mo.observe(a,{childList:true,subtree:true});}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
