import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="status-box">
      <h1>404 — Страница не найдена</h1>
      <p>Такого маршрута в галерее нет. Возможно, ссылка устарела или введена с опечаткой.</p>
      <Link to="/" className="btn btn-primary">
        Вернуться к поиску
      </Link>
    </section>
  );
}
