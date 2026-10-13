/* Ilustraciones vectoriales livianas (no pesan como imágenes y funcionan sin conexión).
 * Apoyan la lectura sin mostrar las respuestas: los letreros van en blanco y las plantas no se nombran.
 * Un cuento nuevo puede usar imágenes propias (assets/images/...) desde el panel.
 */
(function (AL) {
  'use strict';
  const P = { cielo: '#CFEAF6', sol: '#FFD25E', pasto: '#8CCB7A', pasto2: '#6FB565', tierra: '#8A5A3C',
    hoja: '#3E9B5F', piel1: '#E8B58C', piel2: '#B97A56', pelo: '#3A2A22', blanco: '#FFFDF7', tinta: '#2B3A4A' };

  function persona(x, y, camisa, piel, e) {
    e = e || 1;
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + e + ')">' +
      '<rect x="-12" y="14" width="24" height="36" rx="10" fill="' + camisa + '"/>' +
      '<circle cx="0" cy="2" r="12" fill="' + piel + '"/>' +
      '<path d="M-12 0a12 12 0 0 1 24 0q-12-9-24 0z" fill="' + P.pelo + '"/></g>';
  }
  function planta(x, y, alto) {
    let s = '<path d="M' + x + ' ' + y + 'v-' + alto + '" stroke="' + P.hoja + '" stroke-width="3" stroke-linecap="round" fill="none"/>';
    for (let k = 6; k <= alto; k += 10) {
      s += '<ellipse cx="' + (x - 6) + '" cy="' + (y - k) + '" rx="6" ry="3" fill="' + P.hoja + '" transform="rotate(-30 ' + (x - 6) + ' ' + (y - k) + ')"/>' +
        '<ellipse cx="' + (x + 6) + '" cy="' + (y - k) + '" rx="6" ry="3" fill="' + P.pasto2 + '" transform="rotate(30 ' + (x + 6) + ' ' + (y - k) + ')"/>';
    }
    return s;
  }
  function filas(alturas) {
    let s = '';
    [176, 198, 220].forEach(function (y, f) {
      s += '<rect x="50" y="' + y + '" width="300" height="12" rx="6" fill="' + P.tierra + '"/>';
      if (alturas) for (let x = 70; x <= 330; x += 37) s += planta(x, y + 2, alturas[f]);
    });
    return s;
  }
  const exterior = '<rect width="400" height="240" fill="' + P.cielo + '"/><circle cx="342" cy="48" r="24" fill="' + P.sol + '"/>' +
    '<path d="M50 60h46a14 14 0 0 0 0-28 20 20 0 0 0-38 6 12 12 0 0 0-8 22z" fill="' + P.blanco + '"/>' +
    '<path d="M0 160q200-34 400 0v80H0z" fill="' + P.pasto + '"/>';
  function letrero(x, y) {
    return '<path d="M' + x + ' ' + y + 'v-26" stroke="' + P.tinta + '" stroke-width="3"/><rect x="' + (x - 13) + '" y="' + (y - 42) + '" width="26" height="18" rx="3" fill="' + P.blanco + '" stroke="' + P.tinta + '" stroke-width="2"/>';
  }
  const libro = '<path d="M200 96c-30-18-70-18-96-6v92c26-12 66-12 96 6 30-18 70-18 96-6V90c-26-12-66-12-96 6z" fill="' + P.blanco + '" stroke="' + P.tinta + '" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M200 96v92" stroke="' + P.tinta + '" stroke-width="4"/>' +
    '<path d="M124 112q30-8 58 4M124 132q30-8 58 4M124 152q30-8 58 4M218 116q28-12 58-4M218 136q28-12 58-4M218 156q28-12 58-4" stroke="#9FB3C2" stroke-width="3" fill="none" stroke-linecap="round"/>';

  const interior = '<rect width="400" height="240" fill="#FBEFD2"/><rect y="186" width="400" height="54" fill="#E2C9A0"/>' +
    '<rect x="296" y="30" width="84" height="84" rx="6" fill="' + P.cielo + '" stroke="#8A5A3C" stroke-width="6"/><path d="M338 30v84M296 72h84" stroke="#8A5A3C" stroke-width="4"/>';
  const LOMOS = ['#E8734E', '#4C8FD6', '#F2B33D', '#3E9B5F', '#8C6BC9', '#E8734E', '#4C8FD6', '#F2B33D'];
  /* Estante con tres tablas. Las etiquetas van en blanco para no mostrar respuestas. */
  function estante(x, lleno, etiquetas) {
    let s = '<rect x="' + x + '" y="62" width="130" height="134" rx="6" fill="#B98552" stroke="#8A5A3C" stroke-width="4"/>';
    [66, 108, 150].forEach(function (y, f) {
      s += '<rect x="' + (x + 6) + '" y="' + y + '" width="118" height="38" fill="#F6E3BE"/>';
      if (lleno) for (let k = 0; k < 8; k++) s += '<rect x="' + (x + 10 + k * 13) + '" y="' + (y + 6 + ((k + f) % 3) * 2) + '" width="10" height="' + (32 - ((k + f) % 3) * 2) + '" rx="2" fill="' + LOMOS[(k + f * 3) % 8] + '"/>';
      if (etiquetas) s += '<rect x="' + (x + 122) + '" y="' + (y + 10) + '" width="22" height="12" rx="2" fill="' + P.blanco + '" stroke="' + P.tinta + '" stroke-width="2"/>';
    });
    return s;
  }
  function caja(x, y, libros) {
    return (libros ? '<rect x="' + (x + 8) + '" y="' + (y - 12) + '" width="10" height="16" fill="#4C8FD6"/><rect x="' + (x + 22) + '" y="' + (y - 16) + '" width="10" height="20" fill="#E8734E"/><rect x="' + (x + 36) + '" y="' + (y - 10) + '" width="10" height="14" fill="#3E9B5F"/>' : '') +
      '<rect x="' + x + '" y="' + y + '" width="56" height="34" rx="3" fill="#C89B5E" stroke="' + P.tinta + '" stroke-width="2"/><path d="M' + x + ' ' + (y + 10) + 'h56" stroke="' + P.tinta + '" stroke-width="2"/>';
  }
  const alfombra = '<ellipse cx="170" cy="214" rx="120" ry="18" fill="#8C6BC9"/><ellipse cx="170" cy="214" rx="96" ry="12" fill="#B6A0E3"/>';
  const libroMini = '<g transform="translate(120 96) scale(.42)">' + libro + '</g>';

  const sobre = function (x, y) { return '<rect x="' + x + '" y="' + y + '" width="30" height="22" rx="2" fill="' + P.blanco + '" stroke="' + P.tinta + '" stroke-width="2"/><path d="M' + x + ' ' + y + 'l15 11 15-11" stroke="' + P.tinta + '" stroke-width="2" fill="none"/>'; };
  const mesa = '<rect x="90" y="150" width="220" height="14" rx="4" fill="#B98552"/><path d="M104 164v56M296 164v56" stroke="#8A5A3C" stroke-width="8"/>' +
    '<rect x="170" y="164" width="70" height="26" fill="#C89B5E" stroke="#8A5A3C" stroke-width="3"/><circle cx="205" cy="177" r="4" fill="#8A5A3C"/>';
  const maceta = function (x) { return '<path d="M' + x + ' 124h34l-6 26h-22z" fill="#D9772B"/><rect x="' + (x - 3) + '" y="118" width="40" height="8" rx="2" fill="#B85F1F"/>'; };

  const escenas = {
    mision2: exterior + '<rect x="150" y="150" width="110" height="60" rx="4" fill="#B98552" stroke="#8A5A3C" stroke-width="4"/><path d="M150 150l-14-26h110l14 26" fill="#C89B5E" stroke="#8A5A3C" stroke-width="4" stroke-linejoin="round"/>' +
      persona(86, 130, '#4C8FD6', P.piel1, 1.3) + persona(318, 130, '#F2B33D', P.piel2, 1.3),
    mision3: interior + persona(250, 104, '#E8734E', P.piel2, 1.7) + persona(120, 132, '#4C8FD6', P.piel1, 1.2) + persona(166, 136, '#F2B33D', P.piel2, 1.2) +
      '<path d="M64 60h60a12 12 0 0 1 12 12v22a12 12 0 0 1-12 12H96l-14 14v-14H64a12 12 0 0 1-12-12V72a12 12 0 0 1 12-12z" fill="' + P.blanco + '" stroke="' + P.tinta + '" stroke-width="2"/><path d="M68 78h52M68 90h34" stroke="#9FB3C2" stroke-width="3" stroke-linecap="round"/>',
    mision4: '<rect width="400" height="240" fill="#EAD9B8"/><rect y="200" width="400" height="40" fill="#C9AE83"/><path d="M0 40h400M0 90h400" stroke="#D9C39B" stroke-width="3"/>' + mesa +
      '<rect x="110" y="116" width="62" height="34" rx="3" fill="#B98552" stroke="#8A5A3C" stroke-width="3"/>' + maceta(196) + maceta(240) +
      '<path d="M318 204q-8-40 14-52 22 12 14 52z" fill="#8A6B4A" stroke="' + P.tinta + '" stroke-width="2"/>',
    mision5: '<rect width="400" height="240" fill="#EAD9B8"/><rect y="200" width="400" height="40" fill="#C9AE83"/>' + mesa +
      persona(60, 112, '#E8734E', P.piel2, 1.6) + persona(336, 130, '#4C8FD6', P.piel1, 1.2) + persona(376, 134, '#F2B33D', P.piel2, 1.2) + sobre(190, 120) +
      '<g fill="' + P.sol + '"><circle cx="170" cy="96" r="4"/><circle cx="240" cy="92" r="4"/><circle cx="205" cy="80" r="4"/></g>',
    mision6: exterior + filas() + '<path d="M330 176v-46" stroke="' + P.tinta + '" stroke-width="4"/><rect x="286" y="96" width="88" height="40" rx="4" fill="' + P.blanco + '" stroke="' + P.tinta + '" stroke-width="3"/><path d="M296 110h68M296 122h48" stroke="#9FB3C2" stroke-width="3" stroke-linecap="round"/>',
    biblio1: interior + persona(120, 104, '#4C8FD6', P.piel1, 1.7) + caja(160, 150, true) +
      '<rect x="36" y="170" width="50" height="10" rx="3" fill="#B98552"/><path d="M42 180v34M80 180v34" stroke="#8A5A3C" stroke-width="4"/>',
    biblio2: interior + estante(40, false, false) + persona(206, 128, '#F2B33D', P.piel2, 1.2) + persona(250, 124, '#3E9B5F', P.piel1, 1.2) +
      '<ellipse cx="318" cy="204" rx="30" ry="14" fill="#E8734E"/><ellipse cx="350" cy="218" rx="30" ry="14" fill="#4C8FD6"/><ellipse cx="290" cy="222" rx="30" ry="14" fill="#F2B33D"/>',
    biblio3: interior + estante(40, true, true) + '<g transform="translate(70 0)">' + alfombra + '</g>' + caja(318, 150, false) + caja(306, 176, false),
    biblio4: interior + estante(40, true, true) + '<g transform="translate(96 30)">' + libroMini + '</g>' +
      '<g transform="translate(296 138) rotate(6)"><rect width="62" height="44" rx="3" fill="' + P.blanco + '" stroke="' + P.tinta + '" stroke-width="3"/><path d="M8 12h46M8 22h46M8 32h30" stroke="#9FB3C2" stroke-width="3" stroke-linecap="round"/></g>',
    biblio5: interior + estante(40, true, true) + '<g transform="translate(90 0)">' + alfombra + '</g>' +
      persona(214, 150, '#E8734E', P.piel2, 1.1) + persona(262, 154, '#3E9B5F', P.piel1, 1.1) + persona(308, 150, '#F2B33D', P.piel2, 1.1) + persona(360, 118, '#4C8FD6', P.piel1, 1.5),
    portada2: interior + estante(135, true, false),
    huerta1: '<rect width="400" height="240" fill="#FBEFD2"/><rect y="186" width="400" height="54" fill="#E2C9A0"/>' +
      '<rect x="40" y="36" width="190" height="96" rx="6" fill="#2F6B55" stroke="#8A5A3C" stroke-width="6"/>' +
      '<path d="M60 64h70M60 84h110M60 104h50" stroke="#CFE8DC" stroke-width="4" stroke-linecap="round"/>' +
      persona(292, 108, '#E8734E', P.piel2, 1.7) +
      '<path d="M322 150h34l8 44h-50z" fill="#C89B5E" stroke="' + P.tinta + '" stroke-width="2"/><path d="M324 150q15-14 30 0" stroke="' + P.tinta + '" stroke-width="2" fill="none"/>' +
      '<rect x="56" y="170" width="70" height="10" rx="3" fill="#B98552"/><rect x="150" y="170" width="70" height="10" rx="3" fill="#B98552"/>' +
      '<path d="M62 180v34M120 180v34M156 180v34M214 180v34" stroke="#8A5A3C" stroke-width="4"/>',
    huerta2: exterior + '<path d="M250 150v-40h70v40" stroke="' + P.blanco + '" stroke-width="4" fill="none"/>' +
      '<rect x="60" y="188" width="280" height="40" rx="18" fill="' + P.tierra + '"/>' +
      '<g fill="#D98A3A"><ellipse cx="96" cy="184" rx="9" ry="4"/><ellipse cx="118" cy="190" rx="9" ry="4"/><ellipse cx="78" cy="194" rx="9" ry="4"/><ellipse cx="140" cy="182" rx="9" ry="4"/></g>' +
      persona(110, 126, '#4C8FD6', P.piel1, 1.2) + persona(158, 130, '#F2B33D', P.piel2, 1.2) +
      persona(262, 134, '#8C6BC9', P.piel1, 1.2) + persona(308, 130, '#E8734E', P.piel2, 1.2) +
      '<path d="M284 150l14 46" stroke="#6B4A33" stroke-width="4" stroke-linecap="round"/><path d="M292 196h14l-4 16h-8z" fill="#9AA7B4"/>',
    huerta3: exterior + filas() + letrero(42, 190) + letrero(42, 212) + letrero(42, 234) +
      '<g transform="translate(250 96)"><rect width="56" height="44" rx="8" fill="#4C8FD6"/><path d="M56 12l34-14 4 8-38 22z" fill="#4C8FD6"/><path d="M0 8q-22 14 0 30" stroke="#4C8FD6" stroke-width="6" fill="none"/></g>' +
      '<g fill="#6DB7E8"><circle cx="340" cy="124" r="3"/><circle cx="332" cy="140" r="3"/><circle cx="346" cy="150" r="3"/><circle cx="336" cy="162" r="3"/></g>',
    huerta4: exterior + filas([8, 6, 9]) +
      '<g transform="translate(236 70) rotate(-8)"><rect width="96" height="66" rx="4" fill="' + P.blanco + '" stroke="' + P.tinta + '" stroke-width="3"/><path d="M48 0v66M10 18h28M10 32h28M10 46h20M58 18h28M58 32h28" stroke="#9FB3C2" stroke-width="3" stroke-linecap="round"/></g>' +
      '<path d="M344 60l-22 54" stroke="#F2B33D" stroke-width="6" stroke-linecap="round"/>',
    huerta5: exterior + filas([30, 22, 34]) + persona(352, 96, '#E8734E', P.piel2, 1.3),
    portada: exterior + '<g transform="translate(0 -20)">' + libro + '</g>' + planta(200, 78, 34),
    generica: exterior + '<g transform="translate(0 10)">' + libro + '</g>',
    hero: exterior + '<path d="M0 190q110-60 210-20t190-30v100H0z" fill="' + P.pasto2 + '"/>' +
      '<path d="M40 232q70-58 150-40t110-52" stroke="' + P.blanco + '" stroke-width="8" stroke-dasharray="2 16" stroke-linecap="round" fill="none"/>' +
      '<g transform="translate(-20 -48) scale(.9)">' + libro + '</g>' +
      '<path d="M318 140v-56" stroke="' + P.tinta + '" stroke-width="4"/><path d="M320 84l34 12-34 12z" fill="#E8734E"/>' +
      persona(86, 150, '#4C8FD6', P.piel1, 1.1) + persona(124, 158, '#F2B33D', P.piel2, 1.1)
  };

  /* Devuelve un elemento con la ilustración de una escena (imagen propia o dibujo incluido). */
  AL.ilustracion = function (escena, clase) {
    const h = AL.ui.h;
    escena = escena || {};
    if (escena.imagen) {
      return h('img', { class: 'ilustra ' + (clase || ''), src: escena.imagen, alt: escena.alt || '', loading: 'lazy' });
    }
    const svg = '<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      (escenas[escena.ilustracion] || escenas.generica) + '</svg>';
    return h('div', { class: 'ilustra ' + (clase || ''), role: 'img', 'aria-label': escena.alt || 'Ilustración del cuento', html: svg });
  };
})(window.AL = window.AL || {});
