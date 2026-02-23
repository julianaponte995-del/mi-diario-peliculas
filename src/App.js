import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import './App.css';

const TMDB_API_KEY = '9f703739095bdf0c11f10618496e87e8';
const TMDB_BASE    = 'https://api.themoviedb.org/3';
const TMDB_IMG     = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_SM  = 'https://image.tmdb.org/t/p/w92';

const PLACEHOLDER  = 'https://placehold.co/300x450/111113/5a5956?text=Sin+Póster';

// ── helpers ──────────────────────────────────────
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ── App ───────────────────────────────────────────
function App() {
  // library
  const [movies,         setMovies]         = useState([]);
  const [filteredMovies, setFilteredMovies] = useState([]);
  const [loading,        setLoading]        = useState(true);

  // filters
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [years,      setYears]      = useState([]);

  // detail modal
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [notes,         setNotes]         = useState('');
  const [isEditing,     setIsEditing]     = useState(false);
  const [editName,      setEditName]      = useState('');
  const [editYear,      setEditYear]      = useState('');
  const [editPoster,    setEditPoster]    = useState('');

  // add modal
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [newNotes,        setNewNotes]        = useState('');

  // TMDB search (add modal)
  const [tmdbQuery,    setTmdbQuery]    = useState('');
  const [tmdbResults,  setTmdbResults]  = useState([]);
  const [tmdbLoading,  setTmdbLoading]  = useState(false);
  const [tmdbSelected, setTmdbSelected] = useState(null); // movie chosen from TMDB

  // manual fallback
  const [manualMode,      setManualMode]      = useState(false);
  const [manualName,      setManualName]      = useState('');
  const [manualYear,      setManualYear]      = useState('');
  const [manualPoster,    setManualPoster]    = useState('');

  // auth
  const [user, setUser] = useState(null);

  // ── Auth ───────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  const handleLogin  = async () => { try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); } };
  const handleLogout = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };

  // ── Load movies ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'peliculas'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMovies(data);
        setFilteredMovies(data);
        const uniqueYears = [...new Set(data.map(m => m.año))].sort((a, b) => b - a);
        setYears(uniqueYears);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Filter ─────────────────────────────────────
  useEffect(() => {
    let filtered = movies;
    if (searchTerm) {
      filtered = filtered.filter(m =>
        m.nombre && String(m.nombre).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (yearFilter) {
      filtered = filtered.filter(m => m.año === parseInt(yearFilter));
    }
    setFilteredMovies(filtered);
  }, [searchTerm, yearFilter, movies]);

  // ── TMDB search (debounced) ────────────────────
  const searchTmdb = useCallback(
    debounce(async (query) => {
      if (!query.trim()) { setTmdbResults([]); return; }
      setTmdbLoading(true);
      try {
        const res  = await fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=es-MX&include_adult=false`);
        const data = await res.json();
        setTmdbResults(data.results?.slice(0, 8) || []);
      } catch (e) {
        console.error(e);
        setTmdbResults([]);
      } finally {
        setTmdbLoading(false);
      }
    }, 480),
    []
  );

  useEffect(() => {
    if (!manualMode) searchTmdb(tmdbQuery);
  }, [tmdbQuery, manualMode, searchTmdb]);

  // ── Open / close add modal ─────────────────────
  const openAddModal = () => {
    setShowAddModal(true);
    setTmdbQuery('');
    setTmdbResults([]);
    setTmdbSelected(null);
    setNewNotes('');
    setManualMode(false);
    setManualName('');
    setManualYear('');
    setManualPoster('');
  };

  const closeAddModal = () => {
    setShowAddModal(false);
  };

  // ── Select TMDB result ─────────────────────────
  const selectTmdbMovie = (movie) => {
    setTmdbSelected(movie);
    setTmdbResults([]);
    setTmdbQuery('');
  };

  const clearTmdbSelected = () => {
    setTmdbSelected(null);
    setTmdbQuery('');
    setTmdbResults([]);
  };

  // ── Add movie ──────────────────────────────────
  const handleAddMovie = async (e) => {
    e.preventDefault();
    if (!user) { alert('Debes iniciar sesión para agregar películas'); return; }

    let nombre, año, poster_url, sinopsis = '', tmdb_id = null;

    if (!manualMode) {
      if (!tmdbSelected) { alert('Busca y selecciona una película'); return; }
      nombre     = tmdbSelected.title;
      año        = tmdbSelected.release_date ? parseInt(tmdbSelected.release_date.slice(0, 4)) : 0;
      poster_url = tmdbSelected.poster_path ? TMDB_IMG + tmdbSelected.poster_path : '';
      sinopsis   = tmdbSelected.overview || '';
      tmdb_id    = tmdbSelected.id;
    } else {
      if (!manualName || !manualYear) { alert('El nombre y año son obligatorios'); return; }
      nombre     = manualName;
      año        = parseInt(manualYear);
      poster_url = manualPoster || '';
    }

    try {
      const newMovie = { nombre, año, poster_url, sinopsis, notas: newNotes, tmdb_id };
      const docRef   = await addDoc(collection(db, 'peliculas'), newMovie);
      const withId   = { ...newMovie, id: docRef.id };
      const updated  = [...movies, withId];
      setMovies(updated);
      const uniqueYears = [...new Set(updated.map(m => m.año))].sort((a, b) => b - a);
      setYears(uniqueYears);
      closeAddModal();
    } catch (e) {
      console.error(e);
      alert('Error al agregar la película');
    }
  };

  // ── Movie detail ───────────────────────────────
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

  const saveNotes = async () => {
    if (!selectedMovie || !user) return;
    try {
      await updateDoc(doc(db, 'peliculas', selectedMovie.id), { notas: notes });
      setMovies(movies.map(m => m.id === selectedMovie.id ? { ...m, notas: notes } : m));
      setSelectedMovie({ ...selectedMovie, notas: notes });
    } catch (e) {
      console.error(e);
    }
  };

  const saveEdit = async () => {
    if (!editName || !editYear) { alert('El nombre y año son obligatorios'); return; }
    try {
      await updateDoc(doc(db, 'peliculas', selectedMovie.id), {
        nombre: editName, año: parseInt(editYear), poster_url: editPoster
      });
      const updated = { ...selectedMovie, nombre: editName, año: parseInt(editYear), poster_url: editPoster };
      setMovies(movies.map(m => m.id === selectedMovie.id ? updated : m));
      setSelectedMovie(updated);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert('Error al actualizar');
    }
  };

  const deleteMovie = async () => {
    if (!user) return;
    if (!window.confirm('¿Eliminar esta película del diario?')) return;
    try {
      await deleteDoc(doc(db, 'peliculas', selectedMovie.id));
      setMovies(movies.filter(m => m.id !== selectedMovie.id));
      closeMovie();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Render loading ─────────────────────────────
  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <span>Cargando diario</span>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────
  return (
    <div className="App">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-top">
          <div className="header-brand">
            <h1>Cine<span>log</span></h1>
            <span className="header-sub">diario de películas</span>
          </div>
          <span className="movie-count">
            {filteredMovies.length} {filteredMovies.length === 1 ? 'película' : 'películas'}
          </span>
        </div>

        <div className="header-controls">
          <input
            type="text"
            className="search-box"
            placeholder="Buscar en tu diario…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <select
            className="year-filter"
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
          >
            <option value="">Todos los años</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-auth" onClick={user ? handleLogout : handleLogin}>
            {user ? '↩ Salir' : '🔑 Entrar'}
          </button>
        </div>
      </header>

      {/* ── Grid ── */}
      <main className="page-body">
        {filteredMovies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎬</div>
            <p>No hay películas que coincidan</p>
          </div>
        ) : (
          <div className="movies-grid">
            {filteredMovies.map(movie => (
              <div key={movie.id} className="movie-card" onClick={() => openMovie(movie)}>
                <div className="movie-poster-wrap">
                  <img
                    src={movie.poster_url || PLACEHOLDER}
                    alt={movie.nombre}
                    className="movie-poster"
                    onError={e => { e.target.src = PLACEHOLDER; }}
                  />
                </div>
                <div className="movie-info">
                  <div className="movie-title">
                    {movie.nombre}
                    {movie.notas && <span className="movie-has-notes" title="Tiene notas" />}
                  </div>
                  <div className="movie-year">{movie.año}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── FAB ── */}
      {user && (
        <button className="add-button" title="Agregar película" onClick={openAddModal}>
          +
        </button>
      )}

      {/* ── Movie detail modal ── */}
      {selectedMovie && (
        <div className="modal-overlay" onClick={closeMovie}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeMovie}>✕</button>

            {!isEditing ? (
              <div className="movie-modal-layout">
                {/* poster */}
                <div className="movie-modal-poster-col">
                  <img
                    src={selectedMovie.poster_url || PLACEHOLDER}
                    alt={selectedMovie.nombre}
                    className="modal-poster"
                    onError={e => { e.target.src = PLACEHOLDER; }}
                  />
                </div>

                {/* details */}
                <div className="movie-modal-details">
                  <h2 className="modal-title">{selectedMovie.nombre}</h2>
                  <div className="modal-year">{selectedMovie.año}</div>

                  {selectedMovie.sinopsis && (
                    <p className="modal-overview">{selectedMovie.sinopsis}</p>
                  )}

                  {user && (
                    <>
                      <div className="modal-divider" />
                      <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                          ✏️ Editar
                        </button>
                        <button className="btn btn-danger" onClick={deleteMovie}>
                          🗑 Eliminar
                        </button>
                      </div>
                    </>
                  )}

                  <div className="modal-divider" />

                  <span className="notes-label">Mis notas</span>
                  <textarea
                    className="notes-textarea"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={user ? 'Escribe tus impresiones…' : 'Inicia sesión para agregar notas'}
                    disabled={!user}
                    rows={5}
                  />
                  {user && (
                    <button className="btn btn-primary" style={{marginTop: '10px'}} onClick={saveNotes}>
                      Guardar notas
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ── Edit form ── */
              <div style={{padding: '30px 28px 28px'}}>
                <h3 className="edit-form-title">Editar película</h3>
                <div className="edit-form">
                  <div className="form-group">
                    <label className="form-label">Nombre</label>
                    <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Año</label>
                    <input className="form-input" type="number" value={editYear} onChange={e => setEditYear(e.target.value)} min="1900" max="2030" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">URL del póster</label>
                    <input className="form-input" type="url" value={editPoster} onChange={e => setEditPoster(e.target.value)} placeholder="https://…" />
                  </div>
                  <div style={{display:'flex', gap:'8px', marginTop:'4px'}}>
                    <button className="btn btn-primary" style={{flex:1}} onClick={saveEdit}>💾 Guardar</button>
                    <button className="btn btn-secondary" style={{flex:1}} onClick={() => setIsEditing(false)}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add movie modal ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal-content add-modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeAddModal}>✕</button>

            <div className="add-modal-inner">
              <h2 className="add-modal-title">Agregar película</h2>
              <p className="add-modal-sub">
                {manualMode
                  ? 'Rellena los datos manualmente'
                  : 'Busca por título y selecciona de los resultados de TMDB'}
              </p>

              <form onSubmit={handleAddMovie}>

                {!manualMode ? (
                  <>
                    {/* TMDB search */}
                    {!tmdbSelected && (
                      <div className="tmdb-search-wrap">
                        <div className="tmdb-search-input-row">
                          <input
                            className="form-input"
                            placeholder="Buscar en TMDB… ej: Interstellar"
                            value={tmdbQuery}
                            onChange={e => setTmdbQuery(e.target.value)}
                            autoFocus
                          />
                          {tmdbLoading && <div className="tmdb-searching" />}
                        </div>

                        {tmdbResults.length > 0 && (
                          <div className="tmdb-results">
                            {tmdbResults.map(m => (
                              <div
                                key={m.id}
                                className="tmdb-result-item"
                                onClick={() => selectTmdbMovie(m)}
                              >
                                <img
                                  src={m.poster_path ? TMDB_IMG_SM + m.poster_path : PLACEHOLDER}
                                  alt={m.title}
                                  className="tmdb-result-thumb"
                                  onError={e => { e.target.src = PLACEHOLDER; }}
                                />
                                <div className="tmdb-result-info">
                                  <div className="tmdb-result-title">{m.title}</div>
                                  <div className="tmdb-result-year">
                                    {m.release_date ? m.release_date.slice(0, 4) : '—'}
                                    {m.original_title !== m.title && ` · ${m.original_title}`}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {tmdbQuery.length > 2 && !tmdbLoading && tmdbResults.length === 0 && (
                          <div className="tmdb-results">
                            <div className="tmdb-no-results">Sin resultados para "{tmdbQuery}"</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selected movie preview */}
                    {tmdbSelected && (
                      <div className="selected-preview">
                        <img
                          src={tmdbSelected.poster_path ? TMDB_IMG + tmdbSelected.poster_path : PLACEHOLDER}
                          alt={tmdbSelected.title}
                          className="selected-preview-poster"
                          onError={e => { e.target.src = PLACEHOLDER; }}
                        />
                        <div className="selected-preview-info">
                          <div className="selected-preview-title">{tmdbSelected.title}</div>
                          <div className="selected-preview-year">
                            {tmdbSelected.release_date ? tmdbSelected.release_date.slice(0, 4) : '—'}
                          </div>
                          {tmdbSelected.overview && (
                            <p className="selected-preview-overview">{tmdbSelected.overview}</p>
                          )}
                        </div>
                        <button type="button" className="selected-clear" onClick={clearTmdbSelected} title="Cambiar selección">✕</button>
                      </div>
                    )}
                  </>
                ) : (
                  /* Manual mode */
                  <>
                    <div className="form-group">
                      <label className="form-label">Nombre *</label>
                      <input
                        className="form-input"
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        placeholder="Ej: The Matrix"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Año *</label>
                      <input
                        className="form-input"
                        type="number"
                        value={manualYear}
                        onChange={e => setManualYear(e.target.value)}
                        placeholder="2024"
                        required
                        min="1900"
                        max="2030"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">URL del póster</label>
                      <input
                        className="form-input"
                        type="url"
                        value={manualPoster}
                        onChange={e => setManualPoster(e.target.value)}
                        placeholder="https://…"
                      />
                    </div>
                  </>
                )}

                {/* Notes — always visible */}
                <div className="form-group" style={{marginTop: '4px'}}>
                  <label className="form-label">Mis notas (opcional)</label>
                  <textarea
                    className="notes-textarea"
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    placeholder="Primeras impresiones, opinión…"
                    rows={4}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-full" style={{marginTop: '4px'}}>
                  ＋ Agregar al diario
                </button>

                {/* Toggle manual mode */}
                <div className="divider-or">o bien</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-full"
                  onClick={() => { setManualMode(!manualMode); setTmdbSelected(null); setTmdbQuery(''); setTmdbResults([]); }}
                >
                  {manualMode ? '🔍 Buscar en TMDB' : '⌨️ Ingresar manualmente'}
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
