"use strict";

const WB = [
  "SP.POP.TOTL", "SP.POP.GROW", "SP.DYN.CBRT.IN", "SP.DYN.CDRT.IN", "SP.DYN.TFRT.IN",
  "SP.DYN.LE00.IN", "SP.DYN.LE00.FE.IN", "SP.DYN.LE00.MA.IN", "NY.GDP.PCAP.CD",
  "NY.GDP.MKTP.KD.ZG", "SI.POV.NAHC", "SE.ADT.LITR.ZS", "SP.URB.TOTL.IN.ZS",
  "SP.POP.0014.TO.ZS", "SP.POP.1564.TO.ZS", "SP.POP.65UP.TO.ZS", "EN.POP.DNST"
];

const state = { section: "glance", country: null, live: null, mode: "rates", map: null };

const $ = (id) => document.getElementById(id);

function fmt(n, digits) {
  return Number(n).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function latest(id) {
  const rows = state.live?.[id];
  return rows && rows.length ? rows[rows.length - 1] : null;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function signal(value, label, detail) {
  return `<article class="signal"><strong>${esc(value)}</strong><p>${esc(label)}</p><span>${esc(detail)}</span></article>`;
}

function chartCard(title, caption, canvasId, tall) {
  return `<figure class="chart-card"><h2>${esc(title)}</h2><p>${esc(caption)}</p><div class="chart-box${tall ? " tall" : ""}"><canvas id="${canvasId}"></canvas></div></figure>`;
}

function figures(title, rows) {
  const body = rows.map((row) => `<tr><th>${esc(row[0])}</th><td>${esc(row[1])}</td></tr>`).join("");
  return `<details><summary>Full figures — ${esc(title)}</summary><table>${body}</table></details>`;
}

function destroyCharts() {
  if (state.map) {
    state.map.remove();
    state.map = null;
  }
  document.querySelectorAll("canvas").forEach((canvas) => {
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
  });
}

function hbar(canvasId, labels, values, suffix) {
  const canvas = $(canvasId);
  if (!canvas) return;
  new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: "#21694b", borderRadius: 4 }]
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => `${item.raw}${suffix}` } }
      },
      scales: { x: { ticks: { callback: (v) => suffix === "%" ? `${v}%` : v } } },
      maintainAspectRatio: false
    }
  });
}

function lines(canvasId, labels, series) {
  const canvas = $(canvasId);
  if (!canvas) return;
  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: series.map((item) => ({
        label: item.name,
        data: item.values,
        borderColor: item.color,
        backgroundColor: item.color,
        tension: 0.25,
        pointRadius: 3
      }))
    },
    options: { maintainAspectRatio: false }
  });
}

function pyramidChart() {
  const rows = state.country.pyramid;
  const canvas = $("pyramid");
  if (!canvas) return;
  new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.age),
      datasets: [
        { label: "Male", data: rows.map((row) => -row.male), backgroundColor: "#8f3d32" },
        { label: "Female", data: rows.map((row) => row.female), backgroundColor: "#21694b" }
      ]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      scales: { x: { ticks: { callback: (v) => Math.abs(v) } } },
      plugins: {
        tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${Math.abs(item.raw).toFixed(2)} million` } }
      }
    }
  });
}

function rateSeries() {
  const births = state.live?.["SP.DYN.CBRT.IN"];
  const deaths = state.live?.["SP.DYN.CDRT.IN"];
  if (!births?.length) return state.country.fallbackRates;
  const deathByYear = new Map(deaths.map((point) => [point.year, point.value]));
  return births.slice(-12).map((point) => ({
    year: point.year,
    births: Number(point.value.toFixed(1)),
    deaths: Number((deathByYear.get(point.year) || 0).toFixed(1))
  }));
}

function fertilitySeries() {
  const rows = state.live?.["SP.DYN.TFRT.IN"];
  if (!rows?.length) return state.country.fallbackFertility;
  return rows
    .filter((point, index) => Number(point.year) % 10 === 0 || index === rows.length - 1)
    .map((point) => ({ year: point.year, children: Number(point.value.toFixed(2)) }));
}

function populationSeries() {
  const rows = state.live?.["SP.POP.TOTL"];
  if (!rows?.length) return state.country.fallbackPopulation;
  return rows
    .filter((point, index) => Number(point.year) % 5 === 0 || index === rows.length - 1)
    .map((point) => ({ year: point.year, people: Number((point.value / 1e6).toFixed(1)) }));
}

function renderGlance() {
  const people = latest("SP.POP.TOTL");
  const urban = latest("SP.URB.TOTL.IN.ZS");
  const life = latest("SP.DYN.LE00.IN");
  const young = latest("SP.POP.0014.TO.ZS");
  const births = latest("SP.DYN.CBRT.IN");
  const deaths = latest("SP.DYN.CDRT.IN");
  const poverty = latest("SI.POV.NAHC");
  const literacy = latest("SE.ADT.LITR.ZS");
  const millions = people ? `${fmt(people.value / 1e6, 1)} million` : "57.5 million";
  const paths = [
    ["people", "People", "Still a young country", young ? `${fmt(young.value, 0)}% of people are under 15 (${young.year}).` : "About 1 in 3 people is under 15."],
    ["change", "Change", "Growth is slowing, not stopping", births && deaths ? `Births ${fmt(births.value, 1)} and deaths ${fmt(deaths.value, 1)} per 1,000 (${births.year}).` : "Births are about 27 per 1,000. Deaths are about 7."],
    ["living", "Livelihoods", "Growth has not lifted everyone", poverty ? `${fmt(poverty.value, 1)}% were below the national poverty line in ${poverty.year}.` : "Nearly 2 in 5 people were below the national poverty line in 2022."],
    ["learning", "Learning", "School access is ahead of degrees", literacy ? `${fmt(literacy.value, 1)}% of adults could read in ${literacy.year}.` : "Most adults can read. Few hold a degree."]
  ];
  return `
    <h2>A young country, still growing into its workforce.</h2>
    <p class="answer">Kenya has about ${esc(millions)}. Families are smaller than in the 1960s, but births still far outnumber deaths, so the population keeps rising. Most people live outside cities. Getting into school is common. Leaving with a degree, or with a steady cash income, is not.</p>
    <div class="signals">
      ${signal(people ? `${fmt(people.value / 1e6, 1)}M` : "57.5M", "People", people ? `World Bank, ${people.year}` : "2025 estimate")}
      ${signal("21", "Median age", "Years, around 2025")}
      ${signal(urban ? `${fmt(urban.value, 0)}%` : "30%", "In towns and cities", urban ? `World Bank, ${urban.year}` : "Urban share")}
      ${signal(life ? fmt(life.value, 1) : "64", "Years of life", life ? `World Bank, ${life.year}` : "Life expectancy")}
    </div>
    <h2>Pick a question</h2>
    <div class="paths">
      ${paths.map((path) => `<button class="path" data-go="${path[0]}"><p class="eyebrow">${esc(path[1])}</p><h3>${esc(path[2])}</h3><p>${esc(path[3])}</p></button>`).join("")}
    </div>`;
}

function renderPeople() {
  const young = latest("SP.POP.0014.TO.ZS");
  const working = latest("SP.POP.1564.TO.ZS");
  const older = latest("SP.POP.65UP.TO.ZS");
  const urban = latest("SP.URB.TOTL.IN.ZS");
  const pop = latest("SP.POP.TOTL");
  const growth = latest("SP.POP.GROW");
  const prior = state.live?.["SP.POP.TOTL"]?.at(-2);
  return `
    <h2>Who lives in Kenya?</h2>
    <p class="answer">Kenya is young, almost evenly split between women and men, and still mostly rural. There are many ethnic communities; none is a majority on its own.</p>
    <div class="signals three">
      ${signal(young ? `${fmt(young.value, 0)}%` : "36%", "Children under 15", working && older ? `${fmt(working.value, 0)}% working age, ${fmt(older.value, 0)}% are 65+.` : "About 61% are working age.")}
      ${signal("50 / 50", "Women and men", "98.9 men for every 100 women.")}
      ${signal(urban ? `${fmt(100 - urban.value, 0)}%` : "70%", "Rural", urban ? `${fmt(urban.value, 0)}% live in urban areas (${urban.year}).` : "About 30% live in urban areas.")}
    </div>
    ${chartCard("Age and sex", "Each bar is millions of people in 2024. The wide base is why the country stays young.", "pyramid", true)}
    <div class="two-col">
      ${chartCard("Largest ethnic communities", "Share of the population, 2019 census.", "ethnic", true)}
      ${chartCard("Religion", "2019 census. Christianity is about 85% when the Christian groups are added.", "religion", true)}
    </div>
    ${figures("people", [
      ["Population", pop ? `${fmt(pop.value / 1e6, 2)} million (${pop.year})` : "57.5 million (2025)"],
      ["Prior year", prior ? `${fmt(prior.value / 1e6, 2)} million (${prior.year})` : "56.4 million (2024)"],
      ["Annual growth", growth ? `${fmt(growth.value, 2)}% (${growth.year})` : "About 1.9%"],
      ["Median age", "About 21 years"],
      ["Sex ratio", "98.9 males per 100 females"],
      ["Ages 0–14 / 15–64 / 65+", young && working && older ? `${fmt(young.value, 1)}% / ${fmt(working.value, 1)}% / ${fmt(older.value, 1)}%` : "36.3% / 60.7% / 3.0%"],
      ["Urban share", urban ? `${fmt(urban.value, 1)}% (${urban.year})` : "About 30%"],
      ["Official languages", "English and Kiswahili"]
    ])}`;
}

function renderChange() {
  const births = latest("SP.DYN.CBRT.IN");
  const deaths = latest("SP.DYN.CDRT.IN");
  const tfr = latest("SP.DYN.TFRT.IN");
  const life = latest("SP.DYN.LE00.IN");
  const lifeF = latest("SP.DYN.LE00.FE.IN");
  const lifeM = latest("SP.DYN.LE00.MA.IN");
  const note = state.live ? "World Bank annual series." : "Saved briefing series.";
  const modes = [
    ["rates", "Births and deaths"],
    ["fertility", "Family size"],
    ["size", "Population size"]
  ];
  let chart = "";
  if (state.mode === "rates") chart = chartCard("Births still dwarf deaths", `Per 1,000 people. ${note}`, "rates");
  if (state.mode === "fertility") chart = chartCard("Family size has more than halved", `Children per woman. ${note} Replacement is about 2.1.`, "fertility");
  if (state.mode === "size") chart = chartCard("Population size", `Mid-year population, millions. ${note}`, "size");
  return `
    <h2>Is the population still growing fast?</h2>
    <p class="answer">Yes, but more slowly than a generation ago. A typical woman has about ${esc(tfr ? fmt(tfr.value, 1) : "3.2")} children, down from nearly 8 in the 1960s. The population keeps rising because so many people are still young.</p>
    <div class="signals three">
      ${signal(births ? fmt(births.value, 1) : "27", "Births per 1,000", births ? `World Bank, ${births.year}` : "2024 estimate")}
      ${signal(deaths ? fmt(deaths.value, 1) : "7.2", "Deaths per 1,000", deaths ? `World Bank, ${deaths.year}` : "2024 estimate")}
      ${signal(tfr ? fmt(tfr.value, 2) : "3.2", "Children per woman", tfr ? `World Bank, ${tfr.year}` : "2024")}
    </div>
    <div class="mode-row" role="tablist">
      ${modes.map((item) => `<button type="button" data-mode="${item[0]}" aria-selected="${state.mode === item[0]}">${esc(item[1])}</button>`).join("")}
    </div>
    ${chart}
    <div class="note warn"><h2>Two different birth numbers, both real</h2><p>UN-style estimates put the crude birth rate near 27 per 1,000 and fertility near 3.2. Kenya’s civil registration report for 2024 shows a registered crude birth rate of 21.2 and registered fertility of 2.3. Registered events only count what was filed.</p></div>
    ${figures("change", [
      ["Life expectancy", life ? `${fmt(life.value, 1)} years (${life.year})${lifeF && lifeM ? ` — women ${fmt(lifeF.value, 1)}, men ${fmt(lifeM.value, 1)}` : ""}` : "64 years"],
      ["Registered crude birth rate, 2024", "21.2 per 1,000 (KNBS)"],
      ["Registered fertility, 2024", "2.3 children (KNBS)"]
    ])}`;
}

function renderLiving() {
  const gdp = latest("NY.GDP.PCAP.CD");
  const poverty = latest("SI.POV.NAHC");
  const growth = latest("NY.GDP.MKTP.KD.ZG");
  return `
    <h2>How do people get by?</h2>
    <p class="answer">Kenya is a lower-middle-income country with steady growth, but a large share of people still live in poverty — especially in rural areas and among adults with little schooling.</p>
    <div class="signals three">
      ${signal(gdp ? `$${fmt(gdp.value, 0)}` : "$2,363", "GDP per person", gdp ? `World Bank, ${gdp.year}` : "Current US dollars, 2025")}
      ${signal(poverty ? `${fmt(poverty.value, 1)}%` : "40%", "National poverty", poverty ? `World Bank, ${poverty.year}` : "Headcount, 2022")}
      ${signal(growth ? `${fmt(growth.value, 1)}%` : "4.6%", "Economy growth", growth ? `Real GDP, World Bank ${growth.year}` : "Real GDP")}
    </div>
    ${chartCard("Schooling and poverty move together", "Share of people in poverty by the education of adults in the household, 2022.", "poverty")}
    ${chartCard("Where the economy sits", "Approximate share of GDP. Manufacturing is already counted inside industry.", "economy")}
    ${figures("livelihoods", [
      ["National poverty line", poverty ? `${fmt(poverty.value, 1)}% (${poverty.year})` : "39.8% (2022)"],
      ["Rural vs urban poverty, 2022", "58% rural, 18% urban"],
      ["Income group", "Lower-middle income"]
    ])}`;
}

function renderLearning() {
  const literacy = latest("SE.ADT.LITR.ZS");
  const steps = state.country.learning.map((step, index) => (
    index === 0 && literacy
      ? { ...step, share: Number(literacy.value.toFixed(1)), who: `Ages 15+, World Bank ${literacy.year}` }
      : step
  ));
  return `
    <h2>How far does school go?</h2>
    <p class="answer">Kenya gets children into school. It does not yet get most adults through secondary school, and only a small share hold a university degree.</p>
    <ol class="ladder">
      ${steps.map((step, index) => `<li class="chart-card"><p class="eyebrow">Step ${index + 1}</p><strong>${esc(String(step.share))}%</strong><p>${esc(step.step)}</p><div class="bar"><i style="width:${step.share}%"></i></div><span>${esc(step.who)}</span></li>`).join("")}
    </ol>
    <div class="note"><h2>A recent exam snapshot</h2><p>27% of 2025 KCSE candidates scored C+ or above — about 270,715 of 993,000 candidates. That grade is the usual direct university entry line. It is one exam year, not the share of all adults with a degree.</p></div>`;
}

function renderPlaces() {
  const density = latest("EN.POP.DNST");
  const lists = state.country.cities.map((group) => `
    <section class="place-list"><h3>${esc(group.region)}</h3><ul>
      ${group.places.map((place) => `<li><strong>${esc(place.name)}</strong><p>${esc(place.role)}</p><span>${esc(place.note)}</span></li>`).join("")}
    </ul></section>`).join("");
  return `
    <h2>Where is life concentrated?</h2>
    <p class="answer">Kenya has 47 counties, but people, jobs, and services bunch in a handful of cities. Tap a county or a city dot.</p>
    <div class="signals three">
      ${signal("47", "Counties", "Shown on the map")}
      ${signal(density ? fmt(density.value, 0) : "99", "People per km²", density ? `World Bank, ${density.year}` : "National average")}
      ${signal("5M+", "Nairobi metro", "Largest urban area")}
    </div>
    <div id="kenya-map" class="kenya-map"></div>
    ${lists}`;
}

function renderNotes() {
  return `
    <h2>Which number should I trust?</h2>
    <p class="answer">Treat this as a briefing, not a statistical release. Years differ because censuses, surveys, and projections are not updated on the same day.</p>
    <div class="note"><h2>Live figures</h2><p>Population, births, deaths, fertility, life expectancy, GDP, poverty, literacy, urban share, and density are requested in the browser from the World Bank API for Kenya. If that request fails, the page keeps the saved figures in data/country.json.</p></div>
    <div class="note"><h2>Census figures</h2><p>Ethnicity and religion are from the 2019 census. They will not match a 2025 population total. The age pyramid is a rounded UN 2024 series.</p></div>
    <div class="note"><h2>Registration versus estimates</h2><p>KNBS registered births and deaths count certificates that were filed. They run lower than UN and World Bank estimates. Use registration when you mean recorded events.</p></div>
    <div class="note"><h2>The map</h2><p>County outlines are geoBoundaries. City dots are the main urban centres, not every town. Tiles are OpenStreetMap.</p></div>`;
}

const views = {
  glance: renderGlance,
  people: renderPeople,
  change: renderChange,
  living: renderLiving,
  learning: renderLearning,
  places: renderPlaces,
  notes: renderNotes
};

function draw() {
  if (state.section === "people") {
    pyramidChart();
    hbar("ethnic", state.country.ethnic.map((row) => row.name), state.country.ethnic.map((row) => row.share), "%");
    hbar("religion", state.country.religion.map((row) => row.name), state.country.religion.map((row) => row.share), "%");
  }
  if (state.section === "change") {
    if (state.mode === "rates") {
      const rows = rateSeries();
      lines("rates", rows.map((row) => row.year), [
        { name: "Births", values: rows.map((row) => row.births), color: "#21694b" },
        { name: "Deaths", values: rows.map((row) => row.deaths), color: "#8f3d32" }
      ]);
    }
    if (state.mode === "fertility") {
      const rows = fertilitySeries();
      lines("fertility", rows.map((row) => row.year), [
        { name: "Children per woman", values: rows.map((row) => row.children), color: "#21694b" }
      ]);
    }
    if (state.mode === "size") {
      const rows = populationSeries();
      lines("size", rows.map((row) => row.year), [
        { name: "Population (millions)", values: rows.map((row) => row.people), color: "#21694b" }
      ]);
    }
  }
  if (state.section === "living") {
    hbar("poverty", state.country.povertySchool.map((row) => row.level), state.country.povertySchool.map((row) => row.rate), "%");
    hbar("economy", state.country.economy.map((row) => row.sector), state.country.economy.map((row) => row.share), "%");
  }
  if (state.section === "places") initMap();
}

function render() {
  destroyCharts();
  $("view").innerHTML = views[state.section]();
  document.querySelectorAll("#section-nav button").forEach((button) => {
    button.setAttribute("aria-current", button.dataset.section === state.section ? "true" : "false");
  });
  $("view").querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => openSection(button.dataset.go));
  });
  $("view").querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      render();
    });
  });
  draw();
}

function openSection(id) {
  state.section = id;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function initMap() {
  const holder = $("kenya-map");
  if (!holder || typeof L === "undefined") return;
  state.map = L.map(holder, { scrollWheelZoom: false }).setView([0.35, 37.9], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(state.map);
  const urls = [
    "./data/kenya-counties.geojson",
    "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/KEN/ADM1/geoBoundaries-KEN-ADM1_simplified.geojson"
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const geo = await response.json();
      if (!state.map) return;
      L.geoJSON(geo, {
        style: { color: "#153e32", weight: 1, fillColor: "#21694b", fillOpacity: 0.15 },
        onEachFeature: (feature, layer) => {
          const name = feature.properties && feature.properties.shapeName;
          if (name) layer.bindPopup(document.createTextNode(name));
        }
      }).addTo(state.map);
      break;
    } catch (error) {
      console.error(error);
    }
  }
  state.country.pins.forEach((pin) => {
    L.circleMarker([pin.lat, pin.lng], {
      radius: pin.name === "Nairobi" ? 8 : 6,
      color: "#fff",
      weight: 2,
      fillColor: "#8f3d32",
      fillOpacity: 1
    }).bindPopup(`<strong>${esc(pin.name)}</strong><br>${esc(pin.role)}`).addTo(state.map);
  });
}

async function loadWorldBank() {
  try {
    const series = {};
    await Promise.all(WB.map(async (id) => {
      const response = await fetch(`https://api.worldbank.org/v2/country/KEN/indicator/${id}?format=json&per_page=70`);
      if (!response.ok) {
        series[id] = [];
        return;
      }
      const json = await response.json();
      const rows = Array.isArray(json[1]) ? json[1] : [];
      series[id] = rows
        .filter((row) => typeof row.value === "number")
        .map((row) => ({ year: row.date, value: row.value }))
        .sort((a, b) => a.year.localeCompare(b.year));
    }));
    state.live = series;
    $("live-status").textContent = "Live World Bank figures";
    render();
  } catch (error) {
    console.error(error);
    $("live-status").textContent = "Showing saved figures";
  }
}

async function boot() {
  const response = await fetch("./data/country.json");
  state.country = await response.json();
  $("section-nav").innerHTML = state.country.sections
    .map((section) => `<button type="button" data-section="${section.id}">${esc(section.label)}</button>`)
    .join("");
  $("section-nav").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) openSection(button.dataset.section);
  });
  render();
  loadWorldBank();
}

boot();
