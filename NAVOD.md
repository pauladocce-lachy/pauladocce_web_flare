# Paula Docce — kompletní nasazení bez Supabase

**Výsledek:** veřejná stránka na GitHub Pages načítá `data/pricing.json`; administrace přes Cloudflare Worker zapisuje změny do stejného souboru prostřednictvím GitHub API. Cloudflare Worker **není databáze** a nepoužívá žádnou Cloudflare D1/KV ani Supabase.

## Než začnete

- Máte přístup ke GitHub účtu vlastníka repozitáře a novému Cloudflare účtu.
- Připravte si **vlastní silné heslo správce**, přihlašovací e-mail a náhodný klíč relace. **Nezapisujte heslo ani GitHub token do webových souborů.**
- **POZOR NA CENY:** v dodaném původním ZIPu byly pouze částečné zkušební údaje v `data/pricing.json`, bez skutečných cen ze Supabase. Nová verze má záměrně prázdné ceny. PŘED zveřejněním nebo hned po zprovoznění administrace doplňte aktuální ceny. Můžete je předtím ručně exportovat ze Supabase, pokud k ní stále máte přístup; tento projekt je ale **nesynchronizuje ani automaticky nemigruje**.
- Doporučení: nejdřív nasadit vše do TESTOVACÍHO repozitáře, následně nahradit aktuální web, aby návštěvníci dočasně neviděli prázdný ceník.

## 1. GitHub — nahrání souborů

1. Přihlaste se na https://github.com a otevřete repozitář svého webu Paula Docce. Jeho přesný název uvidíte jako `MAJITEL/REPOZITAR`.
2. **Zazálohujte původní repozitář** (Code → Download ZIP; případně vytvořte nový testovací repozitář).
3. V ZIPu otevřete složku `pauladocce-web-main`. Nahrajte **obsah složky** (soubor `index.html` musí být přímo v kořeni repozitáře, nikoli v další vnořené složce). Přepište původní soubory. GitHub: **Add file → Upload files → Commit changes**.
4. **Smažte z repozitáře staré soubory**, pokud tam zůstaly z předchozí verze: `admin/feedback.html`, `admin/js/feedback.js`, `admin/js/feedbackSupabase.js`, `admin/js/supabase.js`, `js/supabase.js`. Nahrání ZIPu na GitHub samo staré soubory nesmaže! Soubor je možné na GitHub otevřít → tři tečky → Delete file → Commit.
5. Ověřte v **Settings → Pages**, že zdroj je `Deploy from a branch`, větev `main` (nebo vaše publikovaná větev), složka `/(root)`. Je-li web publikovaný jinak (např. GitHub Actions), ponechte fungující konfiguraci a použijte příslušnou větev.
6. Po uložení zkontrolujte, že funguje hlavní stránka, `cenik.html` a veřejný soubor `data/pricing.json`. Ceník bude zpočátku mít prázdné ceny; podle bodu 1 výše **nezveřejňujte bez kontroly**.
7. Zapište si dvě hodnoty pro Worker: `GH_OWNER` = GitHub uživatelské jméno či název organizace; `GH_REPO` = přesný název repozitáře. `GH_BRANCH` = publikovaná větev, obvykle `main`.

## 2. GitHub — vytvoření přístupového tokenu

1. Klikněte na profilový obrázek → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Nastavte název například `PaulaDocce Cloudflare Worker` a expiraci (např. 90 dní; po vypršení musíte token obnovit).
3. **Resource owner** = vlastník repozitáře a **Repository access → Only select repositories** = vyberte pouze repozitář PaulaDocce.
4. **Repository permissions → Contents → Read and write**. Ostatní práva nepotřebujete. Pokud je repozitář organizační, může být nutné schválení správcem.
5. Klikněte na **Generate token**. Jednorázově si ho zkopírujte do bezpečného správce hesel. **Nikdy jej nevkládejte do GitHub repozitáře, HTML ani JS.**

Dokumentace GitHub API: https://docs.github.com/en/rest/repos/contents

## 3. Cloudflare — nový účet a Worker

1. Zaregistrujte se nebo přihlaste na https://dash.cloudflare.com/.
2. Otevřete **Workers & Pages** → **Create application / Create** → zvolte **Worker**. (Názvy tlačítek se mohou v průběhu času měnit.)
3. Vytvořte Worker například s názvem `pauladocce-api`. Cloudflare přidělí veřejnou URL podobnou `https://pauladocce-api.NAZEV_UCTU.workers.dev`.
4. V editoru Workeru zvolte **Edit code**, nahraďte celý původní příklad obsahem **`cloudflare-worker/worker.js`** a klikněte na **Deploy / Save and deploy**. Soubor používá moderní **ES module** syntaxi `export default { async fetch(...) {} }`.
5. Otevřete **Worker → Settings → Variables and Secrets → Add**, přidejte následující položky. U všech citlivých údajů zvolte **Secret**, nikoli veřejný Text:

| Název | Typ | Hodnota (příklad / co vložit) |
|---|---|---|
| `GH_OWNER` | Text | Vaše GitHub uživatelské jméno, např. `moje-jmeno` |
| `GH_REPO` | Text | Přesný název repozitáře, např. `pauladocce-web` |
| `GH_BRANCH` | Text | `main` (případně skutečná publikovaná větev) |
| `ALLOWED_ORIGIN` | Text | Např. `https://moje-jmeno.github.io` — jen protokol a doména, **bez cesty, bez koncového `/`**. Pokud používáte vlastní doménu, třeba `https://pauladocce.cz`, uveďte ji místo GitHub adresy. Pro obě varianty vložte `https://moje-jmeno.github.io,https://pauladocce.cz` |
| `ADMIN_EMAIL` | **Secret** | E-mail pro přihlášení správce, který si sami určíte |
| `ADMIN_PASSWORD` | **Secret** | Vaše jedinečné silné heslo (doporučuji 20+ znaků) |
| `SESSION_SECRET` | **Secret** | Jiný náhodný dlouhý řetězec, min. 32 znaků. Na počítači lze vygenerovat např. `openssl rand -hex 32` nebo v bezpečném generátoru hesel |
| `GITHUB_TOKEN` | **Secret** | Fine-grained token vytvořený v kroku 2 |

6. Uložte a **Deploy** nastavení. **Nemusíte přidávat Cloudflare databázi, D1 binding, doménu ani DNS záznamy**, pokud používáte přidělenou `workers.dev` adresu.
7. Zkontrolujte, že Worker má povolenou adresu `workers.dev`. Pokud se zobrazuje stav disabled, zapněte ji v Settings → Domains & Routes. Pokud v adrese Cloudflare Workeru otevřete `/pricing` přímo bez přihlášení a bez Origin hlavičky, odpověď `403` je **očekávaná** a znamená, že Worker existuje, nikoli že je rozbitý.

Návod Cloudflare k secretům: https://developers.cloudflare.com/workers/configuration/secrets/

## 4. Propojení webu s Workerem

1. V repozitáři otevřete soubor `admin/js/config.js`, klikněte **Edit (tužka)**.
2. Nahraďte text `DOPLNIT_URL_CLOUDFLARE_WORKERU` skutečnou **HTTPS adresou** svého Workeru. Příklad:

   `window.PAULA_API_URL = "https://pauladocce-api.MUJUCET.workers.dev";`

   Neuvádějte `/login`, `/pricing` ani koncové lomítko.
3. **Commit changes**. Po dokončení GitHub Pages deploymentu otevřete `https://ADRESA-WEBU/admin/index.html` (na projektových GitHub Pages může být cesta `/NAZEV-REPO/admin/index.html`).
4. Zadejte **stejný e-mail a heslo**, které jste uložili jako `ADMIN_EMAIL` a `ADMIN_PASSWORD` v Cloudflare.
5. **Dashboard → Ceník**. Vyplňte skutečné ceny, přidejte/smažte/přeuspořádejte služby a klikněte **Uložit změny**.
6. Otevřete na GitHubu soubor `data/pricing.json`. Po úspěšném uložení bude automaticky aktualizovaný novým commitem. Až doběhne publikování GitHub Pages, zkontrolujte `cenik.html` a úvodní stránku; někdy pomůže vynucené obnovení (Ctrl+F5).

**Tip:** V administraci si doplňte ceny včetně jednotek, např. `450 Kč`, `od 700 Kč`, `dle domluvy`. Prázdná hodnota se na veřejném webu zobrazuje jako `–`.

## 5. Ověření fungování (checklist)

- [ ] `index.html` i `cenik.html` se zobrazují bez chyby a mají původní grafiku.
- [ ] V administraci jde zadat e-mail a heslo a přihlásit se.
- [ ] Nesprávné heslo vrací srozumitelnou chybu.
- [ ] Po přidání služby, změně ceny a kliknutí Uložit vznikne GitHub commit.
- [ ] Po dokončení GitHub Pages deploy se cena zobrazí na veřejném webu.
- [ ] Po obnovení administrace zůstanou změny zachované.
- [ ] Odhlášení funguje; citlivý GitHub token ani heslo nejsou nikde ve veřejném repozitáři.
- [ ] Připomínky a odkazy na ně neexistují ani v repozitáři (staré soubory jste skutečně smazali).

## Bezpečnost a důležité poznámky

- Přihlašování probíhá **na Cloudflare Workeru**; uživateli nikdy neodesíláme GitHub token. Heslo je uloženo jako Cloudflare Secret (ne ve webu); krátkodobá podepsaná relace je v `sessionStorage` pro danou kartu prohlížeče a platí nejvýše 8 hodin. Tlačítko Odhlásit relaci odstraní z prohlížeče. Při změně `ADMIN_PASSWORD` nebo `SESSION_SECRET` dřívější relace přestanou platit.
- Cloudflare Worker kontroluje CORS (povolené webové domény), validuje data, používá verzování GitHub souboru a základní omezování neúspěšných pokusů v jedné instanci. **CORS není náhradou za přihlášení a jednoduché omezování není globální ochranou.** Doporučujeme přidat pravidlo Cloudflare Rate Limiting/WAF podle možností účtu a použít dlouhé heslo. Nedávejte Worker URL do veřejného odkazu s tajnými údaji (žádné nejsou potřeba).
- GitHub Pages je statický hosting. Úprava `data/pricing.json` vytvoří commit v repozitáři; **na veřejném webu se změna neprojeví okamžitě**, ale po publikaci stránky. Pokud publikace selže, zkontrolujte **Actions** a **Settings → Pages**.
- GitHub API má pravidla / limity; neukládejte ceník každou sekundu. GitHub branch protection, expirace tokenu nebo 2FA požadavky organizace mohou zápis blokovat.
- Staré stránky na GitHub Pages jsou veřejné až do chvíle, kdy je smažete z repozitáře a doběhne deployment. Odkazy `noindex` a `robots.txt` **nejsou ochrana heslem**.
- Pro případ nouze je každý ceník zaznamenaný jako GitHub commit: **History → Restore / Revert**.
- Projekt zatím neobsahuje reálné credentials ani cloudové nasazení. Je nutné jej připojit k **vašemu** GitHub a Cloudflare účtu podle tohoto návodu.

## Co je v balíčku

- `index.html`, `cenik.html`, `css`, `images` — původní vzhled veřejného webu
- `js/pricingData.js`, `js/homePricing.js`, `js/pricing.js` — načtení veřejného JSON ceníku
- `data/pricing.json` — jediný datový soubor ceníku
- `admin/` — přihlašování, dashboard, editor a nastavení API
- `cloudflare-worker/worker.js` — serverová část, vložit do Cloudflare Workeru
- `tests/worker.test.mjs`, `tests/client.test.mjs`, `tests/static.test.mjs` — lokální testy (`node tests/worker.test.mjs`, `node tests/client.test.mjs`, `node tests/static.test.mjs`)

**Závěr:** GitHub = vaše data a stránky, Cloudflare Worker = bezpečný most k zápisu. Žádná Supabase.
