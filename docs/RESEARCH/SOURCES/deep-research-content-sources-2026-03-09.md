# Commercially safe data sources for Terra Miner's quiz engine

**Wikidata (CC0) is your universal backbone, providing structured facts across all 10 knowledge domains with 100M+ items queryable via SPARQL.** Combined with US government sources (NASA, PubChem, USDA, NIST, ITIS), four CC0 museum APIs, and the EDRDG dictionary ecosystem for Japanese, you can assemble 10,000+ commercially safe facts per domain. However, European language vocabulary (Spanish, French, German) and Korean present a critical licensing gap — most open bilingual dictionaries use CC-BY-SA — requiring either creative workarounds or custom data creation. This report covers all 16 domains with verified sources, exact license terms, and ingestion strategies.

---

## Critical license verification results

Four specific licensing questions were investigated by visiting actual source websites:

**JMdict/EDICT (EDRDG)** is licensed under **CC-BY-SA 4.0** (updated from 3.0). The EDRDG license page states explicitly: *"There is NO restriction placed on commercial use of the files. The files can be bundled with software and sold for whatever the developer wants to charge. Software using these files does not have to be under any form of open-source licence."* Attribution must appear on an About/Sources screen accessible from the app menu — not just a splash screen. Apps must implement periodic data updates. **Commercial verdict: YES**, with attribution and SA applying only to the dictionary data if redistributed, not to app code.

**CC-CEDICT** carries **CC-BY-SA 4.0** (per the MDBG download page; the wiki still says 3.0). The MDBG page states it allows *"both non-commercial and commercial purposes"* with attribution and share-alike on data modifications. No special commercial exception beyond standard CC-BY-SA exists. **Commercial verdict: YES**, same conditions as JMdict.

**DBpedia** is dual-licensed under **CC-BY-SA 3.0 and GFDL**, mirroring Wikipedia. Commercial use is permitted under both licenses. The SA clause applies most strongly to redistribution of the structured dataset itself. Using extracted facts to generate quiz questions is generally considered transformative. Google, Samsung, and the BBC use DBpedia commercially. **Commercial verdict: CONDITIONAL** — safe for fact extraction into quiz questions with attribution, but avoid redistributing raw DBpedia data dumps.

**Tatoeba** sentences default to **CC-BY 2.0 FR** with no ShareAlike or NonCommercial restrictions. Some sentences are additionally available under CC0. The project states: *"We are not generally opposed to using our content for commercial purposes."* Audio files may carry NC restrictions and should be avoided. **Commercial verdict: YES** — the friendliest license of all four sources, requiring only attribution.

---

## Sources excluded for licensing violations

Several popular sources fail the strict licensing requirement and must be avoided:

- **Open Trivia Database** (opentdb.com): CC-BY-SA 4.0 — share-alike
- **REST Countries API**: Data derives from ODbL-licensed sources — share-alike
- **mledoze/countries** (GitHub): ODbL-1.0 — share-alike
- **Bowserinator/Periodic-Table-JSON**: CC-BY-SA 3.0 — share-alike
- **HYG Star Database**: CC-BY-SA 4.0 — share-alike
- **Open Food Facts**: ODbL — share-alike
- **IUCN Red List API**: Commercial use explicitly forbidden
- **Wiktionary/kaikki.org extracted data**: CC-BY-SA 3.0 — share-alike
- **FreeDict/WikDict**: CC-BY-SA or GPL — share-alike
- **UNESCO World Heritage Site data**: All rights reserved
- **FlavorDB**: CC-BY-NC 4.0 — non-commercial
- **Theoi.com**: Custom copyright, not openly licensed

---

## Wikidata as the universal quiz data backbone

Wikidata (CC0) at query.wikidata.org serves as the single most important source across all knowledge domains. The SPARQL endpoint returns JSON/CSV with a **60-second query timeout** and 5 concurrent queries per IP. Key strategies for large-scale extraction include: paginating with LIMIT/OFFSET, splitting queries by partition (continent, date range), using subqueries to defer label resolution, and avoiding deep `wdt:P279*` traversals on large hierarchies. For truly massive extraction (100K+ facts), download weekly dumps from dumps.wikimedia.org and process locally.

**Estimated Wikidata yield per domain**: Geography (~200 countries × 15 properties + 500K cities) | History (~10K battles, 1K wars, unlimited historical figures) | Natural Sciences (118 elements × 10 properties, 500K+ compounds) | Space (~6K exoplanets, 1K missions, 600 astronauts, 30K asteroids) | Mythology (~3K deities, 5K+ mythical characters) | Animals (millions of taxons, easily 100K with conservation data) | Health (~7K diseases, 5K anatomical structures) | Food (~8K dishes, 3K ingredients, 2K beverages) | Art (100K+ paintings, 50K buildings, 200K artists) | General Knowledge (1.2K World Heritage Sites, 900 Nobel laureates, unlimited cross-domain).

Sample SPARQL for geography (returns all countries with 10+ quiz-ready properties):
```sparql
SELECT ?country ?countryLabel ?capitalLabel ?population ?area 
       ?continentLabel ?currencyLabel ?languageLabel ?isoCode
WHERE {
  ?country wdt:P31 wd:Q6256.
  OPTIONAL { ?country wdt:P36 ?capital. }
  OPTIONAL { ?country wdt:P1082 ?population. }
  OPTIONAL { ?country wdt:P2046 ?area. }
  OPTIONAL { ?country wdt:P30 ?continent. }
  OPTIONAL { ?country wdt:P38 ?currency. }
  OPTIONAL { ?country wdt:P37 ?language. }
  OPTIONAL { ?country wdt:P297 ?isoCode. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

---

## Domain 1: General knowledge

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **Wikidata** | CC0 | SPARQL→JSON | 100M+ items | YES | ★★★★★ |
| **Nobel Prize API** | CC0 | REST→JSON | ~1,000 laureates | YES | ★★★★★ |
| **Library of Congress APIs** | US Gov PD | REST→JSON | Millions | YES | ★★★★ |
| **CIA World Factbook** (factbook.json) | CC0 | JSON/SQL/CSV | 266 entities × 200 fields | YES | ★★★★★ |

**Top 3 recommendations**: (1) Wikidata SPARQL queries targeting world records, famous firsts, inventions, Nobel laureates, and superlatives across domains — unlimited question generation potential. (2) Nobel Prize API at api.nobelprize.org/2.1/ — perfectly structured CC0 data for 660+ prizes with laureate names, nationalities, years, and prize motivations. (3) CIA World Factbook via github.com/factbook/factbook.json — **266 world entities with ~200 data fields each**, auto-updated weekly, CC0. Note: the CIA World Factbook website was retired February 4, 2026, but this GitHub archive preserves the complete dataset.

---

## Domain 2: Geography

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **CIA World Factbook** (factbook.json) | CC0 / PD | JSON, SQL, CSV | 266 entities × 200 fields | YES | ★★★★★ |
| **GeoNames** | CC-BY 4.0 | TSV bulk, REST API | 25M+ names | YES | ★★★★★ |
| **Natural Earth** | Public Domain | Shapefile, GeoJSON | 209 states + features | YES | ★★★★ |
| **Wikidata Geography** | CC0 | SPARQL→JSON | 200K+ entities | YES | ★★★★★ |
| **World Bank Open Data** | CC-BY 4.0 | CSV, JSON, API | 16K indicators, 200+ economies | YES | ★★★★★ |

**Top 3 recommendations**: (1) CIA World Factbook — richest single source for country-level quiz questions covering population, GDP, area, languages, religions, government type, natural resources, coastline length, elevation extremes, and 190+ more fields. (2) GeoNames — **25 million geographical names** with 12 million unique features including populated places, mountains, rivers, and lakes. CC-BY 4.0 requires attribution. (3) World Bank Open Data — **16,000 time series indicators** across 200+ economies via api.worldbank.org (no API key required), perfect for comparative geography questions.

---

## Domain 3: History

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **Wikidata History** | CC0 | SPARQL→JSON | 10K+ battles, 1K+ wars | YES | ★★★★★ |
| **CIA World Factbook** | CC0 / PD | JSON | 266 country histories | YES | ★★★★ |
| **Nobel Prize API** | CC0 | REST→JSON | 660+ prizes (1901–) | YES | ★★★★★ |
| **Library of Congress** | US Gov PD | REST→JSON | Millions of items | YES | ★★★★ |

**Top 3 recommendations**: (1) Wikidata SPARQL — the strongest commercially safe source for structured historical data, enabling queries for all battles with dates/locations/belligerents, wars with start/end dates, inventions with inventors/dates, treaties with signatories, and historical figures filtered by era. (2) CIA World Factbook country "Background" sections — each profile contains narrative history covering independence dates, colonial history, and major political events. (3) Nobel Prize API for 20th/21st century milestones in science, literature, and peace.

---

## Domain 4: Natural sciences

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **PubChem** (NIH) | US Gov PD | REST→JSON/CSV | **119M compounds** | YES | ★★★★★ |
| **NIST Physical Constants** | US Gov PD | Structured data | 350+ constants | YES | ★★★★★ |
| **NIST Atomic Data** | US Gov PD | Web/structured | All elements | YES | ★★★★ |
| **Frictionless Periodic Table** | CC0 | CSV + JSON | 118 elements | YES | ★★★★★ |
| **USGS Mineral Resources** | US Gov PD | CSV, GIS | 111K+ records | YES | ★★★ |
| **Wikidata Chemistry** | CC0 | SPARQL→JSON | 118 elements + 500K compounds | YES | ★★★★★ |

**Top 3 recommendations**: (1) PubChem PUG-REST API — query any named compound for molecular formula, weight, properties, and structure. Example: `pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/property/MolecularFormula,MolecularWeight/JSON`. Public domain, no restrictions. (2) NIST CODATA Fundamental Physical Constants — **350+ constants** (speed of light, Planck's constant, Avogadro's number) with values, uncertainties, and units. US government public domain. (3) Wikidata periodic table query returns all 118 elements with atomic number, symbol, mass, melting/boiling points, discoverer, and discovery date under CC0.

**Note**: The Bowserinator Periodic-Table-JSON (25+ fields per element, best dataset) is CC-BY-SA 3.0 and fails the license constraint. Combine the simpler CC0 Frictionless dataset with NIST data to recreate equivalent coverage under clean licensing.

---

## Domain 5: Space and astronomy

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **NASA Open APIs** | US Gov PD | REST→JSON | Varies | CONDITIONAL | ★★★★★ |
| **NASA Exoplanet Archive** | US Gov PD | CSV, TAP API | **6,128+ exoplanets** | YES | ★★★★★ |
| **JPL Solar System Dynamics** | US Gov PD | REST→JSON | 1.3M+ small bodies | YES | ★★★★★ |
| **Astronaut Database** (Mendeley) | CC-BY 4.0 | CSV | 564 astronauts | YES | ★★★★ |
| **Wikidata Space** | CC0 | SPARQL→JSON | 800+ exoplanets, 1K missions | YES | ★★★★★ |

**Top 3 recommendations**: (1) NASA Exoplanet Archive — **6,128+ confirmed exoplanets** with planet name, host star, orbital period, radius, mass, discovery method, year, and facility. Gold-standard data accessible via Table Access Protocol. (2) JPL Solar System Dynamics APIs — **1.3 million small bodies** plus comprehensive orbital data for all solar system objects. Cache data locally for the app rather than querying live. (3) NASA Open APIs — APOD (11,000+ daily astronomy images with rich descriptions since 1995), NeoWs (asteroid close-approach data), and Mars Rover photos (800,000+). Free API key at api.nasa.gov. Must not imply NASA endorsement.

**Note**: The HYG Star Database (~120K stars with names, magnitudes, spectral types) would be ideal but is CC-BY-SA 4.0. Use the raw Hipparcos catalog (ESA) or Wikidata star queries as alternatives.

---

## Domain 6: Mythology and folklore

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **Wikidata Mythology** | CC0 | SPARQL→JSON | ~3K deities, 5K+ characters | YES | ★★★★★ |
| **MANTO** (Mythlab) | CC-BY 4.0 | Linked Open Data | ~5,400 entities | YES | ★★★★ |
| **FactGrid Roscher Project** | CC0 | SPARQL | 15,000+ entities (growing) | YES | ★★★★ |
| **Dariusk/Corpora** | CC0 | JSON | ~200-500 mythology entries | YES | ★★★ |
| **kamiranoff/greek-mythology-data** | ISC (permissive) | JSON | ~330 figures | YES | ★★ |

**Top 3 recommendations**: (1) Wikidata mythology queries — the only source covering ALL world mythologies (Greek, Norse, Japanese, Egyptian, Hindu, Celtic, Mesoamerican) under CC0. Key properties include P8083 (part of mythology), P361 (part of), family relationships (P22 father, P25 mother, P26 spouse), and P31 (instance of deity/creature). Uneven coverage — Greek/Roman well-represented, others sparser. (2) FactGrid's Roscher's Lexikon Project — **15,000+ mythological entities** being digitized from the comprehensive 19th-century mythology encyclopedia (public domain source material, 1884–1937). Interlinks with Wikidata. (3) MANTO — scholarly-grade Greek mythology data with **4,800+ mythological agents**, 300 collectives, and 350 objects, linked to ancient source texts and geographic locations via Pleiades identifiers. CC-BY 4.0.

**Gap alert**: This domain is structurally thin compared to geography or science. Combining all three recommended sources yields roughly **20,000+ mythology entities**, but many lack the rich property coverage needed for diverse quiz questions. Supplementing with programmatic enrichment from OpenStax World History (CC-BY 4.0) and Wikidata cross-domain queries is recommended.

---

## Domain 7: Animals and wildlife

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **ITIS** | US Gov PD | DwC-A, REST API | **839,000+ names** | YES | ★★★★★ |
| **GBIF** (filtered CC0/CC-BY) | CC0/CC-BY | DwC-A, CSV, API | 2.5B+ occurrences | YES (filter!) | ★★★★ |
| **Wikidata Taxonomy** | CC0 | SPARQL→JSON | Millions of taxons | YES | ★★★★★ |
| **NHM London Data Portal** | CC0 (data) / CC-BY (media) | DwC-A, CSV, API | ~5M+ specimens | YES | ★★★★ |
| **Smithsonian Open Access** | CC0 | JSON, API | 5.1M+ items | YES | ★★★★ |
| **Dariusk/Corpora Animals** | CC0 | JSON | ~500 entries | YES | ★★ |

**Top 3 recommendations**: (1) ITIS (itis.gov) — authoritative US federal taxonomy database with **839,000+ scientific names** covering all seven kingdoms of life, with common names, full taxonomic hierarchy, synonyms, and unique Taxonomic Serial Numbers. Public domain, REST API available without registration. (2) Wikidata taxonomy queries — millions of taxon items with conservation status (P141), parent taxon (P171), common name (P1843), and habitat (P2974). Must use LIMIT constraints as the dataset is Wikidata's largest domain. (3) GBIF — **2.5 billion+ occurrence records** covering 1.6M+ species. Must filter for CC0/CC-BY datasets at download time to exclude the ~18% that carry CC-BY-NC.

**Critical exclusion**: The IUCN Red List API explicitly forbids commercial use. Conservation status data should instead be sourced from Wikidata (which imports IUCN data as CC0 structured facts).

---

## Domain 8: Human body and health

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **USDA FoodData Central** | CC0 | REST API, CSV | 400K+ foods | YES | ★★★★★ |
| **OpenStax Anatomy & Physiology 2e** | CC-BY 4.0 | HTML, PDF, CNXML | 28 chapters | YES | ★★★★ |
| **MedlinePlus** (NLM portions) | US Gov PD | XML, JSON API | 1,000+ health topics | YES (partial) | ★★★★ |
| **MeSH** (Medical Subject Headings) | US Gov PD | XML, JSON | 30,000+ descriptors | YES | ★★★★ |
| **Wikidata Health** | CC0 | SPARQL→JSON | 7K+ diseases, 5K+ organs | YES | ★★★★★ |

**Top 3 recommendations**: (1) Wikidata health queries — **7,000+ diseases** with symptoms (P780), treatments (P2176), and medical specialty (P1995), plus 5,000+ anatomical structures. CC0. (2) USDA FoodData Central — the gold standard for nutrition quiz content with **400,000+ food items** and up to 117 nutrients per item, including calories, macronutrients, vitamins, and minerals. CC0, free API at api.nal.usda.gov. (3) OpenStax Anatomy & Physiology 2e — peer-reviewed, complete human anatomy textbook across 28 chapters covering every body system. CC-BY 4.0. Requires NLP processing to extract quiz-ready facts from textbook prose, but content is comprehensive and accurate.

**Caution**: MedlinePlus contains mixed-copyright content — only NLM-authored health topic summaries are public domain. A.D.A.M. Medical Encyclopedia articles and AHFS drug monographs are copyrighted and must be avoided.

---

## Domain 9: Food and world cuisine

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **USDA FoodData Central** | CC0 | REST API, CSV | 400K+ foods | YES | ★★★★★ |
| **Wikidata Food** | CC0 | SPARQL→JSON | 10–30K food entities | YES | ★★★★★ |
| **FAOSTAT** | CC-BY 4.0 + restrictions | CSV | Millions of data points | CONDITIONAL | ★★★ |

**Top 3 recommendations**: (1) Wikidata food queries — **10,000–30,000+ food/cuisine items** with country of origin (P495), ingredients (P527), cuisine type (P2012), and images. The WikiProject Food actively curates this data. Best source for cultural food trivia like "What country does sushi originate from?" CC0. (2) USDA FoodData Central — unmatched for nutrition-based questions with authoritative nutrient composition data. Perfect for "Which has more Vitamin C?" comparison questions. (3) FAOSTAT for food production statistics ("Which country produces the most rice?"), though its additional terms prohibiting use "in conjunction with the promotion of a commercial enterprise" create ambiguity — **legal review recommended**.

**Gap alert**: This domain is structurally thinner than others for commercially safe sources. Open Food Facts (3M+ products, 150+ countries) would be ideal but uses ODbL (share-alike). FlavorDB is CC-BY-NC. The recommended strategy is to lean heavily on Wikidata for cultural/culinary facts and USDA for nutritional data, supplemented by programmatic quiz generation from these two sources.

---

## Domain 10: Art and architecture

| Source | License | Format | Records | Commercial | Ingestion |
|--------|---------|--------|---------|------------|-----------|
| **Met Museum Open Access** | CC0 | CSV (GitHub), REST API | **470,000+ artworks** | YES | ★★★★★ |
| **Art Institute of Chicago** | CC0 / CC-BY 4.0 | REST API, JSONL bulk | 131,000+ artworks | YES | ★★★★★ |
| **Rijksmuseum** | CC0 | JSON, LOD APIs | **800,000+ objects** | YES | ★★★★★ |
| **Cleveland Museum of Art** | CC0 | REST API, CSV (GitHub) | 61,500+ works | YES | ★★★★★ |
| **Getty Vocabularies** (AAT, ULAN, TGN) | ODC-By 1.0 | LOD, XML, SPARQL | **460K+ combined** | YES | ★★★★ |
| **Wikidata Art** | CC0 | SPARQL→JSON | 100K+ paintings, 200K+ artists | YES | ★★★★★ |
| **Smithsonian Open Access** | CC0 | JSON, API | 5.1M+ items | YES | ★★★★ |

**Top 3 recommendations**: (1) Metropolitan Museum of Art — **470,000+ artworks** spanning 5,000 years with rich metadata (title, artist, date, medium, culture, period, classification, geography). CC0, available via both GitHub CSV and REST API. The premier source for art quiz content. (2) Getty Vocabularies — **77,000 art/architecture concepts** (AAT), **380,000+ artist records** (ULAN), and **2.4 million place names** (TGN). Professionally curated, authoritative definitions of art movements, styles, techniques, and materials. ODC-By 1.0 (attribution only, no share-alike). (3) Rijksmuseum — **800,000+ objects** with CC0 data and images, strongest for Dutch Golden Age and European art. Combined with the Met, AIC, and CMA, these four museum APIs provide **1.46 million CC0 artwork records**.

This is the richest domain for commercially safe data. The four CC0 museum APIs alone far exceed the 10,000-fact threshold.

---

## Language domains: Japanese vocabulary

| Source | License | Format | Records | Commercial | Fields |
|--------|---------|--------|---------|------------|--------|
| **JMdict** (via jmdict-simplified) | CC-BY-SA 4.0 | JSON | **214,000+ entries** | YES | Word, reading, meaning, POS, examples |
| **KANJIDIC2** | CC-BY-SA 4.0 | JSON | ~13,000 kanji | YES | Readings, meanings, stroke count, grade |
| **Waller JLPT Lists** (tanos.co.uk) | CC-BY | Various | ~8,000 words | YES | Word, reading, JLPT level |
| **yomitan-jlpt-vocab** | CC-BY | GitHub | ~8,000 words | YES | JMdict entry IDs + JLPT level |
| **Tatoeba JA-EN** | CC-BY 2.0 FR | TSV | ~250,000 pairs | YES | Sentence pairs with author IDs |
| **scriptin/kanji-frequency** | CC-BY 4.0 | JSON | Multi-corpus | YES | Kanji frequency data |
| **RADKFILE/KRADFILE** | CC-BY-SA 4.0 | Text/JSON | ~6,355 kanji | YES | Radical decomposition |

**Recommended pipeline**: Download jmdict-simplified JSON (github.com/scriptin/jmdict-simplified, auto-updated weekly) as the base dictionary. Merge JLPT N5–N1 level tags using stephenmk/yomitan-jlpt-vocab, which maps the widely-accepted Waller CC-BY lists to JMdict entry IDs. Use JMdict's built-in priority fields (`ke_pri`/`re_pri` with `news1/2`, `ichi1/2`, `nfxx` frequency bands) for frequency ranking. Add kanji data from KANJIDIC2 and example sentences from JMdict_e_examp.xml (which includes curated Tatoeba examples mapped to dictionary entries).

**Key limitation**: JMdict does NOT contain JLPT level tags natively — these must be merged from the Waller lists. No official JLPT vocabulary lists exist; all available lists are community-compiled approximations. The BCCWJ frequency list (gold-standard corpus data) is restricted to "research or educational purposes" and cannot be used commercially.

**Attribution requirement**: Create an About/Sources screen listing EDRDG JMdict/KANJIDIC (CC-BY-SA 4.0 with link), Tatoeba (CC-BY 2.0 FR), and Jonathan Waller JLPT lists (CC-BY).

---

## Language domains: Spanish, French, and German vocabulary

| Source | License | Format | Records | Commercial | Translations? | CEFR? |
|--------|---------|--------|---------|------------|---------------|-------|
| **Leipzig Corpora** | CC-BY 4.0 | Text | 10K–1M words/lang | YES | No | No |
| **Tatoeba** (per language) | CC-BY 2.0 FR | TSV | 58K–80K EN pairs | YES | Yes (sentences) | No |
| **Leeds Corpus Freq Lists** | CC-BY 2.5 | Text | ~10K–50K words | YES | No | No |
| **Panlex Swadesh Lists** | CC0 | Text | 110–207 words | YES | Yes | No |

**This is the most significant gap in the entire dataset strategy.** The strict exclusion of CC-BY-SA eliminates virtually all pre-built bilingual dictionary data for European languages — including Wiktionary extracts (kaikki.org), FreeDict, WikDict, hermitdave/FrequencyWords, wordfreq data files, and Lexique.org (French). CEFRLex (FLELex for French, ELELex for Spanish) provides CEFR-graded frequency data but has no explicit commercial license — the site says "research or teaching" only.

**Recommended workaround strategy**: (1) Use Leipzig Corpora Collection (CC-BY 4.0, 270+ languages) for monolingual frequency-ranked word lists. (2) Use Tatoeba for bilingual example sentences (~74K Spanish-EN, ~58K French-EN, ~80K German-EN pairs). (3) **Generate English translations and CEFR level assignments programmatically via the Claude Haiku API** — feed the top 10,000 frequency-ranked words from Leipzig into Haiku with prompts like "Provide the English translation, part of speech, and estimated CEFR level (A1–C2) for this [language] word." This creates original CC0 data owned by you. (4) Approximate CEFR levels from frequency rank using the established mapping: A1 ≈ top 500 words, A2 ≈ 1,000, B1 ≈ 2,000, B2 ≈ 3,500, C1 ≈ 5,000, C2 ≈ 8,000+. (5) Contact UCLouvain's CENTAL team about commercial licensing for CEFRLex data.

**Per-language notes**: No open data from RAE (Spanish), Institut Cervantes, Goethe-Institut, or DELF/DALF institutions. Goethe-Zertifikat word lists are published only in copyrighted exam prep materials. Frantext requires subscription. DWDS (German) is copyrighted.

---

## Language domains: Mandarin Chinese

| Source | License | Format | Records | Commercial | Key Fields |
|--------|---------|--------|---------|------------|------------|
| **complete-hsk-vocabulary** | MIT | JSON | **~11,000+ words** | YES | Simplified, traditional, pinyin, definitions, POS, HSK level, frequency |
| **ivankra/hsk30** | MIT | CSV | ~11,000+ (HSK 3.0) | YES | Simplified, traditional, pinyin, POS, level |
| **Unicode Unihan Database** | Unicode License | TSV | 98,000+ characters | YES | Pinyin, definition, radical, stroke |
| **Tatoeba CMN-EN** | CC-BY 2.0 FR | TSV | ~29K–59K pairs | YES | Sentence pairs |

Chinese is well-served under strict licensing. The **complete-hsk-vocabulary** GitHub repo (MIT license, 117 stars) provides everything needed: both HSK 2.0 (levels 1–6, 5,000 words) and HSK 3.0 (levels 1–9, ~11,000 words) with simplified Chinese, traditional Chinese, pinyin, English definitions, part of speech, HSK level, and frequency rank in clean JSON. Supplement with the Unicode Unihan Database for character-level enrichment (98,000+ CJK ideographs with readings, definitions, radical/stroke data under the permissive Unicode License).

**HSK transition note**: HSK 2.0 exams remain valid until July 2026 when HSK 3.0 officially launches. The November 2025 revision significantly reduced vocabulary for levels 1–5 from the original 2021 HSK 3.0 proposal. Both versions are covered in the recommended repo.

**CC-CEDICT exclusion**: Though it's the gold-standard Chinese-English dictionary (~123,500 entries), CC-CEDICT is CC-BY-SA 4.0 and fails the strict constraint. The complete-hsk-vocabulary repo may derive some definitions from CC-CEDICT — verify whether this creates a derivative work concern before relying on it.

---

## Language domains: Korean

| Source | License | Format | Records | Commercial | Key Fields |
|--------|---------|--------|---------|------------|------------|
| **Tatoeba KOR-EN** | CC-BY 2.0 FR | TSV | **6,394 pairs** | YES | Sentence pairs |
| **Official TOPIK Lists** | Unclear (gov't) | Excel/PDF | ~5,750 words | UNCERTAIN | Korean, English, POS, level |
| **Unicode Unihan** | Unicode License | TSV | CJK chars | YES | Korean readings per character |

**Korean presents the most critical data gap.** Almost all structured Korean-English dictionary data uses incompatible licenses: KRDict/NIKL (CC-BY-SA 2.0 KR), KENGDIC (MPL/LGPL), NIKL frequency lists (CC-BY-SA). Korean government publications are NOT automatically public domain (unlike US federal works), so the official TOPIK vocabulary lists (~5,750 words labeled "공개"/public) have uncertain redistribution terms.

**Recommended approach**: (1) Seek legal counsel on using official TOPIK vocabulary lists — they're published by a government educational agency and labeled "public," but explicit open licensing is absent. (2) Use Tatoeba's 6,394 Korean-English sentence pairs (CC-BY 2.0 FR) as a starting point. (3) **Commission original Korean vocabulary data creation** — hire Korean linguists to create a MIT/CC0 word list covering TOPIK levels 1–6 with Korean, romanization, English meaning, POS, and level. This appears to be a genuine gap in the open data ecosystem. (4) Use the Claude Haiku API to generate romanization, difficulty levels, and example sentences for Korean words extracted from Tatoeba sentences.

---

## Verified institutional sources summary

| Source | License | Commercial | Records | API | Quiz Quality |
|--------|---------|------------|---------|-----|-------------|
| NASA Open APIs | US Gov PD | CONDITIONAL | Varies | YES | ★★★★★ |
| PubChem | US Gov PD | YES | 119M compounds | YES | ★★★★★ |
| GBIF | CC0/CC-BY/CC-BY-NC mixed | CONDITIONAL (~82% OK) | 3.1B+ | YES | ★★★★ |
| Smithsonian Open Access | CC0 | YES | **5.1M+ items** | YES | ★★★★★ |
| NHM London | CC0 (data) / CC-BY (media) | YES | ~5M+ | YES | ★★★★ |
| World Bank Open Data | CC-BY 4.0 | YES | 16K indicators | YES (no key!) | ★★★★★ |
| USDA FoodData Central | CC0 | YES | 400K+ foods | YES | ★★★★★ |
| Met Museum | CC0 | YES | 470K+ artworks | YES + GitHub | ★★★★★ |
| Art Institute of Chicago | CC0 / CC-BY 4.0 | YES | 131K artworks | YES | ★★★★★ |
| OpenStax Textbooks | CC-BY 4.0 (most) | YES (except Calculus) | 50+ titles | Partial | ★★★★ |

**Corrections from initial assumptions**: GBIF is NOT uniformly CC0 — approximately 18% of records carry CC-BY-NC and must be filtered out at download time. Smithsonian has grown to 5.1M+ items (up from the often-cited 4.7M). Met Museum has 470,000+ artworks (not the 490K+ stated in the task). NASA data requires not implying endorsement. OpenStax lacks dedicated Nutrition and Art Appreciation textbooks.

**OpenStax CC-BY 4.0 textbooks confirmed for quiz extraction**: Biology 2e, Anatomy & Physiology 2e, Chemistry 2e, University Physics Vols 1-3, Astronomy 2e, Psychology 2e, World History Vols 1-2. Calculus is CC-BY-NC-SA and must be excluded.

---

## Highest-priority data ingestion plan

The most efficient path to 10,000+ facts per domain combines three tiers:

**Tier 1 — Immediate, high-volume, zero-friction** (CC0, JSON APIs, no attribution needed): Wikidata SPARQL across all domains, USDA FoodData Central, Met Museum API, Smithsonian API, Nobel Prize API, CIA World Factbook JSON.

**Tier 2 — High-volume, requires attribution** (CC-BY, public domain with conditions): NASA APIs, World Bank Open Data, GeoNames, Art Institute of Chicago, Rijksmuseum, OpenStax textbooks, ITIS, Getty Vocabularies, Tatoeba sentences.

**Tier 3 — Specialized, requires SA compliance** (CC-BY-SA, commercially permitted with care): JMdict/KANJIDIC for Japanese, CC-CEDICT for Chinese (if complete-hsk-vocabulary proves insufficient), DBpedia for supplementary structured data. SA applies to the data if redistributed, not to app code or generated quiz questions.

**For language vocabulary**: Japanese and Chinese are well-covered. Spanish, French, German, and Korean all require the workaround strategy of using Leipzig Corpora frequency lists + Tatoeba sentences + programmatic enrichment via Claude Haiku to generate translations and CEFR/proficiency level assignments, creating original data you own outright.

The total commercially safe, structured fact potential across all 10 knowledge domains conservatively exceeds **5 million extractable data points** from the sources identified, with Wikidata alone capable of serving as the primary source for every domain. The recommended architecture uses Wikidata as the universal backbone, enriched with domain-specific authoritative sources (NASA for space, PubChem for chemistry, USDA for nutrition, ITIS for taxonomy, museum APIs for art), and the Claude Haiku API for transforming raw structured data into polished quiz questions with plausible distractors.