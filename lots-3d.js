/* Bouton « Explorer en 3D » de /lots : la vue 3D (/lotissement-3d) n'est chargée qu'au clic. Sans JavaScript, la vue reste masquée. */
(function () {
  var fig = document.getElementById('vue-3d'), btn = fig && fig.querySelector('.vue3d__start');
  if (!btn) return;
  fig.hidden = false;
  btn.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.src = '/lotissement-3d';
    f.title = "Vue 3D interactive du Clos des Cyprès : les 8 lots, la voie et la placette";
    f.setAttribute('allowfullscreen', '');
    btn.parentNode.insertBefore(f, btn);
    btn.remove();
    f.focus();
  });
})();
