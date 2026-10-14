/**
 * Official sources for the rubric's rules — every NEVER rule must have one here or it is drawn as CAUTION.
 * Each quote was read verbatim on the rendered page on the fetch date (2026-10-15); docs/SOURCES.md lists these pages
 * and the laws behind them (UU 18/2017 Pasal 13 huruf f, 30, 69; UU 6/2011 Pasal 130; Permen P2MI 17/2025).
 */

import type { FlagId, RuleSource } from "./types";

export interface AdvisoryPlace {
  /** Display name. */
  name: string;
  /** RegExp source (case-insensitive, word-bounded by the caller). */
  pattern: string;
}

export interface RuleSources {
  flags: Partial<Record<FlagId, RuleSource>>;
  pay: { thresholdIdr: number; thresholdUsd: number; source: RuleSource; usdSource: RuleSource };
  advisory: { places: AdvisoryPlace[]; source: RuleSource };
}

const POLRI_CHECKLIST = {
  url: "https://humas.polri.go.id/news/detail/2270595-waspada-penipuan-lowongan-kerja-luar-negeri-tppo",
  domain: "humas.polri.go.id",
  title: "Waspada Penipuan Lowongan Kerja Luar Negeri (TPPO)",
  date: "2026-02-04",
};

const KEMNAKER_FEES = {
  url: "https://www.kemnaker.go.id/news/detail/kemnaker-imbau-masyarakat-waspada-penipuan-lowongan-pekerjaan",
  domain: "kemnaker.go.id",
  title: "Kemnaker Imbau Masyarakat Waspada Penipuan Lowongan Pekerjaan",
  date: "2024-10-10",
};

export const RULE_SOURCES: RuleSources = {
  flags: {
    tourist_visa: { ...POLRI_CHECKLIST, quote: "Dokumen bermasalah, menggunakan visa turis atau visa kunjungan untuk bekerja, bukan visa kerja (work permit) yang sah." },
    visit_visa_holder: { ...POLRI_CHECKLIST, quote: "Dokumen bermasalah, menggunakan visa turis atau visa kunjungan untuk bekerja, bukan visa kerja (work permit) yang sah." },
    fee_before_contract: { ...KEMNAKER_FEES, quote: "Jangan pernah memberikan apapun untuk mendapatkan pekerjaan." },
    fee_before_departure: { ...KEMNAKER_FEES, quote: "Jangan pernah memberikan apapun untuk mendapatkan pekerjaan." },
    passport_retention: { ...POLRI_CHECKLIST, quote: "M-enolak, apabila diminta menyerahkan dokumen asli seperti paspor atau KTP kepada pihak perorangan yang tidak jelas." },
    personal_recruiter: { ...POLRI_CHECKLIST, quote: "Identitas perusahaan tidak jelas, alamat kantor tidak pasti dan komunikasi hanya dilakukan melalui media sosial atau WhatsApp tanpa pertemuan langsung di kantor resmi." },
    high_pay_no_experience: {
      url: "https://www.kemlu.go.id/berita/kasus-wni-di-kamboja-meningkat-tajam-di-awal-2025?type=publication",
      domain: "kemlu.go.id",
      title: "Kasus WNI di Kamboja Meningkat Tajam di Awal 2025",
      date: "2025-03-21",
      quote: "menghimbau agar WNI lebih waspada terhadap tawaran pekerjaan di luar negeri yang tidak memerlukan skill atau kualifikasi, tapi menjanjikan gaji yang tinggi.",
    },
    advisory_destination: {
      url: "https://www.kemlu.go.id/publikasi/siaran-pers/transkrip-press-briefing-menlu-ri-online-scams,-evakuasi-sudan,-ktt-ke-42-asean-jakarta,-5-mei-2023?type=publication",
      domain: "kemlu.go.id",
      title: "Transkrip Press Briefing Menlu RI: Online Scams (5 Mei 2023)",
      date: "2023-05-05",
      quote: "Untuk korban Indonesia, tercatat berada di Myanmar, Kamboja, Thailand, Vietnam, Laos dan Filipina.",
    },
  },
  pay: {
    // The lowest monthly pay an official source reports scam recruiters promising (Polri, 249 WNI repatriated from Cambodia).
    thresholdIdr: 6_000_000,
    // A Kemlu case: an office job in Thailand "dengan gaji USD 700", sent to Cambodia instead. No currency conversion is done.
    thresholdUsd: 700,
    source: {
      url: "https://humas.polri.go.id/news/detail/2275569-polri-repatriasi-249-wni-dari-kamboja-korban-rekrutmen-scam-online",
      domain: "humas.polri.go.id",
      title: "Polri Repatriasi 249 WNI dari Kamboja Korban Rekrutmen Scam Online",
      date: "2026-02-09",
      quote: "iming-iming gaji Rp 6 juta sampai Rp 8 juta per bulan.",
    },
    usdSource: {
      url: "https://www.kemlu.go.id/berita/kementerian-luar-negeri-dan-kbri-phnom-penh-fasilitasi-pemulangan-jenazah-dari-kamboja?type=publication",
      domain: "kemlu.go.id",
      title: "Kementerian Luar Negeri dan KBRI Phnom Penh Fasilitasi Pemulangan Jenazah dari Kamboja",
      date: "2023-12-29",
      quote: "awalnya dijanjikan pekerjaan di Thailand sebagai pekerja kantoran dengan gaji USD 700, tetapi justru dikirim ke Kamboja.",
    },
  },
  advisory: {
    // The six countries the Foreign Minister named (2023-05-05), with the scam-hub places named on the same ministry's pages.
    places: [
      { name: "Kamboja", pattern: "kamboja|cambodia|phnom\\s+penh|sihanoukville" },
      { name: "Myanmar", pattern: "myanmar|burma|myawaddy" },
      { name: "Thailand", pattern: "thailand|thailan" },
      { name: "Vietnam", pattern: "vietnam|viet\\s+nam|ho\\s+chi\\s+minh" },
      { name: "Laos", pattern: "laos" },
      { name: "Filipina", pattern: "filipina|philippines|manila" },
    ],
    source: {
      url: "https://www.kemlu.go.id/publikasi/siaran-pers/transkrip-press-briefing-menlu-ri-online-scams,-evakuasi-sudan,-ktt-ke-42-asean-jakarta,-5-mei-2023?type=publication",
      domain: "kemlu.go.id",
      title: "Transkrip Press Briefing Menlu RI: Online Scams (5 Mei 2023)",
      date: "2023-05-05",
      quote: "Untuk korban Indonesia, tercatat berada di Myanmar, Kamboja, Thailand, Vietnam, Laos dan Filipina.",
    },
  },
};

/** The official places to check, shown in every VERIFY FIRST. */
export const OFFICIAL_CHECKS = {
  p3miList: "https://siskop2mi.bp2mi.go.id/profil/lembaga/list_lembaga/p3mi",
  callCenter: "08001000",
  callCenterSource: "https://kp2mi.go.id/statistik-penempatan",
};
