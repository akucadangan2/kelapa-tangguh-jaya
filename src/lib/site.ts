/** Isi landing page. Ubah di sini tanpa menyentuh tampilan. Isian kosong ("") tidak ditampilkan. */
export const SITE = {
  name: "Kelapa Tangguh Jaya",
  shortName: "Kelapa Tangguh Jaya",
  tagline: "Pembeli kopra, tempurung dan arang tempurung langsung dari petani",
  region: "Minahasa, Manado dan sekitarnya",
  address: "Mokupa Jaga 6, samping Maesa Mart",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Maesa+Mart+c",
  hours: "08.00–20.00 WITA",

  // Nomor WhatsApp format 62..., tanpa + dan spasi
  whatsappCS: "6285284884889",
  csDisplay: "0852-848-848-89",
  whatsappFarmer: "", // isi nanti: nomor khusus petani yang ingin menjual
  whatsappBuyer: "", // isi nanti: nomor khusus pabrik/pembeli

  phone: "", // isi bila ada nomor telepon kantor
  email: "", // isi bila ada email usaha
};

export const waLink = (text: string, number?: string) =>
  `https://wa.me/${number || SITE.whatsappCS}?text=${encodeURIComponent(text)}`;