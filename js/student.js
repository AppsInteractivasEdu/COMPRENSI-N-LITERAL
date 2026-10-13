/* Pantallas del estudiante: inicio, ingreso, mapa, módulos 1 a 6, misiones lectoras y progreso.
 * El estudiante solo ve los cuentos de las fases que el administrador tenga activadas.
 */
(function (AL) {
  'use strict';
  const U = AL.ui, h = U.h;

  function fase(c) { return (c && c.fase) || 'intervencion'; }
  function deModulos() { return AL.estado.cuentos.filter(function (c) { return !c.mision; }); }
  function misiones() { return AL.estado.cuentos.filter(function (c) { return !!c.mision; }); }
  function preguntasDe(c) { return AL.estado.preguntas.filter(function (p) { return p.cuentoId === c.id; }); }
  function respondidas() { const r = {}; AL.estado.respuestas.forEach(function (x) { r[x.preguntaId] = true; }); return r; }

  /* Avance del estudiante: cuenta pasos realizados, no respuestas correctas. */
  function resumen() {
    const e = AL.estado, hechas = respondidas(), lect = e.sesion.lecturas || {};
    const cs = deModulos(), ids = {};
    cs.forEach(function (c) { ids[c.id] = true; });
    const m = {};
    m[1] = { total: 1, hechas: e.sesion.orientacion ? 1 : 0 };
    m[2] = { total: cs.length, hechas: cs.filter(function (c) { return lect[c.id]; }).length };
    [3, 4, 5].forEach(function (n) {
      const ps = e.preguntas.filter(function (p) { return p.modulo === n && ids[p.cuentoId]; });
      m[n] = { total: ps.length, hechas: ps.filter(function (p) { return hechas[p.id]; }).length };
    });
    const mis = misiones().map(function (c) {
      const ps = preguntasDe(c);
      const k = ps.filter(function (p) { return hechas[p.id]; }).length;
      return { c: c, total: ps.length, hechas: k, listo: ps.length > 0 && k >= ps.length };
    });
    const hayRetos = e.cuentos.some(function (c) { return fase(c) === 'intervencion'; });
    const previos = [1, 2, 3, 4, 5].every(function (n) { return m[n].hechas >= m[n].total; }) && mis.every(function (x) { return x.listo; });
    m[6] = { total: hayRetos ? 1 : 0, hechas: hayRetos && previos && e.sesion.cierre ? 1 : 0 };
    let total = 0, hechos = 0;
    Object.keys(m).forEach(function (n) { total += m[n].total; hechos += m[n].hechas; m[n].listo = m[n].total > 0 && m[n].hechas >= m[n].total; });
    mis.forEach(function (x) { total += x.total; hechos += x.hechas; });
    const niveles = ['Explorador de cuentos', 'Lector atento', 'Detective de historias', 'Gran lector'];
    const p = U.pct(hechos, total);
    return { m: m, mis: mis, previos: previos, total: total, hechas: hechos, pct: p, nivel: niveles[p >= 100 ? 3 : p >= 60 ? 2 : p >= 25 ? 1 : 0] };
  }

  function barra(pct, etiqueta) {
    return h('div', { class: 'avance', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': etiqueta },
      h('span', { style: 'width:' + pct + '%' }));
  }

  /* ---------- Inicio ---------- */
  function inicio(cont) {
    cont.appendChild(h('section', { class: 'portada' },
      h('div', { class: 'portada-texto' },
        h('h1', {}, 'Aventura Lectora'),
        h('p', { class: 'lema' }, 'Lee, descubre y comprende cada historia'),
        h('p', {}, 'Aquí encontrarás cuentos para leer con calma y actividades para descubrir lo que dice cada historia.'),
        h('div', { class: 'fila' },
          h('a', { class: 'boton grande', href: AL.estado.sesion ? '#mapa' : '#entrar' }, AL.estado.sesion ? 'Continuar mi aventura' : 'Entrar a aprender'))),
      AL.ilustracion({ ilustracion: 'hero', alt: 'Dos niños caminan por un sendero hacia un libro abierto.' }, 'grande')));
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', {}, '¿Cómo funciona?'),
      h('ol', { class: 'pasos' },
        h('li', {}, h('strong', {}, 'Escribe tu nombre y apellido. '), 'No necesitas correo ni contraseña.'),
        h('li', {}, h('strong', {}, 'Lee el cuento. '), 'Puedes avanzar, devolverte y leerlo otra vez.'),
        h('li', {}, h('strong', {}, 'Responde las actividades. '), 'Si no recuerdas algo, vuelve a leer el cuento.'),
        h('li', {}, h('strong', {}, 'Mira tu progreso. '), 'Gana insignias al completar cada parte.'))));
    cont.appendChild(h('p', { class: 'centro' }, h('a', { class: 'enlace', href: '#admin' }, 'Acceso para docentes y administradores')));
  }

  /* ---------- Ingreso con nombre y apellido ---------- */
  function entrar(cont) {
    const campo = h('input', { id: 'nombre-estudiante', type: 'text', autocomplete: 'off', maxlength: 60, autocapitalize: 'words', 'aria-describedby': 'nombre-ayuda' });
    const error = h('p', { class: 'error', role: 'alert', hidden: true });
    async function enviar(ev) {
      ev.preventDefault();
      const partes = U.normalizarNombre(campo.value).split(' ').filter(Boolean);
      if (partes.length < 2) {
        error.textContent = 'Escribe tu nombre y tu apellido. Por ejemplo: Ana Pérez.';
        error.hidden = false; campo.focus(); return;
      }
      const boton = ev.target.querySelector('button[type="submit"]');
      boton.disabled = true; error.hidden = true;
      try {
        await AL.store.crearSesion(campo.value);
        await AL.cargarEstudiante();
        location.hash = '#mapa';
      } catch (e) {
        console.error(e);
        const x = AL.explicarError(e);
        U.limpiar(error);
        error.appendChild(h('span', {}, 'No se pudo entrar. ' + x.causa));
        error.appendChild(h('small', { class: 'detalle' }, x.detalle));
        error.hidden = false; boton.disabled = false;
      }
    }
    cont.appendChild(h('section', { class: 'tarjeta angosta' },
      h('h1', {}, '¡Hola!'),
      h('p', {}, 'Escribe tu nombre y prepárate para leer, descubrir y aprender.'),
      h('form', { class: 'formulario', novalidate: true, onsubmit: enviar },
        h('label', { for: 'nombre-estudiante' }, 'Tu nombre y apellido'),
        campo,
        h('p', { id: 'nombre-ayuda', class: 'suave' }, 'Escríbelo siempre igual. Así continúas donde ibas y tu profesor reconoce tu trabajo.'),
        error,
        h('button', { class: 'boton grande', type: 'submit' }, 'Comenzar aventura'))));
    campo.focus();
  }

  /* ---------- Mapa ---------- */
  function mapa(cont) {
    const r = resumen(), e = AL.estado;
    cont.appendChild(h('section', { class: 'saludo' },
      h('h1', {}, '¡Hola, ' + e.sesion.nombre.split(' ')[0] + '!'),
      h('p', {}, 'Elige por dónde seguir tu aventura.'),
      barra(r.pct, 'Tu avance en la aventura'),
      h('p', { class: 'suave' }, 'Has completado ' + r.hechas + ' de ' + r.total + ' pasos · Nivel: ' + r.nivel)));
    if (!e.cuentos.length) {
      cont.appendChild(h('p', { class: 'nota' }, 'Tu profesor todavía no ha activado actividades. Mientras tanto puedes conocer cómo funciona la aventura.'));
    }
    r.mis.forEach(function (x) {
      cont.appendChild(h('a', { class: 'tarjeta mision-tarjeta', href: '#mision.' + x.c.id },
        AL.ilustracion({ ilustracion: x.c.portada, imagen: x.c.imagenPortada, alt: 'Portada de la misión' }),
        h('div', { class: 'pila' },
          h('span', { class: 'eti' }, x.c.mision.etiqueta),
          h('strong', { class: 'mision-titulo' }, x.c.titulo),
          h('span', { class: 'suave' }, x.listo ? '✔ Misión completada' : (x.hechas ? x.hechas + ' de ' + x.total + ' preguntas' : 'Nueva misión')),
          h('span', { class: 'boton' }, x.listo ? 'Ver mi resultado' : (x.hechas ? 'Continuar la misión' : 'Empezar la misión')))));
    });
    const visibles = AL.MODULOS.filter(function (m) { return m.n === 1 || r.m[m.n].total > 0; });
    cont.appendChild(h('ol', { class: 'mapa' }, visibles.map(function (m) {
      const x = r.m[m.n];
      const estado = x.listo ? '✔ Completado' : (x.hechas ? x.hechas + ' de ' + x.total : 'Por empezar');
      return h('li', {}, h('a', { class: 'estacion' + (x.listo ? ' lista' : ''), href: '#' + m.ruta },
        h('span', { class: 'icono', 'aria-hidden': 'true' }, m.icono),
        h('span', { class: 'cuerpo' }, h('strong', {}, m.titulo), h('span', {}, m.texto)),
        h('span', { class: 'estado' }, estado)));
    })));
    cont.appendChild(h('p', { class: 'centro' }, h('a', { class: 'boton claro', href: '#progreso' }, '🏅 Ver mi progreso e insignias')));
  }

  /* ---------- Módulo 1: bienvenida y orientación ---------- */
  function orientacion(cont) {
    let elegida = null;
    const retro = h('p', { class: 'retro', role: 'status', hidden: true });
    const demo = h('div', { class: 'opciones', role: 'radiogroup', 'aria-label': 'Pregunta de práctica' });
    function pintarDemo() {
      U.limpiar(demo);
      ['Un cuaderno', 'Una mochila roja', 'Un balón', 'Una lonchera'].forEach(function (t, k) {
        demo.appendChild(h('button', { class: 'opcion' + (elegida === k ? ' elegida' : ''), type: 'button', role: 'radio', 'aria-checked': elegida === k ? 'true' : 'false',
          onclick: function () {
            elegida = k; pintarDemo();
            retro.hidden = false;
            retro.className = 'retro ' + (k === 1 ? 'bien' : 'repasar');
            retro.textContent = k === 1 ? '✔ ¡Así se hace! La respuesta estaba escrita en el texto.' : '↻ Vuelve a leer la oración de arriba y prueba otra vez.';
          } }, h('span', { class: 'letra' }, AL.LETRAS[k]), h('span', {}, t)));
      });
    }
    pintarDemo();
    async function listo() {
      AL.estado.sesion = await AL.store.actualizarSesion(AL.estado.sesion.id, { orientacion: true });
      location.hash = '#mapa';
    }
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h1', {}, 'Bienvenida'),
      h('p', {}, 'En Aventura Lectora vas a leer cuentos y a descubrir la información que está escrita en ellos.'),
      h('ol', { class: 'pasos' },
        h('li', {}, h('strong', {}, 'Lee por escenas. '), 'Usa los botones Siguiente y Anterior. No hay límite de tiempo.'),
        h('li', {}, h('strong', {}, 'Responde con calma. '), 'Toca una opción y luego el botón para responder.'),
        h('li', {}, h('strong', {}, 'Vuelve al cuento. '), 'Siempre puedes leerlo otra vez antes de responder.'),
        h('li', {}, h('strong', {}, 'Mira tu progreso. '), 'Cada parte que completes te da una insignia.'))));
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', {}, 'Practiquemos'),
      h('p', { class: 'suave' }, 'Esta pregunta es solo para practicar. No se guarda.'),
      h('p', { class: 'lectura' }, 'Tomás llegó a la escuela con una mochila roja.'),
      h('h3', { class: 'enunciado' }, '¿Qué llevaba Tomás?'),
      demo, retro,
      h('div', { class: 'fila' }, h('button', { class: 'boton grande', type: 'button', onclick: listo }, 'Ya entendí, ¡a leer!'))));
  }

  /* ---------- Módulo 2: lista de cuentos y lector ---------- */
  function tarjetaCuento(c, href, detalle) {
    return h('li', {}, h('a', { class: 'tarjeta cuento', href: href },
      AL.ilustracion({ ilustracion: c.portada, imagen: c.imagenPortada, alt: 'Portada del cuento ' + c.titulo }),
      h('span', { class: 'eti' }, AL.FASES[fase(c)]),
      h('strong', {}, c.titulo),
      h('span', { class: 'suave' }, detalle)));
  }
  function cuentos(cont) {
    const lect = AL.estado.sesion.lecturas || {}, cs = deModulos();
    cont.appendChild(h('h1', {}, 'Exploramos los cuentos'));
    if (!cs.length) {
      cont.appendChild(h('p', { class: 'tarjeta' }, 'Todavía no hay cuentos disponibles aquí. Vuelve al mapa.'));
      return;
    }
    cont.appendChild(h('ul', { class: 'rejilla' }, cs.map(function (c) {
      return tarjetaCuento(c, '#cuento.' + c.id, c.escenas.length + ' escenas' + (lect[c.id] ? ' · ✔ Leído' : ''));
    })));
  }

  function lector(cont, idCuento) {
    const c = AL.estado.cuentos.find(function (x) { return x.id === idCuento; });
    if (!c) { cont.appendChild(h('p', { class: 'tarjeta' }, 'No encontramos ese cuento.')); return; }
    let i = 0;
    const voz = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    function callar() { if (voz) window.speechSynthesis.cancel(); }
    function escuchar() {
      callar();
      const u = new SpeechSynthesisUtterance(c.escenas[i].texto);
      u.lang = 'es-CO'; u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
    AL.alSalir = callar;
    async function terminar() {
      const lecturas = Object.assign({}, AL.estado.sesion.lecturas);
      lecturas[c.id] = true;
      AL.estado.sesion = await AL.store.actualizarSesion(AL.estado.sesion.id, { lecturas: lecturas });
      i = c.escenas.length; pintar();
    }
    function pintar() {
      callar();
      U.limpiar(cont);
      if (i >= c.escenas.length) {
        cont.appendChild(h('section', { class: 'tarjeta centro' },
          h('p', { class: 'insignia-grande', 'aria-hidden': 'true' }, '📖'),
          h('h1', {}, '¡Terminaste de leer!'),
          h('p', {}, c.mision ? 'Ahora responde las preguntas de la misión. Podrás volver al cuento cuando lo necesites.'
            : 'Ahora puedes hacer las actividades. Si lo necesitas, lee el cuento otra vez.'),
          h('div', { class: 'fila centro' },
            h('button', { class: 'boton claro', type: 'button', onclick: function () { i = 0; pintar(); } }, 'Volver a leer'),
            c.mision ? h('a', { class: 'boton grande', href: '#mision.' + c.id + '.preguntas' }, 'Ir a las preguntas')
              : h('a', { class: 'boton grande', href: '#modulo.3.' + c.id }, 'Ir a las actividades'))));
        return;
      }
      const e = c.escenas[i];
      const ultimo = i === c.escenas.length - 1;
      cont.appendChild(h('article', { class: 'tarjeta lector' },
        h('p', { class: 'eti' }, c.titulo + ' · Escena ' + (i + 1) + ' de ' + c.escenas.length),
        barra(U.pct(i + 1, c.escenas.length), 'Avance de la lectura'),
        AL.ilustracion(e, 'grande'),
        h('p', { class: 'lectura', id: 'texto-escena' }, e.texto),
        h('div', { class: 'fila entre' },
          h('button', { class: 'boton claro', type: 'button', disabled: i === 0, onclick: function () { i--; pintar(); } }, '← Anterior'),
          voz ? h('button', { class: 'boton claro', type: 'button', onclick: escuchar }, '🔊 Escuchar') : null,
          ultimo
            ? h('button', { class: 'boton grande', type: 'button', onclick: terminar }, 'Terminé de leer')
            : h('button', { class: 'boton grande', type: 'button', onclick: function () { i++; pintar(); } }, 'Siguiente →'))));
      document.getElementById('app').focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
    pintar();
  }

  /* ---------- Módulos 3, 4 y 5: actividades por subcategoría ---------- */
  function modulo(cont, n, idCuento) {
    n = Number(n);
    const m = AL.MODULOS[n - 1];
    if (!m || n < 3 || n > 5) { location.hash = '#mapa'; return; }
    const e = AL.estado, hechas = respondidas();
    const conAct = deModulos().filter(function (c) { return preguntasDe(c).some(function (p) { return p.modulo === n; }); });
    cont.appendChild(h('header', { class: 'cabecera' }, h('h1', {}, m.titulo), h('p', {}, m.texto)));
    if (!conAct.length) { cont.appendChild(h('p', { class: 'tarjeta' }, 'Todavía no hay actividades en esta parte.')); return; }

    let c = conAct.find(function (x) { return x.id === idCuento; });
    if (!c && conAct.length === 1) c = conAct[0];
    if (!c) {
      cont.appendChild(h('p', {}, 'Elige el cuento con el que quieres trabajar.'));
      cont.appendChild(h('ul', { class: 'rejilla' }, conAct.map(function (x) {
        const ps = preguntasDe(x).filter(function (p) { return p.modulo === n; });
        const k = ps.filter(function (p) { return hechas[p.id]; }).length;
        return tarjetaCuento(x, '#modulo.' + n + '.' + x.id, k >= ps.length ? '✔ Completado' : k + ' de ' + ps.length + ' actividades');
      })));
      return;
    }
    const ps = preguntasDe(c).filter(function (p) { return p.modulo === n; });
    const unaVez = fase(c) !== 'intervencion';
    const zona = h('div', {});
    cont.appendChild(zona);
    if (!(e.sesion.lecturas || {})[c.id]) {
      zona.appendChild(h('section', { class: 'tarjeta centro' },
        h('h2', {}, 'Primero lee el cuento'),
        h('p', {}, 'Para responder necesitas haber leído «' + c.titulo + '».'),
        h('a', { class: 'boton grande', href: '#cuento.' + c.id }, 'Leer el cuento')));
      return;
    }
    /* Diagnóstico y cierre: cada pregunta se responde una sola vez; al volver se continúa donde iba. */
    const pendientes = unaVez ? ps.filter(function (p) { return !hechas[p.id]; }) : ps;
    if (!pendientes.length) {
      zona.appendChild(h('section', { class: 'tarjeta centro' },
        h('p', { class: 'insignia-grande', 'aria-hidden': 'true' }, m.icono),
        h('h2', {}, 'Ya respondiste esta parte'),
        h('p', {}, 'Tus respuestas quedaron guardadas.'),
        h('a', { class: 'boton grande', href: '#mapa' }, 'Volver al mapa')));
      return;
    }
    if (unaVez) zona.appendChild(h('p', { class: 'nota' }, 'En esta parte cada pregunta se responde una sola vez. Lee con calma antes de guardar tu respuesta.'));
    const act = h('div', {});
    zona.appendChild(act);
    AL.actividades.ejecutar(act, pendientes, { icono: m.icono });
  }

  /* ---------- Misión lectora (actividad central de la intervención) ---------- */
  function resultadoMision(c) {
    const ps = preguntasDe(c), primero = {}, logro = {};
    AL.estado.respuestas.slice().sort(function (a, b) { return a.intento - b.intento; }).forEach(function (r) {
      if (!(r.preguntaId in primero)) primero[r.preguntaId] = r.correcta;
      if (r.correcta) logro[r.preguntaId] = true;
    });
    const sub = Object.keys(AL.SUBCATS).map(function (s) {
      const q = ps.filter(function (p) { return p.subcategoria === s; });
      return { s: s, total: q.length, primero: q.filter(function (p) { return primero[p.id]; }).length, logro: q.filter(function (p) { return logro[p.id]; }).length };
    });
    return { ps: ps, sub: sub, sinLograr: ps.filter(function (p) { return !logro[p.id]; }),
      primero: ps.filter(function (p) { return primero[p.id]; }).length, logro: ps.filter(function (p) { return logro[p.id]; }).length };
  }

  function pintarResultado(cont, c) {
    const R = resultadoMision(c);
    const mensaje = R.logro === R.ps.length ? '¡Misterio resuelto! Encontraste toda la información en el cuento.'
      : R.logro >= R.ps.length * 0.6 ? '¡Buen trabajo, detective! Ya casi tienes todas las pistas.'
      : '¡Sigue buscando! Cada vez que vuelves al cuento encuentras más pistas.';
    U.limpiar(cont).appendChild(h('article', { class: 'tarjeta' },
      h('p', { class: 'insignia-grande centro', 'aria-hidden': 'true' }, '🌱'),
      h('h1', { class: 'centro' }, '¡Completaste la misión!'),
      h('p', { class: 'centro' }, mensaje),
      AL.actividades.semillas(R.ps),
      h('h2', {}, 'Tu desempeño'),
      h('ul', { class: 'desempeno' }, R.sub.map(function (x) {
        return h('li', {},
          h('strong', {}, AL.SUBCATS[x.s].nombre),
          barra(U.pct(x.primero, x.total), AL.SUBCATS[x.s].corto + ': ' + x.primero + ' de ' + x.total + ' al primer intento'),
          h('span', { class: 'suave' }, x.primero + ' de ' + x.total + ' al primer intento' + (x.logro > x.primero ? ' · ' + x.logro + ' de ' + x.total + ' después de repasar' : '')));
      })),
      h('p', { class: 'suave' }, 'En total acertaste ' + R.primero + ' de ' + R.ps.length + ' preguntas al primer intento.'),
      h('div', { class: 'fila centro' },
        R.sinLograr.length ? h('a', { class: 'boton claro', href: '#mision.' + c.id + '.repasar' }, 'Repasar las ' + R.sinLograr.length + ' que me faltan') : null,
        h('a', { class: 'boton claro', href: '#cuento.' + c.id }, 'Leer el cuento otra vez'),
        h('a', { class: 'boton grande', href: '#mapa' }, 'Volver al mapa'))));
  }

  function mision(cont, idCuento, paso) {
    const c = misiones().find(function (x) { return x.id === idCuento; });
    if (!c) { cont.appendChild(h('section', { class: 'tarjeta centro' }, h('h1', {}, 'Esta misión no está disponible'), h('a', { class: 'boton', href: '#mapa' }, 'Volver al mapa'))); return; }
    const ps = preguntasDe(c), hechas = respondidas();
    const leido = (AL.estado.sesion.lecturas || {})[c.id];
    const sinResponder = ps.filter(function (p) { return !hechas[p.id]; });

    if (paso === 'preguntas' || paso === 'repasar') {
      if (!leido) { location.hash = '#cuento.' + c.id; return; }
      /* Al recargar o volver a entrar se continúa en la primera pregunta sin responder. */
      const lista = paso === 'repasar' ? resultadoMision(c).sinLograr : sinResponder;
      if (!lista.length) { pintarResultado(cont, c); return; }
      cont.appendChild(h('header', { class: 'cabecera' }, h('p', { class: 'eti' }, c.mision.etiqueta), h('h1', {}, c.titulo)));
      const zona = h('div', {});
      cont.appendChild(zona);
      AL.actividades.ejecutar(zona, lista, {
        cabecera: function () { return AL.actividades.semillas(ps); },
        alFinal: function () { pintarResultado(cont, c); window.scrollTo(0, 0); }
      });
      return;
    }

    if (leido && !sinResponder.length) { pintarResultado(cont, c); return; }
    cont.appendChild(h('article', { class: 'tarjeta mision-inicio' },
      AL.ilustracion({ ilustracion: c.portada, imagen: c.imagenPortada, alt: 'Portada de la misión' }, 'grande'),
      h('p', { class: 'eti' }, c.mision.etiqueta),
      h('h1', {}, c.titulo),
      h('h2', {}, 'Tu misión'),
      h('p', {}, c.mision.proposito),
      h('h2', {}, '¿Qué debes hacer?'),
      h('ol', { class: 'pasos' }, (c.mision.instrucciones || []).map(function (t) { return h('li', {}, t); })),
      ps.length - sinResponder.length ? h('p', { class: 'suave' }, 'Ya respondiste ' + (ps.length - sinResponder.length) + ' de ' + ps.length + ' preguntas. Continúas donde ibas.') : null,
      h('div', { class: 'fila' },
        leido ? h('a', { class: 'boton grande', href: '#mision.' + c.id + '.preguntas' }, 'Continuar con las preguntas') : h('a', { class: 'boton grande', href: '#cuento.' + c.id }, 'Comenzar la misión'),
        leido ? h('a', { class: 'boton claro', href: '#cuento.' + c.id }, 'Leer el cuento otra vez') : null)));
  }

  /* ---------- Módulo 6: retos de lectura (solo intervención) ---------- */
  async function retos(cont) {
    const e = AL.estado, ultima = {}, enFase = {};
    e.cuentos.forEach(function (c) { if (fase(c) === 'intervencion') enFase[c.id] = true; });
    e.respuestas.slice().sort(function (a, b) { return a.intento - b.intento; }).forEach(function (r) { ultima[r.preguntaId] = r; });
    const pendientes = e.preguntas.filter(function (p) { return enFase[p.cuentoId] && ultima[p.id] && !ultima[p.id].correcta; });
    cont.appendChild(h('header', { class: 'cabecera' }, h('h1', {}, 'Retos de lectura'),
      h('p', {}, 'Aquí repasas las preguntas que todavía puedes mejorar.')));
    const zona = h('div', {});
    cont.appendChild(zona);
    const r = resumen();
    if (r.previos && r.m[6].total && !e.sesion.cierre) e.sesion = await AL.store.actualizarSesion(e.sesion.id, { cierre: true });
    if (pendientes.length) {
      zona.appendChild(h('p', { class: 'suave' }, 'Tienes ' + pendientes.length + (pendientes.length === 1 ? ' reto.' : ' retos.') + ' Recuerda que puedes volver a leer el cuento.'));
      const act = h('div', {});
      zona.appendChild(act);
      AL.actividades.ejecutar(act, pendientes, { icono: '⭐' });
    } else if (!r.previos) {
      zona.appendChild(h('section', { class: 'tarjeta centro' },
        h('h2', {}, 'Aún te faltan partes por completar'),
        h('p', {}, 'Termina la lectura y las actividades. Después vuelve por tus retos.'),
        h('a', { class: 'boton grande', href: '#mapa' }, 'Volver al mapa')));
    } else {
      zona.appendChild(h('section', { class: 'tarjeta centro' },
        h('p', { class: 'insignia-grande', 'aria-hidden': 'true' }, '⭐'),
        h('h2', {}, '¡No tienes retos pendientes!'),
        h('p', {}, 'Encontraste la información del cuento en cada actividad.'),
        h('div', { class: 'fila centro' }, h('a', { class: 'boton grande', href: '#progreso' }, 'Ver mi progreso'))));
    }
  }

  /* ---------- Mi progreso ---------- */
  function progreso(cont) {
    const r = resumen();
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h1', {}, 'Mi progreso'),
      h('p', {}, 'Nivel: ', h('strong', {}, r.nivel)),
      barra(r.pct, 'Tu avance en la aventura'),
      h('p', { class: 'suave' }, r.hechas + ' de ' + r.total + ' pasos completados')));
    const insignias = AL.MODULOS.filter(function (m) { return m.n === 1 || r.m[m.n].total > 0; })
      .map(function (m) { return { icono: m.icono, titulo: m.titulo, lista: r.m[m.n].listo }; })
      .concat(r.mis.map(function (x) { return { icono: '🌱', titulo: x.c.mision.etiqueta, lista: x.listo }; }));
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', {}, 'Mis insignias'),
      h('ul', { class: 'insignias' }, insignias.map(function (x) {
        return h('li', { class: x.lista ? 'ganada' : '' },
          h('span', { class: 'icono', 'aria-hidden': 'true' }, x.icono),
          h('strong', {}, x.titulo),
          h('span', { class: 'suave' }, x.lista ? 'Insignia ganada' : 'Por ganar'));
      })),
      h('p', { class: 'suave' }, 'Ganas una insignia cuando completas una parte.')));
    cont.appendChild(h('p', { class: 'centro' }, h('a', { class: 'boton grande', href: '#mapa' }, 'Volver al mapa')));
  }

  AL.estudiante = { inicio: inicio, entrar: entrar, mapa: mapa, orientacion: orientacion, cuentos: cuentos,
    lector: lector, modulo: modulo, mision: mision, retos: retos, progreso: progreso };
})(window.AL = window.AL || {});
