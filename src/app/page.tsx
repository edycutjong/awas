import { Checker } from "@/components/Checker";
import { JudgeStrip, Masthead } from "@/components/Chrome";

export default function Home() {
  return (
    <main className="sheet">
      <Masthead />
      <p className="lede">
        Tempel iklan lowongan. Awas mencari apa yang sudah dipublikasikan tentangnya, dan hanya menampilkan kutipan yang benar-benar ada di halaman sumbernya.
        <span className="en"> Paste the job ad. Awas looks up what has been published about it, and shows only quotes that code found on the source page.</span>
      </p>
      <Checker />
      <JudgeStrip />
    </main>
  );
}
