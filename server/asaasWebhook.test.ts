import { describe, expect, it } from "vitest";
import { parseExternalReference, validateAsaasPayment } from "./asaasWebhook";

const base = {
  company: { id: 7, asaasCustomerId: "cus_7", asaasSubscriptionId: "sub_7" },
  plan: { id: 3, price: "99.90" },
  subscription: { asaasSubscriptionId: "sub_7", amount: "99.90" },
};

describe("validação do webhook Asaas", () => {
  it("interpreta referência externa normalizada", () => {
    expect(parseExternalReference("company:7:plan:3")).toEqual({ companyId: 7, planId: 3 });
    expect(parseExternalReference("company:07:plan:003")).toEqual({ companyId: 7, planId: 3 });
    expect(parseExternalReference("7/3")).toBeNull();
  });

  it("aceita pagamento coerente com empresa, assinatura, plano e valor", () => {
    expect(validateAsaasPayment({ ...base, payment: { customer: "cus_7", subscription: "sub_7", value: 99.9, externalReference: "company:7:plan:3" } })).toMatchObject({ ok: true });
  });

  it.each([
    ["empresa ou plano divergente", { externalReference: "company:8:plan:3" }],
    ["cliente Asaas divergente", { customer: "cus_other", externalReference: "company:7:plan:3" }],
    ["assinatura Asaas divergente", { subscription: "sub_other", externalReference: "company:7:plan:3" }],
    ["valor divergente", { value: 100, externalReference: "company:7:plan:3" }],
  ])("rejeita %s", (_reason, payment) => {
    expect(validateAsaasPayment({ ...base, payment: payment as any })).toMatchObject({ ok: false });
  });
});
