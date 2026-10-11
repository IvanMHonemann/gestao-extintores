export type AsaasPaymentForValidation = {
  id?: string;
  customer?: string;
  subscription?: string;
  value?: number | string;
  externalReference?: string | null;
  status?: string;
};

export type BillingCompanyForValidation = {
  id: number;
  asaasCustomerId?: string | null;
  asaasSubscriptionId?: string | null;
};

export type BillingPlanForValidation = {
  id: number;
  price: number | string;
};

export type BillingSubscriptionForValidation = {
  asaasSubscriptionId?: string | null;
  amount?: number | string | null;
};

export function parseExternalReference(value: unknown): { companyId: number; planId: number } | null {
  const match = String(value || "").trim().match(/^company:(\d+):plan:(\d+)$/i);
  if (!match) return null;
  const companyId = Number(match[1]);
  const planId = Number(match[2]);
  return companyId > 0 && planId > 0 ? { companyId, planId } : null;
}

function money(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

export function validateAsaasPayment(input: {
  payment: AsaasPaymentForValidation;
  company: BillingCompanyForValidation;
  plan: BillingPlanForValidation;
  subscription?: BillingSubscriptionForValidation | null;
}): { ok: true; reference: { companyId: number; planId: number } } | { ok: false; reason: string } {
  const reference = parseExternalReference(input.payment.externalReference);
  if (!reference) return { ok: false, reason: "externalReference ausente ou inválida" };
  if (reference.companyId !== input.company.id || reference.planId !== input.plan.id) return { ok: false, reason: "empresa ou plano divergente" };
  if (input.payment.customer && input.company.asaasCustomerId && input.payment.customer !== input.company.asaasCustomerId) return { ok: false, reason: "cliente Asaas divergente" };
  const expectedSubscription = input.subscription?.asaasSubscriptionId || input.company.asaasSubscriptionId;
  if (expectedSubscription && input.payment.subscription !== expectedSubscription) return { ok: false, reason: "assinatura Asaas divergente" };
  const received = money(input.payment.value);
  const expected = money(input.subscription?.amount ?? input.plan.price);
  if (received === null || expected === null || received !== expected) return { ok: false, reason: "valor divergente" };
  return { ok: true, reference };
}
