const containerStyle: React.CSSProperties = {
  maxWidth: 620,
  margin: "0 auto",
  padding: "3rem 1.5rem",
};

const labelStyle: React.CSSProperties = { fontSize: "0.8rem", letterSpacing: 1 };
const titleStyle: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 700 };
const subtitleStyle: React.CSSProperties = { fontSize: "0.95rem" };
const cardBodyStyle: React.CSSProperties = { fontSize: "0.88rem" };
const sectionLabelStyle: React.CSSProperties = { fontSize: "0.78rem", letterSpacing: 0.5 };
const listStyle: React.CSSProperties = { fontSize: "0.88rem" };

const highlights = [
  "React 19 + TypeScript",
  "Zustand",
  "Virtualized tables (TanStack Virtual)",
  "Recharts (sales REST API)",
  "Live Map — WebSocket + react-simple-maps",
  "AI chat — Claude on HTTP request logs (no Cube.js in repo)",
  "Chat: multiple threads, DB history, auto titles",
  "Express, Prisma, PostgreSQL — pnpm workspaces, Turborepo.",
];

export default function HomePage() {
  return (
    <div style={containerStyle}>
      <p className="text-muted mb-1" style={labelStyle}>
        DEMO APPLICATION
      </p>
      <h1 className="mb-2" style={titleStyle}>
        Ilia Zhigarev
      </h1>
      <p className="text-muted mb-4" style={subtitleStyle}>
        Full-Stack Engineer position at{" "}
        <a
          href="https://cube.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="fw-semibold text-decoration-none"
        >
          Cube
        </a>
      </p>

      <div className="card mb-4">
        <div className="card-body" style={cardBodyStyle}>
          <p className="mb-2">
            Demo for the{" "}
            <a
              href="https://www.careers-page.com/cube-dev/job/63X78V5R"
              target="_blank"
              rel="noopener noreferrer"
            >
              Full-Stack Engineer
            </a>{" "}
            role: sales table and charts (REST), a live map (WebSocket), and a
            chat that answers questions about stored request logs (Claude).
            Stack: React, Express, Prisma, Postgres.
          </p>
          <p className="mb-0 text-muted">
            Navigate using the tabs above to explore the app.
          </p>
        </div>
      </div>

      <h6 className="text-muted mb-2" style={sectionLabelStyle}>
        TECH STACK
      </h6>
      <ul className="list-unstyled mb-0" style={listStyle}>
        {highlights.map((h) => (
          <li key={h} className="mb-1">
            <span className="text-muted me-2">—</span>
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}
