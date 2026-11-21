"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || `Request failed (${response.status})`);
  }
  return data;
}

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function BackofficePage() {
  const [dashboard, setDashboard] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    description: "",
    amount: "",
    due_date: "",
  });

  const load = useCallback(async () => {
    try {
      setError("");
      const [dashboardData, forecastData, scenarioData, customerData, invoiceData] =
        await Promise.all([
          request("/backoffice/dashboard"),
          request("/backoffice/forecast?horizon_days=60"),
          request("/backoffice/scenario", { method: "POST" }),
          request("/backoffice/customers"),
          request("/backoffice/invoices"),
        ]);
      setDashboard(dashboardData);
      setForecast(forecastData);
      setScenario(scenarioData);
      setCustomers(customerData);
      setInvoices(invoiceData);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createInvoice(event) {
    event.preventDefault();
    try {
      await request("/backoffice/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm({ customer_id: "", description: "", amount: "", due_date: "" });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function updateInvoice(invoiceId, action) {
    try {
      await request(`/backoffice/invoices/${invoiceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(action === "pay"
          ? { body: JSON.stringify({ paid_date: null }) }
          : {}),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function askAgent(event) {
    event.preventDefault();
    if (!message.trim()) return;
    try {
      const result = await request("/backoffice/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      setReply(result.reply);
      setMessage("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-cyan-400">ONE-PERSON BACK OFFICE</p>
            <h1 className="mt-1 text-3xl font-bold">Freelance Studio</h1>
            <p className="mt-1 text-sm text-slate-400">
              Invoices, follow-ups, and a clearer cash outlook.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-800 bg-red-950 p-3 text-red-200">
            {error}
          </div>
        )}

        {!dashboard ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
            Loading back-office data…
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Outstanding" value={money(dashboard.outstanding_total)} note={`${dashboard.outstanding_count} open invoices`} />
              <Metric title="Overdue" value={money(dashboard.overdue_total)} note={`${dashboard.overdue_count} need attention`} urgent />
              <Metric title="Opening cash" value={money(forecast?.opening_cash)} note="Available today" />
              <Metric title="60-day ending cash" value={money(forecast?.ending_cash)} note="Illustrative forecast" />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="card">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Who owes you</h2>
                  <span className="text-xs text-slate-400">Sorted by due date</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="pb-3">Customer</th>
                        <th>Amount</th>
                        <th>Due</th>
                        <th>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.who_owes.map((item) => (
                        <tr key={item.invoice_id} className="border-t border-slate-800">
                          <td className="py-3">{item.customer}</td>
                          <td>{money(item.amount)}</td>
                          <td>
                            {item.days_late > 0
                              ? `${item.days_late} days late`
                              : item.due_date}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => updateInvoice(item.invoice_id, "pay")}
                              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-600"
                            >
                              Mark paid
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h2 className="mb-4 text-lg font-semibold">Create an invoice</h2>
                <form onSubmit={createInvoice} className="space-y-3">
                  <select
                    required
                    value={form.customer_id}
                    onChange={(event) => setForm({ ...form, customer_id: event.target.value })}
                    className="field"
                  >
                    <option value="">Choose customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                  <input
                    required
                    placeholder="Work description"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    className="field"
                  />
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Amount (₹)"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    className="field"
                  />
                  <input
                    required
                    type="date"
                    value={form.due_date}
                    onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                    className="field"
                  />
                  <button className="w-full rounded-lg bg-cyan-500 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400">
                    Create draft
                  </button>
                </form>
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="card">
                <h2 className="mb-3 text-lg font-semibold">Today’s actions</h2>
                {dashboard.alerts.length === 0 ? (
                  <p className="text-sm text-slate-400">No overdue invoices to chase.</p>
                ) : (
                  <div className="space-y-3">
                    {dashboard.alerts.map((alert) => (
                      <div key={alert.invoice_id} className="rounded-lg border border-rose-900 bg-rose-950/30 p-3">
                        <p className="font-medium text-rose-200">{alert.action}</p>
                        <p className="mt-1 text-sm text-slate-300">
                          {alert.customer} · {money(alert.amount)} · {alert.days_overdue} days overdue
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const draft = await request(`/backoffice/invoices/${alert.invoice_id}/reminder`);
                              setReply(draft.message);
                            } catch (requestError) {
                              setError(requestError.message);
                            }
                          }}
                          className="mt-2 text-xs text-cyan-300 underline"
                        >
                          Draft reminder
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">60-day cash forecast</h2>
                  <strong className="text-cyan-300">{money(forecast?.ending_cash)}</strong>
                </div>
                <div className="space-y-2">
                  {forecast?.events.slice(0, 6).map((event, index) => (
                    <div key={`${event.date}-${index}`} className="flex justify-between gap-4 rounded-lg bg-slate-900 p-2.5 text-sm">
                      <span className="text-slate-300">{event.date} · {event.name}</span>
                      <span className={event.amount >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {event.amount >= 0 ? "+" : ""}{money(event.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="card">
                <h2 className="mb-2 text-lg font-semibold">What if a key customer pays late?</h2>
                {scenario && (
                  <>
                    <p className="text-cyan-300">{scenario.scenario}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Lowest cash: {money(scenario.lowest_point.balance)} on {scenario.lowest_point.date}
                    </p>
                    <p className="mt-3 rounded-lg bg-slate-900 p-3 text-sm">{scenario.action}</p>
                  </>
                )}
              </div>

              <div className="card">
                <h2 className="mb-3 text-lg font-semibold">Back-office assistant</h2>
                <div className="mb-3 flex flex-wrap gap-2">
                  {["Who owes me?", "Show cash forecast", "What if key customer is late?", "Draft a reminder"].map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setMessage(suggestion)}
                      className="rounded-full border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <form onSubmit={askAgent} className="flex gap-2">
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Ask about invoices or cash"
                    className="field min-w-0 flex-1"
                  />
                  <button className="rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950">
                    Ask
                  </button>
                </form>
                {reply && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg border border-cyan-900 bg-cyan-950/30 p-3 text-sm text-cyan-100">
                    {reply}
                  </p>
                )}
              </div>
            </section>

            <section className="mt-5 card">
              <h2 className="mb-3 text-lg font-semibold">Invoice workflow</h2>
              <div className="grid gap-2 md:grid-cols-2">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 p-3 text-sm">
                    <div>
                      <strong>{invoice.customer_name}</strong>
                      <p className="text-slate-400">{invoice.description}</p>
                    </div>
                    <div className="text-right">
                      <p>{money(invoice.amount)}</p>
                      <p className="text-xs uppercase text-slate-400">{invoice.status}</p>
                    </div>
                    {invoice.status === "draft" && (
                      <button type="button" onClick={() => updateInvoice(invoice.id, "send")} className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs">
                        Mark sent
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      <style jsx>{`
        :global(.card) {
          border: 1px solid rgb(30 41 59);
          border-radius: 0.75rem;
          background: rgb(15 23 42 / 0.8);
          padding: 1.25rem;
        }
        :global(.field) {
          width: 100%;
          border: 1px solid rgb(51 65 85);
          border-radius: 0.5rem;
          background: rgb(15 23 42);
          padding: 0.65rem 0.75rem;
          color: white;
        }
      `}</style>
    </main>
  );
}

function Metric({ title, value, note, urgent = false }) {
  return (
    <div className={`rounded-xl border p-5 ${urgent ? "border-rose-900 bg-rose-950/30" : "border-slate-800 bg-slate-900"}`}>
      <p className="text-sm text-slate-400">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${urgent ? "text-rose-300" : "text-white"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}
