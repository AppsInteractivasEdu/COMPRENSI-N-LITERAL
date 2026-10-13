/* Capa de datos con FIREBASE (Authentication + Cloud Firestore).
 *
 * Ofrece exactamente las mismas funciones que js/store-local.js, de modo que las pantallas
 * no cambian. Se activa poniendo modo: 'firebase' en js/firebase-config.js.
 *
 * Identidad
 *   Estudiantes: sesión anónima de Firebase. El identificador de la sesión de trabajo es
 *                <uid>_<nombre-normalizado>, así que volver a entrar con el mismo nombre en el
 *                mismo dispositivo retoma el mismo registro.
 *   Administradores: correo y contraseña, y además deben figurar en la colección
 *                «administradores» (se crea a mano en la consola de Firebase).
 *
 * Protección (la aplican las reglas de firestore.rules, no este archivo)
 *   - El estudiante nunca escribe si su respuesta fue correcta: lo calcula el panel con la clave.
 *   - La clave de una pregunta solo se puede leer después de responderla y solo en la intervención.
 *   - Cada respuesta es un documento nuevo que no se puede modificar. En diagnóstico y cierre
 *     solo se admite el intento 1, así que no puede haber duplicados.
 *
 * Cuotas del plan gratuito: el contenido y las respuestas propias se guardan en memoria durante
 * la visita para no repetir lecturas en cada pantalla.
 */
(function (AL) {
  'use strict';
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const CLAVE_SESION = 'aventuraLectora.sesion';
  const CONFIG_INICIAL = { fasesActivas: { inicial: true, intervencion: false, cierre: false }, modoDatos: 'prueba' };

  function guion(src) {
    return new Promise(function (ok, mal) {
      const s = document.createElement('script');
      s.src = src; s.onload = ok;
      s.onerror = function () { mal(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function recordar(v) {
    try {
      if (v === undefined) return localStorage.getItem(CLAVE_SESION);
      if (v === null) localStorage.removeItem(CLAVE_SESION); else localStorage.setItem(CLAVE_SESION, v);
    } catch (e) { /* sin almacenamiento local: la sesión dura solo esta visita */ }
    return v;
  }
  const copia = function (x) { return x === undefined || x === null ? x : JSON.parse(JSON.stringify(x)); };
  function porOrden(a, b) { return (a.orden || 0) - (b.orden || 0); }
  function mensajeAuth(e) {
    const c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return 'Correo o contraseña incorrectos.';
    if (/too-many-requests/.test(c)) return 'Demasiados intentos. Espere unos minutos y vuelva a intentarlo.';
    if (/network-request-failed/.test(c)) return 'No hay conexión a internet.';
    if (/operation-not-allowed/.test(c)) return 'Este método de acceso no está habilitado en Firebase Authentication.';
    return 'No se pudo completar la operación. Inténtelo de nuevo.';
  }

  AL.crearStoreFirebase = async function () {
    if (!window.firebase) {
      await guion(SDK + 'firebase-app-compat.js');
      await guion(SDK + 'firebase-auth-compat.js');
      await guion(SDK + 'firebase-firestore-compat.js');
    }
    const fb = window.firebase;
    if (!fb.apps || !fb.apps.length) fb.initializeApp(AL.config.firebase);
    const auth = fb.auth(), db = fb.firestore();
    await new Promise(function (listo) { const fin = auth.onAuthStateChanged(function () { fin(); listo(); }); });

    /* Memoria de la visita */
    let C = {};
    function olvidar() { C = { ses: {}, resp: {}, claves: {}, marcas: {} }; }
    olvidar();
    const uid = function () { return auth.currentUser ? auth.currentUser.uid : null; };
    async function todos(col) { return (await db.collection(col).get()).docs.map(function (d) { return d.data(); }); }

    async function contenido() {
      if (C.cuentos) return;
      const r = await Promise.all([db.collection('config').doc('general').get(), todos('cuentos'), todos('preguntas')]);
      C.config = Object.assign({}, CONFIG_INICIAL, r[0].exists ? r[0].data() : {});
      C.cuentos = r[1].sort(porOrden);
      const orden = {};
      C.cuentos.forEach(function (c) { orden[c.id] = c; });
      C.preguntas = r[2].sort(function (a, b) { return porOrden(orden[a.cuentoId] || {}, orden[b.cuentoId] || {}) || porOrden(a, b); });
    }
    function cuento(id) { return C.cuentos.filter(function (c) { return c.id === id; })[0]; }
    function faseDe(c) { return (c && c.fase) || 'intervencion'; }
    function visible(c) { return !!c && c.publicado && !!(C.config.fasesActivas || {})[faseDe(c)]; }

    async function clave(pid) {
      if (!(pid in C.claves)) {
        const d = await db.collection('claves').doc(pid).get();
        C.claves[pid] = d.exists ? d.data() : null;
      }
      return C.claves[pid];
    }
    async function respuestasDe(sid) {
      if (!C.resp[sid]) {
        const q = await db.collection('respuestas').where('uid', '==', uid()).where('sesionId', '==', sid).get();
        C.resp[sid] = q.docs.map(function (d) { return d.data(); });
      }
      return C.resp[sid];
    }
    async function borrarTodo(col, filtro) {
      const docs = (await db.collection(col).get()).docs.filter(function (d) { return !filtro || filtro(d.data(), d.id); });
      for (let i = 0; i < docs.length; i += 400) {
        const lote = db.batch();
        docs.slice(i, i + 400).forEach(function (d) { lote.delete(d.ref); });
        await lote.commit();
      }
      return docs.length;
    }
    /* Sube el contenido inicial (tres fases) cuando la base de datos está vacía. */
    async function sembrar() {
      const s = AL.semilla(), lote = db.batch();
      Object.keys(s.cuentos).forEach(function (id) { lote.set(db.collection('cuentos').doc(id), s.cuentos[id]); });
      Object.keys(s.preguntas).forEach(function (id) {
        const fase = faseDe(s.cuentos[s.preguntas[id].cuentoId]);
        lote.set(db.collection('preguntas').doc(id), Object.assign({ fase: fase }, s.preguntas[id]));
        lote.set(db.collection('claves').doc(id), Object.assign({ fase: fase }, s.claves[id]));
      });
      lote.set(db.collection('config').doc('general'), CONFIG_INICIAL);
      await lote.commit();
      olvidar();
    }
    let adminDe = {};
    async function esAdmin() {
      const u = auth.currentUser;
      if (!u || u.isAnonymous) return false;
      if (!(u.uid in adminDe)) {
        try { adminDe[u.uid] = (await db.collection('administradores').doc(u.uid).get()).exists; }
        catch (e) { adminDe[u.uid] = false; }
      }
      return adminDe[u.uid];
    }

    const store = {
      info: async function () { return { modo: 'firebase', persistente: true }; },

      /* ---------- configuración ---------- */
      getConfig: async function () { await contenido(); return copia(C.config); },
      saveConfig: async function (parcial) {
        await contenido();
        Object.assign(C.config, copia(parcial));
        await db.collection('config').doc('general').set(C.config);
        return copia(C.config);
      },

      /* ---------- cuentos ---------- */
      listCuentos: async function (o) {
        await contenido();
        return copia(o && o.soloPublicados ? C.cuentos.filter(visible) : C.cuentos);
      },
      saveCuento: async function (c) {
        await contenido();
        c = copia(c);
        if (!c.id) { c.id = AL.ui.id('cuento'); c.orden = C.cuentos.length + 1; }
        c.fase = faseDe(c);
        const lote = db.batch();
        lote.set(db.collection('cuentos').doc(c.id), c);
        /* La fase se copia en preguntas y claves porque las reglas de seguridad la consultan allí. */
        C.preguntas.filter(function (p) { return p.cuentoId === c.id && p.fase !== c.fase; }).forEach(function (p) {
          lote.update(db.collection('preguntas').doc(p.id), { fase: c.fase });
          lote.update(db.collection('claves').doc(p.id), { fase: c.fase });
        });
        await lote.commit(); olvidar();
        return c;
      },
      deleteCuento: async function (id) {
        await contenido();
        const lote = db.batch();
        lote.delete(db.collection('cuentos').doc(id));
        C.preguntas.filter(function (p) { return p.cuentoId === id; }).forEach(function (p) {
          lote.delete(db.collection('preguntas').doc(p.id)); lote.delete(db.collection('claves').doc(p.id));
        });
        await lote.commit(); olvidar();
        return true;
      },

      /* ---------- preguntas y claves ---------- */
      listPreguntas: async function (o) {
        await contenido();
        let l = C.preguntas;
        if (o && o.soloPublicadas) l = l.filter(function (p) { return p.publicada && visible(cuento(p.cuentoId)); });
        return copia(l);
      },
      savePregunta: async function (p, k) {
        await contenido();
        p = copia(p);
        if (!p.id) p.id = AL.ui.id('preg');
        p.fase = faseDe(cuento(p.cuentoId));
        const lote = db.batch();
        lote.set(db.collection('preguntas').doc(p.id), p);
        if (k) lote.set(db.collection('claves').doc(p.id), Object.assign({ fase: p.fase }, copia(k)));
        await lote.commit(); olvidar();
        return p;
      },
      deletePregunta: async function (id) {
        const lote = db.batch();
        lote.delete(db.collection('preguntas').doc(id)); lote.delete(db.collection('claves').doc(id));
        await lote.commit(); olvidar();
        return true;
      },
      listClaves: async function () {
        const m = {};
        (await db.collection('claves').get()).docs.forEach(function (d) { m[d.id] = d.data(); });
        return m;
      },
      claveTrasResponder: function (sesionId, preguntaId) { return clave(preguntaId); },

      /* ---------- sesiones de estudiantes ---------- */
      crearSesion: async function (nombre, extra) {
        if (!auth.currentUser) await auth.signInAnonymously();
        await contenido();
        const norm = AL.ui.normalizarNombre(nombre);
        const id = uid() + '_' + norm.replace(/ñ/g, 'n').replace(/\s+/g, '-');
        const ref = db.collection('sesiones').doc(id);
        const previa = await ref.get();
        let s;
        if (previa.exists) s = previa.data();
        else {
          s = Object.assign({ id: id, uid: uid(), nombre: AL.ui.nombreBonito(nombre), nombreNorm: norm, inicio: new Date().toISOString(),
            esPrueba: C.config.modoDatos !== 'real', orientacion: false, lecturas: {}, cierre: false }, extra || {});
          delete s.sinActivar;
          await ref.set(s);
        }
        C.ses[id] = s;
        if (!extra || !extra.sinActivar) recordar(id);
        return copia(s);
      },
      sesionActual: async function () {
        const id = recordar();
        if (!id || !uid() || id.split('_')[0] !== uid()) return null;
        if (!C.ses[id]) {
          const d = await db.collection('sesiones').doc(id).get();
          if (!d.exists) { recordar(null); return null; }
          C.ses[id] = d.data();
        }
        return copia(C.ses[id]);
      },
      cerrarSesion: async function () { recordar(null); return true; },
      actualizarSesion: async function (id, parcial) {
        await db.collection('sesiones').doc(id).update(copia(parcial));
        C.ses[id] = Object.assign(C.ses[id] || {}, copia(parcial));
        return copia(C.ses[id]);
      },
      listSesiones: function () { return todos('sesiones'); },

      /* ---------- respuestas ---------- */
      responder: async function (dato) {
        await contenido();
        const p = C.preguntas.filter(function (x) { return x.id === dato.preguntaId; })[0];
        const s = C.ses[dato.sesionId];
        if (!p || !s) throw new Error('No se encontró la pregunta o la sesión.');
        const fase = faseDe(cuento(p.cuentoId));
        const mias = await respuestasDe(s.id);
        const previas = mias.filter(function (r) { return r.preguntaId === p.id; }).sort(function (a, b) { return a.intento - b.intento; });
        if (fase !== 'intervencion' && previas.length) return Object.assign({ repetida: true }, copia(previas[0]));

        const n = previas.length + 1;
        const r = { id: s.id + '_' + p.id + '_' + n, uid: uid(), sesionId: s.id, preguntaId: p.id, cuentoId: p.cuentoId,
          subcategoria: p.subcategoria, modulo: p.modulo, tipo: p.tipo, seleccion: copia(dato.seleccion), intento: n,
          momento: fase, fecha: new Date().toISOString(), esPrueba: !!s.esPrueba };
        const lote = db.batch();
        lote.set(db.collection('respuestas').doc(r.id), r);
        /* La marca es lo que permite, según las reglas, leer después la clave de esta pregunta. */
        const idMarca = uid() + '_' + p.id;
        if (!C.marcas[idMarca]) {
          const m = await db.collection('marcas').doc(idMarca).get();
          if (!m.exists) lote.set(db.collection('marcas').doc(idMarca), { uid: uid(), preguntaId: p.id, fecha: r.fecha });
        }
        try { await lote.commit(); }
        catch (e) {
          /* Si ya existía (otra pestaña o doble envío), las reglas rechazan la escritura: se devuelve la guardada. */
          delete C.resp[s.id];
          const ya = (await respuestasDe(s.id)).filter(function (x) { return x.preguntaId === p.id && x.intento === n; })[0];
          if (ya) return Object.assign({ repetida: true }, copia(ya));
          throw e;
        }
        C.marcas[idMarca] = true;
        r.correcta = fase === 'intervencion' ? AL.evaluar(p, await clave(p.id), r.seleccion) : null;
        mias.push(r);
        return copia(r);
      },
      listRespuestas: async function (f) {
        if (!(f && f.sesionId)) return todos('respuestas');
        await contenido();
        const l = await respuestasDe(f.sesionId);
        /* La corrección de las respuestas propias se calcula aquí, solo para la intervención. */
        for (const r of l) {
          if (r.correcta !== undefined) continue;
          r.correcta = null;
          if (r.momento === 'intervencion') {
            const p = C.preguntas.filter(function (x) { return x.id === r.preguntaId; })[0];
            try { if (p) r.correcta = AL.evaluar(p, await clave(r.preguntaId), r.seleccion); } catch (e) { /* sin permiso: queda sin corregir */ }
          }
        }
        return copia(l);
      },

      /* ---------- mantenimiento (solo administradores) ---------- */
      borrarPrueba: async function () {
        const ses = (await todos('sesiones')).filter(function (s) { return s.esPrueba; });
        const ids = {}, uids = {};
        ses.forEach(function (s) { ids[s.id] = true; uids[s.uid] = true; });
        await borrarTodo('respuestas', function (r) { return r.esPrueba || ids[r.sesionId]; });
        await borrarTodo('sesiones', function (s) { return s.esPrueba; });
        olvidar();
        return ses.length;
      },
      reiniciarTodo: async function () {
        for (const col of ['respuestas', 'sesiones', 'marcas', 'preguntas', 'claves', 'cuentos']) await borrarTodo(col);
        await sembrar();
        return true;
      },

      /* ---------- acceso administrativo ---------- */
      adminLogin: async function (correo, contrasena) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo || '')) throw new Error('Escriba un correo válido.');
        if (!contrasena) throw new Error('Escriba la contraseña.');
        try { await auth.signInWithEmailAndPassword(correo, contrasena); }
        catch (e) { throw new Error(mensajeAuth(e)); }
        olvidar(); adminDe = {};
        if (!await esAdmin()) {
          await auth.signOut();
          throw new Error('Esta cuenta no está autorizada como administradora.');
        }
        recordar(null);
        await contenido();
        if (!C.cuentos.length) await sembrar();
        return { correo: auth.currentUser.email };
      },
      adminActual: async function () { return (await esAdmin()) ? { correo: auth.currentUser.email } : null; },
      adminLogout: async function () { await auth.signOut(); olvidar(); recordar(null); return true; },
      adminRecuperar: async function (correo) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo || '')) throw new Error('Escriba su correo en el campo de arriba y vuelva a pulsar el enlace.');
        try { await auth.sendPasswordResetEmail(correo); } catch (e) { throw new Error(mensajeAuth(e)); }
        return true;
      }
    };
    return store;
  };
})(window.AL = window.AL || {});
