import type { Metadata } from "next";
import Link from "next/link";
import { JudgeStrip, Masthead } from "@/components/Chrome";

export const metadata: Metadata = { title: "Awas — page not found", robots: { index: false } };

/** Any unknown path, and any case id that is not stored (expired after 75 days, or never existed). */
export default function NotFound() {
  return (
    <main className="sheet">
      <Masthead sub="halaman tidak ditemukan · page not found" />
      <div className="clip notfound">
        <p>
          <b>Halaman ini tidak ada.</b> Kalau ini tautan berkas bukti, mungkin sudah lewat 75 hari.
        </p>
        <p>This page does not exist. If it was a link to an evidence file, it may have expired after 75 days.</p>
        <p>
          <Link href="/">Periksa iklan · check an ad</Link> · <Link href="/judge">/judge</Link> · <Link href="/about">/about</Link>
        </p>
      </div>
      <JudgeStrip />
    </main>
  );
}
