export type ExpenseType = 'deduction' | 'addition';

export type TicketInput = { price: number; issued: number; returned: number };
export type ExpenseInput = { amount: number; type: ExpenseType };

export type TicketResult = TicketInput & { sold: number; amount: number };

export type Settlement = {
  tickets: TicketResult[];
  gross: number;
  totalExpenses: number;
  net: number;
  driver: number;
  conductor: number;
  owner: number;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * sold = issued - returned, amount = sold x price
 * net = gross - expenses (deductions minus additions)
 * wages are a percentage of net; the owner keeps the rest
 */
export function calculate(
  tickets: TicketInput[],
  expenses: ExpenseInput[],
  driverPct: number,
  conductorPct: number
): Settlement {
  const lines = tickets.map((t) => {
    const sold = Math.max(0, t.issued - t.returned);
    return { ...t, sold, amount: sold * t.price };
  });
  const gross = lines.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce(
    (s, e) => s + (e.type === 'addition' ? -e.amount : e.amount),
    0
  );
  const net = gross - totalExpenses;
  const driver = round2((net * driverPct) / 100);
  const conductor = round2((net * conductorPct) / 100);
  return {
    tickets: lines,
    gross: round2(gross),
    totalExpenses: round2(totalExpenses),
    net: round2(net),
    driver,
    conductor,
    owner: round2(net - driver - conductor),
  };
}
