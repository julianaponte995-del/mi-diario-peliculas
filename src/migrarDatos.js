const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");
const XLSX = require('xlsx');

const firebaseConfig = {
  apiKey: "AIzaSyDdZorVyDz5OOYl2uPa3Vy96Lk4hM4ujPM",
  authDomain: "web-de-peliculas-92543.firebaseapp.com",
  projectId: "web-de-peliculas-92543",
  storageBucket: "web-de-peliculas-92543.firebasestorage.app",
  messagingSenderId: "492829259751",
  appId: "1:492829259751:web:0bf9ff5c928ccdd4c56f42"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrarPeliculas() {
  try {
    // Lee el archivo Excel
    const workbook = XLSX.readFile('peliculas_con_posters.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Se encontraron ${data.length} películas en el Excel`);
    console.log('🚀 Iniciando migración a Firebase...\n');

    let exitosas = 0;
    let fallidas = 0;

    for (let i = 0; i < data.length; i++) {
      const pelicula = data[i];
      
      try {
        await addDoc(collection(db, 'peliculas'), {
          nombre: pelicula.nombre || '',
          año: pelicula.año || pelicula['año'] || 0,
          poster_url: pelicula.poster_url || '',
          notas: ''
        });

        exitosas++;
        console.log(`✓ [${i + 1}/${data.length}] ${pelicula.nombre} (${pelicula.año})`);
      } catch (error) {
        fallidas++;
        console.log(`✗ [${i + 1}/${data.length}] Error con ${pelicula.nombre}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRACIÓN COMPLETADA');
    console.log('='.repeat(50));
    console.log(`✓ Exitosas: ${exitosas}`);
    console.log(`✗ Fallidas: ${fallidas}`);
    console.log('\n🎉 ¡Tu base de datos está lista!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

migrarPeliculas();