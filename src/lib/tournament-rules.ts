import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  legacyRuleToHtml,
  parseRulePoints,
  sanitizeRulesHtml,
  type RulePoint,
} from "@/lib/rules-html";

export type { RulePoint };
export { parseRulePoints };

/** Header dokumen peraturan default */
export const DEFAULT_RULES_HEADER = {
  eyebrow: "Dokumen resmi",
  title: "Peraturan Turnamen",
  subtitle:
    "PERATURAN & TATA TERTIB TURNAMEN MINISOCCER\nKategori: Tingkat SD.",
} as const;

/**
 * Peraturan default — diimpor dari
 * RULES TURNAMEN MINISOCCER KATAR MEKARJAYA CUP 2026.pdf
 */
export const DEFAULT_TOURNAMENT_RULES: {
  pasalNumber: number;
  title: string;
  description: string;
  points: RulePoint[];
}[] = [
  {
    pasalNumber: 1,
    title: "Ketentuan umum & pendaftaran",
    description: [
      "<p><strong>Pasal 1 — Ketentuan umum &amp; pendaftaran</strong></p>",
      "<ol>",
      "<li><strong>Status peserta</strong><br />Peserta adalah anak-anak yang berdomisili di wilayah RW masing-masing, dibuktikan dengan Raport (tampak depan / info NISN), Kartu Keluarga (KK) / Kartu Identitas Anak (KIA).</li>",
      "<li><strong>Batasan usia</strong><br />Berstatus sebagai siswa Sekolah Dasar (SD) maksimal kelas 6.</li>",
      "<li><strong>Komposisi tim</strong><br />Setiap RW berhak mengirimkan maksimal 1 atau 2 tim (sesuai kesepakatan kuota panitia).</li>",
      "<li><strong>Kuota pemain</strong><br />Setiap tim wajib mendaftarkan maksimal 15 pemain (8 pemain inti di lapangan dan 7 pemain cadangan) serta didampingi oleh minimal 1 orang Official/Pelatih dewasa.</li>",
      "<li><strong>Pendaftaran ulang</strong><br />Setiap tim harus menyerahkan berkas administrasi (fotokopi KK/rapor sekolah) paling lambat tanggal 25 Oktober 2026 atau selambat-lambatnya saat Technical Meeting. Pemain yang sudah terdaftar tidak dapat diganti selama turnamen berlangsung.</li>",
      "</ol>",
    ].join(""),
    points: [],
  },
  {
    pasalNumber: 2,
    title: "Sistem pertandingan & durasi",
    description: [
      "<p><strong>Pasal 2 — Sistem pertandingan &amp; durasi</strong></p>",
      "<ol>",
      "<li><strong>Format turnamen</strong><br />Menggunakan Sistem Grup (atau penuh kompetisi / atau sistem gugur jika jumlah RW lebih dari 20 team).</li>",
      "<li><strong>Durasi pertandingan</strong><br />Babak Penyisihan s.d. Perempat Final: 2 × 10 menit (istirahat 3–5 menit).<br />Semifinal &amp; Final: 2 × 15 menit (istirahat 5 menit).</li>",
      "<li><strong>Ketentuan hasil imbang</strong><br />Jika pertandingan berakhir seri hingga waktu normal habis, langsung dilanjutkan dengan Adu Penalti (3 orang penendang utama dari setiap tim). Jika masih imbang, dilakukan sudden death (koin tos untuk memilih penendang/kiper).</li>",
      "<li><strong>Kemenangan Walk Out (WO)</strong><br />Tim dinyatakan kalah WO (skor otomatis 0–3) apabila tidak hadir di lapangan atau jumlah pemain kurang dari 5 orang setelah lewat 10 menit dari jadwal sepak mula (kick-off).</li>",
      "</ol>",
    ].join(""),
    points: [],
  },
  {
    pasalNumber: 3,
    title: "Peraturan permainan (Laws of the Game)",
    description: [
      "<p><strong>Pasal 3 — Peraturan permainan</strong></p>",
      "<ol>",
      "<li><strong>Jumlah pemain di lapangan</strong><br />Pertandingan menggunakan format 8 vs 8 (7 pemain posisi + 1 penjaga gawang).</li>",
      "<li><strong>Pergantian pemain (substitution)</strong><br />Bersifat bebas (rolling substitution) dan tidak terbatas. Pergantian harus dilakukan di area garis tengah setelah pemain yang digantikan keluar lapangan terlebih dahulu.</li>",
      "<li><strong>Peraturan offside</strong><br />TIDAK ADA OFFSIDE dalam turnamen mini soccer ini.</li>",
      "<li><strong>Memulai pertandingan</strong><br />Diawali dengan kick-off di titik tengah lapangan. Gol yang tercipta langsung dari kick-off dinyatakan sah.</li>",
      "<li><strong>Bola keluar lapangan (out)</strong><br />Jika bola keluar lewat garis samping, permainan dilanjutkan dengan lemparan ke dalam. Kaki penendang tidak boleh melewati garis dan bola harus diam.<br />Bola keluar lewat garis belakang oleh tim bertahan melahirkan Tendangan Sudut (Corner kick).</li>",
      "<li><strong>Aturan penjaga gawang</strong><br />Kiper hanya boleh menangkap bola di dalam area kotak penalti sendiri.<br />Jika menerima operan sengaja menggunakan kaki dari teman satu tim (back-pass), kiper tidak boleh menangkap bola menggunakan tangan (hukuman: tendangan bebas tidak langsung).</li>",
      "</ol>",
    ].join(""),
    points: [],
  },
  {
    pasalNumber: 4,
    title: "Peralatan & perlengkapan",
    description: [
      "<p><strong>Pasal 4 — Peralatan &amp; perlengkapan</strong></p>",
      "<ol>",
      "<li><strong>Seragam tim</strong><br />Setiap tim wajib memakai kostum/seragam olahraga yang seragam dan memiliki nomor punggung yang jelas.</li>",
      "<li><strong>Rompi tim</strong><br />Jika kedua tim memiliki warna seragam yang mirip/sama, tim yang disebut kedua dalam jadwal wajib memakai rompi yang disediakan oleh panitia.</li>",
      "<li><strong>Alas kaki</strong><br />Pemain wajib menggunakan sepatu olahraga (sepatu mini soccer, futsal, atau sepatu bola biasa berpul karet pendek). Dilarang menggunakan pul besi demi keamanan anak-anak.</li>",
      "<li><strong>Pelindung</strong><br />Setiap pemain sangat disarankan memakai pelindung tulang kering (shin guards / deker) demi keselamatan.</li>",
      "<li><strong>Aksesoris</strong><br />Pemain dilarang memakai perhiasan atau aksesoris berbahaya seperti kalung, gelang, jam tangan, atau anting saat bertanding.</li>",
      "<li><strong>Spesifikasi alat</strong><br />Menggunakan bola standar Ukuran No. 4 khusus untuk anak-anak.</li>",
      "</ol>",
    ].join(""),
    points: [],
  },
  {
    pasalNumber: 5,
    title: "Pelanggaran, sanksi, & denda",
    description: [
      "<p><strong>Pasal 5 — Pelanggaran, sanksi, &amp; denda</strong></p>",
      "<p>Mengingat ini adalah turnamen anak-anak, sanksi ditekankan pada aspek edukasi disiplin namun tetap tegas:</p>",
      "<ol>",
      "<li><strong>Kartu kuning (peringatan)</strong><br />Diberikan untuk pelanggaran keras, protes berlebihan, atau tindakan tidak sportif. Pemain yang mendapat kartu kuning dikenakan denda administrasi sebesar Rp25.000,-.</li>",
      "<li><strong>Kartu merah (pengusiran)</strong><br />Diberikan jika pemain melakukan pelanggaran sangat keras, pemukulan, atau berkata kasar. Pemain yang mendapat kartu merah keluar lapangan, denda sebesar Rp50.000,-, dan dilarang bermain dalam 1 pertandingan berikutnya.</li>",
      "<li><strong>Akumulasi kartu</strong><br />Pemain yang mendapatkan 3 kartu kuning di 3 pertandingan yang berbeda, otomatis dilarang bermain pada 1 pertandingan berikutnya.</li>",
      "</ol>",
    ].join(""),
    points: [],
  },
  {
    pasalNumber: 6,
    title: "Tata tertib suporter & official",
    description: [
      "<p><strong>Pasal 6 — Tata tertib suporter &amp; official</strong></p>",
      "<ol>",
      "<li><strong>Sanksi club</strong><br />Apabila club/Team RW melanggar peraturan yang telah ditetapkan oleh panitia pelaksana (utamanya terkait syarat pendaftaran pemain), maka panitia berhak memberikan sanksi tegas berupa DISKUALIFIKASI serta uang pendaftaran dinyatakan hangus.</li>",
      "<li><strong>Ketertiban area lapangan</strong><br />Hanya pemain terdaftar dan maksimal 2 orang Official (Pelatih &amp; Medis) yang diperbolehkan berada di bench (bangku cadangan) pemain.</li>",
      "<li><strong>Perilaku suporter</strong><br />Orang tua, suporter, dan penonton dari masing-masing RW dilarang keras memasuki lapangan pertandingan selama laga berjalan.</li>",
      "<li><strong>Larangan provokasi</strong><br />Suporter, pelatih, maupun pemain dilarang mengeluarkan kata-kata kotor, hinaan fisik, rasisme, atau memprovokasi tim lawan serta wasit.</li>",
      "<li><strong>Sanksi suporter</strong><br />Jika terjadi keributan atau pelemparan benda ke dalam lapangan oleh suporter salah satu RW, panitia berhak memberikan peringatan keras hingga mendiskualifikasi tim RW yang bersangkutan dari turnamen.</li>",
      "</ol>",
    ].join(""),
    points: [],
  },
  {
    pasalNumber: 7,
    title: "Penutup",
    description: [
      "<p><strong>Pasal 7 — Penutup</strong></p>",
      "<ol>",
      "<li><strong>Keputusan wasit</strong><br />Keputusan wasit di lapangan adalah mutlak dan tidak dapat diganggu gugat.</li>",
      "<li><strong>Hal yang belum diatur</strong><br />Hal-hal yang belum diatur atau perlu penyesuaian darurat dalam aturan ini akan diputuskan oleh Panitia Pelaksana melalui kesepakatan bersama pada saat Technical Meeting.</li>",
      "</ol>",
    ].join(""),
    points: [],
  },
];

export function hasAcceptedCurrentRules(params: {
  rulesVersion: number;
  rulesAcceptedVersion: number | null | undefined;
}): boolean {
  return (
    params.rulesAcceptedVersion != null &&
    params.rulesAcceptedVersion === params.rulesVersion
  );
}

export function ruleBodyHtml(rule: {
  description: string;
  points: unknown;
}): string {
  const desc = rule.description.trim();
  const points = parseRulePoints(rule.points);
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(desc);
  if (looksHtml) return sanitizeRulesHtml(desc);
  return sanitizeRulesHtml(legacyRuleToHtml(desc, points));
}

/** Ganti seluruh pasal turnamen dengan isi dari PDF default. */
export async function replaceTournamentRulesFromDefault(tournamentId: string) {
  await prisma.$transaction([
    prisma.tournamentRule.deleteMany({ where: { tournamentId } }),
    prisma.tournamentRule.createMany({
      data: DEFAULT_TOURNAMENT_RULES.map((r) => ({
        tournamentId,
        pasalNumber: r.pasalNumber,
        title: r.title,
        description: r.description,
        points: [] as unknown as Prisma.InputJsonValue,
      })),
    }),
    prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        rulesVersion: { increment: 1 },
        rulesHeaderEyebrow: DEFAULT_RULES_HEADER.eyebrow,
        rulesHeaderTitle: DEFAULT_RULES_HEADER.title,
        rulesHeaderSubtitle: DEFAULT_RULES_HEADER.subtitle,
      },
    }),
  ]);
}

/** Seed pasal default jika turnamen belum punya. */
export async function ensureDefaultTournamentRules(tournamentId: string) {
  const count = await prisma.tournamentRule.count({
    where: { tournamentId },
  });
  if (count > 0) return;

  await prisma.$transaction([
    prisma.tournamentRule.createMany({
      data: DEFAULT_TOURNAMENT_RULES.map((r) => ({
        tournamentId,
        pasalNumber: r.pasalNumber,
        title: r.title,
        description: r.description,
        points: [] as unknown as Prisma.InputJsonValue,
      })),
    }),
    prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        rulesHeaderEyebrow: DEFAULT_RULES_HEADER.eyebrow,
        rulesHeaderTitle: DEFAULT_RULES_HEADER.title,
        rulesHeaderSubtitle: DEFAULT_RULES_HEADER.subtitle,
      },
    }),
  ]);
}

export async function bumpTournamentRulesVersion(tournamentId: string) {
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { rulesVersion: { increment: 1 } },
  });
}
