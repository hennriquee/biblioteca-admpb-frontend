import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { loanProgress } from "../utils/dates.js";
import { useRefresh } from "../utils/refresh.js";
import ReadingScene from "../components/ReadingScene.jsx";
import { IconBooks, IconLoans, IconPlus } from "../components/Icons.jsx";

function StatValue({ value }) {
  if (value === null || value === undefined) {
    return (
      <strong className="stat__value is-loading" role="status">
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="sr-only">Carregando</span>
      </strong>
    );
  }
  return <strong className="stat__value">{value}</strong>;
}

export default function Home() {
  // null = ainda carregando (mostra os pontinhos); "error" = nao foi possivel carregar
  const [stats, setStats] = useState(null);

  const activeRef = useRef(true);
  // quiet: atualizacao (puxar para atualizar) - se falhar, os numeros que ja
  // estao na tela ficam.
  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const [books, loans] = await Promise.all([
        api("/api/books"),
        api("/api/loans?status=ativo"),
      ]);
      if (!activeRef.current) return;
      // Mesma regra da tela de Empréstimos: atrasado = prazo vencido por dia.
      const overdue = loans.filter(
        (loan) => loan.dueDate && loanProgress(loan.startDate, loan.dueDate).overdue,
      ).length;
      setStats({ books: books.length, active: loans.length, overdue });
    } catch {
      // a home continua util mesmo sem os numeros
      if (activeRef.current && !quiet) setStats("error");
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    load();
    return () => {
      activeRef.current = false;
    };
  }, [load]);

  useRefresh(() => load({ quiet: true }));

  return (
    <div className="home rise">
      <img
        className="home__logo rise-1"
        src="/img/logo-biblioteca.svg"
        alt="Biblioteca ADMP Brasil"
      />

      <p className="home__welcome rise-2">
        Tudo o que sai e volta da estante fica registrado aqui.
      </p>

      <div className="home__stats rise-3">
        <Link to="/livros" className="stat stat--link">
          <StatValue value={stats === "error" ? "—" : stats?.books} />
          <span>livros no acervo</span>
        </Link>
        <Link to="/emprestimos" className="stat stat--link">
          <StatValue value={stats === "error" ? "—" : stats?.active} />
          <span>emprestados agora</span>
        </Link>
        <Link
          to="/emprestimos?filtro=atrasados"
          className={
            "stat stat--link" +
            (stats && stats !== "error" && stats.overdue > 0 ? " stat--alert" : "")
          }
        >
          <StatValue value={stats === "error" ? "—" : stats?.overdue} />
          <span>passaram da data</span>
        </Link>
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
