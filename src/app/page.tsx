import { Checker } from "@/components/Checker";
import { JudgeStrip, Masthead } from "@/components/Chrome";

export default function Home() {
  return (
    <main className="sheet">
      <Masthead />
      <p className="lede">
        Tempel iklan lowongan. Awas memeriksanya dengan aturan yang dikutip dari halaman resmi pemerintah, lalu mencari laporan yang sudah terbit — dan hanya menampilkan kutipan yang benar-benar ada di halaman sumbernya.
        <span className="en"> Paste the job ad. Awas checks it against rules quoted from official government pages, then searches published reports — and shows only quotes that code found on the source page.</span>
      </p>
      <Checker />
      <JudgeStrip />
    </main>
  );
}
