# Shelly Live Tariff Skript

> [!TIP]
> Selle skripti abil saate vaadata oma koduse elektritarbimise täpset maksumust Shelly Cloudis iga energia monitooringut võimaldava [Shelly seadmega.](https://www.shelly.com/collections/energy-metering)

- [Shelly Live Tariff Skript](#shelly-live-tariff-skript)
  - [Omadused](#omadused)
  - [Paigaldamine](#paigaldamine)
    - [Uus paigaldus](#uus-paigaldus)
    - [Skripti Virtual Componentide häälestamine](#skripti-virtual-componentide-häälestamine)
    - [Kuidas panna skript tööle KVS-modes](#kuidas-panna-skript-tööle-kvs-modes)
    - [Skripti KVS häälestamine](#skripti-kvs-häälestamine)
    - [Shelly Live Tariff häälestamine](#shelly-live-tariff-häälestamine)
  - [Kasutamine](#kasutamine)
    - [Shelly häälestamine](#shelly-häälestamine)
    - [Rahalise kulu monitoorimine](#rahalise-kulu-monitoorimine)
    - [Skripti monitoorimine](#skripti-monitoorimine)
  - [Litsents](#litsents)
  - [Autor](#autor)


<img src="images/TotalEnergyUsage.jpg" alt="Shelly Live Tariff" width="500">

## Omadused

See Shelly skript automatiseerib elektritariifi Shelly pilves. Elektri börsihinnad laetakse alla Eleringi API kaudu ja Shelly Live Tariff uuendatakse iga tunni järel.

- Börsihindade allalaadimine Eleringi API kaudu.
- Shelly Cloud Live Tariff uuendamine iga tunni järel.
- Toetab Elektrilevi ja Imatra võrgupakette ja nelja riiki.
- Salvestab kasutaja seaded Shelly KVS-i või Virtuaalsetesse komponentidesse (gen2 Pro või gen3 seadmete korral).
- Skript käivitub automaatselt Shelly käivitumisel.

## Paigaldamine

### Uus paigaldus
1. Kopeerige `ShellyLiveTariff.js` sisu oma Shelly seadme skriptiredaktorisse.
2. Käivita script et tekitada Virtual Komponendid või JSON parameetrid KVS-i.
3. Konfigureerige skripti seaded.
4. Käivitage uuesti skript. Nüüd on kõik täisautomaatne ja rohkem midagi muuta pole tarvis.
   - `networkPacket`: Valige sobiv võrgupakett (nt `VORK2`, `Partner24` jne).
   - `country`: Määrake riigi kood (nt `ee` Eesti jaoks, `fi` Soome jaoks jne).
   - `apiUrl`: Siia pange oma Shelly Cloud token.

### Skripti Virtual Componentide häälestamine

Shelly Gen2 Pro ja Gen3 seadmed toetavad **Virtuaalseid Komponente**, kõiki seadeid saab hallata otse Shelly Cloud veebilehelt või mobiilirakendusest.
Pane kõik vajalikud seaded, nagu API url, võrgupakett ja muidugi riik.

> [!NOTE]
> Iga kord kui skript uuendab Shelly pilves tariifi, kirjutatakse vastav kuupäev ja kellaaeg väljale  **Live Tariff Updated**.

<img src="images/ShellyVirtualCompLiveTariff.jpg" alt="Enable Shelly Live Tariff" width="300">

### Kuidas panna skript tööle KVS-modes

> [!TIP]
> See skript võib käia ka KVS-modes isegi kui Virtuaalsed Komponendid on saadaval.

Seda häälestust on vaja juhul, kui antud Shelly seadme peal on juba mõni teine skript mis kasutab Virtuaalseid Komponente.
Ava skript ja pane ManualKVS parameeter ``mnKv: true``. Peale seda installeerub skript KVS-modes.

```js
let c = {
    pack: "VORK2",     // ELEKTRILEVI/IMATRA transmission fee: NONE, VORK1, VORK2, VORK4, VORK5, PARTN24, PARTN24PL, PARTN12, PARTN12PL
    cnty: "ee",        // Estonia-ee, Finland-fi, Lithuania-lt, Latvia-lv
    api: "API_url",    // Shelly Cloud token
    mnKv: false,       // Forcing KVS mode in case of Virtual components support
}
```

### Skripti KVS häälestamine

Kui skript on **KVS-modes**, saab seadeid muuta seadme veebilehe kaudu, kasutades selle IP-aadressi: Menu → Advanced → KVS.  
Kõik kasutaja häälestused asuvad JSON formaadis parameetri ``LiveTariffConf`` all.
   - `API`: Shelly Cloud API token.
   - `EnergyProvider`: kirjuta siia võrgupaketi nimi (e.g., `VORK2`, `PARTN24`, etc.).
   - `Country`: riigikood (e.g., `ee` for Estonia, `fi` for Finland, etc.).

<img src="images/KvsLiveTariff.jpg" alt="Enable Shelly Live Tariff" width="400">

**Võrgupaketid**

Skript toetab järgmisi [Elektrilevi](https://elektrilevi.ee/en/vorguleping/vorgupaketid/eramu) ja [Imatra](https://imatraelekter.ee/vorguteenus/vorguteenuse-hinnakirjad/) võrgupakette:

- `VORK1`
- `VORK2`
- `VORK4`
- `VORK5`
- `Partner24`
- `Partner24Plus`
- `Partner12`
- `Partner12Plus`
- `NONE`

**Toetatud Riigid**

- `ee` (Eesti)
- `fi` (Soome)
- `lv` (Läti)
- `lt` (Leedu)

### Shelly Live Tariff häälestamine

Konfigureerige Shelly Cloud kasutama Live Tariffi
1. Avage Shelly Cloud keskkond
2. Valige Energy → Electricity Tariff
3. Tariffi all valige Live
4. Kopeerige API URL ja kleepige see skripti Live Tariffi seadistustesse.

<img src="images/EnableShellyLiveTariff.jpg" alt="Enable Shelly Live Tariff" width="750">

## Kasutamine

### Shelly häälestamine

Shelly seadmete seadistamiseks on mitmeid viise, et tagada Shelly Cloudi energiatarbimise kulude aruannete täpsus ja korrastatus.

1. Shelly Pro 3EM + Individuaalsed Shelly energia monitooringu seadmed asuvad samas ruumis. <br>
Et vältida energiakulude topeltarvestust ruumi või konto tasemel, tuleb seadmed õigesti seadistada:
   - Seadista Shelly Pro 3EM, et see kaasaks energiaseire nii ruumi kui ka konto tasemel.
   - Seadista teised Shelly seadmed samas ruumis nii, et need välistaksid oma andmed ruumi ja konto kogutarbimisest.

|||
|-|-|
|<img src="images/Configure3EM.jpg" alt="Shelly Live Tariff" width="200">|<img src="images/ConfigureDevice.jpg" alt="Shelly Live Tariff" width="200">|

2. Shelly Pro 3EM konto tasemel + Individuaalsed Shelly monitooringu seadmed erinevates ruumides. <br>
Et vältida energiakulu puudumist ruumis või topeltarvestust konto tasemel, tuleb seadmed õigesti seadistada:
   - Seadista Shelly Pro 3EM, et see kaasaks energiaseire konto tasemel.
   - Seadista teised Shelly seadmed, et need kaasaksid andmed ruumi tasemel ja välistaksid need konto kogutarbimisest.

|||
|-|-|
|<img src="images/Configure3EM.jpg" alt="Shelly Live Tariff" width="200">|<img src="images/ConfigureDeviceRoom.jpg" alt="Shelly Live Tariff" width="200">|

3. Individuaalsed Shelly energia monitooringu seadmed erinevates ruumides, konto taseme mõõtmine puudub. <br>
Et vältida energiakulude puudumist konto tasemel, tuleb seadmed õigesti seadistada:
   - Seadista iga Shelly seade, et see kaasaks energiaseire nii ruumi kui ka konto tasemel.

### Rahalise kulu monitoorimine

Elektri kulu monitoorimiseks on mitu võimalust.

1. **Kogukulu.** Ava Shelly Cloud [Total Energy history](https://control.shelly.cloud/#/cons/0) ja vaata kui suur on elektri kulu rahas kõikide Shelly seadmete peale kokku.  
<img src="images/TotalEnergyUsage.jpg" alt="Shelly Live Tariff" width="500">

2. **Ruumi kulu.** Ava Shelly Cloud [Total Energy history](https://control.shelly.cloud/#/cons/0), keri veidi allapoole ja vaata kui suur on iga üksiku ruumi elektrikulu rahas.   
<img src="images/RoomUsage.jpg" alt="Shelly Live Tariff" width="500">

3. **Faasi kulu.** See võimalus on ainult Shelly Pro 3EM omanikel. Ava Shelly elektrikulu vaheleht ja liigu hiire või näpuga üle graafiku, et näha iga iseseisva faasi või ka kogu seadet läbiva elektri rahalist kulu.  
<img src="images/3EMUsage.jpg" alt="Shelly Live Tariff" width="500">

4. **Seadme kulu.** Ava mõni energiamõõturiga Shelly seadme  elektrikulu vaheleht ja tutvu selle seadme rahalise kuluga. Nii saad vaadata detailselt näiteks oma külmiku töös hoidmise rahalist kulu.   
<img src="images/EnergyUsageCost.jpg" alt="Enable Shelly Live Tariff" width="300">

### Skripti monitoorimine 
- Virtuaalne komponent ``Live Tariff updated`` uuendatakse iga kord kui uus Live Tariff on saadetud Shelly Cloudi.
- Väljad ``LastCalculation`` ja ``TariffUpdated`` uuendatakse ``LiveTariffSys`` all KVS-s iga kord kui Eleringist on saadud uued börsihinnad ja uus tariif on saadetud Shelly Cloudi.
- Skript töötab automaatselt ja uuendab Shelly Cloud Live Tariffi iga tunni järel.
- Kui teie Shelly seade toetab Virtuaalseid komponente, saate seadeid muuta otse Shelly veebilehelt või Shelly mobiilirakendusest.
- Kasutaja seadete muutmine vanemate Shellyde korral kasutage selle IP-aadressi: Menu → Advanced → KVS.

<img src="images/LastUpdated.jpg" alt="Last Updated data in KVS" width="400">

## Litsents

See projekt on litsentseeritud [MIT LICENSE](LICENSE) litsentsi alusel. 

## Autor

Leivo Sepp, 07.01.2025

[Shelly Live Tariff - GitHub Repository](https://github.com/LeivoSepp/Shelly-Live-Tariff)