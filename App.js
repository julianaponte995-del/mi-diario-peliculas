import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import './App.css';

function App() {
  const [movies, setMovies] = useState([]);
  const [filteredMovies, setFilteredMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [notes, setNotes] = useState('');
  const [years, setYears] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMovieName, setNewMovieName] = useState('');
  const [newMovieYear, setNewMovieYear] = useState('');
  const [newMoviePoster, setNewMoviePoster] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editPoster, setEditPoster] = useState('');
  const [user, setUser] = useState(null);

  // Verificar autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Login con Google
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error en login:', error);
      alert('Error al iniciar sesión');
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  // Cargar películas de Firebase
  useEffect(() => {
    const loadMovies = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'peliculas'));
        const moviesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setMovies(moviesData);
        setFilteredMovies(moviesData);
        
        const uniqueYears = [...new Set(moviesData.map(m => m.año))].sort((a, b) => b - a);
        setYears(uniqueYears);
        
        setLoading(false);
      } catch (error) {
        console.error('Error cargando películas:', error);
        setLoading(false);
      }
    };

    loadMovies();
  }, []);

  // Filtrar películas
  useEffect(() => {
    let filtered = movies;

    if (searchTerm) {
      filtered = filtered.filter(movie =>
        movie.nombre && String(movie.nombre).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (yearFilter) {
      filtered = filtered.filter(movie => movie.año === parseInt(yearFilter));
    }

    setFilteredMovies(filtered);
  }, [searchTerm, yearFilter, movies]);

  // Agregar nueva película
  const handleAddMovie = async (e) => {
    e.preventDefault();
    
    if (!user) {
      alert('Debes iniciar sesión para agregar películas');
      return;
    }

    if (!newMovieName || !newMovieYear) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    try {
      const newMovie = {
        nombre: newMovieName,
        año: parseInt(newMovieYear),
        poster_url: newMoviePoster,
        notas: ''
      };

      const docRef = await addDoc(collection(db, 'peliculas'), newMovie);
      
      const movieWithId = { ...newMovie, id: docRef.id };
      setMovies([...movies, movieWithId]);
      
      setNewMovieName('');
      setNewMovieYear('');
      setNewMoviePoster('');
      setShowAddModal(false);
      
      alert('✓ Película agregada correctamente');
    } catch (error) {
      console.error('Error agregando película:', error);
      alert('Error al agregar la película');
    }
  };

  const openMovie = (movie) => {
    setSelectedMovie(movie);
    setNotes(movie.notas || '');
    setEditName(movie.nombre);
    setEditYear(movie.año);
    setEditPoster(movie.poster_url || '');
    setIsEditing(false);
  };

  const closeMovie = () => {
    setSelectedMovie(null);
    setNotes('');
    setIsEditing(false);
  };

  const startEditing = () => {
    if (!user) {
      alert('Debes iniciar sesión para editar películas');
      return;
    }
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName(selectedMovie.nombre);
    setEditYear(selectedMovie.año);
    setEditPoster(selectedMovie.poster_url || '');
  };

  const saveEdit = async () => {
    if (!editName || !editYear) {
      alert('El nombre y año son obligatorios');
      return;
    }

    try {
      const movieRef = doc(db, 'peliculas', selectedMovie.id);
      await updateDoc(movieRef, {
        nombre: editName,
        año: parseInt(editYear),
        poster_url: editPoster
      });

      const updatedMovies = movies.map(m => 
        m.id === selectedMovie.id 
          ? { ...m, nombre: editName, año: parseInt(editYear), poster_url: editPoster }
          : m
      );
      setMovies(updatedMovies);
      setSelectedMovie({ ...selectedMovie, nombre: editName, año: parseInt(editYear), poster_url: editPoster });
      
      setIsEditing(false);
      alert('✓ Película actualizada correctamente');
    } catch (error) {
      console.error('Error actualizando película:', error);
      alert('Error al actualizar la película');
    }
  };

  const deleteMovie = async () => {
    if (!user) {
      alert('Debes iniciar sesión para eliminar películas');
      return;
    }

    if (!window.confirm('¿Estás seguro de que quieres eliminar esta película?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'peliculas', selectedMovie.id));
      setMovies(movies.filter(m => m.id !== selectedMovie.id));
      closeMovie();
      alert('✓ Película eliminada correctamente');
    } catch (error) {
      console.error('Error eliminando película:', error);
      alert('Error al eliminar la película');
    }
  };

  const saveNotes = async () => {
    if (!selectedMovie) return;

    if (!user) {
      alert('Debes iniciar sesión para guardar notas');
      return;
    }

    try {
      const movieRef = doc(db, 'peliculas', selectedMovie.id);
      await updateDoc(movieRef, {
        notas: notes
      });

      setMovies(movies.map(m => 
        m.id === selectedMovie.id ? { ...m, notas: notes } : m
      ));

      alert('Notas guardadas correctamente ✓');
    } catch (error) {
      console.error('Error guardando notas:', error);
      alert('Error al guardar las notas');
    }
  };

  if (loading) {
    return <div className="loading">Cargando películas...</div>;
  }

  return (
    <div className="App">
      <div className="header">
        <h1>🎬 Mi Diario de Películas</h1>
        <div className="header-info">
          <div className="movie-count">
            {filteredMovies.length} de {movies.length} películas
          </div>
          <div className="controls">
            <input
              type="text"
              className="search-box"
              placeholder="Buscar película..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="year-filter"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="">Todos los años</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {user ? (
              <button className="save-button" onClick={handleLogout}>
                🚪 Cerrar sesión
              </button>
            ) : (
              <button className="save-button" onClick={handleLogin}>
                🔐 Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="movies-grid">
        {filteredMovies.map(movie => (
          <div
            key={movie.id}
            className="movie-card"
            onClick={() => openMovie(movie)}
          >
            <img
              src={movie.poster_url || 'https://via.placeholder.com/300x450?text=Sin+Poster'}
              alt={movie.nombre}
              className="movie-poster"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/300x450?text=Sin+Poster';
              }}
            />
            <div className="movie-info">
              <div className="movie-title">{movie.nombre}</div>
              <div className="movie-year">{movie.año}</div>
            </div>
          </div>
        ))}
      </div>

      {selectedMovie && (
        <div className="modal-overlay" onClick={closeMovie}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeMovie}>×</button>
            <img
              src={selectedMovie.poster_url || 'https://via.placeholder.com/600x900?text=Sin+Poster'}
              alt={selectedMovie.nombre}
              className="modal-poster"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/600x900?text=Sin+Poster';
              }}
            />
            <div className="modal-details">
              {!isEditing ? (
                <>
                  <h2 className="modal-title">{selectedMovie.nombre}</h2>
                  <div className="modal-year">{selectedMovie.año}</div>
                  
                  {user && (
                    <div style={{marginTop: '20px', display: 'flex', gap: '10px'}}>
                      <button className="save-button" onClick={startEditing}>
                        ✏️ Editar película
                      </button>
                      <button 
                        className="save-button" 
                        onClick={deleteMovie}
                        style={{backgroundColor: '#dc3545'}}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  )}

                  <div className="modal-notes" style={{marginTop: '30px'}}>
                    <label>Notas personales (opcional):</label>
                    <textarea
                      className="notes-textarea"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Escribe tus pensamientos sobre esta película..."
                      disabled={!user}
                    />
                    {user && (
                      <button className="save-button" onClick={saveNotes}>
                        Guardar notas
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="modal-title">Editar película</h2>
                  
                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', marginBottom: '10px', color: '#ccc'}}>
                      Nombre:
                    </label>
                    <input
                      type="text"
                      className="search-box"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{width: '100%'}}
                    />
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', marginBottom: '10px', color: '#ccc'}}>
                      Año:
                    </label>
                    <input
                      type="number"
                      className="search-box"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      style={{width: '100%'}}
                      min="1900"
                      max="2030"
                    />
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', marginBottom: '10px', color: '#ccc'}}>
                      Link del póster:
                    </label>
                    <input
                      type="url"
                      className="search-box"
                      value={editPoster}
                      onChange={(e) => setEditPoster(e.target.value)}
                      placeholder="https://ejemplo.com/poster.jpg"
                      style={{width: '100%'}}
                    />
                  </div>

                  <div style={{display: 'flex', gap: '10px'}}>
                    <button className="save-button" onClick={saveEdit} style={{flex: 1}}>
                      💾 Guardar cambios
                    </button>
                    <button 
                      className="save-button" 
                      onClick={cancelEditing}
                      style={{flex: 1, backgroundColor: '#6c757d'}}
                    >
                      ✖️ Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {user && (
        <button 
          className="add-button" 
          title="Agregar película"
          onClick={() => setShowAddModal(true)}
        >
          +
        </button>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            <div className="modal-details">
              <h2 className="modal-title">Agregar nueva película</h2>
              <form onSubmit={handleAddMovie}>
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '10px', color: '#ccc'}}>
                    Nombre de la película:
                  </label>
                  <input
                    type="text"
                    className="search-box"
                    value={newMovieName}
                    onChange={(e) => setNewMovieName(e.target.value)}
                    placeholder="Ej: The Matrix"
                    required
                    style={{width: '100%'}}
                  />
                </div>
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '10px', color: '#ccc'}}>
                    Año:
                  </label>
                  <input
                    type="number"
                    className="search-box"
                    value={newMovieYear}
                    onChange={(e) => setNewMovieYear(e.target.value)}
                    placeholder="2024"
                    required
                    style={{width: '100%'}}
                    min="1900"
                    max="2030"
                  />
                </div>
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '10px', color: '#ccc'}}>
                    Link del póster (opcional):
                  </label>
                  <input
                    type="url"
                    className="search-box"
                    value={newMoviePoster}
                    onChange={(e) => setNewMoviePoster(e.target.value)}
                    placeholder="https://ejemplo.com/poster.jpg"
                    style={{width: '100%'}}
                  />
                </div>
                <button type="submit" className="save-button" style={{width: '100%'}}>
                  Agregar película
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;