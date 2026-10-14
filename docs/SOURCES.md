# Sources

Every rule Awas applies and every statistic about the problem, with the page it comes from and the sentence quoted
verbatim. Pages were read on 2026-10-15; kemlu.go.id and humas.polri.go.id are JavaScript pages (open them in a
browser — a plain `curl` returns an empty shell; kemlu.go.id articles need the `?type=publication` suffix).

## The rules (`src/lib/rule-sources.ts`)

| Rule | Class | Source | Verbatim |
|---|---|---|---|
| Tourist / visit visa for work | NEVER | [Divisi Humas Polri, 2026-02-04](https://humas.polri.go.id/news/detail/2270595-waspada-penipuan-lowongan-kerja-luar-negeri-tppo) | "Dokumen bermasalah, menggunakan visa turis atau visa kunjungan untuk bekerja, bukan visa kerja (work permit) yang sah." |
| … legal basis | | [UU 18/2017 Pasal 13 huruf f](https://peraturan.go.id/files/uu18-2017bt.pdf) | "Untuk dapat ditempatkan di luar negeri, Calon Pekerja Migran Indonesia wajib memiliki dokumen yang meliputi: … f. Visa Kerja;" |
| Fee to get the job, before a contract | NEVER | [Kemnaker, 2024-10-10](https://www.kemnaker.go.id/news/detail/kemnaker-imbau-masyarakat-waspada-penipuan-lowongan-pekerjaan) | "Jangan pernah memberikan apapun untuk mendapatkan pekerjaan." |
| … legal basis | | [UU 18/2017 Pasal 30 ayat (1)](https://peraturan.go.id/files/uu18-2017bt.pdf) | "Pekerja Migran Indonesia tidak dapat dibebani biaya penempatan." |
| … current regulation | | [Permen P2MI 17/2025](https://peraturan.go.id/files/permen-p2mi-no-17-tahun-2025.pdf) | Placement costs are the employer's ("menjadi beban Pemberi Kerja"); costs a worker may bear are exceptions written into the placement agreement — which is why the NEVER rule needs a fee **before a contract**, and a fee before departure alone is only CAUTION. |
| Passport held or handed over | NEVER | [Divisi Humas Polri, 2026-02-04](https://humas.polri.go.id/news/detail/2270595-waspada-penipuan-lowongan-kerja-luar-negeri-tppo) | "M-enolak, apabila diminta menyerahkan dokumen asli seperti paspor atau KTP kepada pihak perorangan yang tidak jelas." |
| … legal basis | | [UU 6/2011 Pasal 130](https://peraturan.go.id/files/uu6-2011bt.pdf) | "Setiap orang yang dengan sengaja dan melawan hukum menguasai Dokumen Perjalanan atau Dokumen Keimigrasian lainnya milik orang lain dipidana …" |
| Fee before departure | CAUTION | Kemnaker, as above | (as above) |
| High pay, no experience needed | CAUTION | [Kemlu / KBRI Phnom Penh, 2025-03-21](https://www.kemlu.go.id/berita/kasus-wni-di-kamboja-meningkat-tajam-di-awal-2025?type=publication) | "menghimbau agar WNI lebih waspada terhadap tawaran pekerjaan di luar negeri yang tidak memerlukan skill atau kualifikasi, tapi menjanjikan gaji yang tinggi." |
| … threshold Rp 6 juta / month | | [Divisi Humas Polri, 2026-02-09](https://humas.polri.go.id/news/detail/2275569-polri-repatriasi-249-wni-dari-kamboja-korban-rekrutmen-scam-online) | "iming-iming gaji Rp 6 juta sampai Rp 8 juta per bulan." (the lowest promised pay an official source reports) |
| … threshold USD 700 | | [Kemlu, 2023-12-29](https://www.kemlu.go.id/berita/kementerian-luar-negeri-dan-kbri-phnom-penh-fasilitasi-pemulangan-jenazah-dari-kamboja?type=publication) | "awalnya dijanjikan pekerjaan di Thailand sebagai pekerja kantoran dengan gaji USD 700, tetapi justru dikirim ke Kamboja." |
| Destination in an official warning | CAUTION | [Kemlu, Foreign Minister's briefing, 2023-05-05](https://www.kemlu.go.id/publikasi/siaran-pers/transkrip-press-briefing-menlu-ri-online-scams,-evakuasi-sudan,-ktt-ke-42-asean-jakarta,-5-mei-2023?type=publication) | "Untuk korban Indonesia, tercatat berada di Myanmar, Kamboja, Thailand, Vietnam, Laos dan Filipina." |
| Personal number, no company | CAUTION | [Divisi Humas Polri, 2026-02-04](https://humas.polri.go.id/news/detail/2270595-waspada-penipuan-lowongan-kerja-luar-negeri-tppo) | "Identitas perusahaan tidak jelas, alamat kantor tidak pasti dan komunikasi hanya dilakukan melalui media sosial atau WhatsApp tanpa pertemuan langsung di kantor resmi." |
| … legal basis | | [UU 18/2017 Pasal 69](https://peraturan.go.id/files/uu18-2017bt.pdf) | "Orang perseorangan dilarang melaksanakan penempatan Pekerja Migran Indonesia." |
| "Visit visa holders may apply" | CAUTION | Polri, as for the tourist-visa rule | Read as the less accusatory case: the ad accepts people already holding a visit visa; VERIFY FIRST, not STOP. |

**Where to check (every VERIFY FIRST):** the licensed placement-company list,
[siskop2mi.bp2mi.go.id/profil/lembaga/list_lembaga/p3mi](https://siskop2mi.bp2mi.go.id/profil/lembaga/list_lembaga/p3mi)
(linked from the [SISKOP2MI FAQ](https://siskop2mi.bp2mi.go.id/publik/faq)), and the KP2MI call centre 08001000
(the footer of every [kp2mi.go.id](https://kp2mi.go.id/statistik-penempatan) page).

## The problem

| Claim | Source | Verbatim |
|---|---|---|
| 1,301 cases at the embassy in Cambodia in Q1 2025, 85 % online scam | [Kemlu / KBRI Phnom Penh, 2025-04-24](https://www.kemlu.go.id/berita/kbri-phnom-penh-tangani-1301-kasus-wni-selama-jan-mar-2025-mayoritas-terkait-penipuan-daring-online-scam?type=publication) | "Selama 3 (tiga) bulan pertama tahun 2025, KBRI Phnom Penh telah menangani 1.301 kasus WNI bermasalah di Kamboja (24/4)." · "Dari total kasus yang ditangani, 1.112 kasus atau 85% melibatkan WNI yang terkait dengan penipuan daring atau online scam." |
| More than 6,800 online-scam cases since 2020, in 10 countries | [Kemlu, 2025-03-18](https://www.kemlu.go.id/berita/kemlu-berhasil-pulangkan-554-wni-terduga-korban-tppo--online-scam-dari-myanmar?type=publication) | "Hingga saat ini sudah lebih dari 6.800 kasus yang ditangani dan tersebar di 10 negara tujuan." |
| More than 12,000 Indonesians affected 2021–2025; many trafficked and forced into crime | [Kemlu, 2025-12-18](https://www.kemlu.go.id/berita/indonesia-tegaskan-online-scam-sebagai-krisis-keamanan-manusia-dan-ancaman-regional-yang-butuh-respon-kolektif-global?type=publication) | "Antara tahun 2021 hingga 2025, tercatat lebih dari 12.000 Warga Negara Indonesia (WNI) terdampak, di mana banyak di antaranya menjadi korban tindak pidana perdagangan orang (TPPO) dan dipaksa menjadi pelaku kejahatan (forced criminality) di online scam centers di kawasan Asia Tenggara." |
| 12,019 Indonesians asked the embassy in Cambodia for help going home, Jan–Jun 2026 | [Kemlu / KBRI Phnom Penh, 2026-07-02](https://www.kemlu.go.id/berita/lebih-dari-12000-wni-eks-jaringan-penipuan-daring-di-kamboja-minta-bantuan-kepulangan?type=publication) | "Sepanjang Januari–Juni 2026, tercatat sebanyak 12.019 WNI telah melapor dan mengajukan fasilitasi proses kepulangan ke Indonesia." |
| Recruits are held by the compounds | [Kemlu, Foreign Minister, 2022-07-30](https://www.kemlu.go.id/publikasi/siaran-pers/press-briefing-menlu-ri-kasus-wni-disekap-di-kamboja--30-juli-2022?type=publication) | "… WNI kita yang disekap oleh perusahaan online scam di Sihanoukville, Kamboja." |
| The offer: job via social media, then forced to scam | [KP2MI, 2025-10-28](https://kp2mi.go.id/berita-detail/waspada-tawaran-kerja-ke-kamboja-menteri-mukhtarudin-itu-bukan-negara-penempatan-pekerja-migran-indonesia) | "Modusnya ditawarkan melalui media sosial, katanya kerja di IT atau marketing digital, tapi begitu sampai di sana justru dipaksa melakukan kegiatan scam" |
| About 297,000 recorded placements a year | [KP2MI, 2026-01-31](https://kp2mi.go.id/statistik-detail/data-penempatan-dan-pelindungan-pekerja-migran-indonesia-periode-tahun-2025) | "Pada tahun 2025, terdapat 296.948 layanan penempatan, menurun 0,16% dibandingkan tahun sebelumnya." |

**Honest framing.** The embassy's "cases" include Indonesians who ran scams, not only victims (KBRI Phnom Penh, same
page: "kegiatan penipuan daring dilakukan oleh WNI dan menargetkan masyarakat Indonesia di tanah air"), and officials
say some later stay willingly. Awas's claim is narrower: the ads that recruit people follow a pattern a family can
check before anyone leaves.
