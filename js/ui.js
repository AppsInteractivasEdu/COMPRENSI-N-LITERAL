/* Utilidades compartidas: creación segura de elementos, avisos, diálogos, CSV. */
(function (AL) {
  'use strict';

  /* Crea elementos sin usar innerHTML con texto de usuarios (evita inyección de código). */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    let valor;
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // solo para SVG y textos fijos del propio sistema
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') valor = v;
      else if (k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (let i = 2; i < arguments.length; i++) agregar(el, arguments[i]);
    if (valor !== undefined) el.value = valor;
    return el;
  }
  function agregar(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { agregar(el, x); });
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function limpiar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  function aviso(texto, tipo) {
    const caja = document.getElementById('avisos');
    const n = h('div', { class: 'aviso ' + (tipo || '') }, texto);
    caja.appendChild(n);
    setTimeout(function () { n.remove(); }, 4200);
  }

  /* Diálogo de confirmación propio (no depende de confirm() del navegador). */
  function confirmar(titulo, detalle, textoSi) {
    return new Promise(function (resolver) {
      const d = h('dialog', { class: 'dialogo' });
      function cerrar(v) { d.close(); d.remove(); resolver(v); }
      agregar(d, [
        h('h2', {}, titulo),
        detalle ? h('p', {}, detalle) : null,
        h('div', { class: 'fila fin' },
          h('button', { class: 'boton claro', type: 'button', onclick: function () { cerrar(false); } }, 'Cancelar'),
          h('button', { class: 'boton', type: 'button', onclick: function () { cerrar(true); } }, textoSi || 'Aceptar'))
      ]);
      d.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(false); });
      document.body.appendChild(d);
      d.showModal();
    });
  }

  /* Ventana con contenido libre (por ejemplo, volver a leer el cuento). */
  function ventana(titulo, contenido) {
    const d = h('dialog', { class: 'dialogo ancho' });
    function cerrar() { d.close(); d.remove(); }
    agregar(d, [
      h('div', { class: 'fila entre' }, h('h2', {}, titulo),
        h('button', { class: 'boton claro', type: 'button', onclick: cerrar }, 'Cerrar')),
      contenido
    ]);
    d.addEventListener('close', function () { d.remove(); });
    document.body.appendChild(d);
    d.showModal();
    return d;
  }

  function normalizarNombre(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-zñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function nombreBonito(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().split(' ').map(function (p) {
      return p.charAt(0).toLocaleUpperCase('es') + p.slice(1).toLocaleLowerCase('es');
    }).join(' ');
  }
  function id(prefijo) {
    return prefijo + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function fecha(iso) {
    try {
      return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { return iso; }
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  /* CSV con punto y coma y BOM: abre bien en Excel configurado en español. */
  function descargarCSV(nombre, filas) {
    const texto = filas.map(function (f) {
      return f.map(function (c) {
        const s = c === null || c === undefined ? '' : String(c);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
    const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* Corrección de una respuesta a partir de la clave. Devuelve null si no hay clave. */
  function evaluar(pregunta, clave, seleccion) {
    if (!clave) return null;
    if (pregunta.tipo === 'orden') return JSON.stringify(seleccion) === JSON.stringify(clave.orden);
    return seleccion === clave.correcta;
  }

  AL.ui = { h: h, agregar: agregar, limpiar: limpiar, aviso: aviso, confirmar: confirmar, ventana: ventana,
    normalizarNombre: normalizarNombre, nombreBonito: nombreBonito, id: id, fecha: fecha, pct: pct,
    descargarCSV: descargarCSV };
  AL.evaluar = evaluar;

  /* Traduce un error de Firebase a una causa concreta, para saber qué revisar en la consola. */
  AL.explicarError = function (e) {
    const c = String((e && e.code) || ''), m = String((e && e.message) || e || '');
    let causa = 'Revisa la conexión a internet e inténtalo de nuevo.';
    if (/operation-not-allowed|admin-restricted-operation/.test(c + m)) causa = 'El acceso «Anónimo» no está habilitado en Firebase (Authentication → Método de acceso).';
    else if (/permission-denied|insufficient permissions/i.test(c + m)) causa = 'Firestore rechazó la operación. Falta publicar las reglas de firestore.rules (Firestore Database → Reglas).';
    else if (/not-found|failed-precondition|database .* does not exist/i.test(c + m)) causa = 'La base de datos de Firestore no está creada (Firestore Database → Crear base de datos).';
    else if (/api-key|configuration-not-found|invalid-api-key/i.test(c + m)) causa = 'Authentication no está activado en el proyecto de Firebase (Authentication → Comenzar).';
    else if (/unauthorized-domain/.test(c + m)) causa = 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).';
    else if (/unavailable|network|offline/i.test(c + m)) causa = 'No se pudo conectar con Firebase. Revisa internet o desactiva el bloqueador del navegador para esta página.';
    return { causa: causa, detalle: (c ? c + ' · ' : '') + m.slice(0, 200) };
  };

  AL.LETRAS = ['A', 'B', 'C', 'D'];
  /* Fases del estudio. Cada cuento pertenece a una fase y cada respuesta se guarda con la fase de su cuento. */
  AL.FASES = { inicial: 'Diagnóstico inicial', intervencion: 'Intervención', cierre: 'Cierre' };
  AL.MOMENTOS = AL.FASES; // nombre anterior, se conserva para el código que ya lo usa
  AL.SUBCATS = {
    reconocimiento: { nombre: 'Reconocimiento de información y elementos explícitos', corto: 'Reconocimiento', modulo: 3 },
    recuperacion: { nombre: 'Recuperación de información específica', corto: 'Recuperación', modulo: 4 },
    secuenciacion: { nombre: 'Secuenciación de acontecimientos', corto: 'Secuenciación', modulo: 5 }
  };
  AL.MODULOS = [
    { n: 1, ruta: 'orientacion', icono: '🧭', titulo: 'Bienvenida', texto: 'Conoce cómo funciona tu aventura.' },
    { n: 2, ruta: 'cuentos', icono: '📖', titulo: 'Exploramos los cuentos', texto: 'Lee cada historia con calma.' },
    { n: 3, ruta: 'modulo.3', icono: '🔎', titulo: 'Reconocemos información', texto: 'Personajes, lugares y objetos del cuento.' },
    { n: 4, ruta: 'modulo.4', icono: '🧺', titulo: 'Recuperamos datos', texto: 'Busca datos exactos en la historia.' },
    { n: 5, ruta: 'modulo.5', icono: '🧩', titulo: 'Organizamos los acontecimientos', texto: 'Qué pasó primero, después y al final.' },
    { n: 6, ruta: 'retos', icono: '⭐', titulo: 'Retos de lectura', texto: 'Repasa lo que aún puedes mejorar.' }
  ];
})(window.AL = window.AL || {});
