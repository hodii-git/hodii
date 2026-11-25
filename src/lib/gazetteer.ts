/** Well-known Kenyan estates and towns with their county number, so common places resolve even when the map or database is unreachable. */
const G: Record<number, string[]> = {
  47: ["Kilimani", "Kileleshwa", "Lavington", "Westlands", "Karen", "Runda", "Muthaiga", "Parklands", "Kasarani", "Embakasi", "Langata", "South B", "South C", "Donholm", "Buruburu", "Eastleigh", "Roysambu", "Kahawa", "Lang'ata", "Upper Hill", "Kitisuru", "Gigiri", "Spring Valley", "Loresho", "Riverside", "Hurlingham", "Ngara", "Pangani", "Umoja", "Kayole", "Ruai", "Githurai", "Zimmerman", "Mountain View", "Nairobi West", "Madaraka", "Kibera", "Dagoretti", "Kawangware", "Syokimau Road", "Thome", "Garden Estate", "Ridgeways", "Lower Kabete", "Rhapta Road", "Mombasa Road", "Industrial Area", "Kangemi", "Woodley", "Jamhuri", "Ngong Road", "Valley Arcade", "Nyari", "Kyuna"],
  22: ["Ruiru", "Thika", "Juja", "Kikuyu", "Limuru", "Ruaka", "Kiambu Town", "Kiambu Road", "Banana", "Githunguri", "Gatundu", "Tigoni", "Kinoo", "Wangige", "Kabete", "Lari", "Karuri", "Membley", "Runda Mumwe", "Mwihoko"],
  34: ["Kitengela", "Ongata Rongai", "Rongai", "Ngong", "Kiserian", "Isinya", "Kajiado Town", "Athi River Kitengela", "Namanga", "Kaputiei"],
  16: ["Syokimau", "Athi River", "Mlolongo", "Machakos Town", "Katani", "Joska", "Tala", "Kangundo", "Matuu"],
  1: ["Nyali", "Bamburi", "Mtwapa Road", "Likoni", "Tudor", "Kizingo", "Shanzu", "Changamwe", "Mikindani", "Old Town"],
  2: ["Diani", "Ukunda", "Msambweni", "Kinondo", "Shimoni"],
  3: ["Malindi", "Watamu", "Mtwapa", "Kilifi Town", "Mnarani", "Vipingo", "Takaungu", "Mariakani"],
  32: ["Naivasha", "Nakuru Town", "Gilgil", "Molo", "Njoro", "Nakuru CBD", "Milimani", "Lanet", "Section 58"],
  42: ["Milimani Kisumu", "Kisumu CBD", "Mamboleo", "Nyalenda", "Kondele", "Riat"],
  27: ["Eldoret Town", "Elgon View", "Kapseret", "Langas", "Kimumu", "Huruma"],
  12: ["Meru Town", "Makutano", "Maua", "Nkubu"],
  19: ["Nyeri Town", "Karatina", "Naro Moru", "Othaya"],
  31: ["Nanyuki", "Rumuruti", "Dol Dol"],
  21: ["Murang'a Town", "Kenol", "Kangari"],
  14: ["Embu Town", "Runyenjes", "Kiritiri"],
};
export type Gaz = { name: string; code: number };
export const GAZETTEER: Gaz[] = Object.entries(G).flatMap(([c, names]) => names.map((name) => ({ name, code: Number(c) })));
