import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useExpo } from './context/ExpoContext.jsx';
import { MAX_EXPO_ITEMS, VARIANT } from './lib/art.js';
import { ArtworkPage } from './pages/ArtworkPage.jsx';
import { ExpoPage } from './pages/ExpoPage.jsx';
import { ExpoViewPage } from './pages/ExpoViewPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';

export default function App() {
  const { expo } = useExpo();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <span className="brand-title">Своя выставка</span>
            <span className="brand-variant">Вариант {VARIANT.number} · {VARIANT.query}</span>
          </Link>

          <nav className="site-nav" aria-label="Основная навигация">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}>
              Поиск
            </NavLink>
            <NavLink to="/expo" className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}>
              Моя выставка ({expo.ids.length}/{MAX_EXPO_ITEMS})
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/artwork/:id" element={<ArtworkPage />} />
          <Route path="/expo" element={<ExpoPage />} />
          <Route path="/expo/view" element={<ExpoViewPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <p>Данные и изображения предоставлены Art Institute of Chicago API (IIIF).</p>
      </footer>
    </div>
  );
}
