"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import {
  AlertCircle,
  Box,
  DollarSign,
  Package,
  ReceiptText,
} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

function formatCategory(category) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function UsedMaterials({ projectId, getToken }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        const token = getToken();
        const response = await axios.get(
          `/api/v1/project/${projectId}/used-materials`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (active) setReport(response.data.data);
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load used materials for this project.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchReport();
    return () => {
      active = false;
    };
  }, [projectId, getToken]);

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
        Loading used materials…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-5 w-5" />
          Unable to load used materials
        </div>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const summary = report?.summary;
  const categories = report?.category_summaries || [];
  const transactions = report?.transactions || [];
  const chartData = {
    labels: categories.map((category) => formatCategory(category.category)),
    datasets: [
      {
        label: "Estimated expense",
        data: categories.map((category) => category.estimated_expense),
        backgroundColor: "rgba(14, 116, 144, 0.75)",
        borderRadius: 6,
      },
    ],
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-700">
            Used Materials
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Estimated cost uses the lowest current supplier price for each item.
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-14 text-center">
          <Box className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h3 className="font-medium text-slate-700">
            No used materials recorded
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Used stock transactions for this project will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={DollarSign}
              label="Estimated expense"
              value={currency.format(summary.estimated_total_expense)}
            />
            <SummaryCard
              icon={Package}
              label="Used quantity"
              value={summary.total_quantity.toLocaleString("en-AU")}
            />
            <SummaryCard
              icon={ReceiptText}
              label="Transactions"
              value={summary.transaction_count.toLocaleString("en-AU")}
            />
            <SummaryCard
              icon={AlertCircle}
              label="Unpriced usage"
              value={`${summary.unpriced_quantity.toLocaleString("en-AU")} (${summary.unpriced_transaction_count})`}
              warning
            />
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-200 p-4">
              <h3 className="mb-4 font-semibold text-slate-800">
                Expense by category
              </h3>
              <div className="h-72">
                <Bar
                  data={chartData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { callback: (value) => currency.format(value) },
                      },
                    },
                  }}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="font-semibold text-slate-800">
                  Category summary
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Expense</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.map((category) => (
                      <tr key={category.category}>
                        <td className="px-4 py-3 text-slate-700">
                          {formatCategory(category.category)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {category.quantity.toLocaleString("en-AU")}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {currency.format(category.estimated_expense)}
                          {category.unpriced_transaction_count > 0 && (
                            <span className="block text-xs font-normal text-amber-600">
                              {category.unpriced_quantity} unpriced
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="overflow-hidden rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="font-semibold text-slate-800">
                Used material details
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Unit price</th>
                    <th className="px-4 py-3 text-right">Estimated cost</th>
                    <th className="px-4 py-3">Lot</th>
                    <th className="px-4 py-3">Used on</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((transaction) => {
                    const lotNames = transaction.lot
                      ? [transaction.lot]
                      : transaction.mto_lots;
                    return (
                      <tr key={transaction.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">
                            {transaction.item_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {transaction.item_id}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatCategory(transaction.category)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {transaction.quantity.toLocaleString("en-AU")}{" "}
                          {transaction.measurement_unit || ""}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {transaction.unit_price === null ? (
                            <span className="text-amber-600">
                              No price available
                            </span>
                          ) : (
                            currency.format(transaction.unit_price)
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {transaction.estimated_cost === null
                            ? "—"
                            : currency.format(transaction.estimated_cost)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {lotNames.length
                            ? lotNames
                                .map((lot) => lot.name || lot.lot_id)
                                .join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {new Date(transaction.created_at).toLocaleDateString(
                            "en-AU",
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, warning = false }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon
          className={`h-5 w-5 ${warning ? "text-amber-500" : "text-secondary"}`}
        />
      </div>
      <p className="text-xl font-semibold text-slate-800">{value}</p>
    </div>
  );
}
