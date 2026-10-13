/* Capa de datos en MODO LOCAL (prototipo).
 *
 * Todas las pantallas hablan únicamente con AL.store. Cada función devuelve una Promesa,
 * igual que lo hará la versión con Firebase, de modo que al conectar Firestore solo se
 * reemplaza este archivo por js/store-firebase.js con las mismas funciones.
 *
 * Colecciones (mismos nombres que tendrá Firestore):
 *   cuentos, preguntas, claves, sesiones, respuestas, config
 *
 * LÍMITES DE ESTE MODO: los datos viven en el almacenamiento de este navegador. No se
 * comparten entre dispositivos, el acceso de administrador no es una autenticación real
 * y la clave de respuestas es visible para quien inspeccione el navegador.
 */
(function (AL) {
  'use strict';
  const CLAVE = 'aventuraLectora.v2';
  const CLAVE_SESION = 'aventuraLectora.sesion';
  const CLAVE_ADMIN = 'aventuraLectora.admin';
  let mem = null;
  let persistente = true;

  const copia = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };
  const ok = function (x) { return Promise.resolve(copia(x)); };
  const lista = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };

  function leer(k, sesion) {
    try { return (sesion ? sessionStorage : localStorage).getItem(k); } catch (e) { persistente = false; return null; }
  }
  function escribir(k, v, sesion) {
    try {
      const a = sesion ? sessionStorage : localStorage;
      if (v === null) a.removeItem(k); else a.setItem(k, v);
    } catch (e) { persistente = false; }
  }
  function inicial() {
    const s = AL.semilla();
    return { cuentos: s.cuentos, preguntas: s.preguntas, claves: s.claves, sesiones: {}, respuestas: {},
      semillas: Object.keys(s.cuentos), config: { fasesActivas: { inicial: true, intervencion: false, cierre: false }, modoDatos: 'prueba' } };
  }
  function db() {
    if (!mem) {
      try { mem = JSON.parse(leer(CLAVE)); } catch (e) { mem = null; }
      if (!mem || !mem.cuentos) { mem = inicial(); guardar(); }
      else actualizarSemilla();
    }
    return mem;
  }
  /* Si una versión nueva trae cuentos iniciales que este navegador nunca recibió, los agrega
   * sin tocar lo que el administrador ya editó ni volver a traer lo que eliminó. */
  function actualizarSemilla() {
    const s = AL.semilla();
    const ya = mem.semillas || ['huerta'];
    let cambio = !mem.semillas;
    Object.keys(s.cuentos).forEach(function (id) {
      if (ya.indexOf(id) >= 0) return;
      ya.push(id); cambio = true;
      mem.cuentos[id] = s.cuentos[id];
      Object.keys(s.preguntas).forEach(function (k) {
        if (s.preguntas[k].cuentoId === id) { mem.preguntas[k] = s.preguntas[k]; mem.claves[k] = s.claves[k]; }
      });
    });
    mem.semillas = ya;
    if (cambio) guardar();
  }
  function guardar() { escribir(CLAVE, JSON.stringify(mem)); }
  function faseDe(c) { return (c && c.fase) || 'intervencion'; }
  function visible(c) { return c.publicado && !!(db().config.fasesActivas || {})[faseDe(c)]; }
  function porOrden(a, b) { return (a.orden || 0) - (b.orden || 0); }

  const store = {
    info: function () { db(); return ok({ modo: 'local', persistente: persistente }); },

    /* ---------- configuración ---------- */
    getConfig: function () { return ok(db().config); },
    saveConfig: function (parcial) { Object.assign(db().config, parcial); guardar(); return ok(mem.config); },

    /* ---------- cuentos ---------- */
    listCuentos: function (o) {
      let l = lista(db().cuentos).sort(porOrden);
      /* Vista del estudiante: solo cuentos publicados cuya fase esté activada por el administrador. */
      if (o && o.soloPublicados) l = l.filter(visible);
      return ok(l);
    },
    saveCuento: function (c) {
      c = copia(c);
      if (!c.id) { c.id = AL.ui.id('cuento'); c.orden = lista(db().cuentos).length + 1; }
      db().cuentos[c.id] = c; guardar(); return ok(c);
    },
    deleteCuento: function (id) {
      const d = db();
      delete d.cuentos[id];
      lista(d.preguntas).forEach(function (p) {
        if (p.cuentoId === id) { delete d.preguntas[p.id]; delete d.claves[p.id]; }
      });
      guardar(); return ok(true);
    },

    /* ---------- preguntas y claves ---------- */
    listPreguntas: function (o) {
      const d = db();
      let l = lista(d.preguntas).sort(function (a, b) {
        return porOrden(d.cuentos[a.cuentoId] || {}, d.cuentos[b.cuentoId] || {}) || porOrden(a, b);
      });
      if (o && o.soloPublicadas) {
        l = l.filter(function (p) { return p.publicada && d.cuentos[p.cuentoId] && visible(d.cuentos[p.cuentoId]); });
      }
      return ok(l);
    },
    savePregunta: function (p, clave) {
      p = copia(p);
      if (!p.id) p.id = AL.ui.id('preg');
      db().preguntas[p.id] = p;
      if (clave) db().claves[p.id] = copia(clave);
      guardar(); return ok(p);
    },
    deletePregunta: function (id) { delete db().preguntas[id]; delete db().claves[id]; guardar(); return ok(true); },
    /* Solo para el panel. En Firestore esta lectura quedará restringida a administradores. */
    listClaves: function () { return ok(db().claves); },
    /* El estudiante solo puede conocer la clave de una pregunta que ya respondió
     * (la misma condición que impondrán las reglas de Firestore). */
    claveTrasResponder: function (sesionId, preguntaId) {
      const d = db();
      const ya = lista(d.respuestas).some(function (r) { return r.sesionId === sesionId && r.preguntaId === preguntaId; });
      return ya ? ok(d.claves[preguntaId]) : Promise.reject(new Error('Primero responde la pregunta.'));
    },

    /* ---------- sesiones de estudiantes ---------- */
    /* Si el estudiante ya había entrado en este dispositivo con el mismo nombre, se retoma su
     * sesión: así volver a entrar no crea un segundo registro de la misma persona. */
    crearSesion: function (nombre, extra) {
      const d = db();
      const norm = AL.ui.normalizarNombre(nombre);
      const previa = lista(d.sesiones).filter(function (x) { return x.nombreNorm === norm; })[0];
      if (previa) {
        if (!extra || !extra.sinActivar) escribir(CLAVE_SESION, previa.id);
        return ok(previa);
      }
      const s = Object.assign({
        id: AL.ui.id('ses'), nombre: AL.ui.nombreBonito(nombre), nombreNorm: AL.ui.normalizarNombre(nombre),
        inicio: new Date().toISOString(),
        esPrueba: d.config.modoDatos !== 'real', orientacion: false, lecturas: {}, cierre: false
      }, extra || {});
      d.sesiones[s.id] = s; guardar();
      if (!extra || !extra.sinActivar) escribir(CLAVE_SESION, s.id);
      return ok(s);
    },
    sesionActual: function () { const id = leer(CLAVE_SESION); return ok(id && db().sesiones[id] ? db().sesiones[id] : null); },
    cerrarSesion: function () { escribir(CLAVE_SESION, null); return ok(true); },
    actualizarSesion: function (id, parcial) {
      const s = db().sesiones[id];
      if (!s) return ok(null);
      Object.assign(s, copia(parcial)); guardar(); return ok(s);
    },
    listSesiones: function () { return ok(lista(db().sesiones)); },

    /* ---------- respuestas ----------
     * Cada intento se guarda como un registro nuevo: nunca se sobrescribe el historial.
     * En modo local la corrección se calcula aquí. Con Firebase, el estudiante guardará
     * primero su respuesta y solo después podrá leer la clave de esa pregunta.
     */
    responder: function (dato) {
      const d = db();
      const p = d.preguntas[dato.preguntaId];
      const s = d.sesiones[dato.sesionId];
      if (!p || !s) return Promise.reject(new Error('No se encontró la pregunta o la sesión.'));
      const fase = faseDe(d.cuentos[p.cuentoId]);
      const previas = lista(d.respuestas).filter(function (r) {
        return r.sesionId === s.id && r.preguntaId === p.id;
      }).sort(function (a, b) { return a.intento - b.intento; });
      /* En el diagnóstico y en el cierre hay una sola respuesta por pregunta: si ya existe,
       * se devuelve la guardada y no se crea otra (evita duplicados al recargar o reingresar). */
      if (fase !== 'intervencion' && previas.length) return ok(Object.assign({ repetida: true }, previas[0]));
      const r = {
        id: AL.ui.id('resp'), sesionId: s.id, preguntaId: p.id, cuentoId: p.cuentoId,
        subcategoria: p.subcategoria, modulo: p.modulo, tipo: p.tipo, seleccion: copia(dato.seleccion),
        correcta: AL.evaluar(p, d.claves[p.id], dato.seleccion), intento: previas.length + 1,
        momento: fase, fecha: new Date().toISOString(), esPrueba: !!s.esPrueba
      };
      d.respuestas[r.id] = r; guardar(); return ok(r);
    },
    listRespuestas: function (f) {
      let l = lista(db().respuestas);
      if (f && f.sesionId) l = l.filter(function (r) { return r.sesionId === f.sesionId; });
      return ok(l);
    },

    /* ---------- mantenimiento ---------- */
    borrarPrueba: function () {
      const d = db(); let n = 0;
      lista(d.sesiones).forEach(function (s) { if (s.esPrueba) { delete d.sesiones[s.id]; n++; } });
      lista(d.respuestas).forEach(function (r) { if (r.esPrueba || !d.sesiones[r.sesionId]) delete d.respuestas[r.id]; });
      guardar(); return ok(n);
    },
    reiniciarTodo: function () { mem = inicial(); guardar(); escribir(CLAVE_SESION, null); return ok(true); },

    /* ---------- acceso administrativo (SIMULADO en modo local) ---------- */
    adminLogin: function (correo, clave) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo || '')) return Promise.reject(new Error('Escriba un correo válido.'));
      if (!clave || clave.length < 6) return Promise.reject(new Error('La contraseña debe tener al menos 6 caracteres.'));
      escribir(CLAVE_ADMIN, correo, true);
      return ok({ correo: correo });
    },
    adminActual: function () { const c = leer(CLAVE_ADMIN, true); return ok(c ? { correo: c } : null); },
    adminLogout: function () { escribir(CLAVE_ADMIN, null, true); return ok(true); },
    adminRecuperar: function () {
      return Promise.reject(new Error('La recuperación de contraseña estará disponible al conectar Firebase Authentication.'));
    }
  };

  AL.store = store;
})(window.AL = window.AL || {});
