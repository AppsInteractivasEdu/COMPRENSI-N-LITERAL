/* Arranque: estado compartido, barra superior y navegación entre pantallas. */
(function (AL) {
  'use strict';
  const U = AL.ui, h = U.h, E = AL.estudiante;

  AL.estado = { sesion: null, respuestas: [], cuentos: [], preguntas: [], admin: null };

  AL.cargarEstudiante = async function () {
    const e = AL.estado;
    e.sesion = await AL.store.sesionActual();
    if (!e.sesion) { e.respuestas = []; return; }
    const r = await Promise.all([AL.store.listCuentos({ soloPublicados: true }), AL.store.listPreguntas({ soloPublicadas: true }),
      AL.store.listRespuestas({ sesionId: e.sesion.id })]);
    e.cuentos = r[0]; e.preguntas = r[1]; e.respuestas = r[2];
  };

  /* nombre de ruta -> [pantalla, requiere sesión de estudiante] */
  const RUTAS = {
    inicio: [E.inicio, false], entrar: [E.entrar, false], mapa: [E.mapa, true], orientacion: [E.orientacion, true],
    cuentos: [E.cuentos, true], cuento: [E.lector, true], modulo: [E.modulo, true], retos: [E.retos, true], mision: [E.mision, true], progreso: [E.progreso, true]
  };

  function preferencia(clave, valor) {
    try {
      if (valor === undefined) return localStorage.getItem(clave);
      localStorage.setItem(clave, valor);
    } catch (e) { /* sin almacenamiento: la preferencia dura solo esta visita */ }
    return valor;
  }

  function pintarBarra(enPanel) {
    const barra = U.limpiar(document.getElementById('barra'));
    const e = AL.estado;
    const grande = document.documentElement.dataset.texto === 'grande';
    const derecha = h('div', { class: 'fila' },
      h('button', { class: 'boton claro chico', type: 'button', 'aria-pressed': grande ? 'true' : 'false', title: 'Cambiar el tamaño de la letra',
        onclick: function () {
          document.documentElement.dataset.texto = grande ? 'normal' : 'grande';
          preferencia('aventuraLectora.texto', grande ? 'normal' : 'grande');
          pintarBarra(enPanel);
        } }, grande ? 'Letra normal' : 'Letra grande'));
    if (enPanel && e.admin) {
      derecha.appendChild(h('button', { class: 'boton claro chico', type: 'button', onclick: async function () { await AL.store.adminLogout(); location.hash = '#inicio'; } }, 'Cerrar sesión'));
    } else if (!enPanel && e.sesion) {
      derecha.insertBefore(h('span', { class: 'chip' }, e.sesion.nombre), derecha.firstChild);
      derecha.appendChild(h('button', { class: 'boton claro chico', type: 'button', onclick: async function () {
        if (!await U.confirmar('¿Terminar y salir?', 'Tu trabajo ya quedó guardado. Otro compañero podrá entrar con su nombre.', 'Terminar y salir')) return;
        await AL.store.cerrarSesion();
        if (location.hash === '#inicio') AL.navegar(); else location.hash = '#inicio';
      } }, 'Terminar y salir'));
    }
    barra.appendChild(h('a', { class: 'marca-sitio', href: enPanel ? '#admin' : (e.sesion ? '#mapa' : '#inicio') }, h('span', { 'aria-hidden': 'true' }, '📗'), 'Aventura Lectora'));
    barra.appendChild(derecha);
    const pie = U.limpiar(document.getElementById('pie'));
    pie.appendChild(h('p', {}, AL.config.modo === 'local'
      ? 'Versión ' + AL.config.version + ' · Modo local: los datos se guardan solo en este dispositivo.'
      : 'Aventura Lectora ' + AL.config.version));
  }

  let turno = 0;
  AL.navegar = async function (ev) {
    const mio = ++turno;
    const partes = location.hash.replace(/^#\/?/, '').split('.');
    const nombre = partes[0] || 'inicio', param = partes[1];
    if (nombre === 'app') return;
    if (AL.alSalir) { AL.alSalir(); AL.alSalir = null; }
    const foco = document.activeElement && document.activeElement.id;
    const app = document.getElementById('app');
    try {
      if (nombre === 'admin') {
        AL.estado.admin = await AL.admin.preparar();
        if (mio !== turno) return;
        U.limpiar(app);
        pintarBarra(true);
        AL.admin.pintar(app, param);
      } else {
        AL.graficos.limpiar();
        AL.admin.olvidar();
        await AL.cargarEstudiante();
        if (mio !== turno) return;
        const ruta = RUTAS[nombre] || RUTAS.inicio;
        if (ruta[1] && !AL.estado.sesion) { location.hash = '#entrar'; return; }
        if (nombre === 'entrar' && AL.estado.sesion) { location.hash = '#mapa'; return; }
        U.limpiar(app);
        pintarBarra(false);
        await ruta[0](app, param, partes[2]);
      }
    } catch (e) {
      console.error(e);
      U.limpiar(app).appendChild(h('section', { class: 'tarjeta' }, h('h1', {}, 'Algo no funcionó'),
        h('p', {}, 'No se pudo mostrar esta pantalla. ' + AL.explicarError(e).causa),
        h('p', { class: 'suave' }, AL.explicarError(e).detalle),
        h('a', { class: 'boton', href: '#inicio' }, 'Volver al inicio')));
    }
    if (ev) window.scrollTo(0, 0);
    const el = foco && document.getElementById(foco);
    if (el && !ev) el.focus({ preventScroll: true });
  };

  if (preferencia('aventuraLectora.texto') === 'grande') document.documentElement.dataset.texto = 'grande';
  /* Arranque. En modo firebase se descarga el SDK y se conecta antes de mostrar nada. */
  async function arrancar() {
    if (AL.config.modo === 'firebase') {
      const app = document.getElementById('app');
      app.appendChild(h('p', { class: 'centro suave' }, 'Conectando…'));
      try { AL.store = await AL.crearStoreFirebase(); }
      catch (e) {
        console.error(e);
        U.limpiar(app).appendChild(h('section', { class: 'tarjeta' }, h('h1', {}, 'No se pudo conectar'),
          h('p', {}, 'Revisa tu conexión a internet y vuelve a cargar la página.'),
          h('button', { class: 'boton', type: 'button', onclick: function () { location.reload(); } }, 'Volver a cargar')));
        return;
      }
    }
    window.addEventListener('hashchange', AL.navegar);
    AL.navegar();
  }
  arrancar();
})(window.AL = window.AL || {});
