/** Home-loan and rent calculators. Pure functions, so they are easy to test and to read. Figures are estimates, not offers of credit. */

/** Monthly repayment on a loan with equal monthly payments. `annualRatePct` is e.g. 13 for 13%. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (!(principal > 0) || n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export type Mortgage = { loan: number; deposit: number; monthly: number; totalPaid: number; totalInterest: number };

export function mortgage(price: number, depositPct: number, annualRatePct: number, years: number): Mortgage {
  const deposit = Math.max(0, Math.min(price, price * (depositPct / 100)));
  const loan = Math.max(0, price - deposit);
  const monthly = monthlyPayment(loan, annualRatePct, years);
  const totalPaid = monthly * Math.round(years * 12);
  return { loan, deposit, monthly, totalPaid, totalInterest: Math.max(0, totalPaid - loan) };
}

/** The most a person can borrow if repayments may use `maxSharePct` of monthly income (banks often use about a third). */
export function affordableLoan(monthlyIncome: number, monthlyDebts: number, maxSharePct: number, annualRatePct: number, years: number): number {
  const room = monthlyIncome * (maxSharePct / 100) - monthlyDebts;
  const n = Math.round(years * 12);
  if (room <= 0 || n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  return r === 0 ? room * n : (room * (1 - Math.pow(1 + r, -n))) / r;
}

/** Rent a person can afford if rent should stay within `maxSharePct` of income (30% is the common rule of thumb). */
export function affordableRent(monthlyIncome: number, monthlyDebts: number, maxSharePct = 30): number {
  return Math.max(0, Math.floor(monthlyIncome * (maxSharePct / 100) - monthlyDebts));
}

/** Upfront cost of renting: deposit months plus advance months of rent, plus an agent fee as a share of one month. */
export function rentUpfront(monthlyRent: number, depositMonths: number, advanceMonths: number, agentFeePct: number): number {
  return Math.round(monthlyRent * (depositMonths + advanceMonths + agentFeePct / 100));
}
