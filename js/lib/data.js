// =============================================================================
// DATA — ett register över inladdningsbara dataset
// =============================================================================
//
// Både galleriet och presentationerna hämtar data härifrån:
//
//   import { ladda } from "../js/lib/data.js";
//   const bef = await ladda("befolkning-kommuner");
//
// Sökvägarna löses mot den här filen (import.meta.url), så samma anrop fungerar
// från vilken sida som helst — /galleri/, /presentationer/nagot/ eller roten.
// Varje dataset hämtas en gång och cachas.
//
// Två sorters poster:
//   • fil     — en JSON-fil under data/demo/
//   • harledd — räknas fram ur andra dataset (pivot, andelar, rangordning)
//
// Lägga till eget dataset: släpp JSON:en i data/demo/ och lägg till en post här
// med `falt` ifyllt — då dyker den upp i galleriets datalista också.
// =============================================================================

const BAS = new URL("../../data/", import.meta.url);
const cache = new Map();

export const DATASET = {
  "befolkning-kommuner": {
    fil: "demo/befolkning-kommuner.json",
    namn: "Befolkning per kommun 1970–2025",
    falt: "{ år, kommun, befolkning, index }",
    kalla: "SCB, befolkningsstatistik",
    om: "Hallands sex kommuner, ett värde per år. Index där 1970 = 100."
  },
  "kommuner-riket": {
    fil: "demo/kommuner-riket.json",
    namn: "Sveriges kommuner",
    falt: "{ kommun, län, befolkning }",
    kalla: "SCB, folkmängd 2024",
    om: "Alla 290 kommuner med län — underlag för fördelningsgrafer."
  },
  "tatorter": {
    fil: "demo/tatorter.json",
    namn: "Tätorter i Halland",
    falt: "{ år, tatort, kommun, befolkning }",
    kalla: "SCB, tätortsavgränsning",
    om: "92 tätorter, mätpunkter 2000, 2010 och 2024. Källfilen innehåller en pseudorad \"Landsbygd\" för befolkningen utanför tätort — den är utplockad hit och ligger i \"landsbygd\" i stället, så att facetter och rangordningar inte förorenas."
  },
  "landsbygd": {
    fil: "demo/landsbygd.json",
    namn: "Befolkning utanför tätort",
    falt: "{ år, befolkning }",
    kalla: "SCB, tätortsavgränsning",
    om: "Landsbygdsresten — Hallands befolkning som inte bor i någon tätort. 2024 var det 58 540 personer, drygt 17 procent."
  },
  "typologi": {
    fil: "demo/typologi.json",
    namn: "Befolkning per ortstypologi",
    falt: "{ typologi, år, befolkning }",
    kalla: "SCB / egen typologi",
    om: "Innerstad, ytterstad, tätort, landsbygd över tid."
  },
  "upplatelseform": {
    fil: "demo/upplatelseform.json",
    namn: "Bostäder per upplåtelseform",
    falt: "{ ar, kommun, upplatelseform, antal, andel }",
    kalla: "SCB, bostadsbeståndet",
    om: "Äganderätt, bostadsrätt, hyresrätt per kommun och år."
  },
  "kommuner-nyckeltal": {
    fil: "demo/kommuner-nyckeltal.json",
    namn: "Nyckeltal per kommun",
    falt: "{ kommun, kod, befolkning, tillvaxt_1970, tillvaxt_2015, tatortsgrad, storsta_tatort }",
    kalla: "Härlett ur befolkning- och tätortsdata",
    om: "En rad per kommun. `kod` är kommunkod och kopplar mot kartan."
  },
  "halland-topo": {
    fil: "halland-kommuner.topojson",
    namn: "Halland som TopoJSON",
    falt: "objects.kommuner → { KnKod, KnNamn, LnKod }",
    kalla: "okfse/sweden-geojson, filtrerad på län 13",
    om: "Sex kommuner med delade bågar, så inre och yttre gränser kan ritas var för sig."
  },
  "befolkning-sverige": {
    fil: "scb/befolkning-sverige.json",
    namn: "Folkmängd i alla kommuner och regioner 1990–2024",
    falt: "{ år, kod, region, typ, befolkning }",
    kalla: "SCB, BefolkningNy (BE0101N1) — hämtad via R/hamta-scb.R",
    om: "290 kommuner, 21 län och riket, totalsiffror ett värde per år. `kod` är 4-siffrig Kolada-kod (\"0000\" riket, \"0013\" Hallands län). Nuvarande indelning för alla år: kommuner bildade efter 1990 har värdet 0 före bildandet. Halland växte 35,5 procent 1990–2024, riket 23,2."
  },
  "befolkning-sysselsatta": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/befolkning-sysselsatta.json",
    namn: "Befolkning och sysselsatta 1990–2024",
    falt: "{ år, kod, region, typ, befolkning, syss_dag, syss_natt, kalla }",
    kalla: "SCB BefolkningNy + dagbef90/RAMS/BAS — byggd av presentationer/dragning_lansstyrelsen_260902/bearbeta.R",
    om: "290 kommuner, 21 län och riket. `befolkning` avser alla åldrar; `syss_dag` och `syss_natt` (sysselsatt dag- respektive nattbefolkning) avser 20–64 år — kvoten mellan dem är ingen sysselsättningsgrad. `kalla` är dagbef90 1990–1992, RAMS 1993–2021 och BAS från 2022 (tidsseriebrott RAMS/BAS). `syss_natt` saknas 1990–1992, och sju kommuner saknar `syss_dag` 1990–1992 (bildade senare, eller Heby). I Halland växte befolkningen 35,5 procent 1990–2024 men dagbefolkningen bara 24,2 — 1990 var toppen före 90-talskrisen."
  },
  "valfard-indikatorer": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/valfard-indikatorer.json",
    namn: "Välfärdsindikatorer, senaste år",
    falt: "{ omrade, indikator, kpi_id, enhet, riktning, år, kod, region, typ, varde }",
    kalla: "SCB, Folkhälsomyndigheten, Kolada via kommundata — byggd av presentationer/dragning_lansstyrelsen_260902/bearbeta-valfard.R",
    om: "Åtta utfallsmått längs folkhälsopolitikens målområden (hälsa, utbildning, arbete, inkomst) för 290 kommuner, 21 regioner och riket, senaste år per indikator (2023–2025). `riktning` säger om högre eller lägre är bättre. Självskattad hälsa saknas för 53 små kommuner. Halland är bäst av 21 regioner i självskattad hälsa (75 %) och lägst andel med varaktigt låg ekonomisk standard (5,5 %), men 7:e i eftergymnasial utbildning (44,8 % mot rikets 47,7)."
  },
  "brp-plus": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/brp-plus.json",
    namn: "BRP+ livskvalitet och hållbarhet, senaste år",
    falt: "{ niva, år, kod, region, typ, livskvalitet, hallbarhet, senaste }",
    kalla: "Tillväxtverket, BRP+ via Kolada v3 (N00343/N00383 regionindex, N00310/N00373 kommunindex) — byggd av presentationer/dragning_lansstyrelsen_260902/bearbeta-brp.R",
    om: "Tillväxtverkets sammanvägda index för livskvalitet (12 teman) och hållbarhet (ekonomi, miljö, social), skala 0–100 där 100 = bäst i jämförelsegruppen på varje indikator. `niva` skiljer regionindexet (21 regioner + riket) från kommunindexet (290 kommuner + riket) — de är normaliserade i var sin grupp och riket får olika värden i dem (51,2/47,9 mot 55,4/52,7 för 2025). Kolada har bara stämpelår 2025. Halland är 3:e av 21 regioner i livskvalitet (64,7) och 7:e i hållbarhet (47,9, samma som riket). Kungsbacka är 8:e av 290 kommuner i livskvalitet, Hylte 202:a."
  },
  "brp-plus-teman": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/brp-plus-teman.json",
    namn: "BRP+ per tema, regioner",
    falt: "{ del, tema, kpi_id, år, kod, region, typ, varde, rang }",
    kalla: "Tillväxtverket, BRP+ via Kolada v3 (regionindex per tema) — byggd av presentationer/dragning_lansstyrelsen_260902/bearbeta-brp-teman.R",
    om: "De 12 livskvalitetstemana, de 3 hållbarhetstemana och de två sammanvägda indexen (`tema` = \"Totalt\") för 21 regioner och riket, stämpelår 2025. `rang` är plats bland regionerna (1 = högst), NA för riket. Totalindexet är exakt medelvärdet av temana. Halland är 1:a i individuellt välbefinnande (82) och 2:a i arbete och löner (70), men 21:a och sist i miljökvalitet (27,5 mot rikets 54,8) och 13:e i ekonomisk hållbarhet (23)."
  },
  "brp-plus-korrigerad": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/brp-plus-korrigerad.json",
    namn: "BRP+ omräknat med bullerindikatorn rättad",
    falt: "{ niva, del, tema, kod, region, typ, varde, varde_korr, rang, rang_korr }",
    kalla: "Tillväxtverkets beräkningsfil brpplus_stand_maxmin_final.csv (github.com/Analytikernatverket/brp_plus), omräknad av presentationer/dragning_lansstyrelsen_260902/bearbeta-brp-korrigerad.R",
    om: "Alla teman och totalindex på både region- och kommunnivå (`niva`), stämpelår 2025. `varde`/`rang` återskapar Koladas publicerade index ur Tillväxtverkets fil (avvikelse < 1e-12); `varde_korr`/`rang_korr` är samma beräkning med indikatorn störd sömn av trafikbuller (N01456) vänd så att mindre buller ger högre poäng — i källan räknas den som \"högre är bättre\". Riket är medelvärdet av enheterna, som i källan. För Halland lyfter rättelsen Miljökvalitet från 27,5 (21:a) till 64,7 (3:e) och livskvalitetsindexet från 64,7 till 67,8 (fortsatt 3:e). Kungsbacka går från 8:e till 6:e av 290 kommuner."
  },
  "banor-befolkning-jobb": {
    fil: "../presentationer/dragning_3khv/data/banor-befolkning-jobb.json",
    namn: "Befolkning och jobb per kommun, index 1990 = 100",
    falt: "{ kod, namn, ar, bef, jobb, folkmangd, syss_dag, kalla }",
    kalla: "SCB BefolkningNy + sysselsatt dagbefolkning 20–64 (dagbef90/RAMS/BAS) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-banor.R",
    om: "283 enheter och riket 1990–2024. `bef` = folkmängd och `jobb` = sysselsatt dagbefolkning 20–64 år, båda som index 1990 = 100. Fem kommuner som delats efter 1990 är ihopslagna med de utbrutna under moderkommunens kod (Nyköping+Gnesta+Trosa, Uppsala+Knivsta, Borås+Bollebygd, Örebro+Lekeberg, Södertälje+Nykvarn) — annars ger delningen ett falskt ras. Gnestas och Trosas jobb 1991–1992 är skattade. Heby saknar 1990-värde. `kalla` byter till BAS 2022, vilket lyfter rikets jobbindex från 112,9 till 115,7. 2024 står riket på 123,2 i befolkning och 115,5 i jobb, och 187 av 283 enheter har färre jobb än 1990."
  },
  "kommuner-3khv": {
    fil: "../presentationer/dragning_3khv/data/kommuner.json",
    namn: "Kommunernas indelningar (län, SKR-grupp, kommuntyp, FA, LA)",
    falt: "{ kod, namn, lan, lan_namn, fokus_stad, skr2023_kod, skr2023, skr2023_huvudgrupp, skr2017_kod, skr2017, tvv2026_ordning, tvv2026, tvv2026_typ3, fa25_kod, fa25, fa25_stad, fa15_kod, fa15, la24_kod, la24, la24_stad }",
    kalla: "SKR kommungruppsindelning 2023/2017, Tillväxtverkets kommuntyper 2026 och FA-regioner 2025/2015, SCB LA-regioner 2024 — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-jamforelser.R",
    om: "En rad per kommun, 290 kommuner. SKR:s nio grupper 2023: A1 Storstäder (3), A2 Pendlingskommun nära storstad (43), B3 Större stad (23), B4 (63), B5 (24), C6 Mindre stad/tätort (27), C7 (51), C8 (35), C9 (21). `fa25_stad`/`la24_stad` anger om kommunen ligger i någon av de fem 3KHV-städernas FA- eller LA-region."
  },
  "3khv-lan-roll": {
    fil: "../presentationer/dragning_3khv/data/3khv-lan-roll.json",
    namn: "Kommunens andel av länets invånare och jobb 1990 och 2024",
    falt: "{ kod, namn, lan, lan_namn, fokus, storst_i_lanet, jobb_1990, jobb_2024, invanare_1990, invanare_2024, andel_jobb_1990, andel_jobb_2024, andel_inv_1990, andel_inv_2024, andel_okning_jobb, andel_okning_inv }",
    kalla: "SCB sysselsatt dagbefolkning 20–64 (dagbef90/BAS) och folkmängd — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "290 kommuner i dagens indelning. Andelar i procent av länets summa. `andel_okning_*` = kommunens andel av länets bruttoökning 1990–2024 (summan av alla kommuners ökningar). Växjö står för 80 % av Kronobergs jobbökning, Kalmar 86,8 %, Karlskrona 100 %, Halmstad 37,4 % och Kristianstad 1,6 % av Skånes."
  },
  "3khv-lan-andelar": {
    fil: "../presentationer/dragning_3khv/data/3khv-lan-andelar.json",
    namn: "Kommunens andel av länets invånare och jobb, varje år 1990–2024",
    falt: "{ kod, namn, lan, lan_namn, ar, jobb, invanare, andel_jobb, andel_inv }",
    kalla: "SCB sysselsatt dagbefolkning 20–64 (dagbef90/RAMS/BAS) och folkmängd — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "Årsserien bakom spårdiagrammet på bild 3. Andelar i procent av länets summa samma år, dagens kommunindelning (kommuner bildade efter 1990 saknar år före bildandet)."
  },
  "3khv-ortsstruktur": {
    fil: "../presentationer/dragning_3khv/data/3khv-ortsstruktur.json",
    namn: "Ortsstrukturen per län 2023",
    falt: "{ ar, ranksize: [{ region, rank, tatort, befolkning, kum_andel }], lan: [{ lan, lan_namn, storsta, storsta_bef, nast, nast_bef, primat, andel_storsta, tatorter_30k, tatorter_10k, lanbef, fokus }], tatorter: [{ tatort, kommun, lan_namn, folkmangd, centralort, tatort_kod, x, y, storsta_i_lan }], centralorter: [{ kod, tatort, folkmangd, landareal_km2, tathet }] }",
    kalla: "SCB tätorter 2023 (MI0810), tätortsytor 2023 (data/geo/tatorter-2023.gpkg) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R, utökad av bearbeta-final.R",
    om: "Rang-storlek: de tio största tätorterna per län, kumulativ andel av länets folkmängd 2023. Primatkvot = största / näst största tätorten: Kronoberg 4,6, Skåne 2,9, Kalmar 2,0, Halland 1,9, Blekinge 1,8. Tätorter som korsar kommungräns räknas till kodens kommun (Kungsbacka/Göteborg hamnar i Västra Götaland). Tillagt av bearbeta-final.R: `tatorter[].x/y` = tätortsytans tyngdpunkt i SWEREF99 TM, `storsta_i_lan` = länets största tätort (i Skåne Malmö, inte Kristianstad), och `centralorter` 2023 med landareal i km² och invånare per km²: Växjö 74 052 inv., 38,2 km², 1 937/km²; Halmstad 72 979, 38,9, 1 877; Kalmar 42 622, 20,5, 2 082; Kristianstad 41 198, 22,4, 1 836; Karlskrona 36 423, 22,0, 1 653."
  },
  "3khv-pendling": {
    fil: "../presentationer/dragning_3khv/data/3khv-pendling.json",
    namn: "In- och utpendling i relativa mått 1993 och 2024",
    falt: "{ ar0, ar1, kommuner: [{ kod, namn, lan, fokus, andel_in_1993/2024, andel_ut_1993/2024, netto_per_100_1993/2024, kvot_1993/2024, dagbef_*, nattbef_*, … }], ursprung: [{ stad_kod, stad, fran_eget_lan, fran_andra_lan, andel_eget_lan }], serie: [{ kod, namn, ar, kalla, dagbef, andel_in, andel_ut }] }",
    kalla: "SCB RAMS (1993, 16+) och BAS (2024, 15–74) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "`andel_in` = inpendlare i % av jobben (dagbefolkningen), `andel_ut` = utpendlare i % av de sysselsatta som bor i kommunen, `netto_per_100` = (in − ut) per 100 jobb, `kvot` = dagbef/nattbef. Åldersavgränsningen byter 1993 → 2024. Medianen bland alla kommuner 2024: 27,9 % in, 37,7 % ut."
  },
  "3khv-naringsliv": {
    fil: "../presentationer/dragning_3khv/data/3khv-naringsliv.json",
    namn: "Jobben i åtta block efter logik, 1990–2024",
    falt: "{ block: [...], andelar: [{ kod, namn, typ, lan, ar, block, antal, andel, lok_kvot, fokus }], serier: [{ kod, namn, typ, ar, serie, block, antal, andel }], lang: [{ kod, namn, ar, serie, block, antal, andel }] }",
    kalla: "SCB dagbefolkning efter bransch, SNI2007 (RAMS 2008–2019, BAS 2020–) och harmoniserad SNI92/2002/2007 — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "Block: Offentlig välfärd (O, P, Q), Avancerade tjänster (J, K, L, M+N — N innehåller även bemanning och städ), Handel (G), Transport (H), Bygg (F), Service och upplevelser (I, R–U), Industri och energi (B–E), Jord och skog (A). Andel av jobb med känd bransch. `lang` är den harmoniserade serien 1990–2024 för städerna och riket, där handel, transport och IT är ett block."
  },
  "3khv-befolkning": {
    fil: "../presentationer/dragning_3khv/data/3khv-befolkning.json",
    namn: "Befolkningsförändringens komponenter",
    falt: "{ alla: [{ kod, typ, namn, lan, fokus, ar, fodelsenetto, inrikes_eget_lan, inrikes_ovriga, inrikes, invandring, folkokning }], perioder: [{ kod, namn, period, fodelsenetto, inrikes, inrikes_eget_lan, inrikes_ovriga, invandring, folkokning, per_1000_ar }], alder: [{ kod, namn, grupp, inrikes_netto, invandringsnetto, folkmangd, inrikes_per_1000 }] }",
    kalla: "SCB BE0101 (födda, döda, flyttningar) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "`alla`: per 1 000 invånare och år 2000–2024, alla kommuner, län och riket. Inrikes netto delat på det egna länet och övriga Sverige (finns från 2000). `perioder`: summor för städerna, deras län och riket 1990–1999 … 2020–2025. `alder`: genomsnittligt flyttnetto per år 2015–2024 per femårsklass."
  },
  "3khv-bostader": {
    fil: "../presentationer/dragning_3khv/data/3khv-bostader.json",
    namn: "Bostadsbyggande, byggbehov och småhuspriser",
    falt: "{ ar, pris_ar, kommuner: [{ kod, namn, lan, behov, byggt_per_ar, folkmangd, pris_tkr, kop, behov_per_1000, byggt_per_1000, tackning, nya_inv_per_bostad, pris_real_forandring, fokus }], serier: [{ kod, namn, ar, fardigstallda, folkmangd, per_1000, pris_tkr, real_tkr }] }",
    kalla: "SCB BO0101 (färdigställda lägenheter i nybyggda hus), BO0501 (köpeskilling småhus), KPI; Boverket, beräknat byggbehov 2026–2035 (2026-05-11) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "`behov` = Boverkets beräknade årliga byggbehov 2026–2035. `byggt_per_ar` = genomsnitt färdigställda 2021–2025. `tackning` = byggt i % av behovet — saknas för de 104 kommuner där Boverkets behov är noll; av de 186 med behov byggde 82 i takt med det. `real_tkr` = medelpris i 2025 års penningvärde (KPI). Växjö byggde 347 % och Karlskrona 308 % av sitt behov, Halmstad 74 % och Kristianstad 67 %."
  },
  "3khv-brp": {
    fil: "../presentationer/dragning_3khv/data/3khv-brp.json",
    namn: "BRP+ kommunindex 2025: totalindex och 15 teman",
    falt: "{ ar, lang: [{ kod, namn, lan, typ, fokus, del, tema, kpi_id, varde, rang }], bred: [{ kod, namn, lan, typ, fokus, folkmangd, livskvalitet, hallbarhet, ekonomi, miljo, miljokvalitet, miljo_hallbarhet }], struktur: [{ del, tema, indikatorer, aspekter, ar_fran, ar_till }], indikatorer: [{ tema, aspekt, kpi, kpi_text, ar }] }",
    kalla: "Tillväxtverket, BRP+ via Kolada v3 (N00300–N00310, N00366, N85372, N00370–N00373), stämpelår 2025 — hämtad av presentationer/dragning_3khv/hamta/hamta-brp.R; struktur och indikatorer ur Tillväxtverkets beräkningsfil (github.com/Analytikernatverket/brp_plus, hamta-brp-struktur.R); byggd av bearbeta-presentation.R",
    om: "Kommunindex 0–100, min–max bland de 290 kommunerna; riket är en egen enhet (livskvalitet 55,4, hållbarhet 52,7). `ekonomi` = medel av Inkomst och förmögenhet, Arbete och löner, Ekonomisk hållbarhet; `miljo` = medel av Miljökvalitet och Miljömässig hållbarhet — våra sammanvägningar, inte Tillväxtverkets. Bullerindikatorn N01456 i Miljökvalitet räknas åt fel håll i stämpelår 2025. Korrelationen ekonomi–miljö bland kommunerna är r = −0,10."
  },
  "3khv-profil": {
    fil: "../presentationer/dragning_3khv/data/3khv-profil.json",
    namn: "Städernas placering bland alla kommuner, 16 mått",
    falt: "{ kod, namn, omrade, matt, enhet, varde, percentil, median, n }",
    kalla: "Sammanställt ur 3khv-*-dataseten — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "`percentil` = andel av kommunerna med lägre värde (0–100). `median` = medianen bland alla kommuner med värde."
  },
  "3khv-fakta": {
    fil: "../presentationer/dragning_3khv/data/3khv-fakta.json",
    namn: "De fem städerna i korthet: storlek, yta, jobb, avstånd",
    falt: "{ stader: [{ kod, namn, lan_namn, folkmangd, rang_bef, centralort, centralort_bef, rang_tatort, antal_tatorter, landareal_km2, rang_areal, tathet, rang_tathet, jobb, rang_jobb, andel_lan_bef, andel_lan_jobb, inpendling, utpendling, storstad, avstand_km, skr2023_kod, skr2023 }], ref: { median_bef, median_jobb, median_areal, median_tathet, fem_bef, fem_jobb, riket_bef, riket_jobb, fem_andel_bef, fem_andel_jobb, avstand_inbordes_min, avstand_inbordes_max }, punkter: [{ tatort, x, y, storstad, kod }], avstand: [{ fran, … }] }",
    kalla: "SCB folkmängd 2025, tätorter 2025, sysselsatt dagbefolkning 20–64 år 2024, landareal 2026 (MI0802/Areal2025), pendling 2024; SKR kommungrupper 2023 — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "Rang bland 290 kommuner (1 = störst). Avstånd fågelvägen i km mellan tätortsytornas tyngdpunkter (SWEREF99 TM); punkterna x/y i samma koordinater. Tillsammans 430 252 invånare (4,1 % av riket) och 203 335 jobb (4,2 %)."
  },
  "3khv-lagekarta": {
    fil: "../presentationer/dragning_3khv/data/3khv-lagekarta.json",
    namn: "Länen i Sydsverige, förenklade (lägeskarta)",
    falt: "GeoJSON: features[{ properties: { lan, fokus }, geometry }]",
    kalla: "Lantmäteriet/SCB länsgränser (data/geo/lan-sverige.shp), förenklade 1,5 km — byggd av bearbeta-presentation.R",
    om: "Koordinater i SWEREF99 TM (hela meter). Rita med d3.geoIdentity().reflectY(true)."
  },
  "3khv-pendlingsbalans": {
    fil: "../presentationer/dragning_3khv/data/3khv-pendlingsbalans.json",
    namn: "In- och utpendling 2024 inom länet och över länsgränsen",
    falt: "{ kod, namn, in_eget, in_andra, ut_eget, ut_andra, netto, netto_per_100, andel_in_eget, inpendling, utpendling, dagbef, nattbef }",
    kalla: "SCB BAS 2024, pendling kommun → kommun (sysselsatta 15–74 år) — byggd av bearbeta-presentation.R",
    om: "Uppdelningen bygger på flödena mellan kommunerna; summan avviker från SCB:s totaler (`inpendling`, `utpendling`) med upp till 263 personer, flöden till okänd kommun. Netto per 100 jobb: Växjö 7,7, Kalmar 7,6, Halmstad 4,6, Karlskrona 4,2, Kristianstad 4,0."
  },
  "3khv-naringstabell": {
    fil: "../presentationer/dragning_3khv/data/3khv-naringstabell.json",
    namn: "Jobben per block 2008 och 2024: städerna, de fem tillsammans och riket",
    falt: "{ kod, namn, block, antal_2008, antal_2024, andel_2024, lok_kvot, forandring_pct, forandring_antal }",
    kalla: "SCB sysselsatt dagbefolkning efter bransch, SNI2007 (RAMS 2008, BAS 2024) — byggd av bearbeta-presentation.R",
    om: "`kod` = \"FEM\" för de fem tillsammans. `lok_kvot` = andel / rikets andel 2024. De fem: offentlig välfärd 40,8 % av jobben (riket 33,6), +20 327 jobb 2008–2024; avancerade tjänster +10 007 (+36 %), industri och energi −1 812 (−7 %)."
  },
  "3khv-framat": {
    fil: "../presentationer/dragning_3khv/data/3khv-framat.json",
    namn: "SCB:s framskrivning 2025 → 2040 efter ålder",
    falt: "{ kod, namn, alder, bef_2025, bef_2040, forandring_pct, forandring_antal }",
    kalla: "SCB regional befolkningsframskrivning (juni 2024), 5-årsgrupper — byggd av bearbeta-presentation.R",
    om: "Båda åren ur framskrivningen. `alder`: 0–19, 20–64, 65–79, 80+, Alla. `kod` = \"FEM\" för de fem tillsammans: 80+ +31,1 %, 20–64 +4,2 %, 0–19 −8,3 %, alla +4,3 %. Karlskrona alla −3,1 %."
  },
  "3khv-pendling-trend": {
    fil: "../presentationer/dragning_3khv/data/3khv-pendling-trend.json",
    namn: "Städernas in- och utpendling år för år 1993–2024, inom länet och över länsgränsen",
    falt: "{ kod, namn, ar, serie, in_eget, in_andra, ut_eget, ut_andra, netto, netto_per_100, andel_in, dagbef, nattbef, inpendling, utpendling, kontroll_in, kontroll_ut }",
    kalla: "SCB RAMS 1993–2019 och BAS 2020–2024, pendling kommun → kommun — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "En serie per år: RAMS 16+ t.o.m. 2018, RAMS 16–74 2019, BAS 15–74 från 2020. Uppdelningen bygger på flödena mellan kommunerna; summan avviker från SCB:s totaler med högst 52 (in) och 363 (ut) personer. De fem tillsammans: inpendlare 26 516 (1993) → 49 334 (2024), utpendlare 15 152 → 36 655."
  },
  "3khv-befolkning-trend": {
    fil: "../presentationer/dragning_3khv/data/3khv-befolkning-trend.json",
    namn: "Befolkningsförändringens delar år för år 2000–2025, per 1 000 invånare",
    falt: "{ kod, namn, ar, folkmangd, fodelsenetto, inrikes_eget_lan, inrikes_ovriga, invandring, folkokning, folkokning_antal }",
    kalla: "SCB befolkningsförändringar — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "De fem städerna och riket. Per 1 000 av medelfolkmängden (snitt av årets början och slut). Inrikes netto är noll för riket. Delarna summerar till folkökningen utom SCB:s justeringspost. Invandringsnettot toppar 2016 i fyra av fem städer, 2015 i Kalmar."
  },
  "3khv-struktur": {
    fil: "../presentationer/dragning_3khv/data/3khv-struktur.json",
    namn: "Strukturomvandlingen: jobbförändring per block sedan 1990",
    falt: "{ kod, namn, ar, serie, block, antal, antal_1990, forandring, pe, total_pe }",
    kalla: "SCB sysselsatt dagbefolkning efter bransch, harmoniserad SNI92/2002/2007 (RAMS 1990–2019, BAS 2020–2024) — byggd av bearbeta-presentation.R",
    om: "De fem städerna och riket, alla åldrar. `pe` = förändring sedan 1990 i procent av kommunens jobb 1990; `total_pe` = summan. Klassbyten 2004, 2008 (flyttar jobb främst till handel, transport och IT) och 2019, BAS 2020. 1990–2024: Växjö +32,8, Halmstad +30,3, riket +21,0, Karlskrona +19,3, Kalmar +18,8, Kristianstad +9,9."
  },
  "3khv-framtid": {
    fil: "../presentationer/dragning_3khv/data/3khv-framtid.json",
    namn: "Folkmängd 1990–2025 och SCB:s framskrivning till 2070",
    falt: "{ kod, ar, folkmangd, kalla, namn, index }",
    kalla: "SCB folkmängd och regional befolkningsframskrivning (juni 2024) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R",
    om: "De fem städerna och deras län. `index` = folkmängd, 2025 års utfall = 100. Framskrivningen ger Karlskrona 96,8 år 2040; övriga städer 103,9–106,9."
  },
  "3khv-linjer": {
    fil: "../presentationer/dragning_3khv/data/3khv-linjer.json",
    namn: "Folkmängd 1990–2025 och jobb 1990–2024 per kommun (linjebilderna)",
    falt: "{ kod, namn, ar, folkmangd, syss_dag, kalla }",
    kalla: "SCB BefolkningNy (1990–2024) och BefolkningCKM (2025, total befolkning), sysselsatt dagbefolkning 20–64 år (dagbef90/RAMS/BAS) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-final.R",
    om: "Samma 283 enheter och riket som banor-befolkning-jobb, med samma fem ihopslagningar (Nyköping+Gnesta+Trosa, Uppsala+Knivsta, Borås+Bollebygd, Örebro+Lekeberg, Södertälje+Nykvarn), i antal. 2025 har bara folkmängd: `syss_dag` = null och `kalla` = \"CKM\" (cell key-störda tal, några personers avvikelse möjlig). `kalla` för jobben: dagbef90 1990–1992, RAMS 1993–2021, BAS 2022–2024. Riket 8 590 630 (1990) → 10 605 529 (2025), +23,5 %. 145 av 283 enheter har färre invånare 2025 än 1990, och 176 minskade 2024→2025. 1990–2025: Växjö +42,3 %, Halmstad +32,8, Kalmar +30,0, Kristianstad +19,7, Karlskrona +11,8."
  },
  "3khv-orientering": {
    fil: "../presentationer/dragning_3khv/data/3khv-orientering.json",
    namn: "De fem i korthet: invånare, yta, täthet, länet, inom 45 minuter och inom 10 mil",
    falt: "{ ar_folkmangd, ar_rutnat, antal_kommuner, antal_lan, kalla, restid_45min: { minuter, km_h, radie_km }, stader: [{ kod, namn, centralort, lan, lan_namn, folkmangd, folkmangd_rang_riket, folkmangd_rang_lan, kommuner_i_lanet, landareal_km2, areal_rang_riket, areal_rang_lan, tathet, tathet_rang_riket, tathet_rang_lan, lan_folkmangd, lan_folkmangd_rang, inom_10mil, inom_45min }] }",
    kalla: "SCB folkmängd 2025 (BefolkningCKM), landareal 1 januari 2026 (MI0802/Areal2025), befolkning på 1 km-rutor 31 dec 2025 (kapitelrapport/befolkning/data/befolkning_1km_2025.gpkg). Byggd av presentationer/dragning_3khv/bearbeta/bearbeta-final.R; inom_45min av bearbeta-rev1.R",
    om: "Rev 1: `inom_45min` = invånare i 1 km-rutor (2025, bara Sverige) vars mittpunkt ligger högst 45 km fågelvägen från centralortens tyngdpunkt, det vill säga 45 minuter i 60 km/h fågelvägen (ungefär 75–80 km/h på väg med omvägsfaktor 1,3); parametrarna står i `restid_45min`. Inom 45 minuter: Kristianstad 246 855, Halmstad 214 713, Växjö 149 720, Kalmar 135 195, Karlskrona 106 643. De fem sorterade efter folkmängd 2025. Rang 1 = störst/tätast bland 290 kommuner (`_rang_riket`) och bland länets kommuner (`_rang_lan`, av `kommuner_i_lanet`); `lan_folkmangd_rang` bland 21 län. `lan` är 2-siffrig. `inom_10mil` = invånare i de 1 km-rutor vars mittpunkt ligger högst 100 km fågelvägen från centralortens tyngdpunkt (3khv-fakta.punkter) — bara svensk befolkning, Danmark räknas inte. Rutorna summerar till 10 578 118 mot rikets 10 605 529. Halmstad 106 315 inv. (17:e), Växjö 98 940 (23:e), Kristianstad 85 908 (28:e, 4:e av Skånes 33), Kalmar 73 068 (33:e), Karlskrona 66 021 (37:e). Inom 10 mil: Kristianstad 1 662 518 (Malmö ligger 85 km bort), Halmstad 983 941, Växjö 749 075, Karlskrona 517 968, Kalmar 405 708."
  },
  "3khv-ortskarta": {
    fil: "../presentationer/dragning_3khv/data/3khv-ortskarta.json",
    namn: "Karta: län, kommuner och tätorter i de fem länen (SWEREF99 TM)",
    falt: "{ crs, toleransmeter, lan: FeatureCollection{ properties: { lan, lan_namn, fokus } }, kommuner: FeatureCollection{ properties: { kod, namn, lan } }, tatorter: [{ tatort, kod, lan, folkmangd, x, y, centralort, storsta_i_lan, tatort_kod }], utsnitt: [{ lan, lan_namn, stad_kod, bbox }] }",
    kalla: "Lantmäteriet Översiktskartan, läns- och kommungränser (data/geo/lan-sverige.shp, kommuner-sverige.shp), klippta mot land med OpenStreetMaps förenklade landpolygoner (© OpenStreetMap contributors, ODbL; hamta/hamta-landmask.R); SCB tätorter 2023 (data/geo/tatorter-2023.gpkg) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-final.R",
    om: "EPSG:3006, hela meter — rita med d3.geoIdentity().reflectY(true). Länskoder 2-siffriga. 8 län: de fem (`fokus` = true) och grannarna Östergötland, Jönköping och Västra Götaland; 64 kommuner i de fem länen. Översiktskartans ytor går ut i havet och är därför klippta mot land (sjöarna ingår i ytorna, öar under 5 ha är borttagna): de fem länen krymper från 62 828 till 41 169 km². Geometrierna är sedan förenklade var för sig med 50 m tolerans (sf::st_simplify), så gemensamma gränser kan skilja upp till ungefär 50 m. 532 tätorter med minst 200 invånare 2023 i de fem länen, största först; `kod` = kommunkod, `x`/`y` = tätortsytans tyngdpunkt. `storsta_i_lan` är Malmö i Skåne, inte Kristianstad. `utsnitt.bbox` = [xmin, ymin, xmax, ymax] för länets landyta, utan marginal. Kalmar läns utsnitt är fastlandet plus Ölands västkust närmast Kalmar (österut till Kalmar tätort + 20 km); det är 88 × 206 km och alltså fortfarande högt och smalt — höjden kommer från Västerviksdelen i norr, inte från Öland. Filen är 865 kB."
  },
  "3khv-landning": {
    fil: "../presentationer/dragning_3khv/data/3khv-landning.json",
    namn: "Landningskorten: befolkning, jobb och centralort 1990 → 2024 med rang",
    falt: "{ kod, namn, centralort, lan_namn, kommuner_i_lanet, bef_1990, bef_2024, bef_rang_riket_1990, bef_rang_riket_2024, bef_rang_lan_1990, bef_rang_lan_2024, andel_lan_bef_1990, andel_lan_bef_2024, jobb_1990, jobb_2024, jobb_rang_riket_1990, jobb_rang_riket_2024, jobb_rang_lan_1990, jobb_rang_lan_2024, andel_lan_jobb_1990, andel_lan_jobb_2024, ort_bef_1990, ort_bef_2023, ort_rang_riket_1990, ort_rang_riket_2023, ort_rang_lan_1990, ort_rang_lan_2023 }",
    kalla: "SCB folkmängd, sysselsatt dagbefolkning 20–64 år (dagbef90 1990, BAS 2024), tätorter 1990 och 2023 (MI0810) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-final.R",
    om: "En rad per stad. Befolkning 31 dec och jobb (sysselsatt dagbefolkning 20–64 år, samma som banorna) med rang bland 290 kommuner i dagens indelning (1 = störst) och bland länets kommuner; andel av länet i %. Centralorten är tätorten 1990 och 2023 (avgränsningen görs om varje gång) med rang bland landets 1 843 resp. 2 017 tätorter och i länet. Befolkningsrang 1990 → 2024: Halmstad 18 → 17, Växjö 23 → 22, Kalmar 35 → 33, Kristianstad 22 → 26, Karlskrona 30 → 37. Jobbrang: Halmstad 21 → 17, Växjö 22 → 20, Karlskrona 32 → 31, Kalmar 27 → 27, Kristianstad 23 → 25. Centralorten 1990 → 2023: Växjö 22 → 17, Kalmar 34 → 29, Halmstad 20 → 18, Karlskrona 37 → 37, Kristianstad 29 → 30. Växjös andel av Kronobergs jobb 44,6 → 51,2 %."
  },
  "3khv-pendling-linjer": {
    fil: "../presentationer/dragning_3khv/data/3khv-pendling-linjer.json",
    namn: "Bor och arbetar, in- och utpendling över kommungräns 1993–2024",
    falt: "{ kalla, brott: [{ ar, etikett }], rader: [{ kod, namn, ar, serie, bor_arbetar, inpendling, utpendling, netto, nattbef, dagbef, folkmangd }] }",
    kalla: "SCB RAMS (förvärvsarbetande 16+ år t.o.m. 2018, 16–74 år 2019) och BAS (sysselsatta 15–74 år 2020–2024), pendling över kommungräns — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-final.R",
    om: "De fem och riket 1993–2024. `bor_arbetar` = bor och arbetar i kommunen, `netto` = in − ut, `nattbef`/`dagbef` = sysselsatta efter bostadens/arbetsställets kommun, `folkmangd` för per 1 000 invånare. `serie` byter 2019 (RAMS 16–74) och 2020 (BAS 15–74), se `brott`. Riket = summan av kommunerna; 1993–1999 saknas 1–4 senare bildade kommuner i summan. Rikets inpendling och utpendling är inte lika (2024: 1 861 147 mot 1 897 209), så rikets netto är inte noll — troligen pendlare vars arbetsställe inte kan knytas till en kommun. 1993 → 2024: Halmstads inpendling +162 %, utpendling +168 %; Kalmars inpendling +63 %, utpendling +155 %. Inpendlare per 1 000 invånare 2024: Kalmar 138,8, Kristianstad 123,8, Växjö 115,7, Halmstad 104,4, Karlskrona 92,2."
  },
  "3khv-komponenter": {
    fil: "../presentationer/dragning_3khv/data/3khv-komponenter.json",
    namn: "Befolkningsförändringens delar år för år 1990–2025, antal",
    falt: "{ kalla, rader: [{ kod, namn, ar, fodelsenetto, invandringsnetto, inrikes_netto, inrikes_eget_lan, inrikes_ovriga, justering, folkokning, folkmangd }] }",
    kalla: "SCB BE0101 (FoddaK, DodaHandelseK, Flyttningar, Flyttningar97; 2025 ur CKM-tabellerna) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-final.R",
    om: "De fem och riket, antal per år. `fodelsenetto` + `invandringsnetto` + `inrikes_netto` + `justering` = `folkokning` exakt. `inrikes_eget_lan`/`inrikes_ovriga` finns från 2000 (null före) och avviker från `inrikes_netto` med högst 4 personer. För riket är inrikes netto och dess delar 0. 2020–2025 sammanlagt: Växjö +4 811, Kalmar +3 601, Halmstad +3 548, Kristianstad +161 och Karlskrona −601 (födelsenetto −501, inrikes netto −801, invandringsnetto +597)."
  },
  "3khv-lage-idag": {
    fil: "../presentationer/dragning_3khv/data/3khv-lage-idag.json",
    namn: "Läget i dag: de fem mot SKR:s kommungrupper",
    falt: "{ kalla, grupper: [{ id, namn, kort, typ, antal_kommuner }], matt: [{ id, namn, enhet, ar }], varden: [{ grupp, matt, varde }], naring: [{ grupp, ar, tjanster, varuproduktion, totalt, index_tjanster, index_varu }] }",
    kalla: "SCB sysselsatt dagbefolkning efter bransch, harmoniserad (RAMS 1990–2019, BAS 2020–2024), folkmängd efter ålder 2025, utbildningsnivå 30–34 år 2025 (UF0506B/Utbildning); SKR kommungruppsindelning 2023. Byggd av presentationer/dragning_3khv/bearbeta/bearbeta-final.R, utbildningen av bearbeta-rev1.R",
    om: "Grupper: de fem städerna (`id` = kommunkod), SKR:s nio kommungrupper 2023 utan de fem, och riket (290). Karlskrona är C6 Mindre stad/tätort hos SKR, inte B3: B3 heter här \"Övriga större städer\" (19 kommuner, utan Växjö, Kalmar, Kristianstad och Halmstad) och C6 saknar Karlskrona (26 kommuner). Gruppvärdena räknas på summor av antal. `platsbundna` = andel av jobben (dagbefolkning, alla åldrar, känd bransch) i tjänster, harmoniserade grupper 5–10; `varuproduktion` = grupp 1–4: jord/skog, tillverkning och utvinning, energi och miljö samt byggverksamhet (bygg räknas alltså till varuproduktion). `forsorjningskvot` = (0–19 + 65+) / 20–64 år 2025. `eftergymn3` = andel **30–34 år** med minst treårig eftergymnasial utbildning (SUN nivå 6–7, nämnaren inklusive uppgift saknas) 2025, % (rev 1; tidigare 25–64 år): Växjö 36,5, Kalmar 35,8, Karlskrona 34,1, Halmstad 31,7, Kristianstad 27,4, riket 35,2, A1 49,4, C8 17,2. Näringsförändringen 1990–2024 i procent av 1990 års totala jobb (ur `naring`), tjänster / varuproduktion: Halmstad +38,4 / −8,0, Växjö +37,6 / −4,7, Kalmar +28,5 / −9,7, Karlskrona +26,7 / −7,5, Kristianstad +18,3 / −8,4, riket +28,4 / −7,3, A2 +46,4 / +1,1, C8 −3,9 / −13,3. `naring` 1990–2024, index 1990 = 100; klassbyten 2004 och 2008, BAS 2020. Tjänsteandel 2024: Växjö 82,6 %, Kalmar 81,8, Halmstad 81,2, Karlskrona 80,2, Kristianstad 79,8, övriga större städer 81,0, riket 79,3, C7 62,7. Försörjningskvot 2025: Växjö 0,755, Kristianstad 0,849, C8 0,981. Tjänstejobben 1990–2024: Halmstad index 156,9, Växjö 152,1, riket 142,0, C8 93,3; varuproduktionen i C7 68,3 och i riket 77,4."
  },
  "3khv-prognos": {
    fil: "../presentationer/dragning_3khv/data/3khv-prognos.json",
    namn: "Befolkning efter ålder 2000–2040, demografisk och ekonomisk försörjningskvot",
    falt: "{ kalla, prognos_fran, rader: [{ kod, namn, ar, typ, folkmangd, alder_0_19, alder_20_64, alder_65p, sysselsatta, syssgrad, ek_kvot, ek_kvot_oforandrad, kravd_syssgrad, dem_kvot, dem_netto }] }",
    kalla: "SCB folkmängd efter ålder (BefolkningNy/BefolkningCKM), förvärvsarbetande/sysselsatt nattbefolkning (RAMS/BAS); SCB:s regionala befolkningsframskrivning juni 2024 (BefProgOsiktRegN) och nationella framskrivning april 2026 (BefolkprognRevNb, BefPrognosOversiktN). Hämtad av hamta/hamta-prognos-alder.R, byggd av bearbeta/bearbeta-final.R; dem_kvot och dem_netto av bearbeta-rev1.R",
    om: "Rev 1: `dem_kvot` = demografisk försörjningskvot (0–19 + 65+) / (20–64), `dem_netto` = (20–64) − (0–19 + 65+) i personer, alla år. 2025 → 2040, kvot: Växjö 0,755 → 0,746, Kalmar 0,765 → 0,768, Halmstad 0,791 → 0,799, Karlskrona 0,809 → 0,815, Kristianstad 0,849 → 0,859, riket 0,770 → 0,784. Netto: Växjö 13 842 → 15 359, Halmstad 12 381 → 12 648, Kalmar 9 743 → 10 247, Kristianstad 7 001 → 6 708, Karlskrona 6 988 → 6 533, riket 1 374 927 → 1 320 654. Bara Växjö får lägre kvot och bara Växjö, Kalmar och Halmstad större netto 2040. De fem och riket. `typ` = utfall t.o.m. 2025, prognos 2026–2040. Kommunernas prognos är SCB:s regionala framskrivning (basår 2023) kedjad mot utfallet 2025: framskrivningens procentuella förändring sedan 2025 per åldersgrupp läggs på utfallet 2025, och `folkmangd` är summan av grupperna. Kedjningen ändrar 2040 med −1,1 % (Kristianstad, där framskrivningen låg 1 005 över utfallet 2025) till +0,3 % (Växjö). Riket kommer ur den nationella framskrivningen (basår 2025) och behöver ingen kedjning. 2025 är summan av åldrarna i CKM-tabellen och kan avvika några tiotal personer från totalen. `sysselsatta` = förvärvsarbetande/sysselsatt nattbefolkning 2000–2024 (RAMS 16+, BAS 15–74, som pendling-kommun). `syssgrad` = sysselsatta / befolkning 20–64 i % — en approximation, täljaren har andra åldrar än nämnaren. `ek_kvot` = (folkmängd − sysselsatta) / sysselsatta. Från 2024: `ek_kvot_oforandrad` = kvoten om syssgraden ligger kvar på 2024 års nivå; `kravd_syssgrad` = den syssgrad som behövs för att behålla 2024 års kvot. Krävd syssgrad 2040 (2024 inom parentes): Karlskrona 90,1 (90,3), Kalmar 88,9 (88,6), Halmstad 88,0 (87,6), Kristianstad 87,7 (87,2), Växjö 87,2 (87,7), riket 89,3 (88,6). Rikets prognos minskar 2027 med 0,25 % (10 617 229 → 10 590 195): SCB räknar med att folkräkningen avregistrerar personer som flyttat ut utan att anmäla det och sätter utvandringen 2027 till 106 099, mot 74 763 året innan."
  },
  "3khv-bostadsdata": {
    fil: "../presentationer/dragning_3khv/data/3khv-bostadsdata.json",
    namn: "Bostäder: bestånd, hushåll, småhuspriser, pris mot medianinkomst och byggande mot behov",
    falt: "{ kalla, inkomst_kalla, bestand: [{ kod, namn, ar, flerbostad_hyresratt, flerbostad_bostadsratt, smahus, ovrigt, totalt }], hushall: [{ kod, ar, personer_per_hushall, andel_1person, andel_2person, andel_3plus, antal_hushall, folkmangd }], priser: [{ kod, ar, pris_tkr, real_tkr }], inkomst: [{ kod, ar, median_tkr, median_fast_tkr }], pris_inkomst: [{ kod, ar, kvot }], perioder: [{ kod, period, fran, till, byggt, byggt_per_ar, per_1000_ar, typ }] }",
    kalla: "SCB BO0104T04 (lägenheter efter hustyp och upplåtelseform), BE0101S HushallT03/T03CKM/T09 (hushåll), BO0501 (köpeskilling permanenta småhus), KPI, BO0101 (färdigställda lägenheter i nybyggda hus), HE0110G/TabVX4bDispInkN (hushållens disponibla inkomst); Boverket, beräknat byggbehov 2026–2035 (2026-05-11). Hämtad av hamta/hamta-bostadsbestand.R, hamta-bostader.R och hamta-rev1.R, byggd av bearbeta/bearbeta-final.R och bearbeta-rev1.R",
    om: "Rev 1: `inkomst` 2011–2024 = median av hushållens disponibla inkomst (inkl. kapitalvinst), samtliga hushåll, referensperson 18+ år, helårshushåll (SCB HE0110G/TabVX4bDispInkN; finns per kommun, så förstahandsvalet gäller). SCB publicerar den i fasta priser (2024 års penningvärde, `median_fast_tkr`); `median_tkr` är omräknad till löpande priser med KPI årsmedel så att den kan ställas mot småhuspriset samma år. `pris_inkomst.kvot` = småhusens medelpris / medianinkomsten samma år, 2011–2024 (antal årsinkomster). 2024: Halmstad 8,88, Kalmar 8,59, Skåne län 8,52, Hallands län 8,42, riket 7,95, Växjö 7,39, Karlskrona 6,20, Kristianstad 6,04; 2011: Halmstad 7,74, riket 6,65, Kristianstad 4,93. Medianinkomst 2024: Kristianstad 446,3 tkr, Växjö 446,0, Halmstad 445,5, Karlskrona 443,1, Kalmar 430,8, riket 472,6. `hushall.antal_hushall`/`folkmangd` ur HushallT09 2011–2025. Hushåll mot folkmängd 2011–2025: Växjö +23,0 mot +18,2 %, Kalmar +20,2 mot +15,9, Halmstad +17,6 mot +15,2, Kristianstad +10,8 mot +7,5, Karlskrona +7,4 mot +2,8, riket +15,1 mot +11,8: hushållen ökar snabbare än befolkningen överallt. De fem, deras län och riket. `bestand` 2013–2025: lägenheter 31 dec; `ovrigt` = övriga hus, specialbostäder och flerbostadshus med äganderätt eller okänd upplåtelseform. `hushall` 2011–2025 (2025 ur CKM): personer per hushåll och andel hushåll med 1, 2 och 3+ personer i %. `priser` 2000–2025: medelpris för permanenta småhus i tkr, `real_tkr` i 2025 års penningvärde (KPI). `perioder`: färdigställda lägenheter per femårsperiod 1990–1994 … 2020–2024 och 2025 för sig (`typ` = utfall), Boverkets beräknade årliga byggbehov 2026–2035 som två perioder med samma årstakt (`typ` = behov; län och riket = summan av kommunerna). `per_1000_ar` = per 1 000 invånare (periodens medelfolkmängd, behovet mot 2025) och år. Byggt per år 2020–2024 mot behovet per år: Växjö 836,8 mot 201,5, Kalmar 536,4 mot 268,3, Halmstad 494,4 mot 658,2, Kristianstad 327,8 mot 426,9, Karlskrona 234,4 mot 63,5. Småhuspris 2025: Halmstad 4 166 tkr, Kalmar 3 559, Växjö 3 433, Karlskrona 3 018, Kristianstad 2 924. Andel flerbostadshus med hyresrätt 2025: Halmstad 37,1 %, Kalmar 33,9, Växjö 33,6, Karlskrona 32,3, Kristianstad 29,4, riket 30,6."
  },
  "3khv-brp-forklaring": {
    fil: "../presentationer/dragning_3khv/data/3khv-brp-forklaring.json",
    namn: "BRP+: varför städerna hamnar där de hamnar (underlag för text)",
    falt: "{ ar, kalla, stader: [{ kod, namn, del, index, rang, antal_indikatorer, teman: [{ tema, varde, rang }], starkast: [{ kpi, text, tema, standard, varde, ar }], svagast: [...] }] }",
    kalla: "Tillväxtverket, BRP+ kommunindex stämpelår 2025 (Kolada v3, hamta/hamta-brp.R) och beräkningsfilen brpplus_stand_maxmin_final.csv (github.com/Analytikernatverket/brp_plus) — byggd av presentationer/dragning_3khv/bearbeta/bearbeta-final.R",
    om: "Underlag för textkondensen, inte för grafer. En rad per stad och del: Livskvalitet (46 indikatorer) och Hållbarhet (29). `index`/`rang` = Koladas kommunindex med rang bland 290; `teman` = temaindexen med rang, bäst först. `starkast`/`svagast` = de fyra indikatorer där kommunen har högst/lägst standardiserat värde (0–100, min–max bland kommunerna, omvänd skala redan tillämpad). Bullerindikatorn N01456 är vänd här men inte i Koladas temaindex. `varde` = indikatorns råvärde, `ar` = dataåret. Livskvalitet: Halmstad 58,9 (79:e), Kalmar 58,7 (85:e), Växjö 56,9 (110:e), Karlskrona 55,9 (131:a), Kristianstad 53,2 (177:e). Hållbarhet: Karlskrona 55,4 (70:e), Växjö 53,5 (113:e), Kristianstad 52,9 (127:e), Kalmar 52,6 (138:e), Halmstad 51,1 (172:a). I hållbarhet har alla fem förnybar fjärrvärme bland de starkaste indikatorerna och skyddad natur bland de svagaste."
  },
  "3khv-koncentration": {
    fil: "../presentationer/dragning_3khv/data/3khv-koncentration.json",
    namn: "Koncentration: kommunens andel av länet och centralortens andel, 1990–2025",
    falt: "{ kalla, kommun: [{ kod, namn, lan, lan_namn, ar, bef, jobb, lan_bef, lan_jobb, andel_bef, andel_jobb }], tatort: [{ kod, centralort, ar, ort_bef, kommun_bef, lan_bef, andel_av_kommun, andel_av_lan }] }",
    kalla: "SCB folkmängd (BefolkningNy, BefolkningCKM 2025), sysselsatt dagbefolkning 20–64 år (dagbef90, RAMS, BAS), tätorternas folkmängd (MI0810). Byggd av presentationer/dragning_3khv/bearbeta/bearbeta-rev1.R",
    om: "`kommun`: de fem, varje år 1990–2025 (`jobb`, `lan_jobb` och `andel_jobb` = null 2025). Länet = summan av dagens kommuner i länet alla år (SCB:s egna länsrader följer det årets indelning). `jobb` = sysselsatt dagbefolkning 20–64 år som i banorna (dagbef90 1990–1992, RAMS, BAS från 2022). Andelar i procent med två decimaler; `lan` 2-siffrig. Andel av länets invånare 1990 → 2024: Växjö 39,1 → 48,4 (+9,3 procentenheter), Kalmar 23,3 → 29,5 (+6,2), Karlskrona 39,2 → 42,2 (+3,0), Halmstad 31,4 → 30,7 (−0,7), Kristianstad 6,7 → 6,0 (−0,7). Andel av länets jobb: Växjö 44,6 → 51,2 (+6,6), Karlskrona 39,6 → 47,5 (+7,9), Kalmar 28,4 → 35,3 (+6,8), Halmstad 36,5 → 37,0 (+0,5), Kristianstad 7,3 → 6,4 (−0,9). Växjö, Kalmar och Karlskrona växte mer än hela sitt län 1990–2024 (resten av länet krympte); i Kalmar och Blekinge län minskade jobben medan staden ökade. `tatort`: centralorten vid tätortsavgränsningarna 1990, 1995, 2000, 2005, 2010, 2015, 2018, 2020 och 2023 (avgränsningen görs om varje gång; tätortens folkmängd mot kommunens och länets 31 dec samma år). Andel av kommunen 1990 → 2023: Växjö 67,2 → 75,9, Halmstad 61,0 → 69,0, Kalmar 54,8 → 59,0, Karlskrona 51,0 → 54,8, Kristianstad 43,6 → 47,6. Andel av länet: Växjö 26,3 → 36,4, Karlskrona 20,0 → 23,1, Halmstad 19,2 → 21,2, Kalmar 12,8 → 17,3, Kristianstad 2,9 → 2,9."
  },
  "3khv-alder": {
    fil: "../presentationer/dragning_3khv/data/3khv-alder.json",
    namn: "Åldersfördelning per ettårsklass 2025: riket, de fem, Stockholm, Lund, Lomma, Hylte, Borgholm",
    falt: "{ ar, referensdag, kalla, enheter: [{ kod, namn, grupp: riket|stad|jamfor }], rader: [{ kod, alder (100 = 100+), antal }] }",
    kalla: "SCB, folkmängd efter ålder 31 december 2025 (BefolkningCKM). Byggd av presentationer/dragning_3khv/bearbeta/bearbeta-alder.R",
    om: "Andel 0–19 / 20–64 / 65–79 / 80+ 2025: riket 22,4 / 56,5 / 14,6 / 6,4 %; Borgholm 15,4 / 44,0 / 28,3 / 12,3; Lund 20,4 / 61,9 / 12,1 / 5,6. Medianålder (interpolerad inom ettårsklassen): riket 41,4, Lund 36,1, Växjö 38,4, Stockholm 39,0, Borgholm 58,9. CKM-störda celler: summan av ettårsklasserna avviker något från totalen."
  },
  "3khv-brp-tips": {
    fil: "../presentationer/dragning_3khv/data/3khv-brp-tips.json",
    namn: "BRP+ per kommun: index, teman och vad som drar upp och ned (tooltip)",
    falt: "{ ar, n_kommuner, kalla, tema_namn: { kort: Kolada-namn }, median: { livskvalitet: { tema: värde, index }, hallbarhet: { ... } }, kommuner: [{ kod, namn, livskvalitet: { index, rang, teman: [{ tema, varde, rang }], upp: [{ text, tema, standard }], ned: [...] }, hallbarhet: { ... } }] }",
    kalla: "Tillväxtverket, BRP+ kommunindex stämpelår 2025 (Kolada v3, hamta/hamta-brp.R) och beräkningsfilen brpplus_stand_maxmin_final.csv (github.com/Analytikernatverket/brp_plus). Byggd av presentationer/dragning_3khv/bearbeta/bearbeta-rev1.R",
    om: "Alla 290 kommuner. `index` och `teman[].varde` = Koladas kommunindex (0–100), `rang` bland 290 med värdet avrundat till tre decimaler och delad rang = lägsta (samma som 3khv-brp-forklaring för de fem). `tema` är korta namn (\"Närhet till service\", \"Ekonomisk\" …); Koladas namn i `tema_namn`. `teman` i Koladas ordning: 12 i livskvalitet, 3 i hållbarhet. `upp`/`ned` = de tre indikatorer där kommunen har högst/lägst standardvärde (0–100, min–max bland kommunerna, omvänd skala tillämpad så att högt = bra; bullerindikatorn N01456 vänd eftersom källan räknar mer buller som bättre). `text` är formulerad i rätt riktning: i `upp` det som är bra (\"Få anmälda våldsbrott\"), i `ned` det som är dåligt (\"Många anmälda våldsbrott\"), högst 43 tecken. Standardvärdet i `upp` är 74–100 (median 97), i `ned` 0–42 (median 5). `median` = medianen bland kommunerna per tema och för `index`: livskvalitet 55,2, hållbarhet 52,2. Filen är 533 kB."
  },
  "bas-manad": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/bas-manad.json",
    namn: "BAS månadsstatistik, Halland och riket",
    falt: "{ år, månad, period, datum, kod, region, typ, syss_dag_alla, syss_dag_stat, syss_dag, syss_dag_yoy, arbl_16_64 }",
    kalla: "SCB BAS preliminär månadsstatistik (AM0210A/ArbStatusM, AM0210B/SektorSyssM) — byggd av presentationer/dragning_lansstyrelsen_260902/bearbeta-bas.R",
    om: "Sysselsatt dagbefolkning 15–74 år efter arbetsställets belägenhet: `syss_dag_alla` samtliga sektorer, `syss_dag_stat` staten, `syss_dag` = alla − staten (staten utplockad för att omorganisationer inom bl.a. försvaret flyttar arbetsställen mellan regioner). `syss_dag_yoy` är förändringen i `syss_dag` mot samma månad föregående år; saknas 2020. Arbetslöshet 16–64 år i procent av arbetskraften. Preliminär statistik — senaste månaderna revideras. Siffrorna för senaste månad står i utskriften från bearbeta-bas.R."
  },
  "befolkning-manad": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/befolkning-manad.json",
    namn: "Folkmängd per månad, Halland",
    falt: "{ år, månad, period, datum, kod, region, typ, befolkning, befolkning_yoy }",
    kalla: "SCB BE0101A/BefolkManad (2020–2024) skarvad med BefolkManadCKM (2025–) — byggd av presentationer/dragning_lansstyrelsen_260902/bearbeta-befolkning-manad.R",
    om: "Riket, Hallands län och länets sex kommuner, 2020M01 till senaste månad. Folkmängd vid månadens slut; `befolkning_yoy` är förändringen mot samma månad föregående år i procent (saknas 2020). Skarven 2024M12→2025M01 är kontrollerad mot grannmånaderna. I juni 2026 växte Halland 0,21 procent på årsbasis mot rikets 0,17; Varberg +0,60 och Kungsbacka +0,40, medan Hylte (−1,45) och Laholm (−0,55) minskade."
  },
  "befolkning-prognos": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/befolkning-prognos.json",
    namn: "Folkmängd och årlig förändring 1990–2040, riket och Halland",
    falt: "{ år, kod, region, typ, befolkning, kalla, forandring_antal, forandring }",
    kalla: "SCB BefolkningNy/BefolkningCKM (utfall), SCB:s befolkningsframskrivning 2025 (riket 2026–2040), Region Hallands befolkningsframskrivning (Halland 2026–2040) — byggd av presentationer/dragning_lansstyrelsen_260902/bearbeta-prognos.R",
    om: "Riket och Hallands län, ett värde per år. `kalla` är utfall t.o.m. 2025 och prognos 2026–2040; `forandring` är procent mot året innan (1990 mot 1989). Halland växte 35,9 procent 1990–2025 (0,88 procent om året) mot rikets 23,5, men väntas växa bara 4,0 procent 2025–2040 (0,26 om året) mot rikets 3,1. Toppåret var 2016 för båda (Halland 1,76, riket 1,46). SCB:s framskrivning ger riket ett minus 2027 (−0,25 procent) för att folkräkningen väntas avregistrera utflyttade — utvandringen det året är satt till 106 000."
  },
  "aldersstruktur-riket": {
    fil: "../presentationer/dragning_lansstyrelsen_260902/data/aldersstruktur-riket.json",
    namn: "Rikets folkmängd per ettårsklass 2025",
    falt: "{ ålder, befolkning }",
    kalla: "SCB BefolkningCKM (ålder 0–99 och 100+) — byggd av presentationer/dragning_lansstyrelsen_260902/bearbeta-prognos.R",
    om: "101 klasser, 31 december 2025; `ålder` 100 är 100 år och äldre. Tabellen är röjandeskyddad med cell key-metoden, så summan av klasserna (10 605 545) avviker 16 personer från rikets total. Största årskullen är 35-åringarna, födda 1990 (161 499); därefter topparna 59 år (födda 1966, 137 273) och 45 år (födda 1980, 133 173). Årets födda, 0 år, är 97 926."
  },
  "halland-geo": {
    fil: "halland-kommuner.geojson",
    namn: "Halland som GeoJSON",
    falt: "features[].properties → { id, kom_namn, lan_code }",
    kalla: "okfse/sweden-geojson, filtrerad på län 13",
    om: "Samma geometri i rå GeoJSON — för hallandskarta() som tar GeoJSON direkt."
  },

  // ── Härledda ──────────────────────────────────────────────────────────────
  "tatortstillvaxt": {
    harledd: ["tatorter"],
    namn: "Tätorternas tillväxt 2000→2024",
    falt: "{ tatort, kommun, bef2000, bef2024, forandring }",
    kalla: "Härlett ur tätortsdata",
    om: "En punkt per tätort som fanns båda åren — underlag för sambandsgrafer.",
    rakna: ([tat]) => {
      const vid = (ar) => new Map(tat.filter(d => d.år === ar).map(d => [d.tatort, d]));
      const a = vid(2000), b = vid(2024);
      return [...b.keys()]
        .filter(t => a.has(t) && a.get(t).befolkning > 0)
        .map(t => ({
          tatort: t,
          kommun: b.get(t).kommun,
          bef2000: a.get(t).befolkning,
          bef2024: b.get(t).befolkning,
          forandring: Math.round((b.get(t).befolkning / a.get(t).befolkning - 1) * 1000) / 10
        }));
    }
  },
  "ortshierarki": {
    harledd: ["tatorter"],
    namn: "Ortshierarki per kommun",
    falt: "{ region, rank, tatort, befolkning, kum_andel }",
    kalla: "Härlett ur tätortsdata 2024",
    om: "Tätorterna rangordnade inom varje kommun med kumulativ andel av kommunens tätortsbefolkning.",
    rakna: ([tat]) => {
      const nu = tat.filter(d => d.år === 2024);
      const rader = [];
      for (const kommun of [...new Set(nu.map(d => d.kommun))]) {
        const orter = nu.filter(d => d.kommun === kommun).sort((a, b) => b.befolkning - a.befolkning);
        const summa = orter.reduce((s, d) => s + d.befolkning, 0);
        let kum = 0;
        orter.forEach((d, i) => {
          kum += d.befolkning;
          rader.push({
            region: kommun,
            rank: i + 1,
            tatort: d.tatort,
            befolkning: d.befolkning,
            kum_andel: Math.round((kum / summa) * 1000) / 10
          });
        });
      }
      return rader;
    }
  },
  "upplatelse-2024": {
    harledd: ["upplatelseform"],
    namn: "Upplåtelseform senaste året",
    falt: "{ kommun, upplatelseform, andel, antal }",
    kalla: "SCB, bostadsbeståndet",
    om: "En rad per kommun och upplåtelseform — underlag för staplade och grupperade staplar.",
    rakna: ([upp]) => {
      const sista = Math.max(...upp.map(d => d.ar));
      return upp.filter(d => d.ar === sista)
        .map(({ kommun, upplatelseform, andel, antal }) => ({ kommun, upplatelseform, andel, antal }));
    }
  }
};

export const DATANAMN = Object.keys(DATASET);

// Hämta ett dataset. Cachar, så upprepade anrop kostar ingenting.
export async function ladda(namn) {
  if (cache.has(namn)) return cache.get(namn);
  const post = DATASET[namn];
  if (!post) throw new Error(`Okänt dataset: ${namn}. Finns: ${DATANAMN.join(", ")}`);

  const löfte = post.harledd
    ? Promise.all(post.harledd.map(ladda)).then(post.rakna)
    : fetch(new URL(post.fil, BAS)).then(r => {
        if (!r.ok) throw new Error(`Kunde inte läsa ${post.fil} (${r.status})`);
        return r.json();
      });

  cache.set(namn, löfte);
  return löfte;
}

// Hämta flera på en gång: const [bef, geo] = await laddaFlera("befolkning-kommuner", "halland-topo")
export async function laddaFlera(...namn) {
  return Promise.all(namn.map(ladda));
}
