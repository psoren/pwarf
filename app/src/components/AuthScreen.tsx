import { useState } from "react";

type AuthMode = "login" | "signup";

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

export default function AuthScreen({ onSignIn, onSignUp }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-panel)] gap-6">
      <h1 className="text-[var(--amber)] text-2xl font-bold tracking-wider">
        pWarf
      </h1>
      <p className="text-[var(--text)] text-sm">
        A dwarf fortress adventure awaits.
      </p>

      <div className="flex gap-4 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`px-3 py-1 cursor-pointer border-b-2 ${
            mode === "login"
              ? "border-[var(--green)] text-[var(--green)]"
              : "border-transparent text-[var(--text)] hover:text-[var(--amber)]"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`px-3 py-1 cursor-pointer border-b-2 ${
            mode === "signup"
              ? "border-[var(--green)] text-[var(--green)]"
              : "border-transparent text-[var(--text)] hover:text-[var(--amber)]"
          }`}
        >
          Sign Up
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 w-72"
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--green)]"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--green)]"
        />

        {error && (
          <p className="text-red-400 text-xs text-center" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 border border-[var(--green)] text-[var(--green)] font-bold text-sm hover:bg-[var(--green)] hover:text-[var(--bg-panel)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "..."
            : mode === "login"
              ? "Login"
              : "Sign Up"}
        </button>
      </form>
    </div>
  );
}
