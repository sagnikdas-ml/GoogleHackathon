const cards = [
  ['Classes', '4'],
  ['Shared Notes', '9'],
  ['Upcoming Events', '5'],
  ['Quiz Readiness', '82%']
];

export default function DashboardPage() {
  return (
    <main className="grid">
      <div className="grid grid-4">
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="muted">{label}</div>
            <div className="kpi">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h3>Upcoming</h3>
          <ul>
            <li>Cloud Computing - Monday 10:00</li>
            <li>ML Quiz - Wednesday 09:00</li>
            <li>Data Structures Review - Friday 18:00</li>
          </ul>
        </div>
        <div className="card">
          <h3>Recent notes</h3>
          <ul>
            <li>CAP theorem summary</li>
            <li>IAM role basics</li>
            <li>Operating systems scheduling</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
