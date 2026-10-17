/* Awas lab: src/lib compiled for the browser by scripts/build-lab.mjs (MIT).
* lab-sources: src/lib/text.ts src/lib/rubric.ts src/lib/rule-sources.ts src/lib/gate.ts src/lib/verdict.ts src/lib/types.ts scripts/lab/entry.ts scripts/lab/sha256.ts
* source-sha256: be4507dee9295ddc776ea77e6bc1a839d82f79c6c8c2a011ffde990aba818718 */
var AwasLab = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region src/lib/data/p3mi-2026-10-17.json
	var source = "https://siskop2mi.bp2mi.go.id/profil/lembaga/list_lembaga/p3mi";
	var fetched = "2026-10-17";
	var count = 534;
	var agencies = [
		["AGESA ASA JAYA", "Aktif"],
		["AJI AYAHBUNDA SEJATI", "Aktif"],
		["ANTAR BANGSA CITRA DHARMAINDO", "Aktif"],
		["PUTRA INDO SEJAHTERA", "Aktif"],
		["AMALINDO LANGGENG", "Aktif"],
		["AMANAH PUTRA PRATAMA", "Aktif"],
		["INTAN AYU LESTARI", "Aktif"],
		["INTERSOLUSI INDONESIA", "Aktif"],
		["ARMINA MITRA KARYA", "Aktif"],
		["ARNI FAMILY", "Aktif"],
		["ASAMULIA INDOMANPOWER", "Aktif"],
		["ASSALAM KARYA MANUNGGAL", "Aktif"],
		["BABA METRO UTAMA", "Aktif"],
		["BAHAM PUTRA ABADI", "Aktif"],
		["BAHRINDO MAHDI", "Aktif"],
		["GASINDO BUALA SARI", "Aktif"],
		["GUNAWAN SUKSES ABADI", "Aktif"],
		["HENDRARTA ARGA RAYA", "Aktif"],
		["INDONAKER MANDIRI", "Aktif"],
		["INDO DUTA SEMBADA", "Aktif"],
		["INDOTAK JAYA ABADI", "Aktif"],
		["BUMI MAS CITRA MANDIRI", "Aktif"],
		["BUMI MAS ANTARNUSA", "Aktif"],
		["CITRANUSA KARYA SEMESTA", "Aktif"],
		["CITRA CATUR UTAMA KARYA", "Aktif"],
		["ISTI JAYA MANDIRI", "Aktif"],
		["JASATAMA DANA MANDIRI", "Aktif"],
		["JASEBU PRIMA INTERNUSA", "Aktif"],
		["KARYATAMA MITRA SEJATI", "Aktif"],
		["HAMPARAN KARYA INSANI", "Aktif"],
		["KURNIA BINA RIZKI", "Aktif"],
		["LIA CENTRAL UTAMA", "Aktif"],
		["BANDAR LAGUNA", "Aktif"],
		["BANYUSEWU SEGARA BERKAH", "Aktif"],
		["BAYUSATRIA DEWI", "Aktif"],
		["BHAKTI PERSADA JAYA", "Aktif"],
		["BINA DINAMITA RAMA", "Aktif"],
		["BINTAN NIRWANA", "Aktif"],
		["DIVA DUTA INDOSA", "Aktif"],
		["DUTA FADALIMA", "Aktif"],
		["DUTA FAJAR BARUTAMA", "Aktif"],
		["DWICITRA TRI PATRIA", "Aktif"],
		["ELSHAFAH ADI WIGUNA MANDIRI", "Aktif"],
		["ESDEMA MANDIRI", "Aktif"],
		["NURWIRA CAHAYA", "Aktif"],
		["QAFCO", "Aktif"],
		["LINTAS CAKRAWALA BUANA", "Aktif"],
		["MARDEL ANUGERAH INTERNASIONAL", "Sanksi - Penghentian Sementara"],
		["MEKARJAYA WANAYASA PUTRA", "Aktif"],
		["MITRA HARTA INSANI", "Aktif"],
		["MITRA SINERGI SUKSES", "Aktif"],
		["MITRA SARANA INTERNASIONAL", "Aktif"],
		["MOMANDSONS SEJAHTERA", "Aktif"],
		["MUHDI SETIA ABADI", "Aktif"],
		["MULTI LINTAS BUANA RAYA", "Aktif"],
		["NUSA SINAR MAKMUR", "Aktif"],
		["PANCAMANAH UTAMA", "Aktif"],
		["PERSADA DUTA UTAMA", "Aktif"],
		["PERWITA NUSARAYA", "Aktif"],
		["PHINISI SUMBER DAYA", "Aktif"],
		["PORICONINDO INTINUSA", "Aktif"],
		["SANJAYA THANRY BAHTERA", "Aktif"],
		["PAMOR SAPTA DHARMA", "Aktif"],
		["TRIAS INSAN MADANI", "Aktif"],
		["BALI PESONA ABADI", "Aktif"],
		["TRITUNGGAL NUANSA PRIMATAMA", "Aktif"],
		["ABDILLAH PUTRA TAMALA", "Aktif"],
		["RAHANA KARINDO UTAMA", "Aktif"],
		["RESTU BUNDA SEJATI", "Aktif"],
		["RUYUNG KARYAMANDIRI", "Aktif"],
		["SAPTA REZEKI", "Aktif"],
		["SATRIA PARANGTRITIS", "Aktif"],
		["SRITI RUKMA LESTARI", "Aktif"],
		["SUKMA INSAN KAMIL", "Aktif"],
		["SUKMA KARYA SEJATI", "Aktif"],
		["SUMBER TENAGA KERJA REMAJA ABADI", "Aktif"],
		["SUMBERKENCANA SEJAHTERA", "Aktif"],
		["SUMBER BAKAT INSANI", "Aktif"],
		["SURYAPACIFIC JAYA", "Aktif"],
		["TAFCINDO JASATAMA SEGARA", "Aktif"],
		["TIARAMAS RONA GEMILANG", "Aktif"],
		["BUKIT MAYAK ASRI", "Aktif"],
		["TIMURAYA JAYA LESTARI", "Aktif"],
		["TISTAMA ARGARAYA", "Aktif"],
		["TRI AKMI SENTOSA", "Aktif"],
		["WAHANA KARYA SUPLAINDO", "Aktif"],
		["CIKAL DIAN ASTUTI", "Aktif"],
		["NUR FAUZAN SEJAHTERA", "Aktif"],
		["ANDHIKA PUTRA MANDIRI", "Aktif"],
		["ANNUR JAYA", "Aktif"],
		["TEGAR SUKSES ABADI", "Aktif"],
		["PERMATA GOBEL KARYA SEJAHTERA", "Aktif"],
		["PUTRA PERTIWI JAYALESTARI", "Aktif"],
		["GRAHA MITRA BALINDO", "Aktif"],
		["BUMI MAS INDONESIA MANDIRI", "Aktif"],
		["NAYAKA KALYANA", "Aktif"],
		["MILENIUM NAGA MAS", "Aktif"],
		["TIARA CILACAP ABADI", "Aktif"],
		["TIFAR ADMANCO", "Aktif"],
		["RIHLAH IBADI", "Aktif"],
		["NEW COMER", "Aktif"],
		["MUARA MAS GLOBAL", "Aktif"],
		["RAMAH INDAH INDOHASTA", "Aktif"],
		["ASIA PRIMADONA PRATAMA", "Aktif"],
		["DUTA PUTRA KAHURIPAN", "Aktif"],
		["PANDU ABDI PERTIWI", "Sanksi - Penghentian Sementara"],
		["LAATANSA LINTAS INTERNASIONAL", "Aktif"],
		["BRATA KARYA INDONESIA", "Aktif"],
		["DEFITA BERSAUDARA", "Aktif"],
		["BELLA SUKSES MANDIRI", "Aktif"],
		["PANCA BANYU AJI SAKTI", "Aktif"],
		["ALFIRA PERDANA JAYA", "Aktif"],
		["PUTRA ALWINI", "Aktif"],
		["ARWANA CITRA LESTARI", "Aktif"],
		["AVIDA AVIADUTA", "Aktif"],
		["DHARMAKERTA RAHARJA", "Aktif"],
		["BIDAR SATRIA ABADI", "Aktif"],
		["DWICITRA PUTRA MANDIRI", "Aktif"],
		["OKDO HARAPAN MULIA", "Aktif"],
		["FORWARD GLOBAL", "Aktif"],
		["SABRINA PRAMITHA", "Aktif"],
		["SARCO", "Aktif"],
		["SUKSES MANDIRI UTAMA", "Aktif"],
		["TRITAMA BINA KARYA", "Aktif"],
		["KHALIFFAH FIERDAUS AULIA", "Aktif"],
		["ZISRA DWI JAYA", "Aktif"],
		["SUKSES DUA BERSAUDARA", "Aktif"],
		["PUTRA DUTAPEMBANGUNAN", "Aktif"],
		["NUSA SINAR PERKASA", "Aktif"],
		["PELITA KARYA JUHARI", "Aktif"],
		["VITA MELATI INDONESIA", "Aktif"],
		["ASA JAYA", "Aktif"],
		["MULTI SUKSES PUTRANTO", "Aktif"],
		["PERMATA SUKSES ABADI", "Aktif"],
		["BIDAR PUTRA SUKSES", "Aktif"],
		["LITAKARYA BERSAMA", "Aktif"],
		["YANBU AL BAHAR", "Aktif"],
		["JABAPUTRA BINAWAN UNGGUL", "Aktif"],
		["SUDINAR ARTHA", "Aktif"],
		["HARCO SELARAS SENTOSA JAYA", "Aktif"],
		["CRYSTAL BIRU MEULIGO", "Aktif"],
		["MITRA KENCANA PRASETYA", "Aktif"],
		["HOSANA JASA PERSADA", "Aktif"],
		["FICOTAMA BINA TRAMPIL", "Aktif"],
		["BALANTA BUDI PRIMA", "Aktif"],
		["DUTA WIBAWA MANDA PUTRA", "Aktif"],
		["MULIA LAKSANA SEJAHTERA", "Aktif"],
		["SAKINAH PYRAMIDA", "Aktif"],
		["SAHARA FAJARINDO CORPORA", "Aktif"],
		["BAHANA MEGA PRESTASI", "Aktif"],
		["AGAFIA ADDA MANDIRI", "Aktif"],
		["SERUMPUN MAJU BERSAMA", "Aktif"],
		["LEYVI PERKASA BERSAUDARA", "Aktif"],
		["PRATAMA LAHJI MANDIRI", "Aktif"],
		["GRAHA CIPTA UTAMA", "Aktif"],
		["REANG NOTO BERSAMA", "Aktif"],
		["JATIM DUTAPEMBANGUNAN", "Aktif"],
		["MEGAH UTAMA KRIYA NUGRAHA", "Aktif"],
		["CIPTA REZEKI UTAMA", "Aktif"],
		["ABUL PRATAMAJAYA", "Aktif"],
		["AL WIHDAH JAYA SENTOSA", "Aktif"],
		["AGRELIA PUTRA SEJAHTERA", "Aktif"],
		["SATRIA ABDI PERSADA", "Aktif"],
		["WIRA KREASI USAHA", "Aktif"],
		["FALIA SINATRYA SEJATI", "Aktif"],
		["INDOKARSA GUNABUANA", "Aktif"],
		["DWI TUNGGAL JAYA ABADI", "Aktif"],
		["BUMIMAS KATONG BESARI", "Aktif"],
		["PADEMANGAN SEMESTA LESTARI", "Aktif"],
		["KENTJANA MERCU BUANA", "Aktif"],
		["ANTAR INDOSADYA", "Aktif"],
		["ALKURNIA SENTOSA INTERNASIONAL", "Aktif"],
		["PARCO LAUT", "Aktif"],
		["BUANA LINTAS KARYA", "Aktif"],
		["BINA ADIDAYA MANDIRI INTERNATIONAL", "Aktif"],
		["AMALIA ROZIKIN JAYA", "Aktif"],
		["GUNA KARYA INSAN MANDIRI", "Aktif"],
		["CEGER SARI BUANA", "Aktif"],
		["BANGUN GUNUNGSARI", "Aktif"],
		["AMAL ICHWAN ARINDO", "Aktif"],
		["SINAR BERLIAN MANDIRI", "Aktif"],
		["KARYANANDA ADI PERTIWI", "Aktif"],
		["BARKAHAYU SAFARINDO", "Aktif"],
		["DEKA PERKASA ADIJAYA", "Aktif"],
		["PRIMA DUTA SEJATI", "Aktif"],
		["JAYA FRANS ABADI", "Aktif"],
		["PRIMA SYIFA NUSANTARA", "Aktif"],
		["GRAHA AYUKARSA", "Aktif"],
		["CITRA KARYA SEJATI", "Aktif"],
		["KIJANG LOMBOK RAYA", "Aktif"],
		["SOFIA INTERNASIONAL PERKASA", "Aktif"],
		["TRI GANDA SWAJAYA", "Aktif"],
		["DUTA AMPEL MULIA", "Aktif"],
		["KARYA ANTAR BANGSA SEJATI", "Aktif"],
		["SARANA INSAN MANDIRI", "Aktif"],
		["PANCA ASHMA TUNGGAL", "Aktif"],
		["AKKA AL-MATAR", "Aktif"],
		["BAROKAH SAUDARA ABADI", "Aktif"],
		["KARYA SEMESTA SEJAHTERA", "Aktif"],
		["IIN ERA SEJAHTERA", "Aktif"],
		["EKASANTI JAYAMULIA", "Aktif"],
		["ANTO BINTAN PERMAI", "Aktif"],
		["NANGUMA SEJATI", "Aktif"],
		["SEJAHTERA EKA PRATAMA", "Aktif"],
		["TENAGA SEJAHTERA WIRASTA", "Aktif"],
		["GENTA KARYA SEJAHTERA", "Aktif"],
		["ANTAR TENAGA MANDIRI", "Aktif"],
		["ALZUBARA MANPOWER INDONESIA", "Aktif"],
		["WAHANA BAROKAH", "Aktif"],
		["MARCO PUTRA MANDIRI", "Aktif"],
		["PRIMA DUTA PERSADA", "Aktif"],
		["MILLENIUM MUDA MAKMUR", "Aktif"],
		["PT. ABUNI`MAH SEJAHTERA UTAMA", "Aktif"],
		["LUCKY MITRA ABADI", "Aktif"],
		["AL ROYYAN CAHAYA MANDIRI", "Aktif"],
		["BUMENJAYA EKA PUTRA", "Aktif"],
		["INDO WYNN", "Aktif"],
		["ASRI CIPTA TENAGA KARYA", "Aktif"],
		["TATA ATLAS MASTERINDO", "Aktif"],
		["BERKAT SUKSES MAKMUR SEJAHTERA", "Aktif"],
		["ANUGERAH DIANTAS", "Aktif"],
		["ADILA PREZKIFARINDO DUTA", "Aktif"],
		["BINAWAN INTI UTAMA", "Aktif"],
		["MAHARANI TRI UTAMA MANDIRI", "Aktif"],
		["MAHARANI ANUGRAH PEKERTI", "Aktif"],
		["SANSAN YOSINDO", "Aktif"],
		["WIRA KARITAS", "Aktif"],
		["DANAMON WAHANA TENAGA KERJA", "Aktif"],
		["KHIDMAT EL KASAB", "Aktif"],
		["AMRITA MAHESA PRIMA", "Aktif"],
		["PRIMADAYA PRATAMA PANDUKARYA", "Aktif"],
		["TEKAD JAYA ABADI", "Aktif"],
		["SANG SURYA SENTOSA ABADI", "Aktif"],
		["DIAN YOGYA PERDANA", "Aktif"],
		["MUSTARI MITRA MAHKOTA", "Aktif"],
		["DEWI PENGAYOM BANGSA", "Aktif"],
		["SETIA MULIA KRIDATAMA", "Aktif"],
		["DJAMIN HARAPAN ABADI", "Aktif"],
		["EKORISTI BERKARYA", "Aktif"],
		["BINA KRIDATAMA LESTARI", "Aktif"],
		["SUKAMULIA MANDIRI AGUNG", "Aktif"],
		["INSAN KARYA MANDIRI UTAMA", "Aktif"],
		["HAENA DUTA CEMERLANG", "Aktif"],
		["ALLQURRNY BAGAS PRATAMA", "Aktif"],
		["JASATAMA WIDYA PERKASA", "Aktif"],
		["RASTANURA RAYANI SAPUTRA", "Aktif"],
		["JAFA INDO CORPORA", "Sanksi - Penghentian Sementara"],
		["IFAN MARGATAMA", "Aktif"],
		["MUTIARA PUTRA UTAMA", "Aktif"],
		["ANDROMEDA GRAHA", "Aktif"],
		["BERKAH GUNA SELARAS", "Sanksi - Penghentian Sementara"],
		["MUTIARA BAHARI ALAMRIA", "Aktif"],
		["DUTA TANGGUH SELARAS", "Aktif"],
		["SUPERINDO SEMESTA", "Aktif"],
		["RIZALDY BINA BERSAMA", "Aktif"],
		["BALI DUTA MANDIRI", "Aktif"],
		["PUTRI MANDIRI ABADI", "Aktif"],
		["PANCARAN BATUSARI", "Aktif"],
		["USAHATAMA BUNDA SEJATI", "Aktif"],
		["AMRI MARGATAMA", "Aktif"],
		["SAMPEANG ALIFID MANDIRI", "Aktif"],
		["BINAGALA MITRA", "Aktif"],
		["HASRATANDA SEJAHTERA", "Aktif"],
		["FLAMBOYAN GEMA JASA", "Aktif"],
		["FIM ANUGERAH PERKASA", "Aktif"],
		["FAHAD FAJAR MUSTIKA", "Aktif"],
		["SARIMADU JAYANUSA", "Aktif"],
		["PUTRA BRAGAS MANDIRI", "Aktif"],
		["MITRA MUDA REKSA MANDIRI", "Aktif"],
		["JATIM SUKSES KARYA BERSAMA", "Aktif"],
		["DIYAVI MANPOWER", "Aktif"],
		["NUR BAKTI LANGGENG MANDIRI", "Aktif"],
		["DUTA BANTEN MANDIRI", "Aktif"],
		["ALAM PERMAI INDONESIA", "Aktif"],
		["BUMENJAYA PRADUTA ABADI", "Aktif"],
		["ADHI MAKMUR OENGGOEL INSANI", "Aktif"],
		["DELLA FADHIL ANUGRAH", "Aktif"],
		["BUANA SAFIRA ABADI", "Aktif"],
		["CITRA PUTRA INDARAB", "Aktif"],
		["CAHAYA LOMBOK", "Aktif"],
		["ASSAMI ANANDA MANDIRI", "Aktif"],
		["GENTA GUMI SELAPAWIS", "Aktif"],
		["ARUNDA BAYU", "Aktif"],
		["PT. BALI PARADISE CITRA DEWATA", "Aktif"],
		["PUTRI NIL SEJATI", "Aktif"],
		["RAJASA INTAMA", "Aktif"],
		["SENTOSAKARYA ADITAMA", "Aktif"],
		["TRITAMA MEGAH ABADI", "Aktif"],
		["NAHELINDO PRATAMA", "Aktif"],
		["KALIP SUKSES BERJAYA", "Aktif"],
		["PUTRA JABUNG PERSADA", "Aktif"],
		["MILLENIUM MUDA MANDIRI", "Aktif"],
		["PT.AL-HIKMAH JAYA BHAKTI", "Aktif"],
		["ANDALAN MITRA PRESTASI", "Aktif"],
		["DINASTY INSAN MANDIRI", "Aktif"],
		["SARI WARTI AGUNG", "Sanksi - Penghentian Sementara"],
		["GUNAMANDIRI PARIPURNA", "Aktif"],
		["HIKMAH SURYA JAYA", "Aktif"],
		["BUGHSAN LABRINDO", "Aktif"],
		["MUSAFIR KELANA", "Aktif"],
		["SABIKA ARABINDO", "Aktif"],
		["SALMAN PUTRA RAYANA", "Aktif"],
		["SRIJATI GANDASARI", "Aktif"],
		["BINTANG LIMA BRATA", "Aktif"],
		["DELTA RONA ADIGUNA", "Aktif"],
		["KARYA PESONA SUMBER REJEKI", "Aktif"],
		["SURYA ABADI DUTAINDO", "Aktif"],
		["AZKA DUTA SEMESTA", "Aktif"],
		["PT AHWA INTERNATIONAL RESOURCE", "Aktif"],
		["CITRA DATO PERKASA", "Aktif"],
		["EMPAT PILAR SINAR GEMILANG", "Aktif"],
		["KARYA SEMARATAMA MANDIRI", "Aktif"],
		["PT ANUGERAH TUJUH SAMUDRA", "Aktif"],
		["PT BAKTI UNGGUL SEJAHTERA", "Aktif"],
		["PT BINAMANDIRI MULIA JAYA", "Aktif"],
		["PT DAYA HELDIA ABADI", "Aktif"],
		["PT GRAND GRAHA PRATAMA", "Aktif"],
		["PT KERJAYA LESTARI KEPONG", "Aktif"],
		["PT OMNA TRISATYA CHANDRA", "Aktif"],
		["TENRIAWARU ELIT INTERNASIONAL", "Aktif"],
		["TUNASKARYA SUKSES BERKARYA", "Aktif"],
		["PT. BLUE DIAMOND INDONESIA", "Aktif"],
		["LAS OLAS INDONESIA", "Aktif"],
		["PT. PRIGEL ANTAR SUKSES", "Aktif"],
		["PT. SERANGKAI CAHAYA TIMUR", "Aktif"],
		["SRI DEWI BARUNA", "Aktif"],
		["PT. SUGIH JAYA SENTOSA", "Aktif"],
		["PT. SUMA BERJAYA ASRI", "Aktif"],
		["PUNCAK JAYA SAMUDRA", "Aktif"],
		["SALAM KARYA WINTANA", "Aktif"],
		["BREXA TALENT INDONESIA", "Aktif"],
		["ARGAM PUTRA TAMA", "Aktif"],
		["PT JAYA INDONESIA PANDU ABHIPRAYA", "Aktif"],
		["PT MARINA PRIMA SUKSES", "Aktif"],
		["PT PUTRA ALIRSHAD SEJAHTERA", "Aktif"],
		["YUSRI MUHAIR MANDIRI", "Aktif"],
		["AIDA DUTA INDONESIA SEJAHTERA", "Aktif"],
		["SAMUEL JAYA MARITIM", "Aktif"],
		["PT PANGERAN PUTRA SEJAHTERA", "Aktif"],
		["PT GRANDA SAMUDRA UTAMA", "Aktif"],
		["PT BINAJASA ABADIKARYA", "Aktif"],
		["MEGA AGUNG SEJAHTRA", "Aktif"],
		["ANNUR PRIMA JAYA", "Aktif"],
		["CEMERLANG TUNGGAL INTINUSA", "Aktif"],
		["PT. KORINDO TECH INDONESIA", "Aktif"],
		["FORTUNE JAYA CORPORA", "Aktif"],
		["INDO SUMBER MANDIRI", "Aktif"],
		["PT. MARDEL MITRA SEJAHTERA", "Aktif"],
		["PT. KAMPUH WELDING INDONESIA", "Aktif"],
		["PT. ANUGERAH BAHARI PASIFIK", "Aktif"],
		["SIP SIAP SUKSES", "Aktif"],
		["PT INDONESIA MAPAN PERKASA", "Aktif"],
		["INDO BAROKAH INSANI", "Aktif"],
		["ARSYILA CONDET MANDIRI", "Sanksi - Penghentian Sementara"],
		["JAVA TUNA MUKTI", "Aktif"],
		["PROFESIONAL WORKER INDONESIA", "Aktif"],
		["GANESHA BINA BANGSA", "Aktif"],
		["HUMAN SELECT INDONESIA", "Aktif"],
		["YUKO TESA MIRAI", "Aktif"],
		["SOLUSI BALI BERKARYA", "Aktif"],
		["KARYA TENAGA MANDIRI", "Aktif"],
		["YUTAKA SAIYOU GALUH PERSADA", "Aktif"],
		["DUTA ARNETHO MANDIRI", "Aktif"],
		["DASTAN FAJAR GEMILANG", "Aktif"],
		["TOP KARIR MULTINUSA", "Aktif"],
		["NUINDO DUTA KHATULISTIWA", "Aktif"],
		["ALPHA MAGSAYSAY INTERNATIONAL", "Aktif"],
		["LANGGENG NAWASENA PROSPERITY", "Aktif"],
		["MITRA KARIR INTERNASIONAL", "Aktif"],
		["NAGA PERSADA GLOBAL", "Aktif"],
		["FUJI BIJAK PRESTASI", "Aktif"],
		["ASKA BALI GROUP", "Aktif"],
		["PRESTASI ABADI SUKSES", "Aktif"],
		["IIM ABADI JAYA", "Aktif"],
		["FOSCON GLOBAL INDONESIA", "Aktif"],
		["SULTAN MONARKI NUSANTARA", "Aktif"],
		["LOMBOK PUTRA PRATAMA", "Aktif"],
		["EDEN GRACE SUMBER DAYA", "Aktif"],
		["NUGRAHA KINERJA SENTOSA", "Aktif"],
		["JEPANG WIND INDONESIA", "Aktif"],
		["LORING MARGI INTERNASIONAL", "Aktif"],
		["INDOKARYA SUKSES SEJAHTERA", "Aktif"],
		["JOE MANPOWER INTERNATIONAL", "Aktif"],
		["UNIVERSAL RECRUITMENT AGENCY", "Aktif"],
		["PUTRA SAHABAT INTERNATIONAL", "Aktif"],
		["CAHAYA LIMA SAMUDRA", "Aktif"],
		["JASUMA ANUGERAH PRIMA SEJAHTERA", "Aktif"],
		["JAKARTA MAJU BERSAMA", "Aktif"],
		["BERKAH YUNIVA KENCANA", "Aktif"],
		["WORLD HORENSO INDONESIA", "Aktif"],
		["BALI SANITYA GLOBAL", "Aktif"],
		["CITRA INSAN MANDIRI", "Aktif"],
		["ADHI KERANI INDONESIA", "Aktif"],
		["SINERGI MALEO AZHAR", "Aktif"],
		["SUKSES BINA BANGSA", "Aktif"],
		["RYOSHIN HARAPAN EDUKASI", "Aktif"],
		["KEPODANG MAKMUR SEJAHTERA", "Aktif"],
		["MINORI", "Aktif"],
		["NAWA MANUNGGAL JAYA", "Aktif"],
		["KEBUN TEKNOLOGI INDONESIA", "Aktif"],
		["MIRAI BERKAH ABADI", "Aktif"],
		["MCS INTERNASIONAL", "Aktif"],
		["GOSIVA SUKSES MANDIRI", "Aktif"],
		["DEVISA GROUP ALRIYADH", "Aktif"],
		["KANDARRA INDONESIA", "Aktif"],
		["BINTANG BENUAJAYA MANDIRI", "Aktif"],
		["ANDINI PERMATA SEJAHTERA", "Aktif"],
		["ASA BESTARI KASIH AMERTA", "Aktif"],
		["AHWA GLOBAL SUKSES", "Aktif"],
		["TAHTA MAHA DEWA", "Aktif"],
		["ANUGRAH MIGRAN NUSANTARA", "Aktif"],
		["AKBEI BORNEO RAYA", "Aktif"],
		["KTJ Indonesia", "Aktif"],
		["JAVA OLAH SUMBER SUKSES", "Aktif"],
		["PRIMA DHANI BAHARI", "Aktif"],
		["BIMA SAMUDRA BAHARI", "Aktif"],
		["ORION HARMONI MANDALA", "Aktif"],
		["AMANAH MIGRAN INDONESIA", "Aktif"],
		["OCEAN JAYA SAMUDRA", "Aktif"],
		["ISMAA GLOBAL MANAJEMEN", "Aktif"],
		["MARIKU AIC INDONESIA", "Aktif"],
		["KOKORONO BIJAK LOKA", "Aktif"],
		["EDIGY DJAYA GLOBAL", "Aktif"],
		["FLORA TALENT INDONESIA", "Aktif"],
		["HAMA WORK SOLUTION", "Aktif"],
		["AMRI SETIA MULYA", "Aktif"],
		["AMIRAH BERKAH MELIMPAH", "Aktif"],
		["ABDI SELARAS SETIA", "Aktif"],
		["SOLUSINDO INSAN MANDIRI", "Aktif"],
		["TENTREM DAMAI SENTOSA", "Aktif"],
		["SURYA EKA PERKASA", "Aktif"],
		["HYMBI NIHON NUSANTARA", "Aktif"],
		["SURYA TIRTA MITRA JASA", "Aktif"],
		["PT. SETYA JAYA SAMUDERA", "Aktif"],
		["AFDAL DUTA SEJAHTERA", "Aktif"],
		["TAMIO SUKSES BERSAMA", "Aktif"],
		["DUTAGRIYA SARANA", "Aktif"],
		["ELITE TUTORS INDONESIA", "Aktif"],
		["LPK BSI INDONESIA", "Aktif"],
		["NAWASENA CITA NUSANTARA", "Aktif"],
		["SINAR IMPIAN BERKARYA", "Aktif"],
		["PT. SHABI LOMBOK BERSAUDARA", "Aktif"],
		["DIAN MANPOWER SUPPLY", "Aktif"],
		["HIBIKI CENDEKIA MANDALA", "Aktif"],
		["BRYNA SUKSES ABADI", "Aktif"],
		["CIPTA JAYA BAHTERA", "Aktif"],
		["ZAMRUD SINAR NUSANTARA", "Aktif"],
		["YOBOSYO CORINDO PUTRA", "Aktif"],
		["HINATA HUMAN LINK", "Aktif"],
		["AMIL FAJAR BERKAH", "Aktif"],
		["SAPTA SINERGI SELARAS", "Aktif"],
		["INSAN SELARAS INDONESIA", "Aktif"],
		["MARUFUKU UNIVERSAL INDONESIA", "Aktif"],
		["DAYA TALENTA GLOBAL", "Aktif"],
		["BRILLIANT LANGGENG MAKMUR", "Aktif"],
		["SAHABAT JEPANG INDONESIA GROUP", "Aktif"],
		["NAKAYOSHI JAYA ABADI", "Aktif"],
		["LAYLA PARAHYANGAN SEJATI", "Aktif"],
		["MASA JAYA PASIFIK", "Aktif"],
		["PENEMPATAN PEMENANG ASIA", "Aktif"],
		["MENERBANGKAN ANAK BANGSA", "Aktif"],
		["ABDI SOBAT AMERTA", "Aktif"],
		["MARIKANGEN MANDIRI CIREBON", "Aktif"],
		["PRAMA ULTRA GLOBAL INTERPRISE", "Aktif"],
		["HANSEATIC CONNECT INDONESIA", "Aktif"],
		["SYAM INDO CORPORA", "Aktif"],
		["GLORIOUS AGUNG MANDIRI", "Aktif"],
		["NOVO CITRA MARINE", "Aktif"],
		["MULTI GENERASI INDONESIA", "Aktif"],
		["JIESCO PRO SPERITY", "Aktif"],
		["CITRA ESDEEM KARAWANG", "Aktif"],
		["HADIN PRO MANPOWER", "Aktif"],
		["GOLDEN ARUNIKA PERSADA", "Aktif"],
		["UPTY GLOBAL NETWORK", "Aktif"],
		["PADPARADSCHA HUMANIKA GLOBAL GROUP", "Aktif"],
		["WASAIDA HOMARE INDONESIA", "Aktif"],
		["SAKURA GLOBAL INDONESIA", "Aktif"],
		["International Pioneer Manpower", "Aktif"],
		["EDU OMNI TAKARA", "Aktif"],
		["JOBSTACULAR INSAN SEJAHTERA", "Aktif"],
		["MALONA SAHAPORY INTEGRITAS", "Aktif"],
		["AQNESIA MULTI USAHA", "Aktif"],
		["JAYATRA SERVIS INDONESIA", "Aktif"],
		["ALIYAH EST INDONESIA", "Aktif"],
		["PT ANUGERAH BAHARI PASIFIK", "Aktif"],
		["NORYOKU KALYANA INDONESIA", "Aktif"],
		["Marine Cruise Indonesia", "Aktif"],
		["DUTA SAMUDERA BAHARI", "Aktif"],
		["DAYA HELDIA ABADI", "Aktif"],
		["BIMASENA CIPTA MANGGALA", "Aktif"],
		["ARTHA GLOBAL MANPOWER", "Aktif"],
		["RAJAWALI TUNGGAL SETIA", "Aktif"],
		["Garuda Emas Express", "Aktif"],
		["HAJAVADA NUSANTARA ABADI", "Aktif"],
		["Moza Group Indonesia", "Aktif"],
		["PAMOR SUKSES ABADI", "Aktif"],
		["PT Rafa Global Marine", "Aktif"],
		["ACE INDONESIA SUKSESS", "Aktif"],
		["AXEL GARUDA INDONESIA", "Aktif"],
		["LUSIA BERKAH SEJAHTERA", "Aktif"],
		["RNT UTAMA INDONESIA", "Aktif"],
		["PT Mulia Mandiri Abadi Tasikmalaya", "Aktif"],
		["ANUGERAH FAMILI ASIA", "Aktif"],
		["SANTI SAKURA PLANNING", "Aktif"],
		["JOYFUL CARE INDONESIA", "Aktif"],
		["MENUJU MASA DEPAN CERAH", "Aktif"],
		["ANUGERAH TENAGA NUSANTARA", "Aktif"],
		["SENTRAL INOVASI RAYA", "Aktif"],
		["CAHAYA PENDIDIKAN INTERNASIONAL", "Aktif"],
		["ANABUKI CONSULTANT INDONESIA", "Aktif"],
		["YUKARI SINERGI INSANI", "Aktif"],
		["AMEASTARA RAYA MULIA", "Aktif"],
		["MOJO Global Talent", "Aktif"],
		["GENERASI EMAS BERDAYA", "Aktif"],
		["BREXA TALENT INDONESIA", "Aktif"],
		["HARENOHI CAHAYA INDONESIA", "Aktif"],
		["ARTOMORO ABADI REJEKI", "Aktif"],
		["Mega Pratama Samudra", "Aktif"],
		["AIKO NEGARA DAHA", "Aktif"],
		["SINGA MANPOWER", "Aktif"],
		["PT. Tafcindo Jasatama Segara", "Aktif"],
		["HIRO SEJAHTERA BERSAMA", "Aktif"],
		["NAGA CAHAYA ABADI", "Aktif"],
		["ASIA INDO MANPOWER", "Aktif"],
		["PT Global Alpha Group", "Aktif"],
		["EDREA GLOBAL GROUP", "Aktif"],
		["KURATEN MANABU INDONESIA", "Aktif"],
		["GERBANG TALENTA GLOBALINDO", "Aktif"],
		["INDO SAMUDERA SERVICE MANAGEMENT", "Aktif"],
		["ABC BUDAYA CENTER", "Aktif"],
		["PANDAWA MITRA INDONESIA", "Aktif"],
		["CITRA BINA TENAGA MANDIRI", "Aktif"],
		["SUNDO KUKUH BERSINAR", "Aktif"],
		["DAYA BARU INDONESIA", "Aktif"]
	];
	//#endregion
	//#region src/lib/text.ts
	const ZERO_WIDTH = /[​-‍⁠﻿­]/;
	const SINGLE_QUOTES = /[‘’‚‛′ʼ`´]/;
	const DOUBLE_QUOTES = /[“”„‟″«»]/;
	const DASHES = /[‐-―−⸺⸻]/;
	/** Indices of markdown syntax characters to drop: `[text](url)` → text, `**x**` / `_x_` → x. */
	function markdownDrops(raw) {
		const drop = /* @__PURE__ */ new Set();
		for (const m of raw.matchAll(/\[([^\]\n]{1,300})\]\(([^)\s]{1,500})\)/g)) {
			const start = m.index ?? 0;
			drop.add(start);
			const close = start + 1 + m[1].length;
			for (let i = close; i < start + m[0].length; i++) drop.add(i);
		}
		for (const m of raw.matchAll(/(\*{1,3}|_{1,3})/g)) {
			const i = m.index ?? 0;
			const before = i === 0 ? " " : raw[i - 1];
			const after = i + m[0].length >= raw.length ? " " : raw[i + m[0].length];
			const wordBefore = /[\p{L}\p{N}]/u.test(before);
			const wordAfter = /[\p{L}\p{N}]/u.test(after);
			if (wordBefore !== wordAfter || !wordBefore && !wordAfter) for (let k = 0; k < m[0].length; k++) drop.add(i + k);
		}
		return drop;
	}
	function normaliseWithMap(raw) {
		const drop = markdownDrops(raw);
		const out = [];
		const map = [];
		let pendingSpace = false;
		for (let i = 0; i < raw.length; i++) {
			if (drop.has(i)) continue;
			const ch = raw[i];
			if (ZERO_WIDTH.test(ch)) continue;
			let mapped = ch.normalize("NFKC").toLowerCase();
			if (SINGLE_QUOTES.test(ch)) mapped = "'";
			else if (DOUBLE_QUOTES.test(ch)) mapped = "\"";
			else if (DASHES.test(ch)) mapped = "-";
			if (/^\s+$/u.test(mapped)) {
				if (out.length > 0) pendingSpace = true;
				continue;
			}
			if (pendingSpace) {
				out.push(" ");
				map.push(i);
				pendingSpace = false;
			}
			for (const c of mapped) {
				out.push(c);
				map.push(i);
			}
		}
		return {
			text: out.join(""),
			map
		};
	}
	function normalise(raw) {
		return normaliseWithMap(raw).text;
	}
	/** Word tokens of normalised text: letter/digit runs (hyphenated words stay whole, e.g. "kerja-kerja"). */
	function words(s) {
		return normalise(s).match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? [];
	}
	/**
	* A clause: the stretch of text around `index` bounded by clause punctuation (. , ; : ! ?) or a newline. The rubric's
	* negation guard and the fee flag's contract condition never look across these boundaries.
	*/
	function clauseAround(text, start, end = start) {
		let a = start;
		while (a > 0 && !isClauseBoundary(text, a - 1)) a--;
		let b = end;
		while (b < text.length && !isClauseBoundary(text, b)) b++;
		return {
			start: a,
			end: b,
			text: text.slice(a, b)
		};
	}
	/** Abbreviations whose full stop does not end a clause ("PT. Maju", "Rp. 5 juta", "s.d."). */
	const ABBREVIATIONS = /* @__PURE__ */ new Set([
		"pt",
		"cv",
		"rp",
		"no",
		"tbk",
		"ltd",
		"co",
		"inc",
		"jl",
		"kab",
		"kec",
		"dll",
		"dsb",
		"s",
		"d",
		"u",
		"a",
		"n",
		"mr",
		"mrs",
		"dr"
	]);
	/** Is `text[i]` clause punctuation? A "." or "," between two digits ("15.000.000", "9,5") is part of a number. */
	function isClauseBoundary(text, i) {
		const c = text[i];
		if (c === "\n" || c === "\r" || c === ";" || c === ":" || c === "!" || c === "?") return true;
		if (c !== "." && c !== ",") return false;
		if (/\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) return false;
		if (c === ".") {
			const m = text.slice(Math.max(0, i - 6), i).match(/([\p{L}]+)$/u);
			if (m && ABBREVIATIONS.has(m[1].toLowerCase())) return false;
		}
		return true;
	}
	/** Digits only. */
	function digits(s) {
		return s.replace(/\D/g, "");
	}
	/**
	* "CV" is also a curriculum vitae: "Kirim CV ke WA", "SEND CV WHATSAPP". A "CV <Name>" match is a company only when it
	* is not preceded by a sending verb and not followed by a channel or filler word.
	*/
	const CV_BEFORE = /\b(?:kirim|kirimkan|send|submit|upload|lampirkan|sertakan|bawa|email|e-mail|drop)\s*$/i;
	const CV_AFTER = /^\s*(?:whatsapp|whats\s?app|wa|email|e-mail|anda|lengkap|terbaru|ke|to|via|melalui|segera|dan|and|atau|or|lamaran)\b/i;
	function isCurriculumVitae(text, matchStart, matchText) {
		const at = matchStart + (matchText.length - matchText.trimStart().length);
		if (!/^cv\b/i.test(text.slice(at, at + 3))) return false;
		return CV_BEFORE.test(text.slice(Math.max(0, at - 20), at)) || CV_AFTER.test(text.slice(at + 2).replace(/^\./, ""));
	}
	//#endregion
	//#region src/lib/registry.ts
	/**
	* The licensed-placement registry check (spec §4 SHOULD #2): a dated snapshot of the official P3MI list, looked up in
	* code. A query-ranked web search cannot prove a name is absent from a list of hundreds; a stored snapshot can say
	* exactly "not found on the list as of <date>".
	*
	* - The ad names an Indonesian company (PT / CV) that is not on the list → CAUTION, never STOP: the list changes, and
	*   ship-crew agencies are licensed elsewhere.
	* - The ad names an agency the list shows under suspension → CAUTION.
	* - Found and active → no flag, only a note: scammers reuse licensed names, so the family should contact the agency
	*   through the details on the list, not the number in the ad.
	*/
	const LEGAL_FORMS$1 = /* @__PURE__ */ new Set([
		"pt",
		"cv",
		"tbk",
		"persero"
	]);
	function nameTokens(name) {
		return (normalise(name).match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => !LEGAL_FORMS$1.has(t));
	}
	const REGISTRY = {
		source,
		asOf: fetched,
		count,
		agencies: agencies.map(([name, status]) => ({
			name,
			status,
			tokens: nameTokens(name)
		}))
	};
	const REGISTRY_SOURCE = {
		url: source,
		domain: "siskop2mi.bp2mi.go.id",
		title: `SISKOP2MI — List P3MI (${count} licensed placement companies)`,
		date: fetched,
		quote: "List P3MI"
	};
	function tokensWithOffsets(text) {
		return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({
			t: m[0].normalize("NFKC").toLowerCase(),
			start: m.index ?? 0,
			end: (m.index ?? 0) + m[0].length
		}));
	}
	/** "PT Maju Jaya" / "CV. Sinar" in the ad: the Indonesian company names worth looking up. */
	const INDONESIAN_COMPANY = /\b(?:PT|CV)\.?\s+(?:[A-Z0-9][\p{L}\p{N}&'’-]*\.?\s*){1,6}/gu;
	function checkRegistry(adText, extractedCompany) {
		const result = {
			asOf: REGISTRY.asOf,
			source: REGISTRY.source,
			found: null,
			notListed: []
		};
		const toks = tokensWithOffsets(adText);
		let best = null;
		for (const agency of REGISTRY.agencies) {
			const n = agency.tokens;
			if (n.length === 0) continue;
			for (let i = 0; i + n.length <= toks.length; i++) {
				if (!n.every((t, k) => toks[i + k].t === t)) continue;
				if (n.length === 1 && !(i > 0 && LEGAL_FORMS$1.has(toks[i - 1].t))) continue;
				const span = {
					text: adText.slice(toks[i].start, toks[i + n.length - 1].end),
					start: toks[i].start,
					end: toks[i + n.length - 1].end
				};
				if (!best || n.length > best.len) best = {
					agency: {
						name: agency.name,
						status: agency.status
					},
					span,
					len: n.length
				};
			}
		}
		if (best) {
			result.found = {
				...best.agency,
				span: best.span
			};
			return result;
		}
		const seen = /* @__PURE__ */ new Set();
		const add = (span) => {
			const key = nameTokens(span.text).join(" ");
			if (key && !seen.has(key)) {
				seen.add(key);
				result.notListed.push(span);
			}
		};
		for (const m of adText.matchAll(INDONESIAN_COMPANY)) {
			if (isCurriculumVitae(adText, m.index ?? 0, m[0])) continue;
			const text = m[0].trim().replace(/[.,]$/, "");
			add({
				text,
				start: m.index ?? 0,
				end: (m.index ?? 0) + text.length
			});
		}
		if (extractedCompany && /^(?:PT|CV)\b/i.test(extractedCompany.text.trim())) add(extractedCompany);
		return result;
	}
	//#endregion
	//#region src/lib/rule-sources.ts
	const POLRI_CHECKLIST = {
		url: "https://humas.polri.go.id/news/detail/2270595-waspada-penipuan-lowongan-kerja-luar-negeri-tppo",
		domain: "humas.polri.go.id",
		title: "Waspada Penipuan Lowongan Kerja Luar Negeri (TPPO)",
		date: "2026-02-04"
	};
	const POLRI_ITEM = (quote) => ({
		...POLRI_CHECKLIST,
		quote
	});
	const KEMNAKER_FEES = {
		url: "https://www.kemnaker.go.id/news/detail/kemnaker-imbau-masyarakat-waspada-penipuan-lowongan-pekerjaan",
		domain: "kemnaker.go.id",
		title: "Kemnaker Imbau Masyarakat Waspada Penipuan Lowongan Pekerjaan",
		date: "2024-10-10"
	};
	const RULE_SOURCES = {
		flags: {
			tourist_visa: {
				...POLRI_CHECKLIST,
				quote: "Dokumen bermasalah, menggunakan visa turis atau visa kunjungan untuk bekerja, bukan visa kerja (work permit) yang sah."
			},
			visit_visa_holder: {
				...POLRI_CHECKLIST,
				quote: "Dokumen bermasalah, menggunakan visa turis atau visa kunjungan untuk bekerja, bukan visa kerja (work permit) yang sah."
			},
			fee_before_contract: {
				...KEMNAKER_FEES,
				quote: "Jangan pernah memberikan apapun untuk mendapatkan pekerjaan."
			},
			fee_before_departure: {
				...KEMNAKER_FEES,
				quote: "Jangan pernah memberikan apapun untuk mendapatkan pekerjaan."
			},
			passport_retention: {
				...POLRI_CHECKLIST,
				quote: "M-enolak, apabila diminta menyerahkan dokumen asli seperti paspor atau KTP kepada pihak perorangan yang tidak jelas."
			},
			personal_recruiter: {
				...POLRI_CHECKLIST,
				quote: "Identitas perusahaan tidak jelas, alamat kantor tidak pasti dan komunikasi hanya dilakukan melalui media sosial atau WhatsApp tanpa pertemuan langsung di kantor resmi."
			},
			no_company: {
				...POLRI_CHECKLIST,
				quote: "Identitas perusahaan tidak jelas, alamat kantor tidak pasti dan komunikasi hanya dilakukan melalui media sosial atau WhatsApp tanpa pertemuan langsung di kantor resmi."
			},
			quick_departure: POLRI_ITEM("Proses sangat instan, menjanjikan keberangkatan cepat tanpa melalui seleksi resmi maupun pelatihan bahasa dan keterampilan."),
			high_pay_light_work: POLRI_ITEM("Gaji tidak masuk akal, menawarkan upah sangat tinggi untuk pekerjaan yang terlihat ringan, seperti admin media sosial atau layanan pelanggan."),
			debt_bondage: POLRI_ITEM("Biaya keberangkatan “ditalangi”, dengan iming-iming gratis di awal, namun pada akhirnya menjadi utang besar yang dipotong dari gaji (jeratan utang)."),
			fee_asked: {
				...KEMNAKER_FEES,
				quote: "Jangan pernah memberikan apapun untuk mendapatkan pekerjaan."
			},
			high_pay_no_experience: {
				url: "https://www.kemlu.go.id/berita/kasus-wni-di-kamboja-meningkat-tajam-di-awal-2025?type=publication",
				domain: "kemlu.go.id",
				title: "Kasus WNI di Kamboja Meningkat Tajam di Awal 2025",
				date: "2025-03-21",
				quote: "menghimbau agar WNI lebih waspada terhadap tawaran pekerjaan di luar negeri yang tidak memerlukan skill atau kualifikasi, tapi menjanjikan gaji yang tinggi."
			},
			advisory_destination: {
				url: "https://www.kemlu.go.id/publikasi/siaran-pers/transkrip-press-briefing-menlu-ri-online-scams,-evakuasi-sudan,-ktt-ke-42-asean-jakarta,-5-mei-2023?type=publication",
				domain: "kemlu.go.id",
				title: "Transkrip Press Briefing Menlu RI: Online Scams (5 Mei 2023)",
				date: "2023-05-05",
				quote: "Untuk korban Indonesia, tercatat berada di Myanmar, Kamboja, Thailand, Vietnam, Laos dan Filipina."
			}
		},
		pay: {
			thresholdIdr: 6e6,
			thresholdUsd: 700,
			source: {
				url: "https://humas.polri.go.id/news/detail/2275569-polri-repatriasi-249-wni-dari-kamboja-korban-rekrutmen-scam-online",
				domain: "humas.polri.go.id",
				title: "Polri Repatriasi 249 WNI dari Kamboja Korban Rekrutmen Scam Online",
				date: "2026-02-09",
				quote: "iming-iming gaji Rp 6 juta sampai Rp 8 juta per bulan."
			},
			usdSource: {
				url: "https://www.kemlu.go.id/berita/kementerian-luar-negeri-dan-kbri-phnom-penh-fasilitasi-pemulangan-jenazah-dari-kamboja?type=publication",
				domain: "kemlu.go.id",
				title: "Kementerian Luar Negeri dan KBRI Phnom Penh Fasilitasi Pemulangan Jenazah dari Kamboja",
				date: "2023-12-29",
				quote: "awalnya dijanjikan pekerjaan di Thailand sebagai pekerja kantoran dengan gaji USD 700, tetapi justru dikirim ke Kamboja."
			}
		},
		nonPlacement: { places: [{
			name: "Kamboja",
			pattern: "kamboja|cambodia|phnom\\s+penh|sihanoukville",
			source: {
				url: "https://kp2mi.go.id/berita-detail/waspada-tawaran-kerja-ke-kamboja-menteri-mukhtarudin-itu-bukan-negara-penempatan-pekerja-migran-indonesia",
				domain: "kp2mi.go.id",
				title: "Waspada Tawaran Kerja ke Kamboja, Menteri Mukhtarudin: Itu Bukan Negara Penempatan Pekerja Migran Indonesia",
				date: "2025-10-28",
				quote: "Perlu saya tegaskan, Kamboja itu bukan negara penempatan."
			}
		}, {
			name: "Myanmar",
			pattern: "myanmar|burma|myawaddy",
			source: {
				url: "https://kp2mi.go.id/index.php/berita-detail/diduga-terjebak-sindikat-scammer-di-myanmar-bp3mi-sumatera-barat-tegaskan-pentingnya-migrasi-aman",
				domain: "kp2mi.go.id",
				title: "Diduga Terjebak Sindikat Scammer di Myanmar, BP3MI Sumatera Barat Tegaskan Pentingnya Migrasi Aman",
				date: "2026-07-21",
				quote: "Kami tegaskan bahwa Myanmar bukan negara penempatan resmi Pekerja Migran Indonesia."
			}
		}] },
		advisory: {
			places: [
				{
					name: "Kamboja",
					pattern: "kamboja|cambodia|phnom\\s+penh|sihanoukville"
				},
				{
					name: "Myanmar",
					pattern: "myanmar|burma|myawaddy"
				},
				{
					name: "Thailand",
					pattern: "thailand|thailan"
				},
				{
					name: "Vietnam",
					pattern: "vietnam|viet\\s+nam|ho\\s+chi\\s+minh"
				},
				{
					name: "Laos",
					pattern: "laos"
				},
				{
					name: "Filipina",
					pattern: "filipina|philippines|manila"
				}
			],
			source: {
				url: "https://www.kemlu.go.id/publikasi/siaran-pers/transkrip-press-briefing-menlu-ri-online-scams,-evakuasi-sudan,-ktt-ke-42-asean-jakarta,-5-mei-2023?type=publication",
				domain: "kemlu.go.id",
				title: "Transkrip Press Briefing Menlu RI: Online Scams (5 Mei 2023)",
				date: "2023-05-05",
				quote: "Untuk korban Indonesia, tercatat berada di Myanmar, Kamboja, Thailand, Vietnam, Laos dan Filipina."
			}
		}
	};
	//#endregion
	//#region src/lib/rubric.ts
	/**
	* The red-flag rubric — deterministic code, not the model.
	*
	* Every flag fires on the model's extracted field OR a keyword/regex rule over the raw ad text, so a prompt-injected
	* or mis-extracted ad cannot silently drop a flag. Every Indonesian rule has an English twin (English pastes are
	* invited). NEVER-class rules stop the check on their own, but only when an official source is recorded for them in
	* `RULE_SOURCES`; a NEVER rule without one is drawn and counted as CAUTION.
	*
	* Negation guard (NEVER rules and the fee flags): no match when a negator directly governs the phrase — it ends right
	* before the phrase, optionally followed by one filler word ("tanpa biaya", "bukan visa turis", "No placement fee",
	* "tidak pakai visa turis", "not a tourist visa"). The guard never looks across clause punctuation or a newline, so
	* "tanpa pengalaman. Visa turis diurus" still fires. The fee flags also have a post-head guard: costs the ad says are
	* covered in the same clause ("Semua biaya ditanggung perusahaan sebelum berangkat") do not fire — unless the clause
	* says the worker bears them ("ditanggung oleh pekerja"). The visa flag has no post-head guard on purpose:
	* "visa turis ditanggung perusahaan" is still a tourist visa for work.
	*
	* Rules match the content of an offer — pay figures, fees, visa type, destination, departure speed, debt, company
	* identity — never the narrative words a news report uses about one (korban, iming-iming, dijanjikan, tergiur, modus):
	* the benchmark's positives are reporters' descriptions, and a rule that keyed on their vocabulary would score well
	* there and catch nothing in a real ad (bench/PROTOCOL.md Amendment 4).
	*/
	const NEGATORS_1 = /* @__PURE__ */ new Set([
		"tanpa",
		"tidak",
		"tak",
		"bukan",
		"non",
		"bebas",
		"gratis",
		"jangan",
		"dilarang",
		"no",
		"not",
		"never",
		"without",
		"zero",
		"nil"
	]);
	const NEGATORS_2 = /* @__PURE__ */ new Set([
		"tidak ada",
		"free of",
		"do not",
		"does not",
		"don t",
		"doesn t",
		"will not",
		"won t"
	]);
	const FILLERS = /* @__PURE__ */ new Set([
		"a",
		"an",
		"the",
		"any",
		"pakai",
		"memakai",
		"menggunakan",
		"perlu",
		"ada",
		"dengan",
		"untuk",
		"use",
		"using",
		"need",
		"require",
		"required"
	]);
	function tokensOf(s) {
		return s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
	}
	function endsWithNegator(toks) {
		const n = toks.length;
		if (n >= 1 && NEGATORS_1.has(toks[n - 1])) return true;
		if (n >= 2 && NEGATORS_2.has(`${toks[n - 2]} ${toks[n - 1]}`)) return true;
		return false;
	}
	/** Is the phrase starting at `start` governed by a negator right before it, inside the same clause? */
	function negatedBefore(text, start) {
		const clause = clauseAround(text, start);
		const toks = tokensOf(text.slice(clause.start, start));
		if (endsWithNegator(toks)) return true;
		if (toks.length >= 2 && FILLERS.has(toks[toks.length - 1]) && endsWithNegator(toks.slice(0, -1))) return true;
		return false;
	}
	const COVERED = /\b(ditanggung|dibebaskan|gratis|free|covered)\b|\brp\.?\s?0\b(?![.,]?\d)|\bpaid by (the )?(employer|company)\b/i;
	const BORNE_BY_WORKER = /\b(ditanggung|dibayar|dibebankan)\s+(oleh\s+)?(pekerja|pmi|cpmi|calon|sendiri|pelamar|peserta|anda|kamu)\b|\bpaid by (the )?(worker|applicant|candidate|you)\b/i;
	/** Costs the ad itself says are covered, after the phrase head and inside the same clause (fee flags only). */
	function coveredAfter(text, start, end) {
		const clause = clauseAround(text, start, end);
		const tail = text.slice(start, clause.end);
		return COVERED.test(tail) && !BORNE_BY_WORKER.test(tail);
	}
	const FEE_HEAD_ID = String.raw`(?:uang|biaya)\s+(?:penempatan|pendaftaran|administrasi|admin|proses|pengurusan|pemberangkatan|jasa|muka|jaminan)?\s*`;
	const FEE_HEAD_EN = String.raw`\b(?:placement|recruitment|processing|agency|service|admin|administration|registration|visa)?\s*(?:fee|fees|deposit|charge|charges|payment)\b`;
	/** A money amount in an Indonesian ad: "Rp 2 juta", "Rp. 500.000", "3 jt", "750 ribu". */
	const AMOUNT_ID = String.raw`(?:\brp\.?\s?\d|\b\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)\b)`;
	/** The rule set. */
	const PATTERNS = {
		tourist_visa: [
			/\bvisa\s+(?:turis|kunjungan|wisata|pelancong|liburan)\b/giu,
			/\btourist\s+visas?\b/giu,
			/\bvisit\s+visas?\b(?!\s+holders?)/giu
		],
		fee_before_contract: [new RegExp(String.raw`\b${FEE_HEAD_ID}.{0,30}?\b(?:sebelum|dulu|di\s*muka)\b`, "giu"), new RegExp(String.raw`${FEE_HEAD_EN}.{0,30}?\bbefore\b`, "giu")],
		passport_retention: [
			/\bpaspor\b.{0,20}?\b(?:ditahan|disimpan|diserahkan|dititipkan|dipegang|diambil)\b/giu,
			/\bpassports?\b.{0,20}?\b(?:held|kept|surrendered|handed\s+over|retained|confiscated)\b/giu,
			/\b(?:hold|keep|retain|confiscate)s?\b.{0,20}?\bpassports?\b/giu
		],
		fee_before_departure: [new RegExp(String.raw`\b${FEE_HEAD_ID}.{0,30}?\bsebelum\s+(?:berangkat|keberangkatan|pemberangkatan|terbang)\b`, "giu"), new RegExp(String.raw`${FEE_HEAD_EN}.{0,30}?\bbefore\s+(?:departure|departing|flying|you\s+fly|leaving)\b`, "giu")],
		high_pay_no_experience: [/\b(?:tanpa|tidak\s+(?:perlu|butuh|harus|wajib)|tak\s+perlu|bebas)\s+(?:ada\s+)?pengalaman\b|\bpengalaman\s+tidak\s+(?:diperlukan|dibutuhkan|wajib|harus)\b|\bfresh\s*graduate\b/giu, /\bno\s+(?:prior\s+|previous\s+|work\s+)?experience\b|\bwithout\s+(?:any\s+)?experience\b|\bexperience\s+(?:is\s+)?not\s+(?:required|needed|necessary)\b/giu],
		advisory_destination: [],
		personal_recruiter: [],
		visit_visa_holder: [/\bvisit\s+visas?\s+holders?\b/giu],
		non_placement_country: [],
		fee_asked: [
			new RegExp(String.raw`\b(?:biaya|bayar|membayar|dibayar|bayaran|setor|setoran|menyetor|menyetorkan|transfer|mentransfer|dp|deposit|uang\s+(?:muka|pendaftaran|administrasi|admin|proses|jaminan|tiket|visa|pengurusan))\b(?:(?!gaji|upah|salary|penghasilan|bonus)[^.;:!?\n]){0,40}?${AMOUNT_ID}`, "giu"),
			new RegExp(String.raw`${AMOUNT_ID}[^.;:!?\n]{0,25}?\b(?:untuk|buat|sebagai)\s+(?:biaya|ongkos|pendaftaran|administrasi|admin|proses|pengurusan|tiket|visa|paspor|medical|medis|pelatihan|jaminan)\b`, "giu"),
			/\buang\s+(?:untuk|buat)\s+(?:mengurus|pengurusan|biaya|tiket|dokumen|paspor|visa|administrasi|pendaftaran|proses|keberangkatan)\b/giu,
			new RegExp(String.raw`\b(?:fee|fees|deposit|charge|charges|payment)\b(?:(?!salary|wage|income|\bpay\b)[^.;:!?\n]){0,40}?(?:\$|\busd|\bus\$|\brp\.?|\bidr|\bphp|\bmyr|\brm|\baed|\bsgd)\s?\d`, "giu"),
			/\bpay\s+(?:a|an|the)?\s*(?:\w+\s+)?(?:fee|deposit|charge)\b/giu
		],
		debt_bondage: [/\b(?:di)?talangi\b|\b(?:dana\s+)?talangan\b|\bdipotong\s+(?:dari\s+)?gaji\b|\bpotong(?:an)?\s+gaji\b|\bgaji\s+(?:\p{L}+\s+){0,2}dipotong\b|\bdicicil\s+(?:dari|lewat|melalui|dengan)\s+gaji\b|\bpinjaman\b|\bkasbon\b/giu, /\bdeducted\s+from\s+(?:your\s+|the\s+)?(?:salary|wages?|pay)\b|\b(?:salary|wage)\s+deductions?\b|\bloans?\b/giu],
		quick_departure: [
			/\b(?:langsung|cepat|segera|siap)\s+(?:di)?berangkat(?:kan)?\b/giu,
			/\b(?:proses|keberangkatan|pemberangkatan|berangkat|penempatan)\s+(?:sangat\s+|super\s+)?(?:cepat|kilat|instan|singkat|ekspres|express)\b/giu,
			/\bberangkat\s+(?:dalam|kurang\s+dari|maksimal|maks|max)\s+\d+\s*(?:hari|minggu|pekan)\b/giu,
			/\b(?:tanpa|tidak\s+(?:perlu|pakai|ada|wajib))\s+(?:tes|test|seleksi|pelatihan|training|interview|wawancara|kursus)\b/giu,
			/\b(?:minggu|pekan|bulan)\s+(?:ini|depan)\s+(?:langsung\s+)?berangkat\b/giu,
			/\b(?:fast|quick|immediate|express|instant)\s+(?:departure|process(?:ing)?|deployment|placement|hiring)\b/giu,
			/\b(?:fly|depart|leave)\s+(?:within|in)\s+\d+\s+(?:days?|weeks?)\b/giu,
			/\bno\s+(?:interview|test|training|selection)\b/giu
		],
		high_pay_light_work: [],
		no_company: [],
		not_on_p3mi_list: [],
		p3mi_suspended: []
	};
	const CONTRACT_WORDS = /\b(kontrak|tanda\s*tangan|ttd|dp|uang\s+jaminan|contract|deposit|signing|signed)\b/i;
	const DEPARTURE_WORDS = /\b(berangkat|keberangkatan|pemberangkatan|departure|departing|flying)\b/i;
	const NEVER_RULES = [
		"tourist_visa",
		"fee_before_contract",
		"passport_retention",
		"non_placement_country"
	];
	/** The order flags are evaluated and listed in: NEVER rules first. */
	const FLAG_ORDER = [
		"tourist_visa",
		"fee_before_contract",
		"passport_retention",
		"non_placement_country",
		"fee_before_departure",
		"fee_asked",
		"debt_bondage",
		"high_pay_no_experience",
		"high_pay_light_work",
		"quick_departure",
		"advisory_destination",
		"personal_recruiter",
		"no_company",
		"not_on_p3mi_list",
		"p3mi_suspended",
		"visit_visa_holder"
	];
	const FLAG_LABELS = {
		tourist_visa: {
			id: "Iklan menawarkan visa turis/kunjungan untuk bekerja",
			en: "The ad offers a tourist or visit visa for work"
		},
		fee_before_contract: {
			id: "Iklan meminta biaya sebelum ada kontrak",
			en: "The ad asks for a fee before a contract is signed"
		},
		passport_retention: {
			id: "Iklan menyebut paspor ditahan atau diserahkan",
			en: "The ad says the passport is held or handed over"
		},
		fee_before_departure: {
			id: "Iklan meminta biaya sebelum berangkat",
			en: "The ad asks for a fee before departure"
		},
		high_pay_no_experience: {
			id: "Gaji tinggi tanpa perlu pengalaman",
			en: "High pay with no experience needed"
		},
		advisory_destination: {
			id: "Negara tujuan disebut dalam peringatan resmi",
			en: "The destination is named in an official warning"
		},
		personal_recruiter: {
			id: "Perekrut hanya nomor pribadi, tanpa nama perusahaan",
			en: "The recruiter is a personal number with no company named"
		},
		visit_visa_holder: {
			id: "Iklan menerima pemegang visa kunjungan",
			en: "The ad accepts visit-visa holders"
		},
		non_placement_country: {
			id: "Negara tujuan bukan negara penempatan resmi pekerja migran",
			en: "The destination is not an official placement country"
		},
		fee_asked: {
			id: "Iklan meminta biaya untuk mendapatkan pekerjaan",
			en: "The ad asks for a fee to get the job"
		},
		debt_bondage: {
			id: "Biaya ditalangi, lalu dipotong dari gaji",
			en: "Costs advanced, then deducted from pay"
		},
		high_pay_light_work: {
			id: "Gaji sangat tinggi untuk pekerjaan ringan",
			en: "Very high pay for light office work"
		},
		quick_departure: {
			id: "Janji berangkat cepat tanpa seleksi atau pelatihan",
			en: "A fast departure with no selection or training"
		},
		no_company: {
			id: "Iklan tidak menyebut nama perusahaan",
			en: "The ad names no company"
		},
		not_on_p3mi_list: {
			id: "Nama perusahaan tidak ditemukan di daftar P3MI resmi",
			en: "The company is not on the official licensed-agency (P3MI) list"
		},
		p3mi_suspended: {
			id: "Perusahaan ini sedang dihentikan sementara (sanksi) di daftar P3MI",
			en: "The agency is under a temporary suspension on the P3MI list"
		}
	};
	/** Pay figures in an ad, in their own currency (rupiah or US dollars). No conversion: each has its own cited threshold. */
	function payFigures(text) {
		const out = [];
		const num = (raw) => {
			const s = raw.trim();
			if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
			return Number(s.replace(",", "."));
		};
		const push = (m, amount, currency) => {
			if (Number.isFinite(amount) && amount > 0) out.push({
				amount,
				currency,
				span: {
					text: m[0],
					start: m.index ?? 0,
					end: (m.index ?? 0) + m[0].length
				}
			});
		};
		for (const m of text.matchAll(/\brp\.?\s?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)\s*(jt|juta|jutaan|rb|ribu|k)?\b/giu)) {
			const unit = (m[2] ?? "").toLowerCase();
			const mult = unit.startsWith("j") ? 1e6 : unit === "rb" || unit === "ribu" || unit === "k" ? 1e3 : 1;
			push(m, num(m[1]) * mult, "IDR");
		}
		for (const m of text.matchAll(/(?<!rp\.?\s?)\b(\d+(?:[.,]\d{1,2})?)\s*(jt|juta)\b/giu)) push(m, num(m[1]) * 1e6, "IDR");
		for (const m of text.matchAll(/(?:\busd|\bus\$|\$)\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/giu)) push(m, num(m[1]), "USD");
		for (const m of text.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+|\d{3,})\s*(?:usd|us\s?dollars?|dollars?|dolar)\b/giu)) push(m, num(m[1]), "USD");
		return out;
	}
	/** The "high pay" constant. Its source and value live in rule-sources.ts. */
	const PAY = RULE_SOURCES.pay;
	const ADVISORY = RULE_SOURCES.advisory;
	function advisoryMatches(text) {
		const out = [];
		for (const place of ADVISORY.places) {
			const re = new RegExp(String.raw`\b${place.pattern}\b`, "giu");
			for (const m of text.matchAll(re)) out.push({
				text: m[0],
				start: m.index ?? 0,
				end: (m.index ?? 0) + m[0].length
			});
		}
		return out.sort((a, b) => a.start - b.start);
	}
	/** "Not a placement country" mentions, skipping a negated one ("bukan ke Kamboja", "not in Myanmar"). */
	function nonPlacementMatches(text) {
		const out = [];
		for (const place of RULE_SOURCES.nonPlacement.places) {
			const re = new RegExp(String.raw`\b(?:${place.pattern})\b`, "giu");
			for (const m of text.matchAll(re)) {
				const start = m.index ?? 0;
				if (negatedPlace(text, start)) continue;
				out.push({
					span: {
						text: m[0],
						start,
						end: start + m[0].length
					},
					source: place.source
				});
			}
		}
		return out.sort((a, b) => a.span.start - b.span.start);
	}
	const PLACE_PREPOSITIONS = /* @__PURE__ */ new Set([
		"ke",
		"di",
		"menuju",
		"untuk",
		"dari",
		"to",
		"in",
		"for",
		"from"
	]);
	/** "bukan ke Kamboja", "tidak di Myanmar", "not to Cambodia": a negator, then at most a preposition. */
	function negatedPlace(text, start) {
		if (negatedBefore(text, start)) return true;
		const clause = clauseAround(text, start);
		const toks = tokensOf(text.slice(clause.start, start));
		return toks.length >= 2 && PLACE_PREPOSITIONS.has(toks[toks.length - 1]) && endsWithNegator(toks.slice(0, -1));
	}
	/** Light office work, the examples the Polri checklist gives (admin, customer service) and their usual ad titles. */
	const LIGHT_WORK = /\b(?:admin(?:istrasi)?|customer\s+service|layanan\s+pelanggan|cs\s+online|cs|telemarketing|marketing(?:\s+(?:online|digital))?|data\s+entry|entri\s+data|input\s+data|e-?commerce|online\s+shop|toko\s+online|operator\s+(?:komputer|online|chat|game)|pekerja\s+kantor(?:an)?|kerja\s+kantor(?:an)?|staf+\s+kantor|office\s+(?:staff|work|job|assistant)|typist|kerja\s+online|host\s+live|live\s+streaming|trading|trader)\b/giu;
	const LIGHT_WORK_IT = /\bIT\b/u;
	/** Pay claimed in words: "gaji besar", "gaji tinggi", "belasan juta", "high salary". */
	const PAY_WORDS = /\bgaji\s+(?:sangat\s+|super\s+)?(?:besar|tinggi|gede|fantastis|menggiurkan)\b|\b(?:belasan|puluhan)\s+juta\b|\bhigh\s+(?:salary|pay|income)\b/giu;
	/** High pay in an ad: a figure at or above the cited threshold, or a high-pay claim in words. */
	function highPaySpans(text) {
		const figures = payFigures(text).filter((p) => p.currency === "IDR" ? p.amount >= PAY.thresholdIdr : p.amount >= PAY.thresholdUsd).map((p) => p.span);
		const words = [...text.matchAll(PAY_WORDS)].map((m) => ({
			text: m[0],
			start: m.index ?? 0,
			end: (m.index ?? 0) + m[0].length
		}));
		return [...figures, ...words].sort((a, b) => a.start - b.start);
	}
	const LEGAL_COMPANY = /\b(?:PT|CV)\.?\s+[A-Z0-9][\p{L}\p{N}&.'-]*/u;
	/** A foreign legal form, in title case or ALL CAPS as board listings print them ("CO.LTD.", "SDN BHD", "S.R.O"). */
	const FOREIGN_FORM = String.raw`(?:[Cc][Oo]\.?,?\s*[Ll][Tt][Dd]\.?|[Ll][Tt][Dd]\.?|[Ll]imited|LIMITED|[Ii]nc\.?|INC\.?|LLC|[Ss]\.[Rr]\.[Oo]\.?|S\.?R\.?O\.?|[Gg]mb[Hh]|GMBH|[Pp]te\.?\s*[Ll]td\.?|PTE\.?\s*LTD\.?|[Ss]dn\.?\s*[Bb]hd\.?|SDN\.?\s*BHD\.?|Group|GROUP|Company|COMPANY|Corporation|CORPORATION)`;
	const FOREIGN_COMPANY = new RegExp(String.raw`\b[A-Z][\p{L}&'-]+(?:\s+[A-Z][\p{L}&'-]+)*\s+${FOREIGN_FORM}(?![\p{L}])`, "u");
	const CONTACT = /(?:\+?62|\b0)8\d{1,3}[\s.-]?\d{3,4}[\s.-]?\d{3,5}|\b(?:wa|whatsapp|whats\s?app|hubungi|telp|telepon|hp|dm|inbox)\b/giu;
	function patternHits(id, text) {
		const hits = [];
		for (const re of PATTERNS[id]) for (const m of text.matchAll(re)) {
			const start = m.index ?? 0;
			const end = start + m[0].length;
			if (!guardsPass(id, text, start, end)) continue;
			hits.push({
				span: {
					text: m[0],
					start,
					end
				},
				via: "pattern"
			});
		}
		return hits;
	}
	/** The negation / clause conditions for one candidate match. */
	function guardsPass(id, text, start, end) {
		const clause = clauseAround(text, start, end);
		switch (id) {
			case "tourist_visa":
			case "visit_visa_holder": return !negatedBefore(text, start);
			case "passport_retention": {
				if (negatedBefore(text, start)) return false;
				const inside = text.slice(start, end);
				if (/\b(tidak|tak|bukan|jangan|dilarang|not|never|no)\b/i.test(inside)) return false;
				if (/\b(own|sendiri)\b/i.test(text.slice(start, clause.end))) return false;
				return true;
			}
			case "fee_before_contract": return !negatedBefore(text, start) && !coveredAfter(text, start, end) && CONTRACT_WORDS.test(clause.text);
			case "fee_before_departure": return !negatedBefore(text, start) && !coveredAfter(text, start, end);
			case "fee_asked": return !negatedBefore(text, start) && !coveredAfter(text, start, end);
			case "debt_bondage":
				if (negatedBefore(text, start)) return false;
				return !/\b(tidak|tak|tanpa|bukan|no|not|without)\b/i.test(text.slice(start, end));
			case "quick_departure": return !negatedBefore(text, start);
			default: return true;
		}
	}
	/** The model's extracted fields, read through the same guards (the field's span sits inside the ad). */
	function modelHits(id, text, ex) {
		if (!ex) return [];
		const hits = [];
		const add = (span, ok) => {
			if (span && ok) hits.push({
				span,
				via: "model"
			});
		};
		switch (id) {
			case "tourist_visa":
				add(ex.visa, !!ex.visa && /\b(turis|kunjungan|wisata|pelancong|liburan|tourist|visit|on\s+arrival|voa)\b/i.test(ex.visa.text) && !/\bholders?\b/i.test(ex.visa.text) && !negatedBefore(text, ex.visa.start));
				break;
			case "fee_before_contract":
			case "fee_before_departure":
				for (const fee of ex.fees) {
					const clause = clauseAround(text, fee.start, fee.end);
					const before = /\b(sebelum|dulu|di\s*muka|before|upfront|in\s+advance)\b/i.test(clause.text);
					const kind = id === "fee_before_contract" ? CONTRACT_WORDS.test(clause.text) : DEPARTURE_WORDS.test(clause.text);
					add(fee, before && kind && !negatedBefore(text, fee.start) && !coveredAfter(text, fee.start, fee.end));
				}
				break;
			case "advisory_destination":
				add(ex.destination, !!ex.destination && advisoryMatches(ex.destination.text).length > 0);
				break;
			case "fee_asked":
				for (const fee of ex.fees) add(fee, !negatedBefore(text, fee.start) && !coveredAfter(text, fee.start, fee.end) && !/\b(gratis|free|ditanggung|covered)\b/i.test(fee.text));
				break;
			case "debt_bondage":
				for (const span of [...ex.fees, ...ex.promises]) add(span, PATTERNS.debt_bondage.some((re) => new RegExp(re.source, "iu").test(span.text)) && guardsPass("debt_bondage", text, span.start, span.end));
				break;
			case "quick_departure": for (const span of ex.promises) add(span, PATTERNS.quick_departure.some((re) => new RegExp(re.source, "iu").test(span.text)) && !negatedBefore(text, span.start));
		}
		return hits;
	}
	function sourceFor(id) {
		return RULE_SOURCES.flags[id] ?? null;
	}
	function makeFlag(id, hits, sourceOverride) {
		if (hits.length === 0) return null;
		hits.sort((a, b) => a.span.start - b.span.start);
		const vias = new Set(hits.map((h) => h.via));
		const source = sourceOverride !== void 0 ? sourceOverride : sourceFor(id);
		const declared = NEVER_RULES.includes(id) ? "NEVER" : "CAUTION";
		const sourced = source !== null;
		return {
			id,
			class: declared === "NEVER" && sourced ? "NEVER" : "CAUTION",
			sourced,
			via: vias.size === 2 ? "both" : hits[0].via,
			span: hits[0].span,
			label: FLAG_LABELS[id].en,
			source
		};
	}
	/**
	* Evaluate every flag over the raw ad text (and the model's extraction, when there is one).
	* `extraction` is null for the rubric-only ablation column and when the extraction call failed.
	*/
	function evaluateRubric(adText, extraction) {
		const flags = [];
		const has = (id) => flags.some((f) => f.id === id);
		const nonPlacement = [...nonPlacementMatches(adText), ...extraction?.destination ? nonPlacementMatches(extraction.destination.text).map((m) => ({
			...m,
			span: extraction.destination,
			model: true
		})) : []];
		for (const id of FLAG_ORDER) {
			let hits;
			let source;
			if (id === "non_placement_country") {
				hits = nonPlacement.map((m) => ({
					span: m.span,
					via: "model" in m ? "model" : "pattern"
				}));
				source = nonPlacement[0]?.source ?? null;
			} else if (id === "high_pay_no_experience") hits = highPayHits(adText, extraction);
			else if (id === "high_pay_light_work") hits = lightWorkHits(adText, extraction);
			else if (id === "advisory_destination") hits = [...advisoryMatches(adText).map((span) => ({
				span,
				via: "pattern"
			})), ...modelHits(id, adText, extraction)].filter((h) => !nonPlacement.some((m) => m.span.start < h.span.end && h.span.start < m.span.end));
			else if (id === "personal_recruiter") hits = personalRecruiterHits(adText, extraction);
			else if (id === "no_company") hits = has("personal_recruiter") ? [] : noCompanyHits(adText, extraction);
			else if (id === "not_on_p3mi_list" || id === "p3mi_suspended") {
				const reg = checkRegistry(adText, extraction?.company);
				hits = (id === "not_on_p3mi_list" ? reg.notListed : reg.found && !/^aktif$/i.test(reg.found.status) ? [reg.found.span] : []).map((span) => ({
					span,
					via: "pattern"
				}));
				source = REGISTRY_SOURCE;
			} else if (id === "fee_asked") hits = has("fee_before_contract") || has("fee_before_departure") ? [] : [...patternHits(id, adText), ...modelHits(id, adText, extraction)];
			else hits = [...patternHits(id, adText), ...modelHits(id, adText, extraction)];
			const flag = makeFlag(id, dedupeHits(hits), source);
			if (flag) flags.push(flag);
		}
		if (has("fee_before_contract")) return flags.filter((f) => !(f.id === "fee_before_departure" && overlapsFlag(f, flags.find((g) => g.id === "fee_before_contract"))));
		return flags;
	}
	function overlapsFlag(a, b) {
		return !!b && a.span.start < b.span.end && b.span.start < a.span.end;
	}
	function dedupeHits(hits) {
		const seen = /* @__PURE__ */ new Set();
		return hits.filter((h) => {
			const k = `${h.span.start}:${h.span.end}:${h.via}`;
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}
	function highPayHits(text, ex) {
		const noExp = patternHits("high_pay_no_experience", text);
		const modelNoExp = (ex?.promises ?? []).filter((p) => PATTERNS.high_pay_no_experience.some((re) => new RegExp(re.source, "iu").test(p.text)));
		if (noExp.length === 0 && modelNoExp.length === 0) return [];
		if (highPaySpans(text).length === 0) return [];
		const hits = [];
		if (noExp.length > 0) hits.push({
			span: noExp[0].span,
			via: "pattern"
		});
		if (modelNoExp.length > 0) hits.push({
			span: modelNoExp[0],
			via: "model"
		});
		return hits;
	}
	/** Very high pay for light office work (Polri checklist item 2): the flag points at the pay. */
	function lightWorkHits(text, ex) {
		const pay = highPaySpans(text);
		if (pay.length === 0) return [];
		const hits = [];
		if (new RegExp(LIGHT_WORK.source, "iu").test(text) || LIGHT_WORK_IT.test(text)) hits.push({
			span: pay[0],
			via: "pattern"
		});
		if (ex?.job && (new RegExp(LIGHT_WORK.source, "iu").test(ex.job.text) || LIGHT_WORK_IT.test(ex.job.text))) hits.push({
			span: pay[0],
			via: "model"
		});
		return hits;
	}
	/**
	* Wording of a job offer, in the raw text — the no-company rule never fires on text without it ("kerja bakti", a
	* recipe). Raw text only, like every rubric rule: the model's "not a job offer" reading can never switch a flag off.
	*/
	const JOB_OFFER = /\b(?:lowongan|loker|dibutuhkan|dicari|rekrut\p{L}*|direkrut|perekrut\p{L}*|gaji|upah|hiring|vacanc(?:y|ies)|salary|(?:di)?tawar(?:i|kan|an)\s+(?:pekerjaan|kerja|bekerja)|(?:bekerja|kerja|pekerjaan)\s+(?:di|ke|sebagai|dengan\s+gaji)|jobs?\s+(?:in|at|offer)|work\s+(?:in|at|as))\b/iu;
	/** The ad names no company and gives no contact (with a personal contact, the personal-recruiter rule fires instead). */
	function noCompanyHits(text, ex) {
		if (!JOB_OFFER.test(text)) return [];
		if (namesLegalCompany(text) || FOREIGN_COMPANY.test(text) || ex?.company) return [];
		const first = text.match(/^\s*([^\n]{1,80})/u);
		if (!first) return [];
		const start = (first.index ?? 0) + first[0].length - first[1].length;
		const span = {
			text: first[1],
			start,
			end: start + first[1].length
		};
		return ex ? [{
			span,
			via: "pattern"
		}, {
			span,
			via: "model"
		}] : [{
			span,
			via: "pattern"
		}];
	}
	/** An Indonesian legal-form name in the ad ("PT Maju", "CV Sinar") — but never "Kirim CV ke WA". */
	function namesLegalCompany(text) {
		for (const m of text.matchAll(new RegExp(LEGAL_COMPANY.source, "gu"))) if (!isCurriculumVitae(text, m.index ?? 0, m[0])) return true;
		return false;
	}
	function personalRecruiterHits(text, ex) {
		const hits = [];
		const contacts = [...text.matchAll(CONTACT)];
		if (!(namesLegalCompany(text) || FOREIGN_COMPANY.test(text)) && contacts.length > 0) {
			const m = contacts[0];
			hits.push({
				span: {
					text: m[0],
					start: m.index ?? 0,
					end: (m.index ?? 0) + m[0].length
				},
				via: "pattern"
			});
		}
		if (ex && !ex.company && ex.phones.length > 0) hits.push({
			span: ex.phones[0],
			via: "model"
		});
		return hits;
	}
	/** Normalised company name tokens (legal forms "PT." → "pt"), used by Tavily queries and the gate. */
	function companyTokens(company) {
		return normalise(company).replace(/\b(pt|cv)\./g, "$1").match(/[\p{L}\p{N}]+/gu) ?? [];
	}
	//#endregion
	//#region scripts/lab/sha256.ts
	/**
	* Browser stand-in for `node:crypto` in the landing lab bundle. The gate hashes a verified page's chunks with
	* createHash("sha256"); browsers have no synchronous SHA-256, so this is the FIPS 180-4 algorithm in plain code.
	* tests/lab.test.ts checks it against node:crypto.
	*/
	const K = new Uint32Array([
		1116352408,
		1899447441,
		3049323471,
		3921009573,
		961987163,
		1508970993,
		2453635748,
		2870763221,
		3624381080,
		310598401,
		607225278,
		1426881987,
		1925078388,
		2162078206,
		2614888103,
		3248222580,
		3835390401,
		4022224774,
		264347078,
		604807628,
		770255983,
		1249150122,
		1555081692,
		1996064986,
		2554220882,
		2821834349,
		2952996808,
		3210313671,
		3336571891,
		3584528711,
		113926993,
		338241895,
		666307205,
		773529912,
		1294757372,
		1396182291,
		1695183700,
		1986661051,
		2177026350,
		2456956037,
		2730485921,
		2820302411,
		3259730800,
		3345764771,
		3516065817,
		3600352804,
		4094571909,
		275423344,
		430227734,
		506948616,
		659060556,
		883997877,
		958139571,
		1322822218,
		1537002063,
		1747873779,
		1955562222,
		2024104815,
		2227730452,
		2361852424,
		2428436474,
		2756734187,
		3204031479,
		3329325298
	]);
	const rotr = (x, n) => x >>> n | x << 32 - n;
	function sha256Hex(bytes) {
		const H = new Uint32Array([
			1779033703,
			3144134277,
			1013904242,
			2773480762,
			1359893119,
			2600822924,
			528734635,
			1541459225
		]);
		const size = Math.ceil((bytes.length + 9) / 64) * 64;
		const m = new Uint8Array(size);
		m.set(bytes);
		m[bytes.length] = 128;
		const view = new DataView(m.buffer);
		const bits = bytes.length * 8;
		view.setUint32(size - 8, Math.floor(bits / 4294967296));
		view.setUint32(size - 4, bits >>> 0);
		const w = /* @__PURE__ */ new Uint32Array(64);
		for (let off = 0; off < size; off += 64) {
			for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
			for (let i = 16; i < 64; i++) {
				const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
				const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
				w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
			}
			let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
			for (let i = 0; i < 64; i++) {
				const t1 = h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] >>> 0;
				const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
				h = g;
				g = f;
				f = e;
				e = d + t1 >>> 0;
				d = c;
				c = b;
				b = a;
				a = t1 + t2 >>> 0;
			}
			H[0] += a;
			H[1] += b;
			H[2] += c;
			H[3] += d;
			H[4] += e;
			H[5] += f;
			H[6] += g;
			H[7] += h;
		}
		return Array.from(H, (x) => x.toString(16).padStart(8, "0")).join("");
	}
	/** The one call shape gate.ts uses: createHash("sha256").update(text, "utf8").digest("hex"). */
	function createHash(algorithm) {
		if (algorithm !== "sha256") throw new Error(`lab bundle: unsupported hash ${algorithm}`);
		const parts = [];
		const hash = {
			update(text) {
				parts.push(text);
				return hash;
			},
			digest() {
				return sha256Hex(new TextEncoder().encode(parts.join("")));
			}
		};
		return hash;
	}
	//#endregion
	//#region src/lib/verdict.ts
	/** A published report of harm. Matched on word boundaries over the normalised quote. */
	const NEGATIVE_TERMS = [
		{
			term: "penipuan",
			re: /\bpenipu(an)?\b/
		},
		{
			term: "TPPO",
			re: /\btppo\b/
		},
		{
			term: "perdagangan orang",
			re: /\bperdagangan orang\b/
		},
		{
			term: "korban",
			re: /\bkorban\b/
		},
		{
			term: "ilegal",
			re: /\bilegal\b/
		},
		{
			term: "tidak terdaftar",
			re: /\btidak terdaftar\b/
		},
		{
			term: "scam",
			re: /\bscam(mer|mers|ming)?\b/
		},
		{
			term: "trafficking",
			re: /\btrafficking\b|\btrafficked\b/
		}
	];
	/** The page says the name was misused by others, or denied. */
	const GUARD_TERMS = [
		{
			term: "mengatasnamakan",
			re: /\bmengatasnamakan\b/
		},
		{
			term: "mencatut",
			re: /\bmencatut\b/
		},
		{
			term: "akun/situs palsu",
			re: /\b(?:akun|website|situs|web|laman|halaman|logo)\s+(?:[\p{L}]+\s+)?palsu\b/u
		},
		{
			term: "membantah",
			re: /\bmembantah\b/
		},
		{
			term: "tidak terlibat",
			re: /\btidak terlibat\b/
		}
	];
	function negativeTerms(normalisedQuote) {
		return NEGATIVE_TERMS.filter((t) => t.re.test(normalisedQuote)).map((t) => t.term);
	}
	function guardTerms(normalisedQuote) {
		return GUARD_TERMS.filter((t) => t.re.test(normalisedQuote)).map((t) => t.term);
	}
	/** A line the verdict may use: verified and found by the company, phone or advisory lookups (not the pattern search). */
	function isVerdictInput(line) {
		return line.status === "verified" && line.purpose !== "pattern";
	}
	function isCompanyMatched(line) {
		return isVerdictInput(line) && line.entity && !line.entityCapped && line.entityKind === "company" && line.negative && !line.guard;
	}
	const FLAG_REASON = {
		tourist_visa: "tourist or visit visa offered for work",
		fee_before_contract: "a fee asked before a contract is signed",
		passport_retention: "the passport is held or handed over",
		fee_before_departure: "a fee asked before departure",
		high_pay_no_experience: "high pay with no experience needed",
		advisory_destination: "the destination is named in an official warning",
		personal_recruiter: "the recruiter is a personal number with no company named",
		visit_visa_holder: "the ad accepts visit-visa holders",
		non_placement_country: "the destination is not an official placement country for Indonesian workers",
		fee_asked: "a fee is asked to get the job",
		debt_bondage: "costs are advanced, then deducted from pay",
		high_pay_light_work: "very high pay for light office work",
		quick_departure: "a fast departure with no selection or training",
		no_company: "the ad names no company",
		not_on_p3mi_list: "the company is not on the official licensed-agency list",
		p3mi_suspended: "the agency is under a temporary suspension on the official list"
	};
	/** The NEVER-class rules; one with no recorded source is drawn and counted as CAUTION. */
	const NEVER_IDS = [
		"tourist_visa",
		"fee_before_contract",
		"passport_retention",
		"non_placement_country"
	];
	function decide(flags, lines, failedSteps) {
		const never = flags.filter((f) => f.class === "NEVER");
		const matched = lines.filter(isCompanyMatched);
		const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
		if (never.length > 0 || matched.length > 0) {
			const reasons = [...never.map((f) => `rule: ${FLAG_REASON[f.id]}`), ...matched.length > 0 ? [plural(new Set(matched.map((l) => l.url)).size, "published report naming this company", "published reports naming this company")] : []];
			return {
				verdict: "STOP",
				rule: `STOP — ${reasons.join(" + ")}`,
				reasons
			};
		}
		const caution = flags.filter((f) => f.class === "CAUTION");
		const entityOnly = lines.filter((l) => isVerdictInput(l) && l.entity && !isCompanyMatched(l));
		if (caution.length > 0 || entityOnly.length > 0 || failedSteps.length > 0) {
			const reasons = [
				...caution.map((f) => f.sourced || !NEVER_IDS.includes(f.id) ? FLAG_REASON[f.id] : `${FLAG_REASON[f.id]} (no official source recorded for this rule)`),
				...entityOnly.some((l) => l.guard) ? ["a page says this name was used by others or denied"] : [],
				...entityOnly.some((l) => !l.guard && !l.entityCapped && !l.negative) ? ["a page names this company without reporting harm"] : [],
				...entityOnly.some((l) => !l.guard && l.entityCapped) ? [entityOnly.some((l) => l.entityKind === "phone") ? "a page mentions this phone number" : "a page mentions a similar or generic name — check the licence number"] : [],
				...failedSteps.map((s) => `step not completed: ${s}`)
			];
			return {
				verdict: "VERIFY_FIRST",
				rule: `VERIFY FIRST — ${reasons.join("; ")}`,
				reasons
			};
		}
		return {
			verdict: "NO_RED_FLAGS_FOUND",
			rule: "NO RED FLAGS FOUND — every step completed and no rule fired. This is not a guarantee.",
			reasons: []
		};
	}
	//#endregion
	//#region src/lib/gate.ts
	/**
	* The quote gate — the mechanism. The model chooses where to look; code decides what is shown.
	*
	* A proposed evidence line `{url, quote, claim}` is VERIFIED only if (architecture.md contract):
	*   - the URL is one Tavily returned in THIS run,
	*   - the quote has at least 6 words,
	*   - normalise(quote) is a substring of normalise(c) for ONE chunk c Tavily returned for that URL:
	*       search raw_content (include_raw_content:"text") is one chunk — the whole page text;
	*       search `content` and extract `raw_content` (query-ranked) are split on the "[...]" separator.
	* A line that fails is dropped and shown greyed. Only the quote is gated; the claim is "Awas's reading".
	*
	* For a verified line the gate also computes the three facts the verdict reads:
	*   entity   — the quote names the ad's company (full name incl. legal form, contiguous on token boundaries, not
	*              continued by another capitalised word in the raw page text) or contains an extracted phone's last
	*              9 digits inside one number. Phone-only, generic-word names and ALL-CAPS text are "capped": they can
	*              raise VERIFY FIRST but never STOP.
	*   negative — a negative-event term (verdict.ts NEGATIVE_TERMS).
	*   guard    — a guard term anywhere, or "bukan" within 5 words before the company name (misused or denied).
	*/
	const MIN_QUOTE_WORDS = 6;
	/** Words that do not make a company name distinctive on their own (beyond its legal form). Tuned on the dev set. */
	const GENERIC_NAME_WORDS = /* @__PURE__ */ new Set([
		"sejahtera",
		"jaya",
		"abadi",
		"mandiri",
		"global",
		"indonesia",
		"international",
		"internasional",
		"makmur",
		"sentosa",
		"utama",
		"maju",
		"bersama",
		"sukses",
		"karya",
		"putra",
		"putri",
		"mulia",
		"persada",
		"nusantara",
		"group",
		"grup",
		"perkasa",
		"raya",
		"sakti",
		"agung",
		"baru",
		"prima",
		"cipta",
		"mitra",
		"sarana",
		"lestari",
		"bersaudara",
		"mega"
	]);
	const LEGAL_FORMS = /* @__PURE__ */ new Set([
		"pt",
		"cv",
		"tbk",
		"ud",
		"ltd",
		"co",
		"inc",
		"llc",
		"sdn",
		"bhd",
		"plc",
		"corp",
		"company",
		"corporation"
	]);
	const PURPOSE_RANK = {
		company: 0,
		phone: 1,
		advisory: 2,
		pattern: 3
	};
	/** Add Tavily text to the run's corpus. `rankedText` is split on the "[...]" separator. */
	function addToCorpus(corpus, url, purpose, opts) {
		const doc = corpus.get(url) ?? {
			url,
			title: opts.title,
			chunks: [],
			purpose
		};
		if (PURPOSE_RANK[purpose] < PURPOSE_RANK[doc.purpose]) doc.purpose = purpose;
		if (!doc.title && opts.title) doc.title = opts.title;
		const push = (text, basis) => {
			const t = text.trim();
			if (t && !doc.chunks.some((c) => c.text === t && c.basis === basis)) doc.chunks.push({
				text: t,
				basis
			});
		};
		if (opts.pageText) push(opts.pageText, "page");
		if (opts.rankedText) for (const part of opts.rankedText.split("[...]")) push(part, "ranked");
		corpus.set(url, doc);
	}
	function sha256(s) {
		return createHash("sha256").update(s, "utf8").digest("hex");
	}
	function chunkSetHash(doc, basis) {
		return sha256(doc.chunks.filter((c) => c.basis === basis).map((c) => c.text).join("\n[...]\n"));
	}
	function dropped(p, reason, purpose) {
		return {
			url: p.url,
			quote: p.quote,
			claim: p.claim,
			status: "dropped",
			reason,
			entity: false,
			entityCapped: false,
			entityKind: null,
			negative: false,
			guard: false,
			chunkBasis: "page",
			purpose
		};
	}
	function gateLine(p, corpus, ctx) {
		const doc = corpus.get(p.url);
		if (!doc) return dropped(p, "url_not_returned");
		if (words(p.quote).length < 6) return dropped(p, "too_short", doc.purpose);
		const nq = normalise(p.quote);
		if (!nq) return dropped(p, "too_short", doc.purpose);
		for (const chunk of doc.chunks) {
			const nc = normaliseWithMap(chunk.text);
			const at = nc.text.indexOf(nq);
			if (at < 0) continue;
			const rawStart = nc.map[at];
			const rawEnd = nc.map[at + nq.length - 1] + 1;
			const rawQuote = chunk.text.slice(rawStart, rawEnd);
			const entity = entityMatch(nq, at, nc, chunk.text, ctx);
			return {
				url: p.url,
				title: doc.title,
				quote: rawQuote,
				claim: p.claim,
				status: "verified",
				entity: entity.matched,
				entityCapped: entity.capped,
				entityKind: entity.kind,
				negative: negativeTerms(nq).length > 0,
				guard: guardTerms(nq).length > 0 || entity.bukanBefore,
				chunkBasis: chunk.basis,
				pageSha256: chunkSetHash(doc, chunk.basis),
				matchOffset: rawStart,
				fragmentUrl: fragmentUrl(p.url, rawQuote),
				purpose: doc.purpose
			};
		}
		return dropped(p, normalise(doc.chunks.map((c) => c.text).join(" ")).includes(nq) ? "spans_chunks" : "not_in_page", doc.purpose);
	}
	/** Token runs with their offsets in a normalised string. */
	function tokenise(s) {
		return [...s.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({
			t: m[0],
			start: m.index ?? 0,
			end: (m.index ?? 0) + m[0].length
		}));
	}
	function entityMatch(nq, at, nc, rawChunk, ctx) {
		let best = {
			matched: false,
			capped: false,
			kind: null,
			bukanBefore: false
		};
		if (ctx.company) {
			const name = companyTokens(ctx.company);
			const qt = tokenise(nq);
			if (name.length > 0) for (let i = 0; i + name.length <= qt.length; i++) {
				if (!name.every((tok, k) => qt[i + k].t === tok)) continue;
				const last = qt[i + name.length - 1];
				const rawFrom = nc.map[at + qt[i].start];
				const rawTo = nc.map[at + last.end - 1] + 1;
				const occurrence = rawChunk.slice(rawFrom, rawTo);
				const nextWord = rawChunk.slice(rawTo).match(/^([ \t ]+)([\p{L}][\p{L}\p{N}]*)/u)?.[2] ?? "";
				const allCaps = !/\p{Ll}/u.test(occurrence) && (nextWord === "" || !/\p{Ll}/u.test(nextWord));
				if (!allCaps && /^\p{Lu}/u.test(nextWord)) continue;
				const distinctive = name.filter((t) => !LEGAL_FORMS.has(t));
				const generic = distinctive.length === 0 || distinctive.every((t) => GENERIC_NAME_WORDS.has(t));
				const before = qt.slice(Math.max(0, i - 5), i).map((x) => x.t);
				const result = {
					matched: true,
					capped: allCaps || generic,
					kind: "company",
					bukanBefore: before.includes("bukan")
				};
				if (!result.capped) return result;
				if (!best.matched) best = result;
			}
		}
		for (const phone of ctx.phones) {
			const last9 = digits(phone).slice(-9);
			if (last9.length < 9) continue;
			for (const m of nq.matchAll(/\+?\d[\d\s.-]{6,}\d/g)) if (digits(m[0]).includes(last9)) return best.matched ? best : {
				matched: true,
				capped: true,
				kind: "phone",
				bukanBefore: false
			};
		}
		return best;
	}
	/**
	* A text-fragment link: `url#:~:text=<start>,<end>`, the first and last ~4 words of the quote as it appears in the
	* page text, percent-encoded (the "-" and "," of text-fragment syntax are escaped, so hyphenated Indonesian words
	* like "iming-iming" survive). The browser scrolls to and highlights the quote; if the rendered page differs, it
	* simply opens the page top — the Playwright check (scripts) records which links actually highlight.
	*/
	function fragmentUrl(url, rawQuote) {
		const enc = (s) => encodeURIComponent(s).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
		const w = rawQuote.split(/\s+/).filter(Boolean);
		const base = url.split("#")[0];
		if (w.length <= 8) return `${base}#:~:text=${enc(w.join(" "))}`;
		return `${base}#:~:text=${enc(w.slice(0, 4).join(" "))},${enc(w.slice(-4).join(" "))}`;
	}
	//#endregion
	exports.FLAG_LABELS = FLAG_LABELS;
	exports.MIN_QUOTE_WORDS = MIN_QUOTE_WORDS;
	exports.addToCorpus = addToCorpus;
	exports.decide = decide;
	exports.evaluateRubric = evaluateRubric;
	exports.fragmentUrl = fragmentUrl;
	exports.gateLine = gateLine;
	exports.normalise = normalise;
	exports.words = words;
	return exports;
})({});
