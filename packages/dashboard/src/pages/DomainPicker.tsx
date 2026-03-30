import { useState } from "react";
import { useNavigate } from "react-router";

export function DomainPicker() {
  const [domain, setDomain] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = domain
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (cleaned) {
      navigate(`/${encodeURIComponent(cleaned)}`);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-16">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">Ivy</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Site Insights</h2>
        <p className="mt-2 text-gray-500">
          See how users experience your website. View aggregated feedback,
          common questions, and areas where users struggle.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Enter a domain (e.g. www.ssa.gov)"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
        />
        <button
          type="submit"
          disabled={!domain.trim()}
          className="px-6 py-3 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          View Dashboard
        </button>
      </form>
    </div>
  );
}
