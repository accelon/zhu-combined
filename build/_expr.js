(function(){
  var out = {};
  out.units = window.ZHU.works.map(function(w){
    var us = {};
    w.anchors.forEach(function(a){ us[a[0]] = (us[a[0]] || 0) + 1; });
    return w.id + ':' + Object.keys(us).length + '句';
  });
  document.querySelector('#reader .sent').click();
  return new Promise(function(res){
    setTimeout(function(){
      out.cards = document.querySelectorAll('#cards .wcard, #cards .work').length;
      out.text = (document.getElementById('cards') || { innerText: '' }).innerText.slice(0, 160);
      res(out);
    }, 500);
  });
})()
