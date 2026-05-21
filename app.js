// CONFIGURATIE - Vul jullie eigen Adafruit IO gegevens in
const AIO_USERNAME = "Jazperz";
const AIO_KEY = "aio_sLMF58nQvIuTM2y64znbWtIhuaQ6";

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

// Algemene functie om de laatste waarde uit een feed te trekken
async function fetchLastValue(feedKey) {
    const url = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${feedKey}/data/last`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'X-AIO-Key': AIO_KEY }
        });
        if (!response.ok) throw new Error(`Feed ${feedKey} onbereikbaar of bestaat niet`);
        return await response.json();
    } catch (error) {
        console.error(`Fout bij ophalen van ${feedKey}:`, error);
        return null;
    }
}

// Hoofdfunctie om alle sensoren te updaten op het scherm
async function updateDashboard() {
    console.log("Weerstation data synchroniseren (elke 10s)...");

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
    if (buitenTempData) {
        document.getElementById('buiten-temp').innerText = `${parseFloat(buitenTempData.value).toFixed(1)} °C`;
        const timestamp = new Date(buitenTempData.created_at);
        document.getElementById('update-time').innerText = timestamp.toLocaleTimeString('nl-NL');
    }

    // 2. Luchtvochtigheid
    if (humidityData) {
        document.getElementById('luchtvochtigheid').innerText = `${parseInt(humidityData.value)} %`;
    }

    // 3. Luchtdruk
    if (pressureData) {
        document.getElementById('luchtdruk').innerText = `${parseInt(pressureData.value)} hPa`;
    }

    // 4. Luchtkwaliteit (Met status, score én de kleine MΩ waarde eronder)
    if (gasData) {
        const aq = getAirQualityInfo(gasData.value);
        const aqElement = document.getElementById('luchtkwaliteit');
        
        // We bouwen de HTML hier dynamisch op zodat de MΩ waarde er klein onder komt te staan
        aqElement.innerHTML = `
            <div>${aq.status} <span class="text-xl sm:text-2xl font-bold opacity-90">(${aq.scoreTekst})</span></div>
            <span class="block text-xs font-normal text-gray-400 mt-1 tracking-normal">Ruwe weerstand: ${aq.rawFormatted}</span>
        `;
        aqElement.className = `text-2xl sm:text-3xl lg:text-4xl font-black my-4 transition-colors duration-500 ${aq.color}`;
    }

    // 5. Wind Snelheid & Richting
    if (windSpeedData) {
        document.getElementById('wind-snelheid').innerText = `${parseFloat(windSpeedData.value).toFixed(1)} km/u`;
    }
    if (windDirData) {
        document.getElementById('wind-richting').innerText = `Richting: ${windDirData.value}`;
    }

    // 6. Neerslag
    if (rainData) {
        document.getElementById('neerslag').innerText = `${parseFloat(rainData.value).toFixed(1)} mm`;
    }

    // 7. Interne BME Temp
    if (bmeTempData) {
        document.getElementById('bme-temp').innerText = `${parseFloat(bmeTempData.value).toFixed(1)} °C`;
    }

    // 8. Daken Info (Nu volledig functioneel voor Groen, Gewoon en Grijs)
    if (dakenInfoData) {
        const tekst = dakenInfoData.value; // Verwacht formaat: "Groen: 17.2C | Gewoon: 21.0C | Grijs: 19.5C"
        const groenDakElement = document.getElementById('groen-dak-temp');
        const gewoonDakElement = document.getElementById('gewoon-dak-temp');
        const grijsDakElement = document.getElementById('grijs-dak-temp');
        
        if (groenDakElement && gewoonDakElement && grijsDakElement) {
            try {
                // Splits de string op het '|' teken
                const delen = tekst.split('|');
                
                // Vul alle drie de vakjes in en haal de labels zoals "Grijs:" weg
                groenDakElement.innerText = delen[0].replace('Groen:', '').trim();
                gewoonDakElement.innerText = delen[1].replace('Gewoon:', '').trim();
                grijsDakElement.innerText = delen[2].replace('Grijs:', '').trim();
            } catch (e) {
                console.error("Fout bij het splitsen van dakenInfo string:", e);
                groenDakElement.innerText = tekst; // Fallback mocht de string breken
            }
        }
    }
}

// Direct uitvoeren bij openen pagina
updateDashboard();

// Om de 10 seconden automatisch verversen
setInterval(updateDashboard, 10000);