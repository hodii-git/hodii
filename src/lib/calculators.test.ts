import { describe, expect, it } from "vitest";
import { affordableLoan, affordableRent, monthlyPayment, mortgage, rentUpfront } from "./calculators";

describe("monthlyPayment", () => {
  it("matches the standard annuity formula", () => expect(Math.round(monthlyPayment(1_000_000, 12, 10))).toBe(14_347));
  it("handles a zero rate", () => expect(monthlyPayment(1_200_000, 0, 10)).toBe(10_000));
  it("is zero without a loan or term", () => { expect(monthlyPayment(0, 10, 10)).toBe(0); expect(monthlyPayment(100, 10, 0)).toBe(0); });
});
describe("mortgage", () => {
  it("splits price into deposit and loan", () => { const m = mortgage(10_000_000, 20, 13, 20); expect(m.deposit).toBe(2_000_000); expect(m.loan).toBe(8_000_000); expect(m.totalInterest).toBeGreaterThan(0); });
  it("caps the deposit at the price", () => expect(mortgage(1_000_000, 150, 13, 20).loan).toBe(0));
});
describe("affordableLoan", () => {
  it("round-trips with monthlyPayment", () => { const loan = affordableLoan(150_000, 0, 33, 13, 20); expect(Math.round(monthlyPayment(loan, 13, 20))).toBe(49_500); });
  it("is zero when debts use the whole allowance", () => expect(affordableLoan(100_000, 40_000, 33, 13, 20)).toBe(0));
});
describe("rent", () => {
  it("applies the 30% rule after debts", () => { expect(affordableRent(100_000, 0)).toBe(30_000); expect(affordableRent(100_000, 10_000)).toBe(20_000); expect(affordableRent(10_000, 50_000)).toBe(0); });
  it("adds deposit, advance and agent fee", () => expect(rentUpfront(30_000, 2, 1, 10)).toBe(93_000));
});
