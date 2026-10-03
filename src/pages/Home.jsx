import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import ReadingScene from "../components/ReadingScene.jsx";
import { IconBooks, IconLoans, IconPlus } from "../components/Icons.jsx";

export default function Home() {
  const [stats, setStats] = useState({ books: 0, active: 0, overdue: 0 });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [books, loans] = await Promise.all([
          api("/api/books"),
          api("/api/loans?status=ativo"),
        ]);
        if (!active) return;
        const today = new Date();
        const overdue = loans.filter(
          (loan) => loan.dueDate && new Date(loan.dueDate) < today,
        ).length;
        setStats({ books: books.length, active: loans.length, overdue });
      } catch {
        /* a home continua util mesmo sem os numeros */
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="home rise">
      <img
        className="home__logo rise-1"
        src="/img/logo-biblioteca.png"
        alt="Biblioteca ADMP Brasil"
      />

      <p className="home__welcome rise-2">
        Tudo o que sai e volta da estante fica registrado aqui.
      </p>

      <div className="home__stats rise-3">
        <div className="stat">
          <strong>{stats.books}</strong>
          <span>livros no acervo</span>
        </div>
        <div className="stat">
          <strong>{stats.active}</strong>
          <span>emprestados agora</span>
        </div>
        <div className={"stat" + (stats.overdue > 0 ? " stat--alert" : "")}>
          <strong>{stats.overdue}</strong>
          <span>passaram da data</span>
        </div>
      </div>

      <nav className="home__actions rise-4">
        <Link to="/livros" className="tile">
          <IconBooks width={24} height={24} />
          <strong>Acervo</strong>
          <span>Cadastrar, editar e excluir livros</span>
        </Link>
        <Link to="/emprestimos" className="tile">
          <IconLoans width={24} height={24} />
          <strong>Acompanhar</strong>
          <span>Quem está com cada livro</span>
        </Link>
        <Link to="/emprestimos/novo" className="tile tile--accent">
          <IconPlus width={24} height={24} />
          <strong>Emprestar</strong>
          <span>Registrar uma nova saída</span>
        </Link>
      </nav>

      <ReadingScene className="home__scene rise-5" />
    </div>
  );
}
