// CONFIGURATIE - De hoofd-URL van je Vercel backend
const PROXY_URL = "https://weerstation-backend.vercel.app"; 

const FEEDS = {
    buitenTemp: "bme-temp",
    luchtvochtigheid: "bme-hum",
    luchtdruk: "bmp-druk",
    luchtkwaliteit: "bme-gas",
    windSnelheid: "wind-snelheid",
    windRichting: "wind-richting",
    neerslag: "regen",
    bmeTemp: "bme-temp",
    dakenInfo: "daken-info",
    gevoelstemp: "gevoelstemp"
};

// Functie om de weerstand om te zetten naar een score, status én nette MΩ/kΩ waarde
function getAirQualityInfo(weerstand) {
    const val = parseInt(weerstand);
    
    // 1. Bereken een score op 10 (10 miljoen of hoger = 10/10)
    let score = (val / 10000000) * 10;
    if (score > 10) score = 10;
    if (score < 1) score = 1;
    const scoreTekst = score.toFixed(1) + "/10";

    // 2. Ruwe waarde versimpelen naar MΩ (Mega-ohm) of kΩ (Kilo-ohm)
    let rawFormatted = "";
    if (val >= 1000000) {
        rawFormatted = (val / 1000000).toFixed(1) + " MΩ";
    } else if (val >= 1000) {
        rawFormatted = (val / 1000).toFixed(1) + " kΩ";
    } else {
        rawFormatted = val + " Ω";
    }

    // 3. Status en kleur bepalen
    if (val > 10000000) return { status: "Uitstekend", scoreTekst, rawFormatted, color: "text-green-400" };
    if (val > 5000000)  return { status: "Goed", scoreTekst, rawFormatted, color: "text-blue-400" };
    if (val > 1000000)  return { status: "Matig", scoreTekst, rawFormatted, color: "text-yellow-400" };
    return { status: "Slecht", scoreTekst, rawFormatted, color: "text-red-500" };
}

// Algemene functie om de laatste waarde uit een feed te trekken via de Vercel-proxy
async function fetchLastValue(feedKey) {
    // We plakken hier het exacte api pad achter de hoofd proxy URL
    const url = `${PROXY_URL}/api/weerdata?feed=${feedKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Feed ${feedKey} onbereikbaar via proxy`);
        return await response.json();
    } catch (error) {
        console.error(`Fout bij ophalen via proxy voor ${feedKey}:`, error);
        return null;
    }
}

// Hoofdfunctie om alle sensoren te updaten op het scherm
async function updateDashboard() {
    console.log("Weerstation data via Vercel proxy synchroniseren (elke 10s)...");

    // Haal alle data parallel (tegelijkertijd) op voor maximale snelheid
    const [
        buitenTempData, humidityData, pressureData, gasData,
        windSpeedData, windDirData, rainData, bmeTempData,
        dakenInfoData
    ] = await Promise.all([
        fetchLastValue(FEEDS.buitenTemp),
        fetchLastValue(FEEDS.luchtvochtigheid),
        fetchLastValue(FEEDS.luchtdruk),
        fetchLastValue(FEEDS.luchtkwaliteit),
        fetchLastValue(FEEDS.windSnelheid),
        fetchLastValue(FEEDS.windRichting),
        fetchLastValue(FEEDS.neerslag),
        fetchLastValue(FEEDS.bmeTemp),
        fetchLastValue(FEEDS.dakenInfo)
    ]);

    // ---- DATA IN DE HTML PLAATSEN ----

    // 1. Buiten Temperatuur
    if (buitenTempData && buitenTempData.value) {
        document.getElementById('buiten-temp').innerText = `${parseFloat(buitenTempData.value).toFixed(1)} °C`;
        const timestamp = new Date(buitenTempData.created_at);
        document.getElementById('update-time').innerText = timestamp.toLocaleTimeString('nl-NL');
    }

    // 2. Luchtvochtigheid
    if (humidityData && humidityData.value) {
        document.getElementById('luchtvochtigheid').innerText = `${parseInt(humidityData.value)} %`;
    }

    // 3. Luchtdruk
    if (pressureData && pressureData.value) {
        document.getElementById('luchtdruk').innerText = `${parseInt(pressureData.value)} hPa`;
    }

    // 4. Luchtkwaliteit
    if (gasData && gasData.value) {
        const aq = getAirQualityInfo(gasData.value);
        const aqElement = document.getElementById('luchtkwaliteit');
        
        aqElement.innerHTML = `
            <div>${aq.status} <span class="text-xl sm:text-2xl font-bold opacity-90">(${aq.scoreTekst})</span></div>
            <span class="block text-xs font-normal text-gray-400 mt-1 tracking-normal">Ruwe weerstand: ${aq.rawFormatted}</span>
        `;
        aqElement.className = `text-2xl sm:text-3xl lg:text-4xl font-black my-4 transition-colors duration-500 ${aq.color}`;
    }

    // 5. Wind Snelheid & Richting
    if (windSpeedData && windSpeedData.value) {
        document.getElementById('wind-snelheid').innerText = `${parseFloat(windSpeedData.value).toFixed(1)} km/u`;
    }
    if (windDirData && windDirData.value) {
        document.getElementById('wind-richting').innerText = `Richting: ${windDirData.value}`;
    }

    // 6. Neerslag
    if (rainData && rainData.value) {
        document.getElementById('neerslag').innerText = `${parseFloat(rainData.value).toFixed(1)} mm`;
    }

    // 7. Interne BME Temp
    if (bmeTempData && bmeTempData.value) {
        document.getElementById('bme-temp').innerText = `${parseFloat(bmeTempData.value).toFixed(1)} °C`;
    }

    // 8. Daken Info
    if (dakenInfoData && dakenInfoData.value) {
        const tekst = dakenInfoData.value; 
        const groenDakElement = document.getElementById('groen-dak-temp');
        const gewoonDakElement = document.getElementById('gewoon-dak-temp');
        const grijsDakElement = document.getElementById('grijs-dak-temp');
        
        if (groenDakElement && gewoonDakElement && grijsDakElement) {
            try {
                const delen = tekst.split('|');
                groenDakElement.innerText = delen[0].replace('Groen:', '').trim();
                gewoonDakElement.innerText = delen[1].replace('Gewoon:', '').trim();
                grijsDakElement.innerText = delen[2].replace('Grijs:', '').trim();
            } catch (e) {
                console.error("Fout bij het splitsen van dakenInfo string:", e);
                groenDakElement.innerText = tekst; 
            }
        }
    }
}

// Direct uitvoeren bij openen pagina
updateDashboard();

// Om de 10 seconden automatisch verversen
setInterval(updateDashboard, 10000);
