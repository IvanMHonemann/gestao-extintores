import { describe, expect, it } from "vitest";
import { isDisposableEmail, normalizeSignupEmail } from "./signupPolicy";

describe("política de cadastro", () => {
  it("normaliza e-mail para impedir duplicação por caixa e espaços", () => {
    expect(normalizeSignupEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("bloqueia domínios descartáveis e aceita domínios comuns", () => {
    expect(isDisposableEmail("person@mailinator.com")).toBe(true);
    expect(isDisposableEmail("person@empresa.com.br")).toBe(false);
  });
});
