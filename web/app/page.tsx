import Link from 'next/link';

export default function Home() {
  return (
    <div className="container">
      <h1>ALEHA TEACHER</h1>
      <p className="subtitle">Teacher Registration Portal</p>

      <div className="card">
        <h2>For applicants</h2>
        <p style={{ marginBottom: 16 }}>
          Submit your details to apply as a teacher.
        </p>
        <Link href="/apply" className="btn btn-primary">
          Apply now
        </Link>
      </div>

      <div className="card">
        <h2>For staff</h2>
        <p style={{ marginBottom: 16 }}>
          Review applicants, enrich records, and manage teacher onboarding.
        </p>
        <Link href="/admin/login" className="btn btn-secondary">
          Staff login
        </Link>
      </div>
    </div>
  );
}