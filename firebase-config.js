/* Configuración general de Aventura Lectora.
 *
 * modo: 'local'    -> prototipo. Los datos se guardan solo en este navegador (js/store-local.js).
 *       'firebase' -> (fase siguiente) los datos se guardan en Cloud Firestore mediante
 *                     js/store-firebase.js, que debe ofrecer las mismas funciones que store-local.js.
 *
 * Cuando se conecte Firebase, pegue aquí la configuración del proyecto. Estos valores
 * identifican el proyecto y no son secretos: la protección real está en las reglas de Firestore.
 * Nunca escriba contraseñas en este archivo.
 */
window.AL = window.AL || {};
AL.config = {
  version: '0.4.2',
  modo: 'firebase',
  firebase: {
    apiKey: 'AIzaSyCHGYALKXeSo1xyX43kaOhQjrwVBi8P8MY',
    authDomain: 'comprensionliteral-b082b.firebaseapp.com',
    projectId: 'comprensionliteral-b082b',
    storageBucket: 'comprensionliteral-b082b.firebasestorage.app',
    messagingSenderId: '1062063139339',
    appId: '1:1062063139339:web:b34c0f6c101851ca76b50e'
  }
};
