// All money in the system is stored as integer cents (smallest currency unit).
// NEVER use floats for money math. Use these helpers everywhere.

import { dinero, toDecimal, type Dinero } from "dinero.js"
import * as currencies from "@dinero.js/currencies"

type CurrencyCode = keyof typeof currencies

export function fromCents(amountCents: number, currencyCode: string): Dinero<number> {
  const currency = (currencies as Record<string, currencies.Currency<number>>)[
    currencyCode.toUpperCase()
  ]
  if (!currency) throw new Error(`Unknown currency: ${currencyCode}`)
  return dinero({ amount: Math.round(amountCents), currency })
}

export function formatMoney(amountCents: number, currencyCode: string, locale = "en-US"): string {
  const d = fromCents(amountCents, currencyCode)
  return toDecimal(d, ({ value, currency }) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.code,
    }).format(Number(value)),
  )
}

// User input like "12.34" → 1234 cents. Handles common currency shapes (2 decimals).
// For zero-decimal currencies (JPY, etc.) caller should pass the integer directly.
export function toCents(input: string | number, exponent = 2): number {
  const n = typeof input === "string" ? Number.parseFloat(input) : input
  if (Number.isNaN(n)) return 0
  return Math.round(n * 10 ** exponent)
}

export function centsToDecimal(amountCents: number, exponent = 2): string {
  return (amountCents / 10 ** exponent).toFixed(exponent)
}

export const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  "USD",
  "EUR",
  "GBP",
  "PHP",
  "AUD",
  "CAD",
  "SGD",
  "JPY",
  "INR",
]
