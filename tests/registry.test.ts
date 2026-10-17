import { describe, expect, it } from "vitest";
import { checkRegistry, REGISTRY } from "@/lib/registry";
import { evaluateRubric } from "@/lib/rubric";

const ids = (text: string) => evaluateRubric(text, null).map((f) => f.id);

describe("the licensed-agency registry (a dated snapshot of the official P3MI list)", () => {
  it("is the official list, dated, with every agency's status", () => {
    expect(REGISTRY.source).toBe("https://siskop2mi.bp2mi.go.id/profil/lembaga/list_lembaga/p3mi");
    expect(REGISTRY.asOf).toBe("2026-10-17");
    expect(REGISTRY.agencies.length).toBe(REGISTRY.count);
    expect(REGISTRY.agencies.some((a) => a.status !== "Aktif")).toBe(true);
  });

  it("finds a listed agency named in the ad, with or without its legal form, and raises no flag", () => {
    const board = "General Workers Rubber\nELSHAFAH ADI WIGUNA MANDIRI\nACEH BARAT\nACROOS BORDERLAND CONSULTING S.R.O Slovakia";
    expect(checkRegistry(board).found?.name).toBe("ELSHAFAH ADI WIGUNA MANDIRI");
    expect(checkRegistry("Lowongan dari PT Elshafah Adi Wiguna Mandiri, Aceh").found?.status).toBe("Aktif");
    expect(ids(board)).not.toContain("not_on_p3mi_list");
  });

  it("an Indonesian company that is not on the list is CAUTION, never STOP", () => {
    const f = evaluateRubric("Lowongan kapal Taiwan. OFFICE : PT Samudera Perdana Selaras, Semarang", null).find((x) => x.id === "not_on_p3mi_list");
    expect(f).toMatchObject({ class: "CAUTION", sourced: true });
    expect(f?.span.text).toBe("PT Samudera Perdana Selaras");
    expect(f?.source?.domain).toBe("siskop2mi.bp2mi.go.id");
  });

  it("an agency the list shows under suspension is CAUTION", () => {
    const suspended = REGISTRY.agencies.find((a) => a.status !== "Aktif");
    const got = evaluateRubric(`Lowongan pabrik Taiwan dari PT ${suspended?.name}`, null).find((x) => x.id === "p3mi_suspended");
    expect(got?.class).toBe("CAUTION");
  });

  it("'CV' as a curriculum vitae is not a company", () => {
    expect(checkRegistry("SEND CV WHATSAPP sekarang").notListed).toEqual([]);
    expect(checkRegistry("Kirim CV Anda ke email kami").notListed).toEqual([]);
    expect(ids("Dibutuhkan admin. SEND CV WHATSAPP")).not.toContain("not_on_p3mi_list");
  });

  it("a one-word listed name counts only after PT/CV; foreign employers are not looked up", () => {
    const one = REGISTRY.agencies.find((a) => a.tokens.length === 1);
    expect(checkRegistry(`kami bekerja sama dengan ${one?.name.toLowerCase()} di sana`).found).toBeNull();
    expect(checkRegistry(`PT ${one?.name}`).found?.name).toBe(one?.name);
    expect(checkRegistry("HJ INTERNATIONAL CO. LTD. Taiwan").notListed).toEqual([]);
  });
});
